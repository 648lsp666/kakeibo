begin;

create extension if not exists pgtap with schema extensions;

select plan(68);

insert into public.transactions (
  user_id, id, payload, last_mutation_id, last_device_id
) values
  ('11111111-1111-1111-1111-111111111111', 'transaction-user-one', '{"amount": 10}', 'mutation-one', 'device-one'),
  ('22222222-2222-2222-2222-222222222222', 'transaction-user-two', '{"amount": 20}', 'mutation-two', 'device-two');

insert into public.change_log (
  user_id, entity_type, entity_id, operation, after_data, revision, mutation_id, device_id
) values
  ('11111111-1111-1111-1111-111111111111', 'transaction', 'transaction-user-one', 'upsert', '{"amount": 10}', 1, 'mutation-one', 'device-one'),
  ('22222222-2222-2222-2222-222222222222', 'transaction', 'transaction-user-two', 'upsert', '{"amount": 20}', 1, 'mutation-two', 'device-two');

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select is(
  (select count(*) from public.transactions),
  1::bigint,
  'an authenticated user sees only their own transaction'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, id, payload, last_mutation_id, last_device_id
    ) values (
      '11111111-1111-1111-1111-111111111111', 'direct-client-write', '{}', 'mutation-three', 'device-one'
    )
  $$,
  '42501',
  'permission denied for table transactions',
  'an authenticated user cannot insert directly'
);

select is(
  (
    select count(*)
    from public.change_log
    where user_id = '22222222-2222-2222-2222-222222222222'
  ),
  0::bigint,
  'an authenticated user cannot read another user''s change log'
);

set local role postgres;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.apply_mutations('[]'::jsonb) $$,
  '42501',
  'authentication required',
  'apply_mutations rejects unauthenticated calls'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  ))))->0->>'status',
  'applied',
  'first mutation is applied'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  ))))->0->>'status',
  'applied',
  'duplicate mutation returns its recorded result'
);

set local role postgres;

select is(
  (select count(*) from public.applied_mutations where user_id = auth.uid() and mutation_id = 'm-1'),
  1::bigint,
  'an idempotent retry stores one receipt'
);

select is(
  (select array_agg(key order by key) from jsonb_object_keys(
    (select result from public.applied_mutations where user_id = auth.uid() and mutation_id = 'm-1')
  ) as key),
  array['conflict','entity_id','entity_type','mutation_id','record','revision','sequence','status']::text[],
  'every mutation result has the exact deterministic key set'
);

set local role authenticated;

select is(
  (select revision from public.transactions where id = 'tx-1'),
  1::bigint,
  'a newly inserted record starts at revision one'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-2','device_id','device-b','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',31,'externalId','ext-1')
  ))))->0->>'status',
  'applied',
  'a stale non-delete upsert is accepted as last-server-arrival wins'
);

select ok(
  ((public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-2','device_id','device-b','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',31,'externalId','ext-1')
  ))))->0->>'conflict')::boolean,
  'a stale overwrite is marked as a conflict'
);

select is(
  (select revision from public.transactions where id = 'tx-1'),
  2::bigint,
  'a stale overwrite increments revision exactly once'
);

select is(
  (select before_data->>'amount' from public.change_log where user_id = auth.uid() and mutation_id = 'm-2'),
  '29',
  'a stale overwrite keeps the overwritten server value in history'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','future-existing','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',3,
    'payload',jsonb_build_object('id','tx-1','amount',88,'externalId','ext-1')
  ))))->0->>'status',
  'invalid',
  'an upsert cannot claim a future revision for an existing record'
);

select is(
  (select revision from public.transactions where id = 'tx-1'),
  2::bigint,
  'a future revision leaves an existing record unchanged'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','future-create','device_id','device-a','entity_type','budget',
    'entity_id','future-budget','operation','upsert','base_revision',1,
    'payload',jsonb_build_object('id','future-budget','limit',10)
  ))))->0->>'status',
  'invalid',
  'a new record requires base revision zero'
);

select is(
  (select count(*) from public.budgets where id = 'future-budget'),
  0::bigint,
  'a nonzero new-record revision writes no business row'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-3','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','delete','base_revision',2,'payload',null
  ))))->0->>'status',
  'deleted',
  'delete returns deleted status'
);

select ok(
  (select deleted_at is not null and payload is not null from public.transactions where id = 'tx-1'),
  'delete preserves a recoverable server tombstone'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-4','device_id','device-c','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',2,
    'payload',jsonb_build_object('id','tx-1','amount',99,'externalId','ext-1')
  ))))->0->>'status',
  'rejected_deleted',
  'an ordinary stale upsert cannot revive a tombstone'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-4','device_id','device-c','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',2,
    'payload',jsonb_build_object('id','tx-1','amount',99,'externalId','ext-1')
  ))))->0->'record'->>'amount',
  '31',
  'rejected_deleted returns the authoritative current tombstone record'
);

