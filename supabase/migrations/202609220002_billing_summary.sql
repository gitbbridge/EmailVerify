create or replace function public.billing_summary(p_workspace_id uuid, p_period text default 'month')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz := (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC';
  v_result jsonb;
begin
  if p_period not in ('month', 'year') or p_period is null then
    raise exception 'Invalid billing period';
  end if;
  v_start := case when p_period = 'month' then ((v_end at time zone 'UTC') - interval '30 days') at time zone 'UTC'
    else (date_trunc('month', now() at time zone 'UTC') - interval '11 months') at time zone 'UTC' end;
  with usage as (
    select date_trunc(case when p_period='month' then 'day' else 'month' end, l.created_at at time zone 'UTC') as bucket,
      case when l.reference_type='batch' then 'bulk'
        when l.reference_type='verification' and v.api_key_id is not null then 'api'
        when l.reference_type='verification' then 'single' else 'other' end as channel,
      -l.amount as credits
    from credit_ledger l
    left join verification_requests v on l.reference_type='verification'
      and v.id::text=l.reference_id and v.workspace_id=l.workspace_id
    where l.workspace_id=p_workspace_id and l.type='consume' and l.amount<0
      and l.created_at>=v_start and l.created_at<v_end
  ), buckets as (
    select d as bucket, coalesce(sum(u.credits) filter(where channel='bulk'),0) as bulk,
      coalesce(sum(u.credits) filter(where channel='single'),0) as single,
      coalesce(sum(u.credits) filter(where channel='api'),0) as api,
      coalesce(sum(u.credits) filter(where channel='other'),0) as other
    from generate_series(v_start at time zone 'UTC',
      date_trunc(case when p_period='month' then 'day' else 'month' end, (v_end-interval '1 second') at time zone 'UTC'),
      case when p_period='month' then interval '1 day' else interval '1 month' end) d
    left join usage u on u.bucket=d group by d
  ) select jsonb_build_object(
    'available', (select available from credit_accounts where workspace_id=p_workspace_id),
    'reserved', (select reserved from credit_accounts where workspace_id=p_workspace_id),
    'lastAdded', (select jsonb_build_object('credits',amount,'date',created_at) from credit_ledger
      where workspace_id=p_workspace_id and amount>0 and type in ('signup_grant','purchase','admin_adjustment')
      order by created_at desc,id desc limit 1),
    'portalAvailable', exists(select 1 from workspaces where id=p_workspace_id and stripe_customer_id is not null),
    'pendingCheckout',(select to_jsonb(p) from (select id,package_id,checkout_key,stripe_session_id,status,reservation_expires_at
      from purchases where workspace_id=p_workspace_id and status='pending' order by created_at desc limit 1) p),
    'start',v_start,'end',v_end,'timezone','UTC',
    'buckets',(select jsonb_agg(to_jsonb(b) || jsonb_build_object('bucket',b.bucket at time zone 'UTC') order by bucket) from buckets b),
    'purchases',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc) from
      (select id,package_id,credits,status,created_at from purchases where workspace_id=p_workspace_id
        order by created_at desc,id desc limit 20) p),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.billing_summary(uuid,text) from public,anon,authenticated;
grant execute on function public.billing_summary(uuid,text) to service_role;

alter policy "members read purchases" on public.purchases using (exists (
  select 1 from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id
  where wm.workspace_id=purchases.workspace_id and wm.user_id=auth.uid()
    and wm.role in ('owner','admin') and w.status='active'
));
alter policy "members read subscriptions" on public.subscriptions using (exists (
  select 1 from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id
  where wm.workspace_id=subscriptions.workspace_id and wm.user_id=auth.uid()
    and wm.role in ('owner','admin') and w.status='active'
));
