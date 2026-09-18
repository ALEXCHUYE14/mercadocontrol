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
