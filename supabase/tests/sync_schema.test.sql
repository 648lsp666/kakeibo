begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

set local request.jwt.claim.sub = '';
set local role postgres;

select throws_ok(
  $$ select public.apply_operation('op-1','transaction','tx-1','upsert','{"id":"tx-1","amount":12}'::jsonb) $$,
  '42501', 'authentication required', 'operation requires authentication'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select is((public.apply_operation('op-1','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":12,"externalId":"ext-1"}'::jsonb))->>'status', 'applied');
select is((public.apply_operation('op-1','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":999,"externalId":"ext-1"}'::jsonb))->>'status', 'duplicate');
select is((select payload->>'amount' from public.transactions where id='tx-1'), '12');

select is((public.apply_operation('op-2','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":18,"externalId":"ext-1"}'::jsonb))->>'status', 'applied');

select is((public.apply_operation('op-3','transaction','tx-1','delete',null))->>'status', 'deleted');
select is((public.apply_operation('op-4','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":20,"externalId":"ext-1"}'::jsonb))->>'status', 'rejected_deleted');

set local role postgres;
insert into public.transactions (user_id, id, payload, last_operation_id)
values (
  '22222222-2222-2222-2222-222222222222',
  'other-user-transaction',
  '{"id":"other-user-transaction","amount":77}',
  'other-user-operation'
);
set local role authenticated;

select is(
  (select count(*) from public.transactions where id = 'other-user-transaction'),
  0::bigint,
  'a user cannot read another user''s rows'
);

select throws_ok(
  $$ insert into public.categories (user_id, id, payload, last_operation_id)
     values (auth.uid(), 'direct-write', '{"id":"direct-write"}', 'direct-write') $$,
  '42501', 'permission denied for table categories',
  'clients cannot directly mutate business tables'
);

select is(
  (public.apply_operation('invalid-payload-id','transaction','expected-id','upsert',
    '{"id":"different-id"}'::jsonb))->>'status',
  'invalid',
  'payload id must equal entity id'
);

select is(
  (public.apply_operation('invalid-entity','wallet','wallet-1','upsert',
    '{"id":"wallet-1"}'::jsonb))->>'status',
  'invalid',
  'unknown entity types are invalid'
);

select ok(
  (public.apply_operation('invalid-operation','budget','budget-invalid','merge',
    '{"id":"budget-invalid"}'::jsonb))->>'status' = 'invalid'
  and (public.apply_operation('null-operation','budget','budget-null',null,
    '{"id":"budget-null"}'::jsonb))->>'status' = 'invalid',
  'unknown operations are invalid'
);

select is(
  (public.apply_operation('category-1','category','cat-1','upsert',
    '{"id":"cat-1","name":"Food"}'::jsonb))->>'status',
  'applied',
  'category operations use the fixed category mapping'
);

select is(
  (public.apply_operation('budget-1','budget','budget-1','upsert',
    '{"id":"budget-1","limit":500}'::jsonb))->>'status',
  'applied',
  'budget operations use the fixed budget mapping'
);

select is(
  (public.apply_operation('external-original','transaction','tx-original','upsert',
    '{"id":"tx-original","amount":31,"externalId":"shared-external-id"}'::jsonb))->>'status',
  'applied',
  'the original external transaction is applied'
);

select is(
  (public.apply_operation('external-duplicate','transaction','tx-duplicate','upsert',
    '{"id":"tx-duplicate","amount":99,"externalId":"shared-external-id"}'::jsonb))->>'status',
  'deduplicated',
  'duplicate external IDs return deduplicated status'
);

select is(
  (public.apply_operation('external-duplicate-record','transaction','tx-duplicate-2','upsert',
    '{"id":"tx-duplicate-2","amount":99,"externalId":"shared-external-id"}'::jsonb))->'record'->>'id',
  'tx-original',
  'an external-ID conflict returns the existing transaction'
);

select is(
  (select count(*) from public.transactions
    where payload->>'externalId' = 'shared-external-id'),
  1::bigint,
  'external-ID deduplication creates no second row'
);

select * from finish();
rollback;
