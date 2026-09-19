create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('billing','verification','api','account','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_workspace_created_idx on public.support_requests(workspace_id,created_at desc);
create index support_requests_status_created_idx on public.support_requests(status,created_at desc);
alter table public.support_requests enable row level security;
create policy "members read support requests" on public.support_requests for select using (exists (
  select 1 from public.workspace_members wm where wm.workspace_id=support_requests.workspace_id and wm.user_id=auth.uid()
));

create function public.admin_update_support_request(
  p_request_id uuid, p_status text, p_priority text, p_actor_user_id uuid
) returns public.support_requests language plpgsql security definer set search_path=public as $$
declare v_request public.support_requests;
begin
  if p_status not in ('open','in_progress','resolved','closed') then raise exception 'Invalid support status'; end if;
  if p_priority not in ('normal','high','urgent') then raise exception 'Invalid support priority'; end if;
  update public.support_requests set status=p_status,priority=p_priority,assigned_to=p_actor_user_id,
    resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now()
  where id=p_request_id returning * into v_request;
  if v_request.id is null then raise exception 'Support request not found'; end if;
  insert into public.admin_actions(actor_user_id,workspace_id,action,reason,metadata)
  values(p_actor_user_id,v_request.workspace_id,'support_request_updated','Support request status updated',jsonb_build_object('request_id',p_request_id,'status',p_status,'priority',p_priority));
  return v_request;
end $$;
revoke all on function public.admin_update_support_request(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_update_support_request(uuid,text,text,uuid) to service_role;
