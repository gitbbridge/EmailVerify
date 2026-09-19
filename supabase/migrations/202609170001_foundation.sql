create extension if not exists pgcrypto;

create type public.system_role as enum ('user', 'admin');
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.workspace_status as enum ('active', 'suspended', 'closed');
create type public.credit_entry_type as enum (
  'signup_grant', 'purchase', 'reserve', 'consume', 'release', 'refund', 'admin_adjustment'
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  system_role public.system_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.workspace_status not null default 'active',
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create unique index one_workspace_per_user on public.workspace_members(user_id);

create table public.credit_accounts (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  available bigint not null default 0 check (available >= 0),
  reserved bigint not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type public.credit_entry_type not null,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reference_type text,
  reference_id text,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index credit_ledger_reference_unique
  on public.credit_ledger(workspace_id, type, reference_type, reference_id)
  where reference_id is not null;
create index credit_ledger_workspace_created_idx
  on public.credit_ledger(workspace_id, created_at desc);

create table public.provider_inventory (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  starting_credits bigint not null check (starting_credits >= 0),
  sales_allocation bigint not null check (sales_allocation >= 0),
  reported_available bigint not null check (reported_available >= 0),
  allocated_to_customers bigint not null default 0 check (allocated_to_customers >= 0),
  pending_checkout bigint not null default 0 check (pending_checkout >= 0),
  safety_reserve bigint not null check (safety_reserve >= 0),
  synced_at timestamptz,
  updated_at timestamptz not null default now(),
  check (sales_allocation + safety_reserve <= starting_credits)
);

create table public.packages (
  id text primary key,
  name text not null,
  credits bigint not null check (credits > 0),
  retail_price_cents integer not null check (retail_price_cents > 0),
  billing_type text not null check (billing_type in ('one_time', 'subscription')),
  billing_interval text check (billing_interval in ('month')),
  credits_roll_over boolean not null default true,
  stripe_price_id text unique,
  active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (billing_type = 'one_time' and billing_interval is null) or
    (billing_type = 'subscription' and billing_interval = 'month')
  )
);

create unique index packages_billing_type_credits_unique
  on public.packages(billing_type, credits);

insert into public.packages (
  id, name, credits, retail_price_cents, billing_type,
  billing_interval, credits_roll_over, sort_order
) values
  ('credits_5k', '5,000 credits', 5000, 1400, 'one_time', null, true, 1),
  ('credits_10k', '10,000 credits', 10000, 2400, 'one_time', null, true, 2),
  ('credits_25k', '25,000 credits', 25000, 4400, 'one_time', null, true, 3),
  ('credits_50k', '50,000 credits', 50000, 7400, 'one_time', null, true, 4),
  ('credits_100k', '100,000 credits', 100000, 13400, 'one_time', null, true, 5),
  ('credits_250k', '250,000 credits', 250000, 23900, 'one_time', null, true, 6),
  ('credits_500k', '500,000 credits', 500000, 29400, 'one_time', null, true, 7),
  ('credits_1m', '1,000,000 credits', 1000000, 44400, 'one_time', null, true, 8),
  ('monthly_2k', '2,000 credits monthly', 2000, 500, 'subscription', 'month', false, 101),
  ('monthly_10k', '10,000 credits monthly', 10000, 2000, 'subscription', 'month', false, 102),
  ('monthly_50k', '50,000 credits monthly', 50000, 9900, 'subscription', 'month', false, 103),
  ('monthly_250k', '250,000 credits monthly', 250000, 39900, 'subscription', 'month', false, 104),
  ('monthly_500k', '500,000 credits monthly', 500000, 59900, 'subscription', 'month', false, 105);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  package_id text not null references public.packages(id),
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  package_id text references public.packages(id),
  source_type text not null,
  source_id text not null,
  credits_granted bigint not null check (credits_granted > 0),
  credits_remaining bigint not null check (credits_remaining >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index credit_grants_consumption_idx
  on public.credit_grants(workspace_id, expires_at nulls last, created_at)
  where credits_remaining > 0;

create table public.purchases (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  package_id text not null references public.packages(id),
  credits bigint not null check (credits > 0),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  reservation_expires_at timestamptz not null default now() + interval '35 minutes',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_workspace_created_idx
  on public.purchases(workspace_id, created_at desc);

create table public.webhook_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

insert into public.provider_inventory (
  provider, starting_credits, sales_allocation, reported_available, safety_reserve
) values ('emailable', 2788318, 2500000, 2788318, 288318);

create or replace function public.bootstrap_workspace(
  p_user_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_workspace_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if p_user_id is distinct from auth.uid() and auth.role() <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  select workspace_id into v_workspace_id
  from public.workspace_members
  where user_id = p_user_id;

  if v_workspace_id is not null then
    return jsonb_build_object('workspace_id', v_workspace_id, 'created', false);
  end if;

  insert into public.profiles (user_id, first_name, last_name, email)
  values (p_user_id, p_first_name, p_last_name, p_email)
  on conflict (user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    updated_at = now();

  insert into public.workspaces (name)
  values (p_workspace_name)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  insert into public.credit_accounts (workspace_id)
  values (v_workspace_id);

  return jsonb_build_object('workspace_id', v_workspace_id, 'created', true);
end;
$$;

create or replace function public.apply_credit_entry(
  p_workspace_id uuid,
  p_type public.credit_entry_type,
  p_amount bigint,
  p_reference_type text default null,
  p_reference_id text default null,
  p_reason text default null,
  p_actor_user_id uuid default null
) returns public.credit_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_entry public.credit_ledger;
begin
  update public.credit_accounts
  set available = available + p_amount, updated_at = now()
  where workspace_id = p_workspace_id
    and available + p_amount >= 0
  returning available into v_balance;

  if v_balance is null then
    raise exception 'Insufficient credits or unknown workspace';
  end if;

  insert into public.credit_ledger (
    workspace_id, type, amount, balance_after, reference_type,
    reference_id, reason, actor_user_id
  ) values (
    p_workspace_id, p_type, p_amount, v_balance, p_reference_type,
    p_reference_id, p_reason, p_actor_user_id
  ) returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.create_checkout_reservation(
  p_purchase_id uuid,
  p_workspace_id uuid,
  p_package_id text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.packages;
  v_inventory public.provider_inventory;
  v_sellable bigint;
begin
  select * into v_package from public.packages
  where id = p_package_id and active = true;
  if v_package.id is null then raise exception 'Package is unavailable'; end if;

  select * into v_inventory from public.provider_inventory
  where provider = 'emailable' for update;

  v_sellable := least(
    v_inventory.sales_allocation - v_inventory.allocated_to_customers - v_inventory.pending_checkout,
    v_inventory.reported_available - v_inventory.safety_reserve - v_inventory.allocated_to_customers - v_inventory.pending_checkout
  );
  if v_sellable < v_package.credits then raise exception 'Insufficient provider inventory'; end if;

  insert into public.purchases (
    id, workspace_id, user_id, package_id, credits, amount_cents
  ) values (
    p_purchase_id, p_workspace_id, p_user_id, p_package_id,
    v_package.credits, v_package.retail_price_cents
  );

  update public.provider_inventory
  set pending_checkout = pending_checkout + v_package.credits, updated_at = now()
  where provider = 'emailable';

  return jsonb_build_object('purchase_id', p_purchase_id, 'reserved', true);
end;
$$;

create or replace function public.release_checkout_reservation(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.id is null or v_purchase.status <> 'pending' then
    return jsonb_build_object('released', false);
  end if;

  update public.purchases set status = 'cancelled', updated_at = now()
  where id = p_purchase_id;
  update public.provider_inventory
  set pending_checkout = greatest(0, pending_checkout - v_purchase.credits), updated_at = now()
  where provider = 'emailable';
  return jsonb_build_object('released', true);
end;
$$;

create or replace function public.fulfill_one_time_purchase(
  p_event_id text,
  p_purchase_id uuid,
  p_stripe_customer_id text,
  p_stripe_payment_intent_id text,
  p_amount_cents integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases;
  v_balance bigint;
begin
  insert into public.webhook_events(provider, event_id, event_type)
  values ('stripe', p_event_id, 'checkout.session.completed')
  on conflict do nothing;
  if not found then return jsonb_build_object('processed', false); end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.id is null then raise exception 'Purchase not found'; end if;
  if v_purchase.status = 'paid' then return jsonb_build_object('processed', false); end if;
  if v_purchase.amount_cents <> p_amount_cents then raise exception 'Purchase amount mismatch'; end if;

  update public.credit_accounts
  set available = available + v_purchase.credits, updated_at = now()
  where workspace_id = v_purchase.workspace_id
  returning available into v_balance;

  insert into public.credit_ledger (
    workspace_id, type, amount, balance_after, reference_type, reference_id, reason
  ) values (
    v_purchase.workspace_id, 'purchase', v_purchase.credits, v_balance,
    'purchase', v_purchase.id::text, 'Stripe credit purchase'
  );

  insert into public.credit_grants (
    workspace_id, package_id, source_type, source_id,
    credits_granted, credits_remaining, expires_at
  ) values (
    v_purchase.workspace_id, v_purchase.package_id, 'purchase', v_purchase.id::text,
    v_purchase.credits, v_purchase.credits, null
  );

  update public.purchases set
    status = 'paid', stripe_payment_intent_id = nullif(p_stripe_payment_intent_id, ''),
    amount_cents = p_amount_cents, paid_at = now(), updated_at = now()
  where id = v_purchase.id;

  update public.workspaces set
    stripe_customer_id = nullif(p_stripe_customer_id, ''), updated_at = now()
  where id = v_purchase.workspace_id;

  update public.provider_inventory set
    pending_checkout = greatest(0, pending_checkout - v_purchase.credits),
    allocated_to_customers = allocated_to_customers + v_purchase.credits,
    updated_at = now()
  where provider = 'emailable';

  return jsonb_build_object('processed', true);
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.provider_inventory enable row level security;
alter table public.packages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_grants enable row level security;
alter table public.purchases enable row level security;
alter table public.webhook_events enable row level security;

create policy "anyone reads active packages" on public.packages
  for select using (active = true);
create policy "members read subscriptions" on public.subscriptions
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id and wm.user_id = auth.uid()
  ));
create policy "members read credit grants" on public.credit_grants
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = credit_grants.workspace_id and wm.user_id = auth.uid()
  ));
create policy "members read purchases" on public.purchases
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = purchases.workspace_id and wm.user_id = auth.uid()
  ));

create policy "users read own profile" on public.profiles
  for select using (user_id = auth.uid());
create policy "members read workspace" on public.workspaces
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = id and wm.user_id = auth.uid()
  ));
create policy "members read memberships" on public.workspace_members
  for select using (user_id = auth.uid());
create policy "members read credit account" on public.credit_accounts
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = credit_accounts.workspace_id and wm.user_id = auth.uid()
  ));
create policy "members read credit ledger" on public.credit_ledger
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = credit_ledger.workspace_id and wm.user_id = auth.uid()
  ));

revoke all on function public.bootstrap_workspace(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace(uuid, text, text, text, text) to service_role;
revoke all on function public.apply_credit_entry(uuid, public.credit_entry_type, bigint, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_credit_entry(uuid, public.credit_entry_type, bigint, text, text, text, uuid) to service_role;
revoke all on function public.create_checkout_reservation(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_checkout_reservation(uuid, uuid, text, uuid) to service_role;
revoke all on function public.release_checkout_reservation(uuid) from public, anon, authenticated;
grant execute on function public.release_checkout_reservation(uuid) to service_role;
revoke all on function public.fulfill_one_time_purchase(text, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.fulfill_one_time_purchase(text, uuid, text, text, integer) to service_role;
