create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  action text not null,
  reason text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions(created_at desc);
create index admin_actions_workspace_idx on public.admin_actions(workspace_id,created_at desc);
alter table public.admin_actions enable row level security;

create function public.admin_adjust_credits(
  p_workspace_id uuid, p_amount bigint, p_reason text, p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_account public.credit_accounts;
  v_inventory public.provider_inventory;
  v_grant public.credit_grants;
  v_left bigint;
  v_take bigint;
  v_reference uuid := gen_random_uuid();
  v_sellable bigint;
begin
  if p_amount=0 or abs(p_amount)>1000000 then raise exception 'Invalid adjustment amount'; end if;
  if char_length(trim(p_reason))<10 then raise exception 'A detailed reason is required'; end if;
  select * into v_account from public.credit_accounts where workspace_id=p_workspace_id for update;
  if v_account.workspace_id is null then raise exception 'Workspace credit account not found'; end if;
  select * into v_inventory from public.provider_inventory where provider='emailable' for update;

  if p_amount>0 then
    v_sellable:=least(
      v_inventory.sales_allocation-v_inventory.allocated_to_customers-v_inventory.pending_checkout,
      v_inventory.reported_available-v_inventory.safety_reserve-v_inventory.allocated_to_customers-v_inventory.pending_checkout
    );
    if v_sellable<p_amount then raise exception 'Insufficient provider inventory'; end if;
    insert into public.credit_grants(workspace_id,source_type,source_id,credits_granted,credits_remaining)
    values(p_workspace_id,'admin_adjustment',v_reference::text,p_amount,p_amount);
  else
    if v_account.available < abs(p_amount) then raise exception 'Adjustment exceeds available credits'; end if;
    v_left:=abs(p_amount);
    for v_grant in select * from public.credit_grants where workspace_id=p_workspace_id and credits_remaining>0
      order by expires_at nulls last,created_at for update loop
      exit when v_left=0;
      v_take:=least(v_left,v_grant.credits_remaining);
      update public.credit_grants set credits_remaining=credits_remaining-v_take where id=v_grant.id;
      v_left:=v_left-v_take;
    end loop;
    if v_left>0 then raise exception 'Credit grant balance is inconsistent'; end if;
  end if;

  update public.credit_accounts set available=available+p_amount,updated_at=now()
  where workspace_id=p_workspace_id returning * into v_account;
  update public.provider_inventory set allocated_to_customers=greatest(0,allocated_to_customers+p_amount),updated_at=now()
  where provider='emailable';
  insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason,actor_user_id)
  values(p_workspace_id,'admin_adjustment',p_amount,v_account.available+v_account.reserved,'admin_adjustment',v_reference::text,p_reason,p_actor_user_id);
  insert into public.admin_actions(actor_user_id,workspace_id,action,reason,metadata)
  values(p_actor_user_id,p_workspace_id,'credit_adjustment',p_reason,jsonb_build_object('amount',p_amount,'reference_id',v_reference));
  return jsonb_build_object('available',v_account.available,'reserved',v_account.reserved,'amount',p_amount);
end $$;

revoke all on function public.admin_adjust_credits(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_adjust_credits(uuid,bigint,text,uuid) to service_role;

create function public.admin_set_workspace_status(
  p_workspace_id uuid, p_status public.workspace_status, p_reason text, p_actor_user_id uuid
) returns public.workspaces language plpgsql security definer set search_path=public as $$
declare v_workspace public.workspaces;
begin
  if p_status not in ('active','suspended') then raise exception 'Invalid workspace status'; end if;
  if char_length(trim(p_reason))<10 then raise exception 'A detailed reason is required'; end if;
  update public.workspaces set status=p_status,updated_at=now() where id=p_workspace_id returning * into v_workspace;
  if v_workspace.id is null then raise exception 'Workspace not found'; end if;
  insert into public.admin_actions(actor_user_id,workspace_id,action,reason)
  values(p_actor_user_id,p_workspace_id,'workspace_'||p_status::text,p_reason);
  return v_workspace;
end $$;

revoke all on function public.admin_set_workspace_status(uuid,public.workspace_status,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_set_workspace_status(uuid,public.workspace_status,text,uuid) to service_role;
