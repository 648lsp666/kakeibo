create extension if not exists pgcrypto with schema extensions;

create table public.bill_inboxes (
  user_id uuid primary key,
  alias text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  check (alias ~ '^[0-9a-f]{20}$')
);

create table public.pending_bills (
  id uuid primary key,
  user_id uuid not null,
  resend_email_id text not null,
  attachment_id text,
  filename text not null,
  content_type text,
  size_bytes bigint,
  storage_path text,
  content_sha256 text,
  status text not null check (status in ('pending', 'failed', 'completed')),
  failure_reason text,
  source text check (source is null or source in ('wechat', 'alipay')),
  statement_period text check (statement_period is null or statement_period ~ '^\d{4}-\d{2}$'),
  imported_count integer check (imported_count is null or imported_count >= 0),
  received_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique (user_id, resend_email_id),
  unique (user_id, resend_email_id, attachment_id),
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  check (
    status <> 'pending'
    or (
      attachment_id is not null
      and storage_path is not null
      and content_sha256 is not null
      and size_bytes is not null
      and size_bytes between 1 and 20971520
    )
  ),
  check (
    status <> 'completed'
    or (
      storage_path is null
      and source is not null
      and imported_count is not null
      and completed_at is not null
    )
  )
);

create unique index pending_bills_user_hash_unique
  on public.pending_bills (user_id, content_sha256)
  where content_sha256 is not null;

create index pending_bills_user_queue_idx
  on public.pending_bills (user_id, received_at desc)
  where status in ('pending', 'failed');

alter table public.bill_inboxes enable row level security;
alter table public.pending_bills enable row level security;

revoke all on table public.bill_inboxes, public.pending_bills from anon, authenticated;
grant select on table public.bill_inboxes, public.pending_bills to authenticated;

create policy "Users can read their own bill inbox"
  on public.bill_inboxes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own pending bills"
  on public.pending_bills
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bill-attachments',
  'bill-attachments',
  false,
  20971520,
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can download their own bill attachments"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bill-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.enable_bill_inbox(p_reset boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_alias text;
  candidate text;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_reset then
    delete from public.bill_inboxes where user_id = current_user_id;
  end if;

  loop
    select inbox.alias
      into current_alias
      from public.bill_inboxes as inbox
     where inbox.user_id = current_user_id;

    if current_alias is not null then
      return current_alias;
    end if;

    candidate := pg_catalog.encode(extensions.gen_random_bytes(10), 'hex');
    insert into public.bill_inboxes (user_id, alias)
    values (current_user_id, candidate)
    on conflict do nothing;

    if found then
      return candidate;
    end if;
  end loop;

  raise exception 'failed to allocate bill inbox alias';
end;
$$;

revoke all on function public.enable_bill_inbox(boolean) from public, anon;
grant execute on function public.enable_bill_inbox(boolean) to authenticated;

alter publication supabase_realtime add table public.pending_bills;
