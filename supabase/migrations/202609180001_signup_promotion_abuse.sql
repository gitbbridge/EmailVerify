create table public.signup_origins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip_hash text,
  network_hash text,
  created_at timestamptz not null default now()
);

create table public.free_credit_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  ip_hash text not null unique,
  network_hash text not null unique,
  credits_granted bigint not null default 1000 check (credits_granted = 1000),
  claimed_at timestamptz not null default now()
);

alter table public.signup_origins enable row level security;
alter table public.free_credit_claims enable row level security;

drop function if exists public.bootstrap_workspace(uuid, text, text, text, text);

create function public.bootstrap_workspace(
  p_user_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_workspace_name text,
  p_ip_hash text,
  p_network_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_inventory public.provider_inventory;
  v_balance bigint := 0;
  v_signup_ip_hash text;
  v_signup_network_hash text;
  v_sellable bigint;
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

  select coalesce(ip_hash, p_ip_hash), coalesce(network_hash, p_network_hash)
  into v_signup_ip_hash, v_signup_network_hash
  from public.signup_origins
  where user_id = p_user_id;

  v_signup_ip_hash := coalesce(v_signup_ip_hash, p_ip_hash);
  v_signup_network_hash := coalesce(v_signup_network_hash, p_network_hash);

  if v_signup_ip_hash is not null and v_signup_network_hash is not null then
    begin
      insert into public.free_credit_claims (user_id, workspace_id, ip_hash, network_hash)
      values (p_user_id, v_workspace_id, v_signup_ip_hash, v_signup_network_hash);
      v_balance := 1000;
    exception when unique_violation then
      v_balance := 0;
    end;
  end if;

  if v_balance > 0 then
    select * into v_inventory from public.provider_inventory
    where provider = 'emailable' for update;
    v_sellable := least(
      v_inventory.sales_allocation - v_inventory.allocated_to_customers - v_inventory.pending_checkout,
      v_inventory.reported_available - v_inventory.safety_reserve - v_inventory.allocated_to_customers - v_inventory.pending_checkout
    );
    if v_sellable < v_balance then raise exception 'Signup credits are temporarily unavailable'; end if;
  end if;

  insert into public.credit_accounts (workspace_id, available)
  values (v_workspace_id, v_balance);

  if v_balance > 0 then
    insert into public.credit_ledger (
      workspace_id, type, amount, balance_after, reference_type,
      reference_id, reason, actor_user_id
    ) values (
      v_workspace_id, 'signup_grant', v_balance, v_balance, 'signup',
      p_user_id::text, 'Free signup credits', p_user_id
    );

    insert into public.credit_grants (
      workspace_id, source_type, source_id, credits_granted, credits_remaining
    ) values (
      v_workspace_id, 'signup', p_user_id::text, v_balance, v_balance
    );

    update public.provider_inventory
    set allocated_to_customers = allocated_to_customers + v_balance, updated_at = now()
    where provider = 'emailable';
  end if;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'created', true,
    'credits_granted', v_balance,
    'signup_credit_eligible', v_balance > 0
  );
end;
$$;

revoke all on function public.bootstrap_workspace(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace(uuid, text, text, text, text, text, text) to service_role;
