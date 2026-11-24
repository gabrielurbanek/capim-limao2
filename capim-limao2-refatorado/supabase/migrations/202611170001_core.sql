-- Capim Limão — schema inicial. Aplicar apenas no projeto Supabase destinado a esta loja.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.roles (
  code text primary key check (code in ('OWNER', 'MANAGER', 'EMPLOYEE')),
  description text not null
);
insert into public.roles(code, description) values
  ('OWNER', 'Acesso total da empresa'),
  ('MANAGER', 'Gestão operacional'),
  ('EMPLOYEE', 'Operação autorizada')
on conflict (code) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_code text not null references public.roles(code) on update restrict on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(12,2) not null check (price >= 0),
  unit text not null check (unit in ('un', 'g', 'kg')),
  stock_balance numeric(12,3) not null default 0,
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0),
  is_available boolean not null default true,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_public_catalog_idx on public.products(is_published, is_available, category_id, name);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  phone text not null unique check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 20),
  email text,
  order_count integer not null default 0 check (order_count >= 0),
  total_spent numeric(12,2) not null default 0 check (total_spent >= 0),
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Capim Limão — Armazém Natural',
  logo_path text,
  description text,
  whatsapp text default '554635366291',
  email text,
  address text,
  opening_hours jsonb,
  social_links jsonb,
  banner_path text,
  announcement text,
  footer_text text,
  differentiators jsonb,
  reservation_window_hours integer not null default 24 check (reservation_window_hours between 1 and 168),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.company_settings(id, store_name, whatsapp, reservation_window_hours)
