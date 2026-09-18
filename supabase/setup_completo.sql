-- =============================================================================
-- MercadoControl · INSTALACIÓN COMPLETA (0001 + 0002 + 0003)
-- Pega TODO este archivo en Supabase -> SQL Editor y pulsa Run. Es idempotente.
-- =============================================================================

-- >>>>>>>>>> migrations/0001_init.sql
-- =============================================================================
-- MercadoControl · Migración inicial
-- PostgreSQL / Supabase
-- Ejecutar en: Supabase Studio -> SQL Editor  (o `supabase db push`)
--
-- Contenido:
--   1. Extensiones
--   2. Enums (tipos de dominio)
--   3. Tablas: profiles, categories, products, inventory_logs,
--              waste_logs, daily_closures
--   4. Índices de rendimiento
--   5. Funciones + Triggers (timestamps, stock, PPC, pérdida, dinero salvado)
--   6. Row Level Security (RLS) — aislamiento total por comerciante
--   7. Seed de categorías globales
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONES
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 2. ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  -- Unidades de medida base para el stock
  create type unit_measure as enum (
    'kg', 'unidad', 'atado', 'saco', 'caja', 'docena', 'litro', 'bandeja'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Estado del semáforo de frescura (persistido y recalculado)
  create type freshness_state as enum ('verde', 'amarillo', 'rojo');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Dirección de un movimiento de inventario
  create type movement_type as enum ('entrada', 'salida', 'ajuste');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Motivos de merma (con su ícono asociado en la UI)
  create type waste_reason as enum (
    'malogrado',        -- 🗑️ Deterioro natural
    'corte_limpieza',   -- ✂️ Corte / limpieza / mermado
    'napa',             -- 🎁 Ñapa / fidelización
    'consumo_personal', -- 🍲 Consumo personal / almuerzo
    'remate',           -- 🔖 Vendido como remate (salida secundaria)
    'otro'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 3. TABLAS
-- -----------------------------------------------------------------------------

-- 3.1 profiles — un registro por comerciante (1:1 con auth.users)
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  stall_name     text,                       -- Nombre del puesto
  stall_type     text,                       -- 'frutas' | 'verduras' | 'abarrotes' | ...
  phone          text,                       -- Para catálogos de remate por WhatsApp
  money_saved    numeric(12, 2) not null default 0,  -- Métrica acumulada de dinero salvado
  currency       text not null default 'PEN',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.profiles is 'Datos del comerciante y métrica acumulada de dinero salvado.';
comment on column public.profiles.money_saved is 'Suma de pérdidas evitadas por vender/donar a tiempo productos en semáforo rojo/amarillo.';

-- 3.2 categories — globales (owner_id NULL) o personalizadas (owner_id = usuario)
create table if not exists public.categories (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references public.profiles (id) on delete cascade, -- NULL = global
  name               text not null,
  icon               text,                    -- nombre de ícono Lucide o emoji
  color              text,                    -- HEX opcional para la UI
  avg_shelf_life_days integer not null default 7 check (avg_shelf_life_days > 0),
  -- Umbral (0..1) del ciclo de vida donde pasa de verde->amarillo
  yellow_threshold   numeric(3, 2) not null default 0.50 check (yellow_threshold between 0 and 1),
  -- Umbral (0..1) donde pasa de amarillo->rojo
  red_threshold      numeric(3, 2) not null default 0.80 check (red_threshold between 0 and 1),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint categories_threshold_order check (yellow_threshold < red_threshold)
);

comment on table public.categories is 'Categorías globales y personalizadas con vida útil y umbrales del semáforo.';

-- 3.3 products — cada lote comprado de un producto
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete set null,
  name           text not null,
  batch_code     text,                        -- Lote (opcional, generado si falta)
  unit           unit_measure not null default 'kg',
  current_stock  numeric(12, 3) not null default 0 check (current_stock >= 0),
  initial_stock  numeric(12, 3) not null default 0,
  avg_cost       numeric(12, 4) not null default 0 check (avg_cost >= 0),  -- PPC
  sale_price     numeric(12, 4) not null default 0 check (sale_price >= 0),
  freshness      freshness_state not null default 'verde',
  entry_date     timestamptz not null default now(),   -- Ingreso del lote (base del semáforo)
  expires_at     timestamptz,                  -- Vencimiento explícito (opcional)
  photo_url      text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.products is 'Producto/lote con stock, PPC, precio y estado de frescura dinámico.';
comment on column public.products.avg_cost is 'Costo Promedio Ponderado (PPC), recalculado por trigger en cada entrada.';

-- 3.4 inventory_logs — trazabilidad de entradas / salidas / ajustes
create table if not exists public.inventory_logs (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  movement       movement_type not null,
  quantity       numeric(12, 3) not null check (quantity >= 0),
  unit_cost      numeric(12, 4),               -- Costo unitario en entradas (para el PPC)
  unit_price     numeric(12, 4),               -- Precio de venta en salidas
  note           text,
  source         text default 'manual',        -- 'manual' | 'voz' | 'foto_ia' | 'sync'
  created_at     timestamptz not null default now()
);

comment on table public.inventory_logs is 'Trazabilidad de entradas (compras) y salidas (ventas/ajustes).';

-- 3.5 waste_logs — mermas con pérdida monetaria calculada
create table if not exists public.waste_logs (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  reason         waste_reason not null,
  quantity       numeric(12, 3) not null check (quantity > 0),
  -- Pérdida monetaria = quantity * avg_cost del producto al momento (calculada por trigger)
  monetary_loss  numeric(12, 2) not null default 0,
  note           text,
  created_at     timestamptz not null default now()
);

comment on table public.waste_logs is 'Registro de mermas: cantidad, motivo y pérdida monetaria calculada.';

-- 3.6 daily_closures — cierre de caja / balance diario
create table if not exists public.daily_closures (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  closure_date      date not null default (now() at time zone 'America/Lima')::date,
  total_sales       numeric(12, 2) not null default 0,   -- Ventas del día
  total_waste_loss  numeric(12, 2) not null default 0,   -- Pérdida por merma
  inventory_capital numeric(12, 2) not null default 0,   -- Capital en inventario (stock * PPC)
  items_adjusted    integer not null default 0,
  note              text,
  created_at        timestamptz not null default now(),
  unique (owner_id, closure_date)                         -- Un cierre por día por comerciante
);

comment on table public.daily_closures is 'Cierres diarios: ventas, pérdida por merma y capital en inventario.';

-- -----------------------------------------------------------------------------
-- 4. ÍNDICES DE RENDIMIENTO
-- -----------------------------------------------------------------------------
create index if not exists idx_products_owner        on public.products (owner_id) where is_active;
create index if not exists idx_products_owner_fresh   on public.products (owner_id, freshness);
create index if not exists idx_products_category      on public.products (category_id);
create index if not exists idx_products_entry_date    on public.products (entry_date);

create index if not exists idx_inv_logs_owner_date    on public.inventory_logs (owner_id, created_at desc);
create index if not exists idx_inv_logs_product       on public.inventory_logs (product_id);

create index if not exists idx_waste_owner_date       on public.waste_logs (owner_id, created_at desc);
create index if not exists idx_waste_product          on public.waste_logs (product_id);

create index if not exists idx_closures_owner_date    on public.daily_closures (owner_id, closure_date desc);

create index if not exists idx_categories_owner       on public.categories (owner_id);

-- -----------------------------------------------------------------------------
-- 5. FUNCIONES Y TRIGGERS
-- -----------------------------------------------------------------------------

-- 5.1 updated_at automático
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles   before update on public.profiles
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_categories on public.categories;
create trigger trg_touch_categories before update on public.categories
  for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_products on public.products;
create trigger trg_touch_products   before update on public.products
  for each row execute function public.fn_touch_updated_at();

-- 5.2 Crear profile automáticamente al registrarse un usuario en auth
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, stall_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'stall_name', 'Mi Puesto')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- 5.3 Recálculo de stock + PPC a partir de inventory_logs
--     entrada -> aumenta stock y recalcula Costo Promedio Ponderado
--     salida/ajuste -> disminuye stock
create or replace function public.fn_apply_inventory_movement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_stock  numeric(12,3);
  v_cost   numeric(12,4);
begin
  select current_stock, avg_cost into v_stock, v_cost
    from public.products where id = new.product_id for update;

  if new.movement = 'entrada' then
    -- PPC = (valor_actual + valor_ingreso) / (stock_actual + cantidad_ingreso)
    if (v_stock + new.quantity) > 0 and new.unit_cost is not null then
      v_cost := round(
        ((v_stock * v_cost) + (new.quantity * new.unit_cost)) / (v_stock + new.quantity),
        4
      );
    end if;
    update public.products
       set current_stock = v_stock + new.quantity,
           avg_cost      = v_cost,
           entry_date    = case when v_stock <= 0 then now() else entry_date end
     where id = new.product_id;

  elsif new.movement = 'salida' then
    update public.products
       set current_stock = greatest(0, v_stock - new.quantity)
     where id = new.product_id;

  elsif new.movement = 'ajuste' then
    -- En ajuste, quantity representa el nuevo stock absoluto
    update public.products
       set current_stock = new.quantity
     where id = new.product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_inventory on public.inventory_logs;
create trigger trg_apply_inventory
  after insert on public.inventory_logs
  for each row execute function public.fn_apply_inventory_movement();

-- 5.4 Aplicar merma: descuenta stock, calcula pérdida y acumula money_saved
--     (la ñapa y el remate "salvan" dinero al no terminar en basura)
create or replace function public.fn_apply_waste()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cost numeric(12,4);
begin
  select avg_cost into v_cost from public.products
    where id = new.product_id for update;

  -- Pérdida monetaria al costo (si no viene precargada desde el cliente offline)
  if new.monetary_loss is null or new.monetary_loss = 0 then
    new.monetary_loss := round(new.quantity * coalesce(v_cost, 0), 2);
  end if;

  -- Descontar del stock
  update public.products
     set current_stock = greatest(0, current_stock - new.quantity)
   where id = new.product_id;

  -- "Dinero salvado": lo que se recupera al dar salida útil (ñapa/remate)
  -- en lugar de botarlo (malogrado). Suma el valor rescatado.
  if new.reason in ('napa', 'remate') then
    update public.profiles
       set money_saved = money_saved + round(new.quantity * coalesce(v_cost, 0), 2)
     where id = new.owner_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_waste on public.waste_logs;
create trigger trg_apply_waste
  before insert on public.waste_logs
  for each row execute function public.fn_apply_waste();

-- 5.5 Recalcular el semáforo de frescura de todos los productos de un dueño.
--     Regla: fracción = días_transcurridos / vida_útil.
--       < yellow_threshold          -> verde
--       entre yellow y red          -> amarillo
--       >= red_threshold o vencido  -> rojo
--     Llamada por RPC desde el cliente (o por un cron programado).
create or replace function public.fn_recalc_freshness(p_owner uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.products p
     set freshness = calc.state
    from (
      select
        pr.id,
        case
          when pr.expires_at is not null and pr.expires_at <= now() then 'rojo'::freshness_state
          when frac >= coalesce(c.red_threshold, 0.80)    then 'rojo'::freshness_state
          when frac >= coalesce(c.yellow_threshold, 0.50) then 'amarillo'::freshness_state
          else 'verde'::freshness_state
        end as state
      from public.products pr
      left join public.categories c on c.id = pr.category_id
      cross join lateral (
        select extract(epoch from (now() - pr.entry_date)) / 86400.0
             / greatest(coalesce(c.avg_shelf_life_days, 7), 1) as frac
      ) f
      where pr.owner_id = p_owner and pr.is_active
    ) calc
   where p.id = calc.id and p.freshness is distinct from calc.state;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.inventory_logs  enable row level security;
alter table public.waste_logs      enable row level security;
alter table public.daily_closures  enable row level security;

-- profiles: cada quien ve/edita su propio perfil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- categories: lectura de globales (owner_id IS NULL) + propias; escritura solo propias
drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select using (owner_id is null or owner_id = auth.uid());
drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (owner_id = auth.uid());
drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (owner_id = auth.uid());

-- Patrón "solo mis filas" para el resto de tablas
do $$
declare t text;
begin
  foreach t in array array['products','inventory_logs','waste_logs','daily_closures']
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (owner_id = auth.uid());', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. SEED — categorías globales típicas de mercado de abastos peruano
-- -----------------------------------------------------------------------------
insert into public.categories (owner_id, name, icon, color, avg_shelf_life_days, yellow_threshold, red_threshold)
values
  (null, 'Frutas',        '🍎', '#EF4444', 5,  0.45, 0.75),
  (null, 'Verduras',      '🥬', '#10B981', 4,  0.45, 0.75),
  (null, 'Tubérculos',    '🥔', '#F97316', 20, 0.55, 0.85),
  (null, 'Hierbas',       '🌿', '#065F46', 2,  0.40, 0.70),
  (null, 'Abarrotes',     '🍚', '#0F172A', 180,0.70, 0.90),
  (null, 'Huevos',        '🥚', '#F97316', 21, 0.55, 0.85),
  (null, 'Lácteos',       '🥛', '#F8FAFC', 10, 0.55, 0.85),
  (null, 'Carnes/Pollo',  '🍗', '#EF4444', 2,  0.40, 0.70)
on conflict do nothing;

-- =============================================================================
-- FIN DE LA MIGRACIÓN
-- =============================================================================


-- >>>>>>>>>> migrations/0002_sales.sql
-- =============================================================================
-- MercadoControl · Migración 0002 — Ventas con detalle (tickets)
-- Ejecutar en: Supabase Studio -> SQL Editor (después de 0001_init.sql)
--
-- Nota de diseño: sale_items es informativa. El stock se descuenta con los
-- inventory_logs (source = 'pos') que el cliente sube junto a cada venta y que ya
-- procesa el trigger fn_apply_inventory_movement; así no se descuenta dos veces.
-- =============================================================================

create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  ticket_number  text not null,
  customer_name  text,
  customer_phone text,
  payment_method text not null default 'efectivo'
                 check (payment_method in ('efectivo', 'yape', 'plin', 'tarjeta', 'otro')),
  subtotal       numeric(12, 2) not null check (subtotal >= 0),
  discount       numeric(12, 2) not null default 0 check (discount >= 0),
  total          numeric(12, 2) not null check (total >= 0),
  amount_paid    numeric(12, 2) check (amount_paid is null or amount_paid >= 0),
  note           text,
  created_at     timestamptz not null default now(),
  constraint sales_discount_le_subtotal check (discount <= subtotal)
);

create table if not exists public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  unit         unit_measure not null,
  quantity     numeric(12, 3) not null check (quantity > 0),
  unit_price   numeric(12, 4) not null check (unit_price >= 0),
  subtotal     numeric(12, 2) not null check (subtotal >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists idx_sales_owner_date on public.sales (owner_id, created_at desc);
create index if not exists idx_sale_items_sale on public.sale_items (sale_id);
create index if not exists idx_sale_items_owner_product on public.sale_items (owner_id, product_id);

alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sales', 'sale_items']
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (owner_id = auth.uid());', t);
  end loop;
end $$;


-- >>>>>>>>>> migrations/0003_team_credit_reports.sql
-- =============================================================================
-- MercadoControl · Migración 0003
--   · Stock mínimo por producto
--   · Costo unitario en el detalle de venta (para calcular ganancia real)
--   · Anulación de ventas
--   · Fiado: clientes + abonos
--   · Equipo: dueño + cajeros (roles) con RLS actualizada
-- Ejecutar en Supabase Studio -> SQL Editor, DESPUÉS de 0001 y 0002.
-- Es idempotente: se puede volver a ejecutar sin efectos secundarios.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas en tablas existentes
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists min_stock numeric(12, 3) not null default 0 check (min_stock >= 0);

alter table public.sale_items
  add column if not exists unit_cost numeric(12, 4) check (unit_cost is null or unit_cost >= 0);

-- -----------------------------------------------------------------------------
-- 2. Clientes y abonos (fiado)
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  phone      text,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_payments (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  customer_id    uuid not null references public.customers (id) on delete cascade,
  amount         numeric(12, 2) not null check (amount > 0),
  payment_method text not null default 'efectivo'
                 check (payment_method in ('efectivo', 'yape', 'plin', 'tarjeta', 'otro')),
  note           text,
  received_by    text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_customers_owner on public.customers (owner_id);
create index if not exists idx_credit_payments_customer on public.credit_payments (customer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Ventas: fiado, anulación y vendedor
-- -----------------------------------------------------------------------------
alter table public.sales add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.sales add column if not exists seller_name text;
alter table public.sales add column if not exists voided_at   timestamptz;
alter table public.sales add column if not exists void_reason text;

alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('efectivo', 'yape', 'plin', 'tarjeta', 'otro', 'fiado'));

create index if not exists idx_sales_customer on public.sales (customer_id) where customer_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Equipo: un dueño con cajeros
-- -----------------------------------------------------------------------------
create table if not exists public.stall_members (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  member_id  uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'cajero' check (role in ('cajero')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  constraint stall_members_not_self check (owner_id <> member_id)
);
-- Una persona solo puede ser cajero de UN puesto
create unique index if not exists uq_stall_members_member on public.stall_members (member_id);

alter table public.stall_members enable row level security;
alter table public.customers enable row level security;
alter table public.credit_payments enable row level security;

-- Helpers de acceso (SECURITY DEFINER para no recursar en las políticas)
create or replace function public.fn_is_stall_member(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.stall_members m
    where m.owner_id = p_owner and m.member_id = auth.uid()
  );
$$;

-- Lectura: el dueño o sus cajeros
create or replace function public.fn_can_read_stall(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_owner = auth.uid() or public.fn_is_stall_member(p_owner);
$$;

drop policy if exists "stall_members_select" on public.stall_members;
create policy "stall_members_select" on public.stall_members
  for select using (owner_id = auth.uid() or member_id = auth.uid());
drop policy if exists "stall_members_delete_owner" on public.stall_members;
create policy "stall_members_delete_owner" on public.stall_members
  for delete using (owner_id = auth.uid());
-- Las altas se hacen SOLO con la función add_stall_member (no hay política de insert)

-- -----------------------------------------------------------------------------
-- 5. RLS: dueño = todo; cajero = leer + vender + cobrar abonos
-- -----------------------------------------------------------------------------
-- profiles: el cajero puede LEER el perfil del dueño (nombre del puesto para el ticket)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.fn_is_stall_member(id));

-- Tablas donde SOLO el dueño escribe y el equipo lee
do $$
declare t text;
begin
  foreach t in array array['products', 'waste_logs', 'daily_closures']
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (public.fn_can_read_stall(owner_id));', t);
  end loop;
end $$;

-- Tablas donde el dueño Y el cajero pueden insertar (ventas, detalle, clientes, abonos)
do $$
declare t text;
begin
  foreach t in array array['sales', 'sale_items', 'customers', 'credit_payments']
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (public.fn_can_read_stall(owner_id));', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (public.fn_can_read_stall(owner_id));', t);
  end loop;
end $$;

-- Editar/borrar clientes y abonos: solo el dueño (ventas y detalle ya lo tienen desde 0002)
do $$
declare t text;
begin
  foreach t in array array['customers', 'credit_payments']
  loop
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (owner_id = auth.uid());', t);
  end loop;
end $$;

-- Movimientos de inventario: el cajero solo puede registrar SALIDAS de venta
drop policy if exists "inventory_logs_select_own" on public.inventory_logs;
create policy "inventory_logs_select_own" on public.inventory_logs
  for select using (public.fn_can_read_stall(owner_id));

drop policy if exists "inventory_logs_insert_own" on public.inventory_logs;
create policy "inventory_logs_insert_own" on public.inventory_logs
  for insert with check (
    owner_id = auth.uid()
    or (
      public.fn_is_stall_member(owner_id)
      and movement = 'salida'
      and source = 'pos'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Funciones para administrar el equipo (solo el dueño)
-- -----------------------------------------------------------------------------
create or replace function public.add_stall_member(p_email text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
  v_mail text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if v_mail = '' then raise exception 'Escribe un correo'; end if;

  select id into v_uid from auth.users where lower(email) = v_mail;
  if v_uid is null then
    raise exception 'Ese correo no tiene cuenta. Pídele que se registre primero';
  end if;
  if v_uid = auth.uid() then raise exception 'No puedes agregarte a ti mismo'; end if;
  if exists (select 1 from public.stall_members where member_id = auth.uid()) then
    raise exception 'Como cajero no puedes administrar un equipo';
  end if;
  if exists (select 1 from public.stall_members where owner_id = v_uid) then
    raise exception 'Esa cuenta ya administra su propio equipo';
  end if;
  if exists (select 1 from public.stall_members where member_id = v_uid) then
    raise exception 'Esa persona ya es cajero de otro puesto';
  end if;

  insert into public.stall_members (owner_id, member_id, role) values (auth.uid(), v_uid, 'cajero');
  return json_build_object('member_id', v_uid, 'email', v_mail);
end;
$$;

create or replace function public.list_stall_members()
returns table (member_id uuid, email text, full_name text, role text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select m.member_id,
         u.email::text,
         coalesce(u.raw_user_meta_data ->> 'full_name', '')::text,
         m.role,
         m.created_at
    from public.stall_members m
    join auth.users u on u.id = m.member_id
   where m.owner_id = auth.uid()
   order by m.created_at;
$$;

create or replace function public.remove_stall_member(p_member_id uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.stall_members where owner_id = auth.uid() and member_id = p_member_id;
$$;

revoke all on function public.add_stall_member(text)    from public, anon;
revoke all on function public.list_stall_members()      from public, anon;
revoke all on function public.remove_stall_member(uuid) from public, anon;
grant execute on function public.add_stall_member(text)    to authenticated;
grant execute on function public.list_stall_members()      to authenticated;
grant execute on function public.remove_stall_member(uuid) to authenticated;

