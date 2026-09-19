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
  v_inventory public.provider_inventory;
  v_balance bigint := 1000;
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

  select * into v_inventory from public.provider_inventory
  where provider = 'emailable' for update;
  v_sellable := least(
    v_inventory.sales_allocation - v_inventory.allocated_to_customers - v_inventory.pending_checkout,
    v_inventory.reported_available - v_inventory.safety_reserve - v_inventory.allocated_to_customers - v_inventory.pending_checkout
  );
  if v_sellable < v_balance then raise exception 'Signup credits are temporarily unavailable'; end if;

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

  insert into public.credit_accounts (workspace_id, available)
  values (v_workspace_id, v_balance);

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

  return jsonb_build_object('workspace_id', v_workspace_id, 'created', true, 'credits_granted', v_balance);
end;
$$;
