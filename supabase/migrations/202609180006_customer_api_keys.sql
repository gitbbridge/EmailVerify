create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null,
  secret_hash text not null unique,
  environment text not null default 'live' check (environment in ('live','test')),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_keys_workspace_created_idx on public.api_keys(workspace_id, created_at desc);
alter table public.api_keys enable row level security;
create policy "workspace admins read api keys" on public.api_keys for select using (exists (
  select 1 from public.workspace_members wm where wm.workspace_id=api_keys.workspace_id
  and wm.user_id=auth.uid() and wm.role in ('owner','admin')
));

alter table public.verification_requests
  add column api_key_id uuid references public.api_keys(id) on delete set null;
create index verification_requests_api_key_created_idx
  on public.verification_requests(api_key_id, created_at desc) where api_key_id is not null;

create function public.get_api_usage_summary(p_workspace_id uuid, p_since timestamptz)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'verifications', count(*),
    'deliverable', count(*) filter (where state='deliverable'),
    'risky', count(*) filter (where state='risky'),
    'undeliverable', count(*) filter (where state='undeliverable'),
    'unknown', count(*) filter (where state='unknown'),
    'credits_used', coalesce(sum(credits_used),0)
  ) from public.verification_requests
  where workspace_id=p_workspace_id and api_key_id is not null and created_at>=p_since;
$$;

revoke all on function public.get_api_usage_summary(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.get_api_usage_summary(uuid,timestamptz) to service_role;