values (true, 'Capim Limão — Armazém Natural', '554635366291', 24)
on conflict (id) do nothing;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  content jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  status text not null default 'NEW' check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PENDING', 'PAID', 'REFUNDED')),
  total numeric(12,2) not null check (total >= 0),
  idempotency_key text not null unique,
  reservation_expires_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit text not null check (unit in ('un', 'g', 'kg')),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity numeric(12,3) not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  check ((unit = 'kg') or (quantity = trunc(quantity)))
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_history_order_idx on public.order_status_history(order_id, created_at);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  expires_at timestamptz not null,
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, product_id),
  check (not (released_at is not null and consumed_at is not null))
);
create index if not exists stock_reservations_active_idx on public.stock_reservations(product_id, expires_at) where released_at is null and consumed_at is null;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_phone text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (discount <= subtotal),
  check ((cancelled_at is null and cancelled_by is null) or (cancelled_at is not null and cancelled_by is not null))
);
create index if not exists sales_created_idx on public.sales(created_at desc);
create index if not exists sales_cashier_created_idx on public.sales(cashier_id, created_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit text not null check (unit in ('un', 'g', 'kg')),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity numeric(12,3) not null check (quantity > 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  check ((unit = 'kg') or (quantity = trunc(quantity)))
);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists sale_items_product_idx on public.sale_items(product_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  method text not null check (method in ('cash', 'pix', 'debit_card', 'credit_card', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'REFUNDED')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create index if not exists sale_payments_sale_idx on public.sale_payments(sale_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('RECEIPT', 'POS_SALE', 'ONLINE_ORDER', 'ADJUSTMENT', 'REVERSAL', 'RETURN')),
  quantity numeric(12,3) not null check (quantity <> 0),
  balance_after numeric(12,3) not null,
  reason text not null check (length(trim(reason)) >= 3),
  actor_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);
create index if not exists stock_movements_created_idx on public.stock_movements(created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_record_idx on public.audit_logs(table_name, record_id, created_at desc);

create table if not exists public.system_bootstrap (
  id text primary key check (id = 'initial-owner'),
  state text not null default 'PENDING' check (state in ('PENDING', 'PROVISIONING', 'COMPLETED', 'FAILED')),
  attempt_id uuid,
  owner_user_id uuid references auth.users(id) on delete set null,
  orphan_user_id uuid references auth.users(id) on delete set null,
  failure_code text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.system_bootstrap(id, state) values ('initial-owner', 'PENDING') on conflict (id) do nothing;

-- Perfis são rótulos de interface; nenhum metadado de usuário determina um cargo.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_role(p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select ur.role_code from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.user_id = p_user_id and p.is_active
$$;

create or replace function public.has_any_role(p_user_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(p_user_id is not null and p_user_id = auth.uid() and public.current_app_role(p_user_id) = any(p_roles), false)
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

-- Bloqueia atualização direta de saldo, inclusive por APIs autenticadas.
create or replace function public.guard_product_stock_balance()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.stock_balance is distinct from old.stock_balance and coalesce(current_setting('app.stock_update', true), '') <> 'on' then
    raise exception using errcode = '42501', message = 'STOCK_BALANCE_IS_LEDGER_MANAGED';
  end if;
  return new;
end;
$$;
create trigger products_guard_stock before update of stock_balance on public.products for each row execute function public.guard_product_stock_balance();

create or replace function public.is_valid_sale_quantity(p_unit text, p_quantity numeric)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(p_quantity > 0 and case p_unit
    when 'un' then p_quantity = trunc(p_quantity)
    when 'g' then p_quantity = trunc(p_quantity)
    when 'kg' then scale(p_quantity) <= 3
    else false end, false)
$$;

create or replace function public.calculate_line_total(p_unit_price numeric, p_quantity numeric)
returns numeric(12,2) language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p_unit_price is null or p_unit_price < 0 or p_quantity is null or p_quantity < 0 then
    raise exception using errcode = '22023', message = 'INVALID_LINE_TOTAL_INPUT';
  end if;
  return round(p_unit_price * p_quantity, 2);
end;
$$;

create or replace function public.current_actor_id()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_actor text;
begin
  v_actor := current_setting('app.actor_id', true);
  if v_actor is not null and v_actor <> '' then return v_actor::uuid; end if;
  return auth.uid();
exception when invalid_text_representation then return auth.uid();
end;
$$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid; v_old jsonb; v_new jsonb; v_record_id uuid; v_record_key text;
begin
  v_actor := public.current_actor_id();
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_table_name in ('orders', 'sales') then
    v_old := v_old - 'customer_name' - 'customer_phone';
    v_new := v_new - 'customer_name' - 'customer_phone';
  elsif tg_table_name = 'profiles' then
    v_old := v_old - 'email' - 'phone';
    v_new := v_new - 'email' - 'phone';
  end if;
  if tg_op = 'DELETE' then v_record_key := coalesce(v_old->>'id', v_old->>'user_id');
  else v_record_key := coalesce(v_new->>'id', v_new->>'user_id'); end if;
  if v_record_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_record_id := v_record_key::uuid; end if;
  insert into public.audit_logs(actor_id, actor_role, action, table_name, record_id, old_data, new_data)
  values (v_actor, public.current_app_role(v_actor), tg_op, tg_table_name, v_record_id, v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.audit_row_change();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_row_change();
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row_change();
create trigger orders_audit after insert or update or delete on public.orders for each row execute function public.audit_row_change();
create trigger sales_audit after insert or update or delete on public.sales for each row execute function public.audit_row_change();
create trigger company_settings_audit after insert or update or delete on public.company_settings for each row execute function public.audit_row_change();
create trigger user_roles_audit after insert or update or delete on public.user_roles for each row execute function public.audit_row_change();
create trigger stock_movements_audit after insert or update or delete on public.stock_movements for each row execute function public.audit_row_change();
create trigger product_images_audit after insert or update or delete on public.product_images for each row execute function public.audit_row_change();

create or replace function public.reject_immutable_row_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception using errcode = '42501', message = 'IMMUTABLE_LEDGER_ROW'; end;
$$;
create trigger stock_movements_immutable before update or delete on public.stock_movements for each row execute function public.reject_immutable_row_change();
create trigger audit_logs_immutable before update or delete on public.audit_logs for each row execute function public.reject_immutable_row_change();
create trigger order_history_immutable before update or delete on public.order_status_history for each row execute function public.reject_immutable_row_change();

-- Única função que aplica alterações ao saldo e ao ledger, sempre sob bloqueio de linha.
create or replace function public.apply_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text,
  p_actor_id uuid,
  p_order_id uuid default null,
  p_sale_id uuid default null,
  p_allow_negative boolean default false
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_balance numeric(12,3); v_after numeric(12,3); v_unit text; v_role text; v_id uuid;
begin
  if p_quantity = 0 or p_reason is null or length(trim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'INVALID_MOVEMENT'; end if;
  if p_movement_type not in ('RECEIPT', 'POS_SALE', 'ONLINE_ORDER', 'ADJUSTMENT', 'REVERSAL', 'RETURN') then raise exception using errcode = '22023', message = 'INVALID_MOVEMENT_TYPE'; end if;
  v_role := public.current_app_role(p_actor_id);
  if p_movement_type in ('RECEIPT', 'ADJUSTMENT') and v_role not in ('OWNER', 'MANAGER') then raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED'; end if;
  if p_movement_type = 'ADJUSTMENT' and p_allow_negative and v_role <> 'OWNER' then raise exception using errcode = '42501', message = 'OWNER_ONLY_NEGATIVE_STOCK'; end if;
  select stock_balance, unit into v_balance, v_unit from public.products where id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND'; end if;
  if v_unit in ('un', 'g') and p_quantity <> trunc(p_quantity) then raise exception using errcode = '22023', message = 'QUANTITY_MUST_BE_INTEGER'; end if;
  if v_unit = 'kg' and scale(p_quantity) > 3 then raise exception using errcode = '22023', message = 'QUANTITY_PRECISION_EXCEEDED'; end if;
  v_after := v_balance + p_quantity;
  if v_after < 0 and not (p_allow_negative and v_role = 'OWNER' and p_movement_type = 'ADJUSTMENT') then raise exception using errcode = '23514', message = 'INSUFFICIENT_STOCK'; end if;
  perform set_config('app.actor_id', coalesce(p_actor_id::text, ''), true);
  perform set_config('app.stock_update', 'on', true);
  update public.products set stock_balance = v_after where id = p_product_id;
  perform set_config('app.stock_update', 'off', true);
  insert into public.stock_movements(product_id, movement_type, quantity, balance_after, reason, actor_id, order_id, sale_id)
  values (p_product_id, p_movement_type, p_quantity, v_after, trim(p_reason), p_actor_id, p_order_id, p_sale_id) returning id into v_id;
  return v_id;
end;
$$;

-- Expiração cron-friendly: também é executada no começo de uma nova reserva. Disponibilidade sempre ignora vencidas.
create or replace function public.release_expired_reservations(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  with expired as (
    update public.stock_reservations r set released_at = p_now
    where r.released_at is null and r.consumed_at is null and r.expires_at <= p_now
    returning r.order_id
  ), cancelled as (
    update public.orders o set status = 'CANCELLED', updated_at = p_now
    where o.id in (select distinct order_id from expired) and o.status = 'NEW'
    returning o.id
  )
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, note)
  select o.id, 'NEW', 'CANCELLED', null, 'Reserva de estoque expirada' from public.orders o join cancelled c on c.id = o.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Idempotente e transacional; o browser fornece somente UUIDs/quantidades, nunca preço.
create or replace function public.create_order(
  p_items jsonb,
  p_customer jsonb,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item record; v_product public.products%rowtype; v_customer_id uuid; v_order_id uuid; v_number text;
  v_hold_hours integer; v_expires timestamptz; v_reserved numeric(12,3); v_line numeric(12,2); v_total numeric(12,2) := 0;
  v_snapshots jsonb := '[]'::jsonb; v_existing public.orders%rowtype; v_name text; v_phone text; v_email text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 12 and 120 then raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number, 'status', v_existing.status, 'payment_status', v_existing.payment_status, 'total', v_existing.total, 'reservation_expires_at', v_existing.reservation_expires_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'unit', oi.unit, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total) order by oi.created_at) from public.order_items oi where oi.order_id = v_existing.id), '[]'::jsonb));
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception using errcode = '22023', message = 'INVALID_ITEMS'; end if;
  v_name := trim(coalesce(p_customer->>'name', ''));
  v_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '[^0-9]', '', 'g');
  v_email := nullif(trim(p_customer->>'email'), '');
  if length(v_name) < 2 or length(v_name) > 160 or length(v_phone) < 8 or length(v_phone) > 20 then raise exception using errcode = '22023', message = 'INVALID_CUSTOMER'; end if;
  if v_email is not null and (v_email ~ '[[:space:]]' or position('@' in v_email) < 2 or position('.' in split_part(v_email, '@', 2)) < 2) then raise exception using errcode = '22023', message = 'INVALID_EMAIL'; end if;
  perform public.release_expired_reservations(now());

  -- Bloqueios em ordem canônica; transações concorrentes reservando o mesmo produto ficam serializadas.
  for v_item in
    select (entry->>'product_id')::uuid as product_id, sum((entry->>'quantity')::numeric)::numeric(12,3) as quantity
    from jsonb_array_elements(p_items) as input_rows(entry) group by (entry->>'product_id')::uuid order by (entry->>'product_id')::uuid
  loop
    select * into v_product from public.products where id = v_item.product_id and is_available and is_published for update;
    if not found then raise exception using errcode = 'P0002', message = 'PRODUCT_UNAVAILABLE'; end if;
    if not public.is_valid_sale_quantity(v_product.unit, v_item.quantity) then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    select coalesce(sum(r.quantity), 0) into v_reserved from public.stock_reservations r
      where r.product_id = v_product.id and r.released_at is null and r.consumed_at is null and r.expires_at > now();
    if v_product.stock_balance - v_reserved < v_item.quantity then raise exception using errcode = '23514', message = 'INSUFFICIENT_STOCK'; end if;
    v_line := public.calculate_line_total(v_product.price, v_item.quantity);
    v_total := v_total + v_line;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'product_name', v_product.name, 'unit', v_product.unit, 'unit_price', v_product.price, 'quantity', v_item.quantity, 'line_total', v_line));
  end loop;
  insert into public.customers(name, phone, email, order_count, last_order_at)
    values (v_name, v_phone, v_email, 1, now())
    on conflict (phone) do update set name = excluded.name, email = coalesce(excluded.email, public.customers.email), order_count = public.customers.order_count + 1, last_order_at = now()
    returning id into v_customer_id;
  select coalesce(reservation_window_hours, 24) into v_hold_hours from public.company_settings where id = true;
  v_expires := now() + make_interval(hours => coalesce(v_hold_hours, 24));
  v_number := 'CL-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.orders(order_number, customer_id, customer_name, customer_phone, total, idempotency_key, reservation_expires_at)
    values (v_number, v_customer_id, v_name, v_phone, round(v_total, 2), p_idempotency_key, v_expires) returning id into v_order_id;
  insert into public.order_items(order_id, product_id, product_name, unit, unit_price, quantity, line_total)
    select v_order_id, (item->>'product_id')::uuid, item->>'product_name', item->>'unit', (item->>'unit_price')::numeric, (item->>'quantity')::numeric, (item->>'line_total')::numeric from jsonb_array_elements(v_snapshots) as snapshot_rows(item);
  insert into public.stock_reservations(order_id, product_id, quantity, expires_at)
    select v_order_id, (item->>'product_id')::uuid, (item->>'quantity')::numeric, v_expires from jsonb_array_elements(v_snapshots) as snapshot_rows(item);
  insert into public.order_status_history(order_id, from_status, to_status, note) values (v_order_id, null, 'NEW', 'Pedido criado; aguardando contato pelo WhatsApp');
  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'status', 'NEW', 'payment_status', 'UNPAID', 'total', round(v_total, 2), 'reservation_expires_at', v_expires, 'items',
    (select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'unit', oi.unit, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total) order by oi.created_at) from public.order_items oi where oi.order_id = v_order_id));
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status text, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_res public.stock_reservations%rowtype; v_role text; v_allowed boolean := false; v_before text;
begin
  v_role := public.current_app_role(p_actor_id);
  if v_role is null then raise exception using errcode = '42501', message = 'ACTIVE_STAFF_REQUIRED'; end if;
  if p_status not in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED') then raise exception using errcode = '22023', message = 'INVALID_ORDER_STATUS'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.status = p_status then return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'payment_status', v_order.payment_status); end if;
  v_before := v_order.status;
  if v_role in ('OWNER', 'MANAGER') then
    v_allowed := case v_before when 'NEW' then p_status in ('CONFIRMED','CANCELLED') when 'CONFIRMED' then p_status in ('PREPARING','CANCELLED') when 'PREPARING' then p_status in ('READY','CANCELLED') when 'READY' then p_status in ('COMPLETED','CANCELLED') else false end;
  elsif v_role = 'EMPLOYEE' then
    v_allowed := (v_before = 'CONFIRMED' and p_status = 'PREPARING') or (v_before = 'PREPARING' and p_status = 'READY') or (v_before = 'READY' and p_status = 'COMPLETED');
  end if;
  if not v_allowed then raise exception using errcode = '42501', message = 'INVALID_OR_UNAUTHORIZED_TRANSITION'; end if;

  if p_status = 'CONFIRMED' then
    for v_res in select * from public.stock_reservations where order_id = v_order.id order by product_id for update loop
      if v_res.released_at is not null or v_res.consumed_at is not null or v_res.expires_at <= now() then raise exception using errcode = '23514', message = 'ORDER_RESERVATION_EXPIRED'; end if;
      perform public.apply_stock_movement(v_res.product_id, 'ONLINE_ORDER', -v_res.quantity, 'Baixa definitiva ao confirmar pedido ' || v_order.order_number, p_actor_id, v_order.id, null, false);
      update public.stock_reservations set consumed_at = now() where id = v_res.id;
    end loop;
  elsif p_status = 'CANCELLED' then
    for v_res in select * from public.stock_reservations where order_id = v_order.id order by product_id for update loop
      if v_res.consumed_at is not null then
        perform public.apply_stock_movement(v_res.product_id, 'REVERSAL', v_res.quantity, 'Estorno do pedido ' || v_order.order_number || coalesce(': ' || nullif(trim(p_note), ''), ''), p_actor_id, v_order.id, null, false);
      else
        update public.stock_reservations set released_at = coalesce(released_at, now()) where id = v_res.id;
      end if;
    end loop;
  end if;
  update public.orders set status = p_status where id = v_order.id;
  perform set_config('app.actor_id', p_actor_id::text, true);
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, note) values (v_order.id, v_before, p_status, p_actor_id, nullif(trim(p_note), ''));
  return jsonb_build_object('id', v_order.id, 'status', p_status, 'payment_status', v_order.payment_status, 'total', v_order.total);
