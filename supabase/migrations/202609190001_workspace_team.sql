create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null check (role in ('admin', 'member')),
  token_hash text not null unique check (length(token_hash) = 64),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index workspace_pending_invitation on public.workspace_invitations(workspace_id, email)
  where accepted_at is null and revoked_at is null;
create index workspace_invitations_created on public.workspace_invitations(workspace_id, created_at desc);
alter table public.workspace_invitations enable row level security;

create table public.team_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject text not null,
  created_at timestamptz not null default now()
);
create index team_events_workspace_created on public.team_events(workspace_id, created_at desc);
alter table public.team_events enable row level security;

-- Serialize team mutations per workspace and re-check roles inside the transaction.
create function public.manage_workspace_team(
  p_workspace_id uuid, p_actor uuid, p_action text,
  p_target uuid default null, p_email text default null,
  p_role public.workspace_role default 'member', p_token_hash text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor public.workspace_role;
  v_target public.workspace_members;
  v_invite public.workspace_invitations;
  v_subject text;
begin
  perform 1 from public.workspaces where id=p_workspace_id and status='active' for update;
  if not found then raise exception using errcode='P0001', message='Workspace is not active.'; end if;
  select role into v_actor from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor;
  if v_actor is null or v_actor not in ('owner','admin') then
    raise exception using errcode='42501', message='Team administrator access is required.';
  end if;
  if p_action='invite' then
    if p_role is null or p_role not in ('admin','member') or (p_role='admin' and v_actor<>'owner') then
      raise exception using errcode='42501', message='Only the owner can appoint administrators.';
    end if;
    v_subject:=lower(trim(p_email));
    if v_subject is null or length(v_subject)>254 or position('@' in v_subject)<2 then
      raise exception using errcode='P0001', message='A valid email is required.';
    end if;
    if exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id where lower(u.email)=v_subject) then
      raise exception using errcode='P0001', message='This email already belongs to a workspace.';
    end if;
    if (select count(*) from public.workspace_invitations where workspace_id=p_workspace_id and created_at>now()-interval '1 hour')>=10 then
      raise exception using errcode='P0001', message='Invitation limit reached. Try again in an hour.';
    end if;
    update public.workspace_invitations set revoked_at=now()
      where workspace_id=p_workspace_id and expires_at<=now() and accepted_at is null and revoked_at is null;
    if exists(select 1 from public.workspace_invitations where workspace_id=p_workspace_id and email=v_subject and accepted_at is null and revoked_at is null) then
      raise exception using errcode='P0001', message='An invitation is already pending for this email.';
    end if;
    if (select count(*) from public.workspace_invitations where workspace_id=p_workspace_id and accepted_at is null and revoked_at is null)>=20 then
      raise exception using errcode='P0001', message='Revoke an unused invitation before inviting more people.';
    end if;
    insert into public.workspace_invitations(workspace_id,email,role,token_hash,invited_by)
      values(p_workspace_id,v_subject,p_role,p_token_hash,p_actor) returning * into v_invite;
  elsif p_action='revoke' then
    select * into v_invite from public.workspace_invitations where id=p_target and workspace_id=p_workspace_id for update;
    if v_invite.id is null then raise exception using errcode='P0001', message='Invitation not found.'; end if;
    if v_invite.role='admin' and v_actor<>'owner' then raise exception using errcode='42501', message='Only the owner can manage administrator invitations.'; end if;
    if v_invite.accepted_at is not null then raise exception using errcode='P0001', message='Invitation has already been accepted.'; end if;
    if v_invite.revoked_at is not null then return '{}'::jsonb; end if;
    update public.workspace_invitations set revoked_at=now() where id=p_target;
    v_subject:=v_invite.email;
  elsif p_action in ('role','remove') then
    select * into v_target from public.workspace_members where workspace_id=p_workspace_id and user_id=p_target;
    if v_target.user_id is null then raise exception using errcode='P0001', message='Member not found.'; end if;
    if p_target=p_actor or v_target.role='owner' or (v_actor<>'owner' and (v_target.role='admin' or p_action='role')) then
      raise exception using errcode='42501', message='You cannot change this member.';
    end if;
    select email into v_subject from auth.users where id=p_target;
    if p_action='role' then
      if p_role is null or p_role not in ('admin','member') then raise exception using errcode='42501', message='Invalid team role.'; end if;
      update public.workspace_members set role=p_role where workspace_id=p_workspace_id and user_id=p_target;
    else
      delete from public.workspace_members where workspace_id=p_workspace_id and user_id=p_target;
    end if;
    if p_action='remove' or (v_target.role='admin' and p_role='member') then
      update public.api_keys set revoked_at=now() where workspace_id=p_workspace_id and created_by=p_target and revoked_at is null;
    end if;
  else
    raise exception using errcode='P0001', message='Invalid team action.';
  end if;
  insert into public.team_events(workspace_id,actor_user_id,action,subject)
    values(p_workspace_id,p_actor,p_action,coalesce(v_subject,'') || case when p_action in ('invite','role') then ' (' || p_role::text || ')' else '' end);
  return jsonb_build_object('id',v_invite.id);
