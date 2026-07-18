create table public.transactions (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  last_operation_id text not null,
  primary key (user_id, id),
  check (payload is null or payload->>'id' = id)
);

create unique index transactions_external_id_unique
  on public.transactions (user_id, (payload->>'externalId'))
  where deleted_at is null and payload ? 'externalId' and payload->>'externalId' <> '';

create table public.categories (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  last_operation_id text not null,
  primary key (user_id, id),
  check (payload is null or payload->>'id' = id)
);

create table public.budgets (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  last_operation_id text not null,
  primary key (user_id, id),
  check (payload is null or payload->>'id' = id)
);

create table public.applied_operations (
  user_id uuid not null,
  operation_id text not null,
  entity_type text not null check (entity_type in ('transaction','category','budget')),
  entity_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, operation_id)
);

alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.applied_operations enable row level security;

revoke all on table public.transactions, public.categories, public.budgets
  from anon, authenticated;
grant select on table public.transactions, public.categories, public.budgets
  to authenticated;
revoke all on table public.applied_operations from anon, authenticated;

create policy "Users can read their own transactions"
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own categories"
  on public.categories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own budgets"
  on public.budgets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table
  public.transactions,
  public.categories,
  public.budgets;

create or replace function public.apply_operation(
  p_operation_id text,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  current_user_id uuid := auth.uid();
  entity_table regclass;
  inserted bigint;
  current_payload jsonb;
  current_updated_at timestamptz;
  current_deleted_at timestamptz;
  current_found boolean;
  receipt_entity_type text;
  receipt_entity_id text;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  entity_table := case p_entity_type
    when 'transaction' then 'public.transactions'::pg_catalog.regclass
    when 'category' then 'public.categories'::pg_catalog.regclass
    when 'budget' then 'public.budgets'::pg_catalog.regclass
    else null
  end;

  if nullif(pg_catalog.btrim(p_operation_id), '') is null
     or nullif(pg_catalog.btrim(p_entity_id), '') is null
     or entity_table is null
     or p_operation is null
     or p_operation not in ('upsert', 'delete')
     or (
       p_operation = 'upsert'
       and (
         p_payload is null
         or pg_catalog.jsonb_typeof(p_payload) <> 'object'
         or p_payload->>'id' is distinct from p_entity_id
         or p_payload ? 'user_id'
       )
     )
     or (
       p_operation = 'delete'
       and p_payload is not null
       and p_payload <> 'null'::jsonb
     ) then
    return pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'status', 'invalid',
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'record', null,
      'updated_at', null,
      'deleted_at', null
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 21997831)
  );

  insert into public.applied_operations (user_id, operation_id, entity_type, entity_id)
  values (current_user_id, p_operation_id, p_entity_type, p_entity_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    select applied.entity_type, applied.entity_id
      into receipt_entity_type, receipt_entity_id
      from public.applied_operations as applied
     where applied.user_id = current_user_id
       and applied.operation_id = p_operation_id;

    entity_table := case receipt_entity_type
      when 'transaction' then 'public.transactions'::pg_catalog.regclass
      when 'category' then 'public.categories'::pg_catalog.regclass
      when 'budget' then 'public.budgets'::pg_catalog.regclass
    end;

    execute pg_catalog.format(
      'select payload, updated_at, deleted_at from %s where user_id = $1 and id = $2',
      entity_table
    )
    into current_payload, current_updated_at, current_deleted_at
    using current_user_id, receipt_entity_id;

    return pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'status', 'duplicate',
      'entity_type', receipt_entity_type,
      'entity_id', receipt_entity_id,
      'record', current_payload,
      'updated_at', current_updated_at,
      'deleted_at', current_deleted_at
    );
  end if;

  execute pg_catalog.format(
    'select payload, updated_at, deleted_at from %s where user_id = $1 and id = $2 for update',
    entity_table
  )
  into current_payload, current_updated_at, current_deleted_at
  using current_user_id, p_entity_id;
  get diagnostics inserted = row_count;
  current_found := inserted > 0;

  if current_found and current_deleted_at is not null and p_operation = 'upsert' then
    return pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'status', 'rejected_deleted',
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'record', current_payload,
      'updated_at', current_updated_at,
      'deleted_at', current_deleted_at
    );
  end if;

  if p_operation = 'upsert' then
    if p_entity_type = 'transaction'
       and coalesce(p_payload->>'externalId', '') <> '' then
      select existing.id, existing.payload, existing.updated_at, existing.deleted_at
        into receipt_entity_id, current_payload, current_updated_at, current_deleted_at
        from public.transactions as existing
       where existing.user_id = current_user_id
         and existing.id <> p_entity_id
         and existing.deleted_at is null
         and existing.payload->>'externalId' = p_payload->>'externalId'
       for update;

      if found then
        update public.applied_operations
           set entity_id = receipt_entity_id
         where user_id = current_user_id
           and operation_id = p_operation_id;

        return pg_catalog.jsonb_build_object(
          'operation_id', p_operation_id,
          'status', 'deduplicated',
          'entity_type', p_entity_type,
          'entity_id', receipt_entity_id,
          'record', current_payload,
          'updated_at', current_updated_at,
          'deleted_at', current_deleted_at
        );
      end if;
    end if;

    execute pg_catalog.format(
      'insert into %s (user_id, id, payload, updated_at, deleted_at, last_operation_id)
       values ($1, $2, $3, pg_catalog.clock_timestamp(), null, $4)
       on conflict (user_id, id) do update
       set payload = excluded.payload,
           updated_at = pg_catalog.clock_timestamp(),
           deleted_at = null,
           last_operation_id = excluded.last_operation_id
       returning payload, updated_at, deleted_at',
      entity_table
    )
    into current_payload, current_updated_at, current_deleted_at
    using current_user_id, p_entity_id, p_payload, p_operation_id;

    return pg_catalog.jsonb_build_object(
      'operation_id', p_operation_id,
      'status', 'applied',
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'record', current_payload,
      'updated_at', current_updated_at,
      'deleted_at', current_deleted_at
    );
  end if;

  execute pg_catalog.format(
    'insert into %s (user_id, id, payload, updated_at, deleted_at, last_operation_id)
     values ($1, $2, null, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(), $3)
     on conflict (user_id, id) do update
     set updated_at = pg_catalog.clock_timestamp(),
         deleted_at = pg_catalog.clock_timestamp(),
         last_operation_id = excluded.last_operation_id
     returning payload, updated_at, deleted_at',
    entity_table
  )
  into current_payload, current_updated_at, current_deleted_at
  using current_user_id, p_entity_id, p_operation_id;

  return pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id,
    'status', 'deleted',
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'record', current_payload,
    'updated_at', current_updated_at,
    'deleted_at', current_deleted_at
  );
end;
$$;

revoke all on function public.apply_operation(text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.apply_operation(text, text, text, text, jsonb)
  to authenticated;
