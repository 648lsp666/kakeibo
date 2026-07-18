begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

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

select ok(
  (public.apply_operation('op-1','category','retry-target','upsert',
    '{"id":"retry-target","name":"Wrong target"}'::jsonb))->>'status' = 'duplicate'
  and (public.apply_operation('op-1','category','retry-target','upsert',
    '{"id":"retry-target","name":"Wrong target"}'::jsonb))->>'entity_type' = 'transaction'
  and (public.apply_operation('op-1','category','retry-target','upsert',
    '{"id":"retry-target","name":"Wrong target"}'::jsonb))->>'entity_id' = 'tx-1'
  and (public.apply_operation('op-1','category','retry-target','upsert',
    '{"id":"retry-target","name":"Wrong target"}'::jsonb))->'record'->>'amount' = '12',
  'a duplicate operation remains bound to its first entity target'
);

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

select ok(
  (public.apply_operation('external-duplicate','transaction','tx-duplicate','upsert',
    '{"id":"tx-duplicate","amount":101,"externalId":"shared-external-id"}'::jsonb))->>'status' = 'duplicate'
  and (public.apply_operation('external-duplicate','transaction','tx-duplicate','upsert',
    '{"id":"tx-duplicate","amount":101,"externalId":"shared-external-id"}'::jsonb))->>'entity_id' = 'tx-original'
  and (public.apply_operation('external-duplicate','transaction','tx-duplicate','upsert',
    '{"id":"tx-duplicate","amount":101,"externalId":"shared-external-id"}'::jsonb))->'record'->>'id' = 'tx-original',
  'a deduplicated operation retry returns the canonical transaction'
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

select ok(
  public.enable_bill_inbox(false) ~ '^[0-9a-f]{20}$',
  'an authenticated user receives an unguessable inbox alias'
);

select is(
  public.enable_bill_inbox(false),
  (select alias from public.bill_inboxes where user_id = auth.uid()),
  'enabling an existing inbox reuses its alias'
);

set local role postgres;
update public.bill_inboxes
   set alias = 'ffffffffffffffffffff'
 where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select isnt(
  public.enable_bill_inbox(true),
  'ffffffffffffffffffff',
  'resetting an inbox invalidates its previous alias'
);

select is(
  (select count(*) from public.bill_inboxes),
  1::bigint,
  'a user can read only their own inbox row'
);

select throws_ok(
  $$ insert into public.pending_bills (
       id, user_id, resend_email_id, filename, status, received_at, expires_at
     ) values (
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'direct-email',
       'bill.zip', 'pending', now(), now() + interval '7 days'
     ) $$,
  '42501', 'permission denied for table pending_bills',
  'clients cannot directly create pending bill rows'
);

set local role postgres;
insert into public.bill_inboxes (user_id, alias)
values ('22222222-2222-2222-2222-222222222222', '22222222222222222222');
insert into public.pending_bills (
  id, user_id, resend_email_id, attachment_id, filename, content_type, size_bytes,
  storage_path, content_sha256, status, received_at, expires_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'email-own', 'attachment-own', 'wechat.zip', 'application/zip', 1024,
   '11111111-1111-1111-1111-111111111111/own/wechat.zip', repeat('a', 64),
   'pending', now(), now() + interval '7 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
   'email-other', 'attachment-other', 'alipay.zip', 'application/zip', 2048,
   '22222222-2222-2222-2222-222222222222/other/alipay.zip', repeat('b', 64),
   'pending', now(), now() + interval '7 days');
set local role authenticated;

select is(
  (select count(*) from public.bill_inboxes where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'inbox rows are isolated by user'
);

select is(
  (select count(*) from public.pending_bills),
  1::bigint,
  'pending bill rows are isolated by user'
);

select throws_ok(
  $$ update public.pending_bills
        set status = 'completed', storage_path = null, source = 'wechat',
            statement_period = '2026-06', imported_count = 12, completed_at = now()
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', 'permission denied for table pending_bills',
  'clients cannot bypass the attachment-cleanup Edge Function'
);

select * from finish();
rollback;
