create table public.auth_rate_limits (
  key text primary key,
  attempts integer not null check (attempts > 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.auth_rate_limits enable row level security;

create function public.consume_auth_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_attempts integer;
begin
  if length(p_key)<10 or p_limit<1 or p_window_seconds<1 then
    raise exception 'Invalid rate limit configuration';
  end if;
  insert into public.auth_rate_limits(key,attempts,window_started_at,updated_at)
    values(p_key,1,now(),now())
  on conflict(key) do update set
    attempts=case when auth_rate_limits.window_started_at <= now() - make_interval(secs=>p_window_seconds)
      then 1 else auth_rate_limits.attempts+1 end,
    window_started_at=case when auth_rate_limits.window_started_at <= now() - make_interval(secs=>p_window_seconds)
      then now() else auth_rate_limits.window_started_at end,
    updated_at=now()
  returning attempts into v_attempts;
  return v_attempts <= p_limit;
end $$;

revoke all on public.auth_rate_limits from anon, authenticated;
revoke all on function public.consume_auth_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_auth_rate_limit(text,integer,integer) to service_role;
