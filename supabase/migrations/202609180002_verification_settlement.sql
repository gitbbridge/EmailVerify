alter table public.credit_ledger drop constraint credit_ledger_amount_check;
alter table public.credit_ledger add constraint credit_ledger_amount_check
  check (amount <> 0 or type in ('reserve', 'release'));

create table public.verification_requests (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_key text not null,
  email_hash text not null,
  email_masked text not null,
  state text check (state in ('deliverable', 'risky', 'undeliverable', 'unknown')),
  reason text,
  score integer check (score between 0 and 100),
  status text not null default 'reserved' check (status in ('reserved', 'complete', 'failed')),
  credits_used integer not null default 0 check (credits_used in (0, 1)),
  provider_request_id text,
  response_data jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, request_key)
);

create index verification_requests_workspace_created_idx
  on public.verification_requests(workspace_id, created_at desc);
create index verification_requests_email_hash_idx
  on public.verification_requests(workspace_id, email_hash);

alter table public.verification_requests enable row level security;
create policy "members read verification requests" on public.verification_requests
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = verification_requests.workspace_id and wm.user_id = auth.uid()
  ));

create function public.reserve_verification_credit(
  p_request_id uuid,
  p_workspace_id uuid,
  p_user_id uuid,
  p_request_key text,
  p_email_hash text,
  p_email_masked text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.verification_requests;
  v_available bigint;
  v_total bigint;
begin
  select * into v_existing
  from public.verification_requests
  where workspace_id = p_workspace_id and request_key = p_request_key;

  if v_existing.id is not null then
    return jsonb_build_object(
      'created', false,
      'id', v_existing.id,
      'status', v_existing.status,
      'response', v_existing.response_data,
      'credits_used', v_existing.credits_used
    );
  end if;

  update public.credit_accounts
  set available = available - 1, reserved = reserved + 1, updated_at = now()
  where workspace_id = p_workspace_id and available >= 1
  returning available, available + reserved into v_available, v_total;

  if v_available is null then
    raise exception 'Insufficient verification credits' using errcode = 'P0001';
  end if;

  insert into public.verification_requests (
    id, workspace_id, user_id, request_key, email_hash, email_masked
  ) values (
    p_request_id, p_workspace_id, p_user_id, p_request_key, p_email_hash, p_email_masked
  );

  insert into public.credit_ledger (
    workspace_id, type, amount, balance_after, reference_type,
    reference_id, reason, actor_user_id
  ) values (
    p_workspace_id, 'reserve', 0, v_total, 'verification',
    p_request_id::text, 'Reserved for email verification', p_user_id
  );

  return jsonb_build_object('created', true, 'id', p_request_id, 'status', 'reserved');
end;
$$;

create function public.settle_verification_credit(
  p_request_id uuid,
  p_state text,
  p_reason text,
  p_score integer,
  p_provider_request_id text,
  p_response_data jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.verification_requests;
  v_available bigint;
  v_total bigint;
  v_billable boolean := p_state <> 'unknown';
  v_grant_id uuid;
begin
  select * into v_request from public.verification_requests
  where id = p_request_id for update;

  if v_request.id is null then raise exception 'Unknown verification request'; end if;
  if v_request.status <> 'reserved' then
    return jsonb_build_object('processed', false, 'status', v_request.status, 'credits_used', v_request.credits_used);
  end if;

  if v_billable then
    update public.credit_accounts
    set reserved = reserved - 1, updated_at = now()
    where workspace_id = v_request.workspace_id and reserved >= 1
    returning available, available + reserved into v_available, v_total;

    select id into v_grant_id from public.credit_grants
    where workspace_id = v_request.workspace_id and credits_remaining > 0
    order by expires_at nulls last, created_at
    limit 1 for update;
    if v_grant_id is null then raise exception 'No credit grant available for settlement'; end if;
    update public.credit_grants set credits_remaining = credits_remaining - 1 where id = v_grant_id;

    insert into public.credit_ledger (
      workspace_id, type, amount, balance_after, reference_type, reference_id, reason
    ) values (
      v_request.workspace_id, 'consume', -1, v_total, 'verification',
      p_request_id::text, 'Email verification completed'
    );

    update public.provider_inventory set
      allocated_to_customers = greatest(0, allocated_to_customers - 1),
      reported_available = greatest(0, reported_available - 1),
      updated_at = now()
    where provider = 'emailable';
  else
    update public.credit_accounts
    set available = available + 1, reserved = reserved - 1, updated_at = now()
    where workspace_id = v_request.workspace_id and reserved >= 1
    returning available, available + reserved into v_available, v_total;

    insert into public.credit_ledger (
      workspace_id, type, amount, balance_after, reference_type, reference_id, reason
    ) values (
      v_request.workspace_id, 'release', 0, v_total, 'verification',
      p_request_id::text, 'Unknown verification result refunded'
    );
  end if;

  update public.verification_requests set
    state = p_state,
    reason = p_reason,
    score = p_score,
    status = 'complete',
    credits_used = case when v_billable then 1 else 0 end,
    provider_request_id = p_provider_request_id,
    response_data = p_response_data,
    completed_at = now()
  where id = p_request_id;

  return jsonb_build_object('processed', true, 'status', 'complete', 'credits_used', case when v_billable then 1 else 0 end);
end;
$$;

create function public.fail_verification_credit(
  p_request_id uuid,
  p_error_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.verification_requests;
  v_available bigint;
  v_total bigint;
begin
  select * into v_request from public.verification_requests
  where id = p_request_id for update;

  if v_request.id is null or v_request.status <> 'reserved' then
    return jsonb_build_object('processed', false);
  end if;

  update public.credit_accounts
  set available = available + 1, reserved = reserved - 1, updated_at = now()
  where workspace_id = v_request.workspace_id and reserved >= 1
  returning available, available + reserved into v_available, v_total;

  insert into public.credit_ledger (
    workspace_id, type, amount, balance_after, reference_type, reference_id, reason
  ) values (
    v_request.workspace_id, 'release', 0, v_total, 'verification',
    p_request_id::text, 'Verification failed before settlement'
  );

  update public.verification_requests set
    status = 'failed', error_code = p_error_code, completed_at = now()
  where id = p_request_id;

  return jsonb_build_object('processed', true);
end;
$$;

revoke all on function public.reserve_verification_credit(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_verification_credit(uuid, uuid, uuid, text, text, text) to service_role;
revoke all on function public.settle_verification_credit(uuid, text, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.settle_verification_credit(uuid, text, text, integer, text, jsonb) to service_role;
revoke all on function public.fail_verification_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_verification_credit(uuid, text) to service_role;