select is(
  (select revision from public.transactions where id = 'tx-1'),
  3::bigint,
  'a rejected stale upsert does not increment the tombstone revision'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-5','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','restore','base_revision',3,
    'payload',jsonb_build_object('id','tx-1','amount',999,'externalId','ext-1')
  ))))->0->>'status',
  'restored',
  'an explicit restore revives a recent tombstone'
);

select is(
  (select payload->>'amount' from public.transactions where id = 'tx-1'),
  '31',
  'restore uses retained server data rather than untrusted client payload'
);

select is(
  (select revision from public.transactions where id = 'tx-1'),
  4::bigint,
  'restore increments revision exactly once'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','invalid-owner','device_id','device-a','entity_type','transaction',
    'entity_id','injected-owner','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','injected-owner','amount',1,'user_id','22222222-2222-2222-2222-222222222222')
  ))))->0->>'status',
  'invalid',
  'a client payload cannot choose another owner'
);

select is(
  (select count(*) from public.transactions where id = 'injected-owner'),
  0::bigint,
  'an invalid owner payload writes no business row'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-dedupe','device_id','device-a','entity_type','transaction',
    'entity_id','tx-duplicate','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-duplicate','amount',31,'externalId','ext-1')
  ))))->0->>'status',
  'deduplicated',
  'a duplicate transaction external ID maps to the existing record'
);

select is(
  (select count(*) from public.transactions where id = 'tx-duplicate'),
  0::bigint,
  'external-ID deduplication creates no second transaction'
);

select ok(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-dedupe','device_id','device-a','entity_type','transaction',
    'entity_id','tx-duplicate','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-duplicate','amount',31,'externalId','ext-1')
  )))->0->'sequence') = 'null'::jsonb,
  'deduplication does not invent a change sequence'
);

select ok(
  (
    select count(*) = 6 and bool_and(item->>'status' = 'invalid')
    from jsonb_array_elements(public.apply_mutations(jsonb_build_array(
      jsonb_build_object('mutation_id','invalid-entity','device_id','d','entity_type','wallet','entity_id','x','operation','upsert','base_revision',0,'payload','{}'::jsonb),
      jsonb_build_object('mutation_id','invalid-operation','device_id','d','entity_type','budget','entity_id','x','operation','merge','base_revision',0,'payload','{}'::jsonb),
      jsonb_build_object('mutation_id','invalid-device','device_id','','entity_type','budget','entity_id','x','operation','upsert','base_revision',0,'payload','{}'::jsonb),
      jsonb_build_object('mutation_id','invalid-payload','device_id','d','entity_type','budget','entity_id','x','operation','upsert','base_revision',0,'payload','[]'::jsonb),
      jsonb_build_object('mutation_id','invalid-revision','device_id','d','entity_type','budget','entity_id','x','operation','upsert','base_revision',99999999999999999999999999999999999999,'payload',jsonb_build_object('id','x')),
      jsonb_build_object('mutation_id','invalid-restore','device_id','d','entity_type','budget','entity_id','missing','operation','restore','base_revision',0,'payload',null)
    ))) item
  ),
  'invalid entity, operation, device, payload, revision, and missing restore are rejected'
);

select ok(
  (
    select item->'revision' = 'null'::jsonb
       and item->'sequence' = 'null'::jsonb
       and item->'record' = 'null'::jsonb
    from jsonb_array_elements(public.apply_mutations(jsonb_build_array(
      jsonb_build_object('mutation_id','invalid-entity','device_id','d','entity_type','wallet','entity_id','x','operation','upsert','base_revision',0,'payload','{}'::jsonb)
    ))) item
  ),
  'an invalid result includes explicit null revision, sequence, and record fields'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','category-1','device_id','device-a','entity_type','category',
    'entity_id','cat-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','cat-1','name','Food')
  ))))->0->>'status',
  'applied',
  'the fixed category entity mapping applies category mutations'
);

set local role postgres;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local role authenticated;

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','other-user-1','device_id','other-device','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',77,'externalId','other-ext')
  ))))->0->>'status',
  'applied',
  'the same entity ID is independently owned by another user'
);

select is(
  (
    select item->'record'->>'amount'
    from jsonb_array_elements(public.sync_snapshot()->'transactions') item
    where item->'record'->>'id' = 'tx-1'
  ),
  '77',
  'snapshot cannot expose the other owner''s same-ID record'
);

