alter table public.purchases
  add column if not exists checkout_key uuid,
  add column if not exists checkout_customer_id text,
  add column if not exists checkout_price_id text,
  add column if not exists checkout_app_url text,
  add column if not exists currency text not null default 'usd';
create unique index if not exists purchases_checkout_key on public.purchases(workspace_id,checkout_key) where checkout_key is not null;

create or replace function public.reserve_checkout_attempt(p_workspace_id uuid,p_user_id uuid,p_package_id text,p_key uuid,p_customer text,p_price text,p_amount integer,p_app_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_purchase purchases; v_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtext('checkout'),hashtext(p_workspace_id::text));
  if not exists(select 1 from workspace_members m join workspaces w on w.id=m.workspace_id
    where m.workspace_id=p_workspace_id and m.user_id=p_user_id and m.role in ('owner','admin') and w.status='active') then
    raise exception 'Billing administrator required';
  end if;
  select * into v_purchase from purchases where workspace_id=p_workspace_id and checkout_key=p_key;
  if found then
    if v_purchase.package_id<>p_package_id then raise exception 'Checkout key conflict'; end if;
    return to_jsonb(v_purchase);
  end if;
  select * into v_purchase from purchases where workspace_id=p_workspace_id and status='pending' order by created_at asc limit 1 for update;
  if found then
    if v_purchase.reservation_expires_at <= now() then
      update purchases set status='cancelled',updated_at=now() where id=v_purchase.id;
      update provider_inventory set pending_checkout=greatest(0,pending_checkout-v_purchase.credits),updated_at=now() where provider='emailable';
    else
      raise exception 'Another checkout is pending. Resume it or wait for expiry.';
    end if;
  end if;
  if not exists(select 1 from packages where id=p_package_id and active and billing_type='one_time'
    and stripe_price_id=p_price and retail_price_cents=p_amount) then raise exception 'Package changed'; end if;
  if not exists(select 1 from workspaces where id=p_workspace_id and stripe_customer_id=p_customer) then raise exception 'Customer mismatch'; end if;
  perform create_checkout_reservation(v_id,p_workspace_id,p_package_id,p_user_id);
  update purchases set checkout_key=p_key,checkout_customer_id=p_customer,checkout_price_id=p_price,
    checkout_app_url=p_app_url,reservation_expires_at=date_trunc('second',now())+interval '1 hour'
    where id=v_id returning * into v_purchase;
  return to_jsonb(v_purchase);
end $$;
revoke all on function public.reserve_checkout_attempt(uuid,uuid,text,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_checkout_attempt(uuid,uuid,text,uuid,text,text,integer,text) to service_role;

create or replace function public.fulfill_checkout_purchase(p_event_id text,p_session jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_purchase purchases;
begin
  select * into v_purchase from purchases where id=(p_session->'metadata'->>'purchase_id')::uuid for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p_session->>'payment_status' is distinct from 'paid' or p_session->>'mode' is distinct from 'payment'
    or p_session->>'currency' is distinct from v_purchase.currency
    or (p_session->>'amount_total')::integer is distinct from v_purchase.amount_cents
    or p_session->>'customer' is distinct from v_purchase.checkout_customer_id
    or p_session->'metadata'->>'workspace_id' is distinct from v_purchase.workspace_id::text
    or p_session->'metadata'->>'package_id' is distinct from v_purchase.package_id
    or (v_purchase.stripe_session_id is not null and p_session->>'id' is distinct from v_purchase.stripe_session_id)
    or coalesce(p_session->>'payment_intent','')='' or coalesce(p_session->>'id','')='' then
    raise exception 'Checkout payment does not match purchase';
  end if;
  if v_purchase.status='paid' then return jsonb_build_object('processed',false); end if;
  if v_purchase.status<>'pending' then raise exception 'Purchase is not pending'; end if;
  update purchases set stripe_session_id=p_session->>'id' where id=v_purchase.id;
  return fulfill_one_time_purchase(p_event_id,v_purchase.id,p_session->>'customer',p_session->>'payment_intent',v_purchase.amount_cents);
end $$;
revoke all on function public.fulfill_checkout_purchase(text,jsonb) from public,anon,authenticated;
grant execute on function public.fulfill_checkout_purchase(text,jsonb) to service_role;
