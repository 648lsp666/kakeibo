create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_entity_table(entity_type text)
returns regclass
language sql
immutable
strict
set search_path = ''
as $$
  select case entity_type
    when 'transaction' then 'public.transactions'::pg_catalog.regclass
    when 'category' then 'public.categories'::pg_catalog.regclass
    when 'budget' then 'public.budgets'::pg_catalog.regclass
  end
$$;

revoke all on function private.sync_entity_table(text) from public, anon, authenticated;

create or replace function public.apply_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  current_user_id uuid := auth.uid();
  mutation jsonb;
  mutation_id text;
  device_id text;
  entity_type text;
  entity_id text;
  operation text;
  payload jsonb;
  base_revision bigint;
  entity_table regclass;
  current_payload jsonb;
  current_revision bigint;
  current_deleted_at timestamptz;
  current_found boolean;
  affected_rows bigint;
  duplicate_payload jsonb;
  duplicate_revision bigint;
  duplicate_id text;
  change_sequence bigint;
  next_revision bigint;
  conflict boolean;
  status text;
  record jsonb;
  result jsonb;
  results jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if mutations is null or jsonb_typeof(mutations) <> 'array' then
    raise exception using errcode = '22023', message = 'mutations must be a JSON array';
  end if;

  -- Serialize a user's batches. Row locks below protect the business record; this
  -- transaction lock additionally closes the absent-row races for mutation IDs,
  -- deletion fingerprints, and transaction external IDs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 91370421)
  );

  for mutation in select value from jsonb_array_elements(mutations)
  loop
    mutation_id := nullif(pg_catalog.btrim(mutation->>'mutation_id'), '');
    device_id := nullif(pg_catalog.btrim(mutation->>'device_id'), '');
    entity_type := mutation->>'entity_type';
    entity_id := nullif(pg_catalog.btrim(mutation->>'entity_id'), '');
    operation := mutation->>'operation';
    payload := mutation->'payload';
    entity_table := private.sync_entity_table(entity_type);

    if mutation_id is not null then
      select applied.result
        into result
        from public.applied_mutations as applied
       where applied.user_id = current_user_id
         and applied.mutation_id = mutation_id;

      if found then
        results := results || jsonb_build_array(result);
        continue;
      end if;
    end if;

    status := 'invalid';
    conflict := false;
    next_revision := null;
    change_sequence := null;
    record := null;
    current_payload := null;
    current_revision := null;
    current_deleted_at := null;
    current_found := false;

    if jsonb_typeof(mutation) = 'object'
       and mutation_id is not null
       and device_id is not null
       and entity_table is not null
       and entity_id is not null
       and operation in ('upsert', 'delete', 'restore')
       and coalesce(mutation->>'base_revision', '') ~ '^[0-9]+$'
       and (
         pg_catalog.length(mutation->>'base_revision') < 19
         or (
           pg_catalog.length(mutation->>'base_revision') = 19
           and mutation->>'base_revision' <= '9223372036854775807'
         )
       )
       and not coalesce(payload ? 'user_id', false)
       and (
         (operation = 'upsert' and jsonb_typeof(payload) = 'object' and payload->>'id' = entity_id)
         or (operation = 'delete' and (payload is null or payload = 'null'::jsonb or jsonb_typeof(payload) = 'object'))
         or operation = 'restore'
       ) then
      base_revision := (mutation->>'base_revision')::bigint;

      execute pg_catalog.format(
        'select payload, revision, deleted_at from %s where user_id = $1 and id = $2 for update',
        entity_table
      )
      into current_payload, current_revision, current_deleted_at
      using current_user_id, entity_id;
      get diagnostics affected_rows = row_count;
      current_found := affected_rows > 0;

      if operation = 'upsert' and (
        (current_found and current_deleted_at is not null)
        or exists (
          select 1
            from public.deletion_registry registry
           where registry.user_id = current_user_id
             and registry.entity_type = entity_type
             and registry.entity_id = entity_id
        )
      ) then
        status := 'rejected_deleted';
        next_revision := current_revision;

      elsif operation = 'upsert' then
        if entity_type = 'transaction'
           and coalesce(payload->>'externalId', '') <> '' then
          select existing.id, existing.payload, existing.revision
            into duplicate_id, duplicate_payload, duplicate_revision
            from public.transactions existing
           where existing.user_id = current_user_id
             and existing.deleted_at is null
             and existing.payload->>'externalId' = payload->>'externalId'
             and existing.id <> entity_id
           for update;
        else
          duplicate_id := null;
          duplicate_payload := null;
          duplicate_revision := null;
        end if;

        if duplicate_id is not null then
          status := 'deduplicated';
          next_revision := duplicate_revision;
          record := duplicate_payload;
        elsif current_found then
          next_revision := current_revision + 1;
          conflict := base_revision <> current_revision;

          execute pg_catalog.format(
            'update %s set payload = $3, revision = $4, updated_at = pg_catalog.now(), deleted_at = null, last_mutation_id = $5, last_device_id = $6 where user_id = $1 and id = $2',
            entity_table
          ) using current_user_id, entity_id, payload, next_revision, mutation_id, device_id;

          insert into public.change_log (
            user_id, entity_type, entity_id, operation, before_data, after_data,
            revision, mutation_id, device_id
          ) values (
            current_user_id, entity_type, entity_id, 'upsert', current_payload, payload,
            next_revision, mutation_id, device_id
          ) returning sequence into change_sequence;

          status := 'applied';
          record := payload;
        else
          next_revision := 1;
          conflict := base_revision <> 0;

          execute pg_catalog.format(
            'insert into %s (user_id, id, payload, revision, last_mutation_id, last_device_id) values ($1, $2, $3, $4, $5, $6)',
            entity_table
          ) using current_user_id, entity_id, payload, next_revision, mutation_id, device_id;

          insert into public.change_log (
            user_id, entity_type, entity_id, operation, before_data, after_data,
            revision, mutation_id, device_id
          ) values (
            current_user_id, entity_type, entity_id, 'upsert', null, payload,
            next_revision, mutation_id, device_id
          ) returning sequence into change_sequence;

          status := 'applied';
          record := payload;
        end if;

      elsif operation = 'delete' then
        if not current_found then
          status := 'invalid';
        elsif current_deleted_at is not null then
          status := 'duplicate';
          next_revision := current_revision;
        else
          next_revision := current_revision + 1;
          conflict := base_revision <> current_revision;

          execute pg_catalog.format(
            'update %s set revision = $3, updated_at = pg_catalog.now(), deleted_at = pg_catalog.now(), last_mutation_id = $4, last_device_id = $5 where user_id = $1 and id = $2',
            entity_table
          ) using current_user_id, entity_id, next_revision, mutation_id, device_id;

          insert into public.change_log (
            user_id, entity_type, entity_id, operation, before_data, after_data,
            revision, mutation_id, device_id
          ) values (
            current_user_id, entity_type, entity_id, 'delete', current_payload, null,
            next_revision, mutation_id, device_id
          ) returning sequence into change_sequence;

          status := 'deleted';
        end if;

      elsif operation = 'restore' then
        if current_found
           and current_deleted_at is not null
           and current_deleted_at > pg_catalog.now() - interval '30 days'
           and base_revision = current_revision then
          next_revision := current_revision + 1;

          execute pg_catalog.format(
            'update %s set revision = $3, updated_at = pg_catalog.now(), deleted_at = null, last_mutation_id = $4, last_device_id = $5 where user_id = $1 and id = $2',
            entity_table
          ) using current_user_id, entity_id, next_revision, mutation_id, device_id;

          insert into public.change_log (
            user_id, entity_type, entity_id, operation, before_data, after_data,
            revision, mutation_id, device_id
          ) values (
            current_user_id, entity_type, entity_id, 'restore', null, current_payload,
            next_revision, mutation_id, device_id
          ) returning sequence into change_sequence;

          status := 'restored';
          record := current_payload;
        else
          status := 'invalid';
        end if;
      end if;
    end if;

    result := jsonb_build_object(
      'mutation_id', mutation_id,
      'entity_type', entity_type,
      'entity_id', entity_id,
      'status', status,
      'revision', next_revision,
      'sequence', change_sequence,
      'conflict', conflict,
      'record', record
    );

    if mutation_id is not null then
      insert into public.applied_mutations (user_id, mutation_id, result)
      values (current_user_id, mutation_id, result);
    end if;

    results := results || jsonb_build_array(result);
  end loop;

  return results;
