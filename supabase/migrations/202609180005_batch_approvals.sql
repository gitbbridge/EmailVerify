alter table public.batches drop constraint batches_status_check;
alter table public.batches add constraint batches_status_check
  check (status in ('approval_pending','reserved','processing','complete','failed','rejected'));
alter table public.batches drop constraint batches_total_check;
alter table public.batches add constraint batches_total_check check (total > 0 and total <= 250000);
alter table public.batches
  add column risk_rules text[] not null default '{}',
  add column network_hash text,
  add column submission_path text,
  add column approval_requested_at timestamptz,
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users(id) on delete set null,
  add column rejected_at timestamptz,
  add column rejected_by uuid references auth.users(id) on delete set null,
  add column decision_reason text;

create table public.batch_chunks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  chunk_number integer not null,
  total integer not null check (total between 1 and 50000),
  provider_batch_id text unique,
  status text not null default 'pending' check (status in ('pending','processing','complete','failed')),
  processed integer not null default 0,
  total_counts jsonb,
  reason_counts jsonb,
  results jsonb,
  export_path text,
  unique(batch_id, chunk_number)
);

create table public.payment_risk_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  created_at timestamptz not null default now()
);

create table public.batch_approval_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  decision text not null check (decision in ('requested','approved','rejected')),
  rule_codes text[] not null default '{}',
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.batch_chunks enable row level security;
alter table public.payment_risk_events enable row level security;
alter table public.batch_approval_audit enable row level security;
create policy "members read batch chunks" on public.batch_chunks for select using (exists (
  select 1 from public.batches b join public.workspace_members wm on wm.workspace_id=b.workspace_id
  where b.id=batch_chunks.batch_id and wm.user_id=auth.uid()
));

insert into storage.buckets(id,name,public,file_size_limit)
values('batch-submissions','batch-submissions',false,15728640) on conflict(id) do nothing;

create function public.reserve_existing_batch_credits(p_batch_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_batch public.batches; v_total bigint;
begin
  select * into v_batch from public.batches where id=p_batch_id for update;
  if v_batch.id is null or v_batch.status not in ('approval_pending','reserved') then raise exception 'Batch cannot be reserved'; end if;
  update public.credit_accounts set available=available-v_batch.total,reserved=reserved+v_batch.total,updated_at=now()
  where workspace_id=v_batch.workspace_id and available>=v_batch.total returning available+reserved into v_total;
  if v_total is null then raise exception 'Insufficient verification credits'; end if;
  update public.batches set status='reserved' where id=p_batch_id;
  insert into public.credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id,reason,actor_user_id)
  values(v_batch.workspace_id,'reserve',0,v_total,'batch',p_batch_id::text,'Reserved for batch verification',v_batch.user_id);
  return true;
end $$;

revoke all on function public.reserve_existing_batch_credits(uuid) from public,anon,authenticated;
grant execute on function public.reserve_existing_batch_credits(uuid) to service_role;
