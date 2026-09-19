create table public.batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  provider_batch_id text unique,
  status text not null default 'reserved' check (status in ('reserved','processing','complete','failed')),
  total integer not null check (total > 0 and total <= 50000),
  processed integer not null default 0,
  billable integer not null default 0,
  unknown integer not null default 0,
  duplicate integer not null default 0,
  total_counts jsonb,
  reason_counts jsonb,
  results jsonb,
  download_url text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index batches_workspace_created_idx on public.batches(workspace_id, created_at desc);
alter table public.batches enable row level security;
create policy "members read batches" on public.batches for select using (exists (
  select 1 from public.workspace_members wm where wm.workspace_id = batches.workspace_id and wm.user_id = auth.uid()
));

create function public.reserve_batch_credits(p_batch_id uuid, p_workspace_id uuid, p_user_id uuid, p_name text, p_total integer)
returns public.batches language plpgsql security definer set search_path=public as $$
declare v_batch public.batches; v_total bigint;
begin
  if p_total < 1 or p_total > 50000 then raise exception 'Invalid batch size'; end if;
  update public.credit_accounts set available=available-p_total, reserved=reserved+p_total, updated_at=now()
  where workspace_id=p_workspace_id and available>=p_total returning available+reserved into v_total;
  if v_total is null then raise exception 'Insufficient verification credits'; end if;
  insert into public.batches(id,workspace_id,user_id,name,total) values(p_batch_id,p_workspace_id,p_user_id,p_name,p_total) returning * into v_batch;
  insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason,actor_user_id)
  values(p_workspace_id,'reserve',0,v_total,'batch',p_batch_id::text,'Reserved for batch verification',p_user_id);
  return v_batch;
end $$;

create function public.release_batch_credits(p_batch_id uuid, p_error_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_batch public.batches; v_total bigint;
begin
  select * into v_batch from public.batches where id=p_batch_id for update;
  if v_batch.id is null or v_batch.status not in ('reserved','processing') then return false; end if;
  update public.credit_accounts set available=available+v_batch.total,reserved=reserved-v_batch.total,updated_at=now()
  where workspace_id=v_batch.workspace_id returning available+reserved into v_total;
  insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason)
  values(v_batch.workspace_id,'release',0,v_total,'batch',p_batch_id::text,'Batch verification failed');
  update public.batches set status='failed',error_code=p_error_code,completed_at=now() where id=p_batch_id;
  return true;
end $$;

create function public.settle_batch_credits(p_batch_id uuid,p_processed integer,p_unknown integer,p_duplicate integer,p_counts jsonb,p_reasons jsonb,p_results jsonb,p_download_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_batch public.batches; v_billable integer; v_refund integer; v_total bigint; v_left integer; v_grant public.credit_grants;
begin
  select * into v_batch from public.batches where id=p_batch_id for update;
  if v_batch.id is null then raise exception 'Unknown batch'; end if;
  if v_batch.status='complete' then return jsonb_build_object('processed',false,'billable',v_batch.billable); end if;
  v_billable:=greatest(0,least(v_batch.total,p_processed-p_unknown-p_duplicate)); v_refund:=v_batch.total-v_billable;
  update public.credit_accounts set available=available+v_refund,reserved=reserved-v_batch.total,updated_at=now()
  where workspace_id=v_batch.workspace_id and reserved>=v_batch.total returning available+reserved into v_total;
  v_left:=v_billable;
  for v_grant in select * from public.credit_grants where workspace_id=v_batch.workspace_id and credits_remaining>0 order by expires_at nulls last,created_at for update loop
    exit when v_left=0;
    update public.credit_grants set credits_remaining=credits_remaining-least(v_left,v_grant.credits_remaining) where id=v_grant.id;
    v_left:=v_left-least(v_left,v_grant.credits_remaining);
  end loop;
  if v_left<>0 then raise exception 'No credit grant available for settlement'; end if;
  if v_billable>0 then insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason)
    values(v_batch.workspace_id,'consume',-v_billable,v_total,'batch',p_batch_id::text,'Batch verification completed'); end if;
  if v_refund>0 then insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason)
    values(v_batch.workspace_id,'release',0,v_total,'batch_refund',p_batch_id::text,'Unknown and duplicate batch results refunded'); end if;
  update public.provider_inventory set allocated_to_customers=greatest(0,allocated_to_customers-v_billable),reported_available=greatest(0,reported_available-v_billable),updated_at=now() where provider='emailable';
  update public.batches set status='complete',processed=p_processed,billable=v_billable,unknown=p_unknown,duplicate=p_duplicate,total_counts=p_counts,reason_counts=p_reasons,results=p_results,download_url=p_download_url,completed_at=now() where id=p_batch_id;
  return jsonb_build_object('processed',true,'billable',v_billable,'refunded',v_refund);
end $$;

revoke all on function public.reserve_batch_credits(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_batch_credits(uuid,uuid,uuid,text,integer) to service_role;
revoke all on function public.release_batch_credits(uuid,text) from public,anon,authenticated;
grant execute on function public.release_batch_credits(uuid,text) to service_role;
revoke all on function public.settle_batch_credits(uuid,integer,integer,integer,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.settle_batch_credits(uuid,integer,integer,integer,jsonb,jsonb,jsonb,text) to service_role;
