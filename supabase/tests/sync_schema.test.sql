begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

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

select * from finish();
rollback;
