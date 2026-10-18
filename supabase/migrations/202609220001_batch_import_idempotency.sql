alter table public.batches
  add column request_key text,
  add column request_hash text;
create unique index batches_workspace_request_key_idx
  on public.batches(workspace_id, request_key) where request_key is not null;
