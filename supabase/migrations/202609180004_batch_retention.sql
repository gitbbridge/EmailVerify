alter table public.batches
  add column expires_at timestamptz not null default (now() + interval '187 days'),
  add column retention_warning_sent_at timestamptz,
  add column export_path text;

create index batches_retention_idx on public.batches(expires_at)
  where status = 'complete';

insert into storage.buckets (id, name, public, file_size_limit)
values ('batch-exports', 'batch-exports', false, 52428800)
on conflict (id) do nothing;

create function public.claim_batch_retention_warnings()
returns table(batch_id uuid, batch_name text, owner_email text, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  return query
  with claimed as (
    update public.batches b set retention_warning_sent_at = now()
    where b.status = 'complete'
      and b.retention_warning_sent_at is null
      and b.expires_at <= now() + interval '7 days'
      and b.expires_at > now()
    returning b.id, b.name, b.user_id, b.expires_at
  )
  select c.id, c.name, p.email, c.expires_at
  from claimed c join public.profiles p on p.user_id = c.user_id;
end $$;

create function public.release_batch_retention_warning(p_batch_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.batches set retention_warning_sent_at = null where id = p_batch_id;
$$;

revoke all on function public.claim_batch_retention_warnings() from public,anon,authenticated;
grant execute on function public.claim_batch_retention_warnings() to service_role;
revoke all on function public.release_batch_retention_warning(uuid) from public,anon,authenticated;
grant execute on function public.release_batch_retention_warning(uuid) to service_role;