end;
$$;

create or replace function public.pull_changes(after_sequence bigint, page_size integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  effective_after bigint := greatest(coalesce(after_sequence, 0), 0);
  effective_page_size integer := least(greatest(coalesce(page_size, 1), 1), 500);
  changes jsonb;
  latest_sequence bigint;
  min_available_sequence bigint;
  has_more boolean;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select coalesce(max(log.sequence), 0),
         min(log.sequence) filter (
           where log.created_at > pg_catalog.now() - interval '30 days'
         )
    into latest_sequence, min_available_sequence
    from public.change_log log
   where log.user_id = current_user_id;

  min_available_sequence := coalesce(
    min_available_sequence,
    case when latest_sequence = 0 then 0 else latest_sequence + 1 end
  );

  select coalesce(jsonb_agg(to_jsonb(page_row) - 'user_id' order by page_row.sequence), '[]'::jsonb)
    into changes
    from (
      select log.*
        from public.change_log log
       where log.user_id = current_user_id
         and log.sequence > effective_after
         and log.created_at > pg_catalog.now() - interval '30 days'
       order by log.sequence
       limit effective_page_size
    ) page_row;

  select exists (
    select 1
      from public.change_log log
     where log.user_id = current_user_id
       and log.sequence > coalesce(
         (select max((item->>'sequence')::bigint) from jsonb_array_elements(changes) item),
         effective_after
       )
       and log.created_at > pg_catalog.now() - interval '30 days'
  ) into has_more;

  return jsonb_build_object(
    'changes', changes,
    'latest_sequence', latest_sequence,
    'min_available_sequence', min_available_sequence,
    'has_more', has_more
  );
end;
$$;

create or replace function public.sync_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  transaction_rows jsonb;
  category_rows jsonb;
  budget_rows jsonb;
  latest_sequence bigint;
  min_available_sequence bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select coalesce(jsonb_agg(row.payload order by row.id), '[]'::jsonb)
    into transaction_rows
    from public.transactions row
   where row.user_id = current_user_id and row.deleted_at is null;

  select coalesce(jsonb_agg(row.payload order by row.id), '[]'::jsonb)
    into category_rows
    from public.categories row
   where row.user_id = current_user_id and row.deleted_at is null;

  select coalesce(jsonb_agg(row.payload order by row.id), '[]'::jsonb)
    into budget_rows
    from public.budgets row
   where row.user_id = current_user_id and row.deleted_at is null;

  select coalesce(max(log.sequence), 0),
         min(log.sequence) filter (
           where log.created_at > pg_catalog.now() - interval '30 days'
         )
    into latest_sequence, min_available_sequence
    from public.change_log log
   where log.user_id = current_user_id;

  min_available_sequence := coalesce(
    min_available_sequence,
    case when latest_sequence = 0 then 0 else latest_sequence + 1 end
  );

  return jsonb_build_object(
    'transactions', transaction_rows,
    'categories', category_rows,
    'budgets', budget_rows,
    'latest_sequence', latest_sequence,
    'min_available_sequence', min_available_sequence
  );
end;
$$;

create or replace function public.list_recoverable()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recoverable jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(history) - 'user_id' order by history.sequence desc), '[]'::jsonb)
    into recoverable
    from public.change_log history
   where history.user_id = current_user_id
     and history.created_at > pg_catalog.now() - interval '30 days'
     and (history.operation = 'delete' or history.before_data is not null);

  return jsonb_build_object('recoverable', recoverable);
