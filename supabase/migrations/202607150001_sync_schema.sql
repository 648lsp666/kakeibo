create table public.transactions (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_mutation_id text not null,
  last_device_id text not null,
  primary key (user_id, id),
  check (deleted_at is not null or payload is not null)
);

create unique index transactions_external_id_unique
  on public.transactions (user_id, (payload->>'externalId'))
  where deleted_at is null and payload ? 'externalId' and payload->>'externalId' <> '';

create table public.categories (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_mutation_id text not null,
  last_device_id text not null,
  primary key (user_id, id),
  check (deleted_at is not null or payload is not null)
);

create table public.budgets (
  user_id uuid not null,
  id text not null,
  payload jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_mutation_id text not null,
  last_device_id text not null,
  primary key (user_id, id),
  check (deleted_at is not null or payload is not null)
);

create table public.change_log (
  sequence bigint generated always as identity primary key,
  user_id uuid not null,
  entity_type text not null check (entity_type in ('transaction','category','budget')),
  entity_id text not null,
  operation text not null check (operation in ('upsert','delete','restore')),
  before_data jsonb,
  after_data jsonb,
  revision bigint not null,
  mutation_id text not null,
  device_id text not null,
  created_at timestamptz not null default now()
);

create table public.applied_mutations (
  user_id uuid not null,
  mutation_id text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);

create table public.deletion_registry (
  user_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  deleted_at timestamptz not null,
  primary key (user_id, entity_type, entity_id)
);

alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.change_log enable row level security;
alter table public.applied_mutations enable row level security;
alter table public.deletion_registry enable row level security;

grant select on table public.transactions, public.categories, public.budgets, public.change_log
  to authenticated;

revoke insert, update, delete on table
  public.transactions,
  public.categories,
  public.budgets,
  public.change_log
  from anon, authenticated;

revoke all on table public.applied_mutations, public.deletion_registry
  from anon, authenticated;

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

create policy "Users can read their own change log"
  on public.change_log
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
