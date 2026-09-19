create table public.batch_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  email text not null,
  state text not null check (state in ('deliverable', 'risky', 'undeliverable', 'unknown')),
  reason text,
  score integer check (score between 0 and 100),
  response_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index batch_results_batch_row_idx on public.batch_results(batch_id, row_number);
create index batch_results_batch_state_idx on public.batch_results(batch_id, state, row_number);
create index batch_results_batch_email_idx on public.batch_results(batch_id, lower(email));

alter table public.batch_results enable row level security;

create policy "members read batch results" on public.batch_results
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = batch_results.workspace_id and wm.user_id = auth.uid()
  ));

revoke all on public.batch_results from anon, authenticated;
grant select on public.batch_results to authenticated;