end;
$$;

create or replace function public.purge_expired_sync_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_count bigint;
  category_count bigint;
  budget_count bigint;
begin
  with expired as (
    delete from public.transactions row
     where row.deleted_at <= pg_catalog.now() - interval '30 days'
     returning row.user_id, row.id, row.deleted_at
  ), registered as (
    insert into public.deletion_registry (user_id, entity_type, entity_id, deleted_at)
    select expired.user_id, 'transaction', expired.id, expired.deleted_at from expired
    on conflict (user_id, entity_type, entity_id) do update
      set deleted_at = greatest(public.deletion_registry.deleted_at, excluded.deleted_at)
    returning 1
  )
  select count(*) into transaction_count from registered;

  with expired as (
    delete from public.categories row
     where row.deleted_at <= pg_catalog.now() - interval '30 days'
     returning row.user_id, row.id, row.deleted_at
  ), registered as (
    insert into public.deletion_registry (user_id, entity_type, entity_id, deleted_at)
    select expired.user_id, 'category', expired.id, expired.deleted_at from expired
    on conflict (user_id, entity_type, entity_id) do update
      set deleted_at = greatest(public.deletion_registry.deleted_at, excluded.deleted_at)
    returning 1
  )
  select count(*) into category_count from registered;

  with expired as (
    delete from public.budgets row
     where row.deleted_at <= pg_catalog.now() - interval '30 days'
     returning row.user_id, row.id, row.deleted_at
  ), registered as (
    insert into public.deletion_registry (user_id, entity_type, entity_id, deleted_at)
    select expired.user_id, 'budget', expired.id, expired.deleted_at from expired
    on conflict (user_id, entity_type, entity_id) do update
      set deleted_at = greatest(public.deletion_registry.deleted_at, excluded.deleted_at)
    returning 1
  )
  select count(*) into budget_count from registered;

  update public.change_log log
     set before_data = null,
         after_data = null
   where log.created_at <= pg_catalog.now() - interval '30 days'
     and (log.before_data is not null or log.after_data is not null);

  return jsonb_build_object(
    'transaction', transaction_count,
    'category', category_count,
    'budget', budget_count
  );
end;
$$;

revoke all on function public.apply_mutations(jsonb) from public, anon;
revoke all on function public.pull_changes(bigint, integer) from public, anon;
revoke all on function public.sync_snapshot() from public, anon;
revoke all on function public.list_recoverable() from public, anon;
revoke all on function public.purge_expired_sync_history() from public, anon, authenticated;

grant execute on function public.apply_mutations(jsonb) to authenticated;
grant execute on function public.pull_changes(bigint, integer) to authenticated;
grant execute on function public.sync_snapshot() to authenticated;
grant execute on function public.list_recoverable() to authenticated;
grant execute on function public.purge_expired_sync_history() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'kakeibo-purge-sync-history',
  '17 3 * * *',
  'select public.purge_expired_sync_history()'
);