select is(
  (select count(*) from jsonb_array_elements(public.pull_changes(0, 500)->'changes') c where c->>'mutation_id' = 'm-1'),
  0::bigint,
  'change-feed RPC cannot expose another user''s changes'
);

set local role postgres;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','budget-1','device_id','device-a','entity_type','budget',
    'entity_id','budget-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','budget-1','limit',500)
  ))))->0->>'status',
  'applied',
  'the fixed budget entity mapping applies budget mutations'
);

select ok(
  not exists (
    select 1
    from (
      select (c->>'sequence')::bigint as sequence,
             lag((c->>'sequence')::bigint) over (order by (c->>'sequence')::bigint) as previous_sequence
      from jsonb_array_elements(public.pull_changes(0, 500)->'changes') c
    ) ordered_changes
    where sequence <= previous_sequence
  ),
  'change sequences are strictly increasing for a user'
);

select ok(
  exists (
    select 1
    from (
      select (c->>'sequence')::bigint as sequence,
             lag((c->>'sequence')::bigint) over (order by (c->>'sequence')::bigint) as previous_sequence
      from jsonb_array_elements(public.pull_changes(0, 500)->'changes') c
    ) ordered_changes
    where sequence > previous_sequence + 1
  ),
  'global sequencing permits ownership-filtered gaps'
);

select is(
  jsonb_array_length(public.pull_changes(0, 2)->'changes'),
  2,
  'pull_changes limits a page'
);

select ok(
  (public.pull_changes(0, 2)->>'has_more')::boolean,
  'pull_changes reports another page'
);

select ok(
  (
    select bool_and((c->>'sequence')::bigint > 0)
    from jsonb_array_elements(public.pull_changes(0, 2)->'changes') c
  ),
  'pull_changes returns only sequences after the cursor'
);

select is(
  jsonb_array_length(public.pull_changes(0, 0)->'changes'),
  1,
  'pull_changes clamps a non-positive page size to one'
);

select ok(
  jsonb_array_length(public.pull_changes(0, 1000)->'changes') <= 500,
  'pull_changes clamps oversized pages to 500'
);

select ok(
  public.sync_snapshot()->'transactions' @> '[{"record":{"id":"tx-1","amount":31,"externalId":"ext-1"},"revision":4}]'::jsonb,
  'snapshot contains the authenticated user''s live transactions'
);

select ok(
  public.sync_snapshot()->'categories' @> '[{"record":{"id":"cat-1","name":"Food"},"revision":1}]'::jsonb
  and public.sync_snapshot()->'budgets' @> '[{"record":{"id":"budget-1","limit":500},"revision":1}]'::jsonb,
  'snapshot includes mapped category and budget payloads'
);

select is(
  (select provolatile::text from pg_proc where oid = 'public.sync_snapshot()'::regprocedure),
  's',
  'sync_snapshot is stable so all reads use one query snapshot'
);

select ok(
  public.sync_snapshot()->'transactions' @> '[{"record":{"id":"tx-1"},"revision":4}]'::jsonb
  and public.sync_snapshot()->'categories' @> '[{"record":{"id":"cat-1"},"revision":1}]'::jsonb
  and public.sync_snapshot()->'budgets' @> '[{"record":{"id":"budget-1"},"revision":1}]'::jsonb,
  'every snapshot entity includes its authoritative server revision'
);

select is(
  (public.sync_snapshot()->>'latest_sequence')::bigint,
  (select max(sequence) from public.change_log where user_id = auth.uid()),
  'snapshot publishes the user''s latest sequence'
);

select is(
  (public.sync_snapshot()->>'min_available_sequence')::bigint,
  (select min(sequence) from public.change_log where user_id = auth.uid()),
  'snapshot publishes the minimum retained sequence'
);

select ok(
  exists (
    select 1 from jsonb_array_elements(public.list_recoverable()->'recoverable') item
    where item->>'mutation_id' = 'm-3' and item->>'operation' = 'delete'
  ),
  'recoverable history includes recent deletes'
);

select ok(
  exists (
    select 1 from jsonb_array_elements(public.list_recoverable()->'recoverable') item
    where item->>'mutation_id' = 'm-2' and item->'before_data'->>'amount' = '29'
  ),
  'recoverable history includes overwritten before_data'
);

set local role postgres;

update public.applied_mutations
   set created_at = now() - interval '31 days'
 where user_id = '11111111-1111-1111-1111-111111111111'
   and mutation_id = 'm-1';

