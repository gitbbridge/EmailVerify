alter table public.packages
  add column if not exists stripe_test_price_id text unique,
  add column if not exists stripe_live_price_id text unique;

update public.packages
set stripe_live_price_id = stripe_price_id
where stripe_live_price_id is null and stripe_price_id is not null;

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
    and (stripe_price_id=p_price or stripe_test_price_id=p_price or stripe_live_price_id=p_price)
    and retail_price_cents=p_amount) then raise exception 'Package changed'; end if;
  if not exists(select 1 from workspaces where id=p_workspace_id and stripe_customer_id=p_customer) then raise exception 'Customer mismatch'; end if;
  perform create_checkout_reservation(v_id,p_workspace_id,p_package_id,p_user_id);
  update purchases set checkout_key=p_key,checkout_customer_id=p_customer,checkout_price_id=p_price,
    checkout_app_url=p_app_url,reservation_expires_at=date_trunc('second',now())+interval '1 hour'
    where id=v_id returning * into v_purchase;
  return to_jsonb(v_purchase);
end $$;
revoke all on function public.reserve_checkout_attempt(uuid,uuid,text,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_checkout_attempt(uuid,uuid,text,uuid,text,text,integer,text) to service_role;