end $$;

create function public.accept_workspace_invitation(p_actor uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_invite public.workspace_invitations;
  v_user auth.users;
  v_existing uuid;
begin
  select * into v_invite from public.workspace_invitations where token_hash=p_token_hash;
  if v_invite.id is null then raise exception using errcode='P0001', message='This invitation is invalid or expired.'; end if;
  perform 1 from public.workspaces where id=v_invite.workspace_id and status='active' for update;
  if not found then raise exception using errcode='P0001', message='Workspace is not active.'; end if;
  select * into v_invite from public.workspace_invitations where id=v_invite.id for update;
  select * into v_user from auth.users where id=p_actor for update;
  if v_user.id is null or v_user.email_confirmed_at is null or lower(v_user.email)<>v_invite.email then
    raise exception using errcode='42501', message='Sign in with the verified email address that received this invitation.';
  end if;
  select workspace_id into v_existing from public.workspace_members where user_id=p_actor;
  if v_invite.accepted_by=p_actor and v_existing=v_invite.workspace_id then
    return jsonb_build_object('workspace_id',v_existing,'created',false);
  end if;
  if v_invite.revoked_at is not null or v_invite.accepted_at is not null or v_invite.expires_at<=now() then
    raise exception using errcode='P0001', message='This invitation is invalid or expired.';
  end if;
  if v_existing is not null then raise exception using errcode='P0001', message='Your account already belongs to a workspace.'; end if;
  -- Re-check the inviter: a demoted or removed administrator cannot grant access.
  if not exists(select 1 from public.workspace_members where user_id=v_invite.invited_by and workspace_id=v_invite.workspace_id
    and (role='owner' or (role='admin' and v_invite.role='member'))) then
    raise exception using errcode='P0001', message='Ask the workspace owner for a new invitation.';
  end if;
  insert into public.profiles(user_id,first_name,last_name,email)
    values(p_actor,coalesce(nullif(v_user.raw_user_meta_data->>'first_name',''),'Team'),
      coalesce(nullif(v_user.raw_user_meta_data->>'last_name',''),'Member'),v_user.email)
    on conflict (user_id) do nothing;
  insert into public.workspace_members(workspace_id,user_id,role) values(v_invite.workspace_id,p_actor,v_invite.role);
  update public.workspace_invitations set accepted_at=now(),accepted_by=p_actor where id=v_invite.id;
  insert into public.team_events(workspace_id,actor_user_id,action,subject) values(v_invite.workspace_id,p_actor,'joined',v_invite.email);
  return jsonb_build_object('workspace_id',v_invite.workspace_id,'created',false);
end $$;

revoke all on public.workspace_invitations, public.team_events from anon, authenticated;
revoke all on function public.manage_workspace_team(uuid,uuid,text,uuid,text,public.workspace_role,text) from public,anon,authenticated;
revoke all on function public.accept_workspace_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.manage_workspace_team(uuid,uuid,text,uuid,text,public.workspace_role,text) to service_role;
grant execute on function public.accept_workspace_invitation(uuid,text) to service_role;