end;
$$;

create or replace function public.set_order_payment_status(p_order_id uuid, p_payment_status text, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_role text; v_old text;
begin
  v_role := public.current_app_role(p_actor_id);
  if v_role not in ('OWNER','MANAGER') then raise exception using errcode = '42501', message = 'MANAGER_REQUIRED'; end if;
  if p_payment_status not in ('UNPAID','PENDING','PAID','REFUNDED') then raise exception using errcode = '22023', message = 'INVALID_PAYMENT_STATUS'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  v_old := v_order.payment_status;
  if v_old = p_payment_status then return jsonb_build_object('id', v_order.id, 'payment_status', v_old); end if;
  if v_order.status = 'CANCELLED' and p_payment_status = 'PAID' then raise exception using errcode = '23514', message = 'CANCELLED_ORDER_CANNOT_BE_PAID'; end if;
  if v_old = 'REFUNDED' and p_payment_status <> 'REFUNDED' then raise exception using errcode = '23514', message = 'REFUND_IS_FINAL'; end if;
  if (v_old = 'UNPAID' and p_payment_status not in ('PENDING','PAID'))
    or (v_old = 'PENDING' and p_payment_status not in ('UNPAID','PAID'))
    or (v_old = 'PAID' and p_payment_status <> 'REFUNDED') then
    raise exception using errcode = '23514', message = 'INVALID_PAYMENT_TRANSITION';
  end if;
  if p_payment_status = 'REFUNDED' and (v_old <> 'PAID' or length(trim(coalesce(p_note, ''))) < 4) then
    raise exception using errcode = '23514', message = 'REFUND_NOTE_REQUIRED';
  end if;
  update public.orders set payment_status = p_payment_status where id = v_order.id;
  if v_order.customer_id is not null and v_old <> 'PAID' and p_payment_status = 'PAID' then
    update public.customers set total_spent = total_spent + v_order.total where id = v_order.customer_id;
  elsif v_order.customer_id is not null and v_old = 'PAID' and p_payment_status = 'REFUNDED' then
    update public.customers set total_spent = greatest(0, total_spent - v_order.total) where id = v_order.customer_id;
  end if;
  perform set_config('app.actor_id', p_actor_id::text, true);
  insert into public.audit_logs(actor_id, actor_role, action, table_name, record_id, old_data, new_data)
  values (p_actor_id, v_role, 'PAYMENT_STATUS', 'orders', v_order.id, jsonb_build_object('payment_status', v_old), jsonb_build_object('payment_status', p_payment_status, 'note', nullif(trim(p_note), '')));
  return jsonb_build_object('id', v_order.id, 'payment_status', p_payment_status);
end;
$$;

create or replace function public.create_pos_sale(p_actor_id uuid, p_items jsonb, p_discount numeric, p_payment_method text, p_customer_phone text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item record; v_product public.products%rowtype; v_sale_id uuid; v_sale_number text; v_subtotal numeric(12,2) := 0; v_total numeric(12,2); v_discount numeric(12,2); v_line numeric(12,2); v_role text; v_snapshots jsonb := '[]'::jsonb; v_customer_id uuid;
begin
  v_role := public.current_app_role(p_actor_id);
  if v_role not in ('OWNER','MANAGER','EMPLOYEE') then raise exception using errcode = '42501', message = 'ACTIVE_STAFF_REQUIRED'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception using errcode = '22023', message = 'INVALID_ITEMS'; end if;
  if p_payment_method not in ('cash','pix','debit_card','credit_card','other') then raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD'; end if;
  if p_discount is null or p_discount < 0 then raise exception using errcode = '22023', message = 'INVALID_DISCOUNT'; end if;
  if p_discount > 0 and v_role not in ('OWNER','MANAGER') then raise exception using errcode = '42501', message = 'DISCOUNT_REQUIRES_MANAGER'; end if;
  if p_customer_phone is not null and length(regexp_replace(p_customer_phone, '[^0-9]', '', 'g')) not between 8 and 20 then raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_PHONE'; end if;
  for v_item in
    select (entry->>'product_id')::uuid as product_id, sum((entry->>'quantity')::numeric)::numeric(12,3) as quantity
    from jsonb_array_elements(p_items) as input_rows(entry) group by (entry->>'product_id')::uuid order by (entry->>'product_id')::uuid
  loop
    select * into v_product from public.products where id = v_item.product_id and is_available for update;
    if not found then raise exception using errcode = 'P0002', message = 'PRODUCT_UNAVAILABLE'; end if;
    if not public.is_valid_sale_quantity(v_product.unit, v_item.quantity) then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    if v_product.stock_balance < v_item.quantity then raise exception using errcode = '23514', message = 'INSUFFICIENT_STOCK'; end if;
    v_line := public.calculate_line_total(v_product.price, v_item.quantity);
    v_subtotal := v_subtotal + v_line;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'product_name', v_product.name, 'unit', v_product.unit, 'unit_price', v_product.price, 'quantity', v_item.quantity, 'line_total', v_line));
  end loop;
  v_subtotal := round(v_subtotal, 2); v_discount := round(p_discount, 2);
  if v_discount > v_subtotal then raise exception using errcode = '23514', message = 'DISCOUNT_EXCEEDS_SUBTOTAL'; end if;
  v_total := v_subtotal - v_discount;
  if p_customer_phone is not null then select id into v_customer_id from public.customers where phone = regexp_replace(p_customer_phone, '[^0-9]', '', 'g'); end if;
  v_sale_number := 'PDV-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  perform set_config('app.actor_id', p_actor_id::text, true);
  insert into public.sales(sale_number, cashier_id, customer_id, customer_phone, subtotal, discount, total)
    values (v_sale_number, p_actor_id, v_customer_id, nullif(regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g'), ''), v_subtotal, v_discount, v_total) returning id into v_sale_id;
  insert into public.sale_items(sale_id, product_id, product_name, unit, unit_price, quantity, discount, line_total)
    select v_sale_id, (item->>'product_id')::uuid, item->>'product_name', item->>'unit', (item->>'unit_price')::numeric, (item->>'quantity')::numeric,
      case when v_subtotal > 0 then round(v_discount * ((item->>'line_total')::numeric / v_subtotal), 2) else 0 end, (item->>'line_total')::numeric
    from jsonb_array_elements(v_snapshots) as snapshot_rows(item);
  for v_item in select (item->>'product_id')::uuid as product_id, (item->>'quantity')::numeric as quantity from jsonb_array_elements(v_snapshots) as snapshot_rows(item) order by (item->>'product_id')::uuid loop
    perform public.apply_stock_movement(v_item.product_id, 'POS_SALE', -v_item.quantity, 'Venda PDV ' || v_sale_number, p_actor_id, null, v_sale_id, false);
  end loop;
  insert into public.sale_payments(sale_id, method, amount, status) values (v_sale_id, p_payment_method, v_total, 'CONFIRMED');
  if v_customer_id is not null then
    update public.customers set total_spent = total_spent + v_total, order_count = order_count + 1, last_order_at = now() where id = v_customer_id;
  end if;
  return jsonb_build_object('id', v_sale_id, 'sale_number', v_sale_number, 'subtotal', v_subtotal, 'discount', v_discount, 'total', v_total, 'created_at', now(), 'items',
    (select jsonb_agg(jsonb_build_object('product_name', si.product_name, 'unit', si.unit, 'quantity', si.quantity, 'unit_price', si.unit_price, 'line_total', si.line_total) order by si.created_at) from public.sale_items si where si.sale_id = v_sale_id));
end;
$$;

create or replace function public.cancel_sale(p_sale_id uuid, p_actor_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sale public.sales%rowtype; v_role text; v_item record;
begin
  v_role := public.current_app_role(p_actor_id);
  if v_role not in ('OWNER','MANAGER') then raise exception using errcode = '42501', message = 'MANAGER_REQUIRED'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception using errcode = '22023', message = 'CANCELLATION_REASON_REQUIRED'; end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'SALE_NOT_FOUND'; end if;
  if v_sale.cancelled_at is not null then return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'cancelled', true); end if;
  perform set_config('app.actor_id', p_actor_id::text, true);
  for v_item in select product_id, sum(quantity)::numeric(12,3) as quantity from public.sale_items where sale_id = v_sale.id group by product_id order by product_id loop
    perform public.apply_stock_movement(v_item.product_id, 'REVERSAL', v_item.quantity, 'Cancelamento venda ' || v_sale.sale_number || ': ' || trim(p_reason), p_actor_id, null, v_sale.id, false);
  end loop;
  update public.sales set cancelled_by = p_actor_id, cancellation_reason = trim(p_reason), cancelled_at = now() where id = v_sale.id;
  update public.sale_payments set status = 'REFUNDED', refunded_at = now() where sale_id = v_sale.id and status = 'CONFIRMED';
  if v_sale.customer_id is not null then
    update public.customers c set total_spent = greatest(0, c.total_spent - v_sale.total), order_count = greatest(0, c.order_count - 1),
      last_order_at = greatest((select max(o.created_at) from public.orders o where o.customer_id = c.id and o.status <> 'CANCELLED'),
                               (select max(s.created_at) from public.sales s where s.customer_id = c.id and s.cancelled_at is null))
    where c.id = v_sale.customer_id;
  end if;
  return jsonb_build_object('id', v_sale.id, 'sale_number', v_sale.sale_number, 'cancelled', true);
end;
$$;

create or replace function public.receive_stock(p_product_id uuid, p_quantity numeric, p_reason text, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_quantity <= 0 then raise exception using errcode = '22023', message = 'QUANTITY_MUST_BE_POSITIVE'; end if;
  v_id := public.apply_stock_movement(p_product_id, 'RECEIPT', p_quantity, p_reason, p_actor_id);
  return jsonb_build_object('movement_id', v_id);
end;
$$;

create or replace function public.adjust_stock(p_product_id uuid, p_quantity_delta numeric, p_reason text, p_actor_id uuid, p_allow_negative boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_quantity_delta = 0 then raise exception using errcode = '22023', message = 'ADJUSTMENT_CANNOT_BE_ZERO'; end if;
  v_id := public.apply_stock_movement(p_product_id, 'ADJUSTMENT', p_quantity_delta, p_reason, p_actor_id, null, null, coalesce(p_allow_negative, false));
  return jsonb_build_object('movement_id', v_id);
end;
$$;

create or replace function public.delete_product_image(p_image_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_image public.product_images%rowtype;
begin
  v_role := public.current_app_role(p_actor_id);
  if v_role not in ('OWNER','MANAGER') then raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED'; end if;
  select * into v_image from public.product_images where id = p_image_id for update;
  if not found then return jsonb_build_object('deleted', true, 'path', null); end if;
  perform set_config('app.actor_id', p_actor_id::text, true);
  delete from public.product_images where id = p_image_id;
  return jsonb_build_object('deleted', true, 'path', v_image.path);
end;
$$;

create or replace function public.assign_staff_role(p_actor_id uuid, p_user_id uuid, p_full_name text, p_phone text, p_role_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor_role text;
begin
  v_actor_role := public.current_app_role(p_actor_id);
  if v_actor_role <> 'OWNER' then raise exception using errcode = '42501', message = 'OWNER_REQUIRED'; end if;
  if p_role_code not in ('MANAGER','EMPLOYEE') then raise exception using errcode = '22023', message = 'ROLE_NOT_ASSIGNABLE'; end if;
  if p_user_id is null or not exists(select 1 from auth.users where id = p_user_id) then raise exception using errcode = 'P0002', message = 'AUTH_USER_NOT_FOUND'; end if;
  if exists(select 1 from public.user_roles where user_id = p_user_id and role_code = 'OWNER') then raise exception using errcode = '42501', message = 'OWNER_ROLE_PROTECTED'; end if;
  insert into public.profiles(id, full_name, email, phone, is_active)
    select u.id, nullif(trim(p_full_name), ''), u.email, nullif(trim(p_phone), ''), true from auth.users u where u.id = p_user_id
    on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, phone = excluded.phone, is_active = true;
  insert into public.user_roles(user_id, role_code, assigned_by) values (p_user_id, p_role_code, p_actor_id)
    on conflict (user_id) do update set role_code = excluded.role_code, assigned_by = excluded.assigned_by, assigned_at = now();
  return jsonb_build_object('user_id', p_user_id, 'role', p_role_code, 'active', true);
end;
$$;

create or replace function public.set_staff_active(p_actor_id uuid, p_user_id uuid, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.current_app_role(p_actor_id) <> 'OWNER' then raise exception using errcode = '42501', message = 'OWNER_REQUIRED'; end if;
  if exists(select 1 from public.user_roles where user_id = p_user_id and role_code = 'OWNER') then raise exception using errcode = '42501', message = 'OWNER_ROLE_PROTECTED'; end if;
  update public.profiles set is_active = p_active where id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND'; end if;
  return jsonb_build_object('user_id', p_user_id, 'active', p_active);
end;
$$;

-- Saga de criação do primeiro OWNER; Auth e PostgreSQL não são uma única transação ACID.
create or replace function public.bootstrap_begin(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.system_bootstrap%rowtype;
begin
  select * into v_row from public.system_bootstrap where id = 'initial-owner' for update;
  if exists(select 1 from public.user_roles where role_code = 'OWNER') then raise exception using errcode = '23505', message = 'OWNER_ALREADY_EXISTS'; end if;
  if v_row.state = 'COMPLETED' then raise exception using errcode = '23505', message = 'BOOTSTRAP_COMPLETED'; end if;
  if v_row.orphan_user_id is not null then raise exception using errcode = '55000', message = 'BOOTSTRAP_ORPHAN_REQUIRES_RECONCILIATION'; end if;
  if v_row.state = 'PROVISIONING' then
    if v_row.attempt_id = p_attempt_id then return jsonb_build_object('acquired', true, 'attempt_id', p_attempt_id); end if;
    raise exception using errcode = '55P03', message = 'BOOTSTRAP_IN_PROGRESS';
  end if;
  update public.system_bootstrap set state = 'PROVISIONING', attempt_id = p_attempt_id, failure_code = null, started_at = now(), updated_at = now() where id = 'initial-owner';
  return jsonb_build_object('acquired', true, 'attempt_id', p_attempt_id);
end;
$$;

create or replace function public.bootstrap_complete(p_attempt_id uuid, p_user_id uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.system_bootstrap%rowtype;
begin
  select * into v_row from public.system_bootstrap where id = 'initial-owner' for update;
  if v_row.state = 'COMPLETED' and v_row.owner_user_id = p_user_id then return jsonb_build_object('completed', true, 'owner_user_id', p_user_id); end if;
  if v_row.state <> 'PROVISIONING' or v_row.attempt_id <> p_attempt_id then raise exception using errcode = '55000', message = 'BOOTSTRAP_ATTEMPT_MISMATCH'; end if;
  if exists(select 1 from public.user_roles where role_code = 'OWNER' and user_id <> p_user_id) then raise exception using errcode = '23505', message = 'OWNER_ALREADY_EXISTS'; end if;
  if not exists(select 1 from auth.users where id = p_user_id) then raise exception using errcode = 'P0002', message = 'AUTH_USER_NOT_FOUND'; end if;
  insert into public.profiles(id, email, full_name, is_active) select id, email, nullif(trim(p_full_name), ''), true from auth.users where id = p_user_id
    on conflict(id) do update set email = excluded.email, full_name = excluded.full_name, is_active = true;
  insert into public.user_roles(user_id, role_code) values (p_user_id, 'OWNER') on conflict(user_id) do update set role_code = 'OWNER';
  update public.system_bootstrap set state = 'COMPLETED', owner_user_id = p_user_id, orphan_user_id = null, completed_at = now(), updated_at = now() where id = 'initial-owner';
  return jsonb_build_object('completed', true, 'owner_user_id', p_user_id);
end;
$$;

create or replace function public.bootstrap_fail(p_attempt_id uuid, p_failure_code text, p_orphan_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.system_bootstrap%rowtype;
begin
  select * into v_row from public.system_bootstrap where id = 'initial-owner' for update;
  if v_row.state = 'COMPLETED' then return jsonb_build_object('completed', true); end if;
  if v_row.attempt_id <> p_attempt_id then raise exception using errcode = '55000', message = 'BOOTSTRAP_ATTEMPT_MISMATCH'; end if;
  update public.system_bootstrap set state = 'FAILED', failure_code = left(coalesce(p_failure_code, 'PROVISIONING_FAILED'), 80), orphan_user_id = p_orphan_user_id, updated_at = now() where id = 'initial-owner';
  return jsonb_build_object('failed', true, 'orphan_requires_reconciliation', p_orphan_user_id is not null);
end;
$$;

create or replace function public.bootstrap_compensated(p_attempt_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.system_bootstrap%rowtype;
begin
  select * into v_row from public.system_bootstrap where id = 'initial-owner' for update;
  if v_row.state = 'COMPLETED' then raise exception using errcode = '55000', message = 'BOOTSTRAP_ALREADY_COMPLETED'; end if;
  if v_row.attempt_id <> p_attempt_id or v_row.orphan_user_id is distinct from p_user_id then raise exception using errcode = '55000', message = 'BOOTSTRAP_RECONCILIATION_MISMATCH'; end if;
  update public.system_bootstrap set state = 'FAILED', orphan_user_id = null, failure_code = 'COMPENSATED_AUTH_USER_REMOVED', updated_at = now() where id = 'initial-owner';
  return jsonb_build_object('compensated', true);
end;
$$;

-- Reconciliador não libera PROVISIONING por tempo. A Edge Function verifica Auth e chama após compensação/recuperação comprovada.
create or replace function public.bootstrap_reconcile(p_attempt_id uuid, p_resolved_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.system_bootstrap%rowtype;
begin
  select * into v_row from public.system_bootstrap where id = 'initial-owner' for update;
  if v_row.state = 'COMPLETED' then return jsonb_build_object('completed', true); end if;
  if v_row.attempt_id <> p_attempt_id then raise exception using errcode = '55000', message = 'BOOTSTRAP_ATTEMPT_MISMATCH'; end if;
  if p_resolved_user_id is not null and exists(select 1 from auth.users where id = p_resolved_user_id) then
    if exists(select 1 from public.user_roles where role_code = 'OWNER' and user_id <> p_resolved_user_id) then raise exception using errcode = '23505', message = 'OWNER_ALREADY_EXISTS'; end if;
    update public.profiles set is_active = false where id = p_resolved_user_id and not exists(select 1 from public.user_roles where user_id = p_resolved_user_id and role_code = 'OWNER');
    update public.system_bootstrap set state = 'FAILED', orphan_user_id = p_resolved_user_id, failure_code = 'ORPHAN_AUTH_USER_FOUND', updated_at = now() where id = 'initial-owner';
    return jsonb_build_object('reconciliation_required', true);
  end if;
  update public.system_bootstrap set state = 'FAILED', orphan_user_id = null, failure_code = 'RECONCILED_NO_AUTH_USER', updated_at = now() where id = 'initial-owner';
  return jsonb_build_object('reconciled', true);
end;
$$;

-- Reconciliação periódica entre o ledger de movimentos e products.stock_balance.
create or replace function public.reconcile_stock_ledger()
returns table(product_id uuid, stored_balance numeric, ledger_balance numeric, difference numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.stock_balance, coalesce(sum(m.quantity), 0)::numeric(12,3), p.stock_balance - coalesce(sum(m.quantity), 0)::numeric(12,3)
  from public.products p left join public.stock_movements m on m.product_id = p.id group by p.id, p.stock_balance
  having p.stock_balance <> coalesce(sum(m.quantity), 0)::numeric(12,3)
$$;

-- RLS
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.company_settings enable row level security;
alter table public.site_content enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_bootstrap enable row level security;

create policy roles_read_authenticated on public.roles for select to authenticated using (true);
create policy profiles_read_self_or_owner on public.profiles for select to authenticated using (id = auth.uid() or public.has_any_role(auth.uid(), array['OWNER']));
create policy profiles_owner_update on public.profiles for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER'])) with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy user_roles_read_self_or_owner on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['OWNER']));
create policy categories_public_or_staff_read on public.categories for select to anon, authenticated using ((is_active = true) or public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']));
create policy categories_insert_manager on public.categories for insert to authenticated with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy categories_update_manager on public.categories for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER'])) with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy products_public_or_staff_read on public.products for select to anon, authenticated using ((is_available = true and is_published = true) or public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']));
create policy products_insert_manager on public.products for insert to authenticated with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy products_update_manager on public.products for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER'])) with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy product_images_read_published on public.product_images for select to anon, authenticated using (
  exists(select 1 from public.products p where p.id = product_id and p.is_available and p.is_published)
  or public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE'])
);
create policy product_images_insert_manager on public.product_images for insert to authenticated with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy product_images_update_manager on public.product_images for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER'])) with check (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy customers_manage_read on public.customers for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy customers_owner_update on public.customers for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER'])) with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy company_settings_public_read on public.company_settings for select to anon, authenticated using (id = true);
create policy company_settings_owner_insert on public.company_settings for insert to authenticated with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy company_settings_owner_update on public.company_settings for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER'])) with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy site_content_public_read on public.site_content for select to anon, authenticated using (is_public = true or public.has_any_role(auth.uid(), array['OWNER']));
create policy site_content_owner_insert on public.site_content for insert to authenticated with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy site_content_owner_update on public.site_content for update to authenticated using (public.has_any_role(auth.uid(), array['OWNER'])) with check (public.has_any_role(auth.uid(), array['OWNER']));
create policy orders_staff_read on public.orders for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']));
create policy order_items_staff_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE'])));
create policy order_history_staff_read on public.order_status_history for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE'])));
create policy reservations_manager_read on public.stock_reservations for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER']));
create policy stock_movements_staff_read on public.stock_movements for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']));
create policy sales_manager_or_cashier_read on public.sales for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER','MANAGER']) or cashier_id = auth.uid());
create policy sale_items_authorized_read on public.sale_items for select to authenticated using (exists(select 1 from public.sales s where s.id = sale_id and (public.has_any_role(auth.uid(), array['OWNER','MANAGER']) or s.cashier_id = auth.uid())));
create policy sale_payments_authorized_read on public.sale_payments for select to authenticated using (exists(select 1 from public.sales s where s.id = sale_id and (public.has_any_role(auth.uid(), array['OWNER','MANAGER']) or s.cashier_id = auth.uid())));
create policy audit_owner_read on public.audit_logs for select to authenticated using (public.has_any_role(auth.uid(), array['OWNER']));

-- Lista limitada para funcionários de PDV: sem e-mail, valor de compras ou dados excessivos.
create or replace view public.staff_customer_directory with (security_barrier = true) as
  select id, name, phone, order_count, last_order_at from public.customers
  where public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']);

-- Funcionários operacionais leem dados necessários à expedição, mas não financeiro/notas, mesmo via REST direto.
create or replace view public.orders_staff_read with (security_barrier = true) as
  select o.id, o.order_number, o.customer_id, o.customer_name, o.customer_phone, o.status,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then o.payment_status else null::text end as payment_status,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then o.total else null::numeric end as total,
    o.created_at,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then o.notes else null::text end as notes
  from public.orders o
  where public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']);

create or replace view public.order_items_staff_read with (security_barrier = true) as
  select i.id, i.order_id, i.product_id, i.product_name, i.unit,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then i.unit_price else null::numeric end as unit_price,
    i.quantity,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then i.line_total else null::numeric end as line_total,
    i.created_at
  from public.order_items i join public.orders o on o.id = i.order_id
  where public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']);

create or replace view public.order_history_staff_read with (security_barrier = true) as
  select h.id, h.order_id, h.from_status, h.to_status,
    case when public.has_any_role(auth.uid(), array['OWNER','MANAGER']) then h.note else null::text end as note,
    h.created_at
  from public.order_status_history h join public.orders o on o.id = h.order_id
  where public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE']);

-- Privilégios mínimos. Nunca se concede escrita do saldo, ledger, pagamentos, papéis ou bootstrap direto.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.roles, public.products, public.categories, public.product_images, public.company_settings, public.site_content to authenticated;
grant select on public.categories, public.product_images, public.site_content to anon;
grant select (store_name, logo_path, description, whatsapp, email, address, opening_hours, social_links, banner_path, announcement, footer_text, differentiators) on public.company_settings to anon;
revoke select on public.products from anon;
grant select (id, name, slug, description, category_id, price, unit, is_available, is_published, is_featured, created_at) on public.products to anon;
grant select on public.profiles, public.user_roles, public.stock_reservations, public.stock_movements,
  public.sales, public.sale_items, public.sale_payments to authenticated;
revoke select on public.orders, public.order_items, public.order_status_history from authenticated;
grant select on public.staff_customer_directory, public.orders_staff_read, public.order_items_staff_read,
  public.order_history_staff_read to authenticated;
grant select on public.customers to authenticated;
grant insert (name, slug, description, category_id, price, unit, minimum_stock, is_available, is_published, is_featured) on public.products to authenticated;
grant update (name, slug, description, category_id, price, unit, minimum_stock, is_available, is_published, is_featured) on public.products to authenticated;
grant insert (name, slug, description, is_active, sort_order) on public.categories to authenticated;
grant update (name, slug, description, is_active, sort_order) on public.categories to authenticated;
grant insert (product_id, path, alt_text, sort_order) on public.product_images to authenticated;
grant update (alt_text, sort_order) on public.product_images to authenticated;

grant insert (id, store_name, logo_path, description, whatsapp, email, address, opening_hours, social_links, banner_path, announcement, footer_text, differentiators, reservation_window_hours, updated_by) on public.company_settings to authenticated;
grant update (store_name, logo_path, description, whatsapp, email, address, opening_hours, social_links, banner_path, announcement, footer_text, differentiators, reservation_window_hours, updated_by) on public.company_settings to authenticated;
grant insert (content_key, content, is_public, updated_by) on public.site_content to authenticated;
grant update (content, is_public, updated_by) on public.site_content to authenticated;


-- Mutations privileged only through Edge Functions. Function bodies still enforce actor role and constraints.
revoke execute on function public.apply_stock_movement(uuid,text,numeric,text,uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.create_order(jsonb,jsonb,text) from public, anon, authenticated;
revoke execute on function public.update_order_status(uuid,text,uuid,text) from public, anon, authenticated;
revoke execute on function public.set_order_payment_status(uuid,text,uuid,text) from public, anon, authenticated;
revoke execute on function public.create_pos_sale(uuid,jsonb,numeric,text,text) from public, anon, authenticated;
revoke execute on function public.cancel_sale(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.receive_stock(uuid,numeric,text,uuid) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid,numeric,text,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.delete_product_image(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.assign_staff_role(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.set_staff_active(uuid,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.bootstrap_begin(uuid) from public, anon, authenticated;
revoke execute on function public.bootstrap_complete(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.bootstrap_fail(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.bootstrap_compensated(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.bootstrap_reconcile(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.release_expired_reservations(timestamptz) from public, anon, authenticated;
revoke execute on function public.reconcile_stock_ledger() from public, anon, authenticated;
revoke execute on function public.current_app_role(uuid) from public, anon, authenticated;
revoke execute on function public.has_any_role(uuid,text[]) from public, anon, authenticated;
grant execute on function public.has_any_role(uuid,text[]) to anon, authenticated;
grant execute on function public.bootstrap_begin(uuid), public.bootstrap_complete(uuid,uuid,text), public.bootstrap_fail(uuid,text,uuid), public.bootstrap_compensated(uuid,uuid), public.bootstrap_reconcile(uuid,uuid), public.release_expired_reservations(timestamptz), public.create_order(jsonb,jsonb,text), public.update_order_status(uuid,text,uuid,text), public.set_order_payment_status(uuid,text,uuid,text), public.create_pos_sale(uuid,jsonb,numeric,text,text), public.cancel_sale(uuid,uuid,text), public.receive_stock(uuid,numeric,text,uuid), public.adjust_stock(uuid,numeric,text,uuid,boolean), public.delete_product_image(uuid,uuid), public.assign_staff_role(uuid,uuid,text,text,text), public.set_staff_active(uuid,uuid,boolean), public.reconcile_stock_ledger() to service_role;

-- Storage privado: leitura via URLs assinadas somente para imagens vinculadas a catálogo publicado.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy product_image_objects_public_read_published on storage.objects for select to anon, authenticated using (
  bucket_id = 'product-images' and (
    exists(select 1 from public.product_images i join public.products p on p.id = i.product_id where i.path = storage.objects.name and p.is_published and p.is_available)
    or exists(select 1 from public.company_settings c where c.id = true and storage.objects.name in (c.logo_path, c.banner_path))
    or public.has_any_role(auth.uid(), array['OWNER','MANAGER','EMPLOYEE'])
  )
);
create policy product_image_objects_upload_staff on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images' and (
    (public.has_any_role(auth.uid(), array['OWNER','MANAGER']) and (
      (storage.objects.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+[.](jpg|jpeg|png|webp)$' and exists(select 1 from public.products p where p.id::text = split_part(storage.objects.name, '/', 1)))
      or (public.has_any_role(auth.uid(), array['OWNER']) and storage.objects.name ~* '^company/(logo|banner)-[0-9a-f-]+[.](jpg|jpeg|png|webp)$')
    ))
  )
);
create policy product_image_objects_update_staff on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.has_any_role(auth.uid(), array['OWNER','MANAGER']) and (
  exists(select 1 from public.product_images i where i.path = storage.objects.name)
  or (public.has_any_role(auth.uid(), array['OWNER']) and exists(select 1 from public.company_settings c where c.id = true and storage.objects.name in (c.logo_path, c.banner_path)))
)) with check (bucket_id = 'product-images' and public.has_any_role(auth.uid(), array['OWNER','MANAGER']) and (
  exists(select 1 from public.product_images i where i.path = storage.objects.name)
  or (public.has_any_role(auth.uid(), array['OWNER']) and exists(select 1 from public.company_settings c where c.id = true and storage.objects.name in (c.logo_path, c.banner_path)))
));
create policy product_image_objects_delete_staff on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.has_any_role(auth.uid(), array['OWNER','MANAGER']) and (
  exists(select 1 from public.product_images i where i.path = storage.objects.name)
  or (public.has_any_role(auth.uid(), array['OWNER']) and exists(select 1 from public.company_settings c where c.id = true and storage.objects.name in (c.logo_path, c.banner_path)))
));

-- Test/debug privilege: reconciliation is callable only from a trusted server function.
comment on function public.create_order(jsonb,jsonb,text) is 'Atomic price validation, order snapshots and stock reservation. Call only from create-order Edge Function.';
comment on function public.create_pos_sale(uuid,jsonb,numeric,text,text) is 'Atomic POS sale, payments and stock ledger. Call only after Edge Function auth.getUser and role verification.';
comment on table public.stock_movements is 'Append-only stock ledger; stock balance is only applied by apply_stock_movement.';
comment on table public.system_bootstrap is 'Private saga state. No client role has any access.';
