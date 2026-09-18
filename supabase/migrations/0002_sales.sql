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