insert into public.transactions (
  user_id, id, payload, revision, updated_at, deleted_at, last_mutation_id, last_device_id
) values (
  '11111111-1111-1111-1111-111111111111', 'expired-tombstone', '{"id":"expired-tombstone","amount":5}', 2,
  now() - interval '31 days', now() - interval '31 days', 'expired-delete', 'old-device'
);

insert into public.change_log (
  user_id, entity_type, entity_id, operation, before_data, after_data,
  revision, mutation_id, device_id, created_at
) values (
  '11111111-1111-1111-1111-111111111111', 'transaction', 'expired-tombstone', 'delete',
  '{"id":"expired-tombstone","amount":5}', null, 2, 'expired-delete', 'old-device', now() - interval '31 days'
), (
  '33333333-3333-3333-3333-333333333333', 'budget', 'expired-only-history', 'upsert',
  null, '{"id":"expired-only-history","limit":10}', 1, 'expired-only-change', 'old-device', now() - interval '31 days'
);

select is(
  (public.purge_expired_sync_history()->>'transaction')::bigint,
  1::bigint,
  'cleanup reports purged transaction tombstones by entity type'
);

select is(
  (select count(*) from public.deletion_registry where user_id = '11111111-1111-1111-1111-111111111111' and entity_type = 'transaction' and entity_id = 'expired-tombstone'),
  1::bigint,
  'cleanup writes a compact permanent deletion fingerprint'
);

select is(
  (select count(*) from public.transactions where user_id = '11111111-1111-1111-1111-111111111111' and id = 'expired-tombstone'),
  0::bigint,
  'cleanup removes the payload-bearing business tombstone'
);

select is(
  (select count(*) from public.change_log where mutation_id = 'expired-delete' and before_data is null and after_data is null),
  1::bigint,
  'cleanup strips expired payloads while retaining the sequence high-water mark'
);

select ok(
  (
    select result->'record' = 'null'::jsonb and result::text not like '%"amount"%'
    from public.applied_mutations
    where user_id = '11111111-1111-1111-1111-111111111111' and mutation_id = 'm-1'
  ),
  'cleanup strips expired receipt payloads while retaining the idempotency receipt'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set local role authenticated;

select ok(
  (public.sync_snapshot()->>'latest_sequence')::bigint = (
    select sequence from public.change_log where mutation_id = 'expired-only-change'
  )
  and (public.sync_snapshot()->>'min_available_sequence')::bigint = (
    select sequence + 1 from public.change_log where mutation_id = 'expired-only-change'
  ),
  'an expired-only history retains latest sequence and advances minimum availability'
);

select is(
  jsonb_array_length(public.pull_changes(0, 500)->'changes'),
  0,
  'pull_changes never returns expired payload-stripped history'
);

set local role postgres;

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select ok(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  )))->0->>'status') = 'applied'
  and (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  )))->0->'record') = 'null'::jsonb
  and (select revision from public.transactions where id = 'tx-1') = 4,
  'an expired receipt retry remains idempotent without returning retained content'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','expired-recreate','device_id','device-a','entity_type','transaction',
    'entity_id','expired-tombstone','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','expired-tombstone','amount',6)
  ))))->0->>'status',
  'rejected_deleted',
  'a permanent deletion fingerprint rejects an ordinary recreation'
);

select is(
  (select count(*) from public.transactions where id = 'expired-tombstone'),
  0::bigint,
  'rejected permanent recreation writes no business row'
);

select ok(
  not exists (
    select 1 from jsonb_array_elements(public.list_recoverable()->'recoverable') item
    where item->>'mutation_id' = 'expired-delete'
  ),
  'expired delete history is not recoverable'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'the entity-table mapping helper is private from clients'
);

select ok(
  has_function_privilege('authenticated', 'public.apply_mutations(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.apply_mutations(jsonb)', 'EXECUTE'),
  'only authenticated clients can execute apply_mutations'
);

select ok(
  has_function_privilege('authenticated', 'public.pull_changes(bigint,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.sync_snapshot()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_recoverable()', 'EXECUTE'),
  'authenticated clients can execute only the read-side sync RPCs'
);

select ok(
  has_function_privilege('service_role', 'public.purge_expired_sync_history()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.purge_expired_sync_history()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.purge_expired_sync_history()', 'EXECUTE'),
  'purge is reserved for the service role'
);

set local role postgres;

select is(
  (select count(*) from cron.job where jobname = 'kakeibo-purge-sync-history' and schedule = '17 3 * * *'),
  1::bigint,
  'cleanup is scheduled once at 03:17 UTC'
);

select * from finish();
rollback;
