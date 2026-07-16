# Automatic Multi-Device Sync Implementation Plan

> **Superseded by [2026-07-15-simple-offline-sync-design.md](../specs/2026-07-15-simple-offline-sync-design.md).** This plan is retained as historical context and must not guide new runtime work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable, local-first, automatic multi-device synchronization for transactions, custom categories, budgets, and deletions under one personal Supabase account.

**Architecture:** IndexedDB remains the only UI-facing datastore. Every local domain write atomically updates business data and an outbox; a singleton SyncEngine pulls sequence-based changes, pushes idempotent mutations through Supabase RPC, and uses Realtime only as a wake-up signal. Supabase Auth, Postgres RLS, recoverable tombstones, compact deletion fingerprints, and change history provide account isolation and deterministic recovery.

**Tech Stack:** React 19, TypeScript 5.8, idb 8, Zustand 5, Vitest 4, Supabase JS 2, Supabase CLI 2, PostgreSQL/PLpgSQL, pgTAP, Playwright-compatible browser E2E.

## Global Constraints

- Preserve transaction amount precision, `YYYY-MM-DD` date semantics, stable category IDs, and CSV `externalId` duplicate behavior.
- UI reads and writes IndexedDB only; React components and hooks never write Supabase directly.
- Local writes remain available without a session or network and never wait for remote confirmation.
- Sync only transactions, custom categories, budgets, and deletion state. Keep system categories, theme, session tokens, WebDAV credentials, and device preferences local.
- Use email OTP, per-user RLS, HTTPS, and the public Supabase anon key. Never place a service-role key in the client or repository.
- Realtime is advisory. Sequence cursors and full-snapshot fallback are the source of eventual consistency.
- Keep recoverable record content for 30 days; keep only `(user_id, entity_type, entity_id)` deletion fingerprints afterward.
- An ordinary stale upsert never revives a deleted ID. Restore is an explicit mutation available only while the recoverable tombstone exists.
- WebDAV remains a manual disaster-recovery path and does not participate in automatic sync.
- A closed PWA need not run in the background; startup, reconnect, and foreground resume must catch up automatically.
- Use TDD for every behavior change and run the full existing Vitest suite after every task.
- Do not enable cloud sync by default until local-only behavior, migration rollback, and two-device tests pass.
- Local database/RPC implementation requires Node.js 20+ and a Docker-compatible container runtime for the Supabase CLI.
- Hosted multi-device rollout requires the user to create or authorize a Supabase project and provide its public URL/anon key; hosted project creation, billing, SMTP, and secrets are never assumed or fabricated.

## File Structure

- `supabase/config.toml` — local Supabase/Auth/Realtime development configuration.
- `supabase/migrations/202607150001_sync_schema.sql` — business tables, history tables, RLS, grants, and snapshot functions.
- `supabase/migrations/202607150002_sync_rpc.sql` — idempotent mutation application, cleanup, and recovery RPCs.
- `supabase/tests/sync_schema.test.sql` — pgTAP ownership, RPC, conflict, tombstone, and cursor tests.
- `src/sync/contracts.ts` — all local/remote mutation, cursor, status, and transport contracts.
- `src/sync/local-db.ts` — IndexedDB v2 schema, anonymous/per-user database selection, outbox, metadata, and budgets.
- `src/sync/domain-repository.ts` — atomic business-data plus outbox writes.
- `src/sync/supabase-client.ts` — validated environment and browser Supabase client.
- `src/sync/supabase-transport.ts` — typed Auth/RPC/snapshot/change-feed/Realtime adapter.
- `src/sync/sync-engine.ts` — pull/push loop, retry state machine, leader election, and foreground/reconnect triggers.
- `src/sync/auth-session.ts` — OTP session lifecycle and safe workspace switching.
- `src/sync/first-sync.ts` — local backup, anonymous-to-user migration, full merge, and resumability.
- `src/sync/sync-store.ts` — Zustand status exposed to UI without leaking transport details.
- `src/components/settings/CloudSyncCard.tsx` — OTP onboarding, status, retry, sign-out, and first-sync progress.
- `src/components/settings/SyncRecoverySheet.tsx` — 30-day deletion/conflict history and explicit restore.
- `src/test/sync-harness.ts` — deterministic fake transport, clocks, online state, and two-device helpers.
- `src/**/*.test.ts(x)` — focused unit/component regression tests beside each unit.
- `e2e/automatic-sync.spec.ts` — two-browser online/offline/realtime-loss acceptance tests.
- `.env.example` and `docs/automatic-sync-operations.md` — configuration, SMTP, deployment, rollback, and recovery instructions.

---

### Task 1: Supabase Local Stack, Schema, RLS, and Client Boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607150001_sync_schema.sql`
- Create: `supabase/tests/sync_schema.test.sql`
- Create: `.env.example`
- Create: `src/sync/supabase-client.ts`
- Create: `src/sync/supabase-client.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Consumes: Vite `import.meta.env` and Supabase Auth JWTs.
- Produces: `getSupabaseClient(): SupabaseClient`, `requireSupabaseConfig(env): SupabaseConfig`, SQL tables `transactions`, `categories`, `budgets`, `change_log`, `applied_mutations`, `deletion_registry`, plus RLS-protected snapshot reads.

- [ ] **Step 1: Install pinned-major dependencies and initialize local Supabase files**

Run:

```bash
npm install @supabase/supabase-js@2
npm install --save-dev supabase@2
npx supabase init
```

Expected: `package-lock.json` records Supabase JS major 2 and CLI major 2; `supabase/config.toml` exists. Do not start the containers until the migration and tests exist.

- [ ] **Step 2: Write failing client-configuration tests**

Create `src/sync/supabase-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { requireSupabaseConfig } from './supabase-client'

describe('requireSupabaseConfig', () => {
  it('rejects a missing URL or anon key', () => {
    expect(() => requireSupabaseConfig({})).toThrow('云同步尚未配置')
  })

  it('accepts only an HTTPS production URL', () => {
    expect(() => requireSupabaseConfig({
      VITE_SUPABASE_URL: 'http://cloud.example.com',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      DEV: false,
    })).toThrow('Supabase 生产地址必须使用 HTTPS')
  })

  it('allows the local Supabase URL in development', () => {
    expect(requireSupabaseConfig({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      DEV: true,
    })).toEqual({ url: 'http://127.0.0.1:54321', anonKey: 'anon-key' })
  })
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npx vitest run src/sync/supabase-client.test.ts`

Expected: FAIL because `./supabase-client` does not exist.

- [ ] **Step 4: Implement the environment boundary**

Create `src/sync/supabase-client.ts` with these exports:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig { url: string; anonKey: string }
type Env = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string>> & { DEV?: boolean }

export function requireSupabaseConfig(env: Env): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) throw new Error('云同步尚未配置')
  const parsed = new URL(url)
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (!env.DEV && parsed.protocol !== 'https:') {
    throw new Error('Supabase 生产地址必须使用 HTTPS')
  }
  if (env.DEV && parsed.protocol !== 'https:' && !local) {
    throw new Error('开发环境仅允许 HTTPS 或本地 Supabase 地址')
  }
  return { url: parsed.toString().replace(/\/$/, ''), anonKey }
}

let client: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const config = requireSupabaseConfig(import.meta.env)
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
```

Add exact declarations to `src/vite-env.d.ts` and non-secret names to `.env.example`:

```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace-with-local-or-hosted-anon-key
```

- [ ] **Step 5: Create the schema and least-privilege RLS**

Create `supabase/migrations/202607150001_sync_schema.sql`. Define each business table with `id text`, `user_id uuid`, `payload jsonb`, `revision bigint`, `updated_at timestamptz`, `deleted_at timestamptz`, `last_mutation_id text`, `last_device_id text`, and primary key `(user_id, id)`. Define:

```sql
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
```

Define the other two business tables explicitly:

```sql
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
```

Add the synchronization support tables:

```sql
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
```

Enable RLS on all six tables. Grant authenticated users `select` on the three business tables and `change_log`, revoke direct insert/update/delete from `anon` and `authenticated`, and add one select policy per readable table using `(select auth.uid()) = user_id`. Grant no client access to `applied_mutations` or `deletion_registry`.

- [ ] **Step 6: Add pgTAP ownership tests and verify GREEN**

In `supabase/tests/sync_schema.test.sql`, create two UUID users as `postgres`, insert one transaction for each, then set `request.jwt.claim.sub` and `role authenticated`. Assert the current user sees one row, cannot insert directly, and cannot read the other user's `change_log`. End with `select * from finish(); rollback;`.

Run:

```bash
npx vitest run src/sync/supabase-client.test.ts
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

Expected: client tests PASS; local stack starts; migrations apply; pgTAP and lint PASS.

- [ ] **Step 7: Run regression tests and commit**

Run: `npx vitest run && npm run build`

Expected: all existing tests PASS and production build succeeds.

```bash
git add package.json package-lock.json .env.example src/vite-env.d.ts src/sync/supabase-client.ts src/sync/supabase-client.test.ts supabase
git commit -m "feat: add secure Supabase sync foundation"
```

---

### Task 2: Idempotent Server Mutation, Change Feed, and Cleanup RPCs

**Files:**
- Create: `supabase/migrations/202607150002_sync_rpc.sql`
- Modify: `supabase/tests/sync_schema.test.sql`

**Interfaces:**
- Consumes: Task 1 tables and `auth.uid()`.
- Produces: `apply_mutations(mutations jsonb) returns jsonb`, `pull_changes(after_sequence bigint, page_size int)`, `sync_snapshot()`, `list_recoverable()`, `purge_expired_sync_history()`.

- [ ] **Step 1: Add failing pgTAP cases for the complete server contract**

Append tests that call `apply_mutations` as an authenticated user and assert:

```sql
select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  )))->0->>'status',
  'applied',
  'first mutation is applied'
);

select is(
  (public.apply_mutations(jsonb_build_array(jsonb_build_object(
    'mutation_id','m-1','device_id','device-a','entity_type','transaction',
    'entity_id','tx-1','operation','upsert','base_revision',0,
    'payload',jsonb_build_object('id','tx-1','amount',29,'externalId','ext-1')
  )))->0->>'status',
  'applied',
  'duplicate mutation returns its recorded result'
);
```

Add assertions for stale-revision overwrite with `conflict=true`, delete tombstone, stale upsert rejection, explicit restore before 30 days, cross-user denial, external-ID deduplication, monotonic change sequences with allowed gaps, paginated pulls, snapshot content, cleanup into `deletion_registry`, and rejection of a permanently deleted ID.

- [ ] **Step 2: Verify the database tests fail**

Run: `npx supabase db reset && npx supabase test db`

Expected: FAIL because the five RPC functions do not exist.

- [ ] **Step 3: Implement the RPC migration**

Create a private helper that maps the fixed entity enum to one of the three regclass values; never concatenate a client-provided table name. `apply_mutations` must use `security definer`, `set search_path = ''`, reject unauthenticated calls, and process every batch in one transaction.

Use this exact result shape for every mutation:

```json
{
  "mutation_id": "m-1",
  "entity_type": "transaction",
  "entity_id": "tx-1",
  "status": "applied",
  "revision": 2,
  "sequence": 18,
  "conflict": false,
  "record": { "id": "tx-1", "amount": 29 }
}
```

Allowed status values are `applied`, `duplicate`, `deduplicated`, `deleted`, `restored`, `rejected_deleted`, and `invalid`. For each mutation:

```sql
-- Required transaction order inside apply_mutations:
-- 1. Return applied_mutations.result when (auth.uid(), mutation_id) exists.
-- 2. Validate entity_type, operation, entity_id, device_id, and payload.
-- 3. Lock the current business row with FOR UPDATE.
-- 4. Reject ordinary upsert when a tombstone or deletion_registry row exists.
-- 5. Apply upsert/delete/restore and increment revision exactly once.
-- 6. Insert change_log and capture its generated sequence.
-- 7. Insert the final JSON result into applied_mutations.
```

`pull_changes` returns ordered rows with `sequence > after_sequence`, limited to `least(greatest(page_size, 1), 500)`, plus `min_available_sequence` and `has_more`. `sync_snapshot` returns all non-deleted current rows, the latest sequence, and the minimum retained sequence. `list_recoverable` returns the authenticated user's delete rows and overwritten `before_data` from the last 30 days. `purge_expired_sync_history` moves business tombstones older than 30 days into `deletion_registry`, removes their payload-bearing rows, removes old `change_log` payloads, and returns counts by entity type.

Enable `pg_cron` and schedule cleanup at 03:17 UTC:

```sql
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'kakeibo-purge-sync-history',
  '17 3 * * *',
  'select public.purge_expired_sync_history()'
);
```

Grant execute only to `authenticated` for client RPCs and only to `service_role` for purge. Revoke public execute from all functions.

- [ ] **Step 4: Verify database tests and lint pass**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

Expected: all pgTAP cases PASS and lint reports no security-definer search-path warning.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202607150002_sync_rpc.sql supabase/tests/sync_schema.test.sql
git commit -m "feat: add idempotent cloud mutation protocol"
```

---

### Task 3: Sync Contracts and IndexedDB v2 Workspaces

**Files:**
- Create: `src/sync/contracts.ts`
- Create: `src/sync/local-db.ts`
- Create: `src/sync/local-db.test.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useBudget.ts`

**Interfaces:**
- Consumes: existing `Transaction`, `Category`, `BudgetRule`.
- Produces: `EntityType`, `MutationOperation`, `OutboxMutation`, `RemoteChange`, `SyncStatus`, `openWorkspace()`, `switchWorkspace()`, `withWorkspaceWrite()`, `outboxOps`, `syncMetaOps`, first-class `budgetOps`.

- [ ] **Step 1: Define contracts and failing workspace tests**

Create `src/sync/contracts.ts` with exact public types:

```ts
import type { BudgetRule, Category, Transaction } from '../types'

export type EntityType = 'transaction' | 'category' | 'budget'
export type MutationOperation = 'upsert' | 'delete' | 'restore'
export type SyncPayload = Transaction | Category | BudgetRule

export interface OutboxMutation {
  mutationId: string
  userId: string
  deviceId: string
  entityType: EntityType
  entityId: string
  operation: MutationOperation
  baseRevision: number
  payload: SyncPayload | null
  createdAt: string
  attemptCount: number
  nextAttemptAt: string
  state: 'pending' | 'dead-letter'
  lastError?: string
}

export interface RemoteChange {
  sequence: number
  entityType: EntityType
  entityId: string
  operation: MutationOperation
  revision: number
  record: SyncPayload | null
  deletedAt: string | null
}

export interface RecoverableChange {
  sequence: number
  entityType: EntityType
  entityId: string
  reason: 'deleted' | 'overwritten'
  record: SyncPayload
  revision: number
  createdAt: string
  deviceId: string
}

export type SyncStatus =
  | { kind: 'local-only' }
  | { kind: 'idle'; lastSyncedAt?: string }
  | { kind: 'syncing'; pending: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'auth-required'; pending: number }
  | { kind: 'error'; pending: number; message: string }
```

Write `src/sync/local-db.test.ts` to prove: anonymous and two user IDs open different database names; v1 data survives v2 upgrade; budgets migrate from `sync_config.budgets`; an atomic callback writes a transaction and outbox together; a thrown callback writes neither; remote application plus pending overlay keeps the local payload visible; switching users closes the previous active handle.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/sync/local-db.test.ts src/lib/db.test.ts`

Expected: FAIL because workspace APIs and v2 stores do not exist.

- [ ] **Step 3: Implement v2 schema and workspace isolation**

Use database name `kakeibo` for anonymous data and `kakeibo-user-${userId}` for authenticated data. Upgrade to version 2 with stores:

```ts
interface SyncMetaRow { key: string; value: string }
interface BudgetRow extends BudgetRule { revision: number }

// Stores and keys:
// transactions: keyPath 'id'; indexes by-date, by-external
// categories: keyPath 'id'; index by-sort
// budgets: keyPath 'id'
// sync_config: keyPath 'key'
// outbox: keyPath 'mutationId'; indexes by-state, by-entity
// sync_meta: keyPath 'key'
```

Expose:

```ts
export type WorkspaceId = { kind: 'anonymous' } | { kind: 'user'; userId: string }
export function workspaceDbName(id: WorkspaceId): string
export async function openWorkspace(id: WorkspaceId): Promise<IDBPDatabase<KakeiboSchemaV2>>
export async function switchWorkspace(id: WorkspaceId): Promise<void>
export async function getActiveWorkspace(): Promise<IDBPDatabase<KakeiboSchemaV2>>
export async function withWorkspaceWrite<T>(
  stores: Array<keyof KakeiboSchemaV2>,
  run: (tx: IDBPTransaction<KakeiboSchemaV2, Array<keyof KakeiboSchemaV2>, 'readwrite'>) => Promise<T>,
): Promise<T>
```

During v2 upgrade, parse `sync_config.budgets`, put every rule into `budgets` with revision 0, then delete only the legacy budget key after all puts succeed.

- [ ] **Step 4: Rebind existing ops and migrate `useBudget`**

Make `src/lib/db.ts` obtain the active workspace for every operation rather than caching one global database. Preserve existing method names for transaction/category/WebDAV config callers. Add `budgetOps.list/add/update/delete` and change `useBudget` to use them without changing its returned public API.

- [ ] **Step 5: Verify focused and full tests**

Run:

```bash
npx vitest run src/sync/local-db.test.ts src/lib/db.test.ts src/components/budget/BudgetAccessibility.test.tsx
npx vitest run
npm run build
```

Expected: focused tests PASS; all existing tests PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/sync/contracts.ts src/sync/local-db.ts src/sync/local-db.test.ts src/lib/db.ts src/lib/db.test.ts src/types/index.ts src/hooks/useBudget.ts
git commit -m "feat: add isolated sync-ready local workspaces"
```

---

### Task 4: Atomic Domain Repository and Hook Migration

**Files:**
- Create: `src/sync/domain-repository.ts`
- Create: `src/sync/domain-repository.test.ts`
- Modify: `src/hooks/useTransactions.ts`
- Modify: `src/hooks/useTransactions.test.ts`
- Modify: `src/hooks/useCategories.ts`
- Modify: `src/hooks/useCategories.test.ts`
- Modify: `src/hooks/useBudget.ts`

**Interfaces:**
- Consumes: Task 3 workspace/outbox types, active user/device metadata, existing hooks.
- Produces: `domainRepository.addTransaction`, `deleteTransaction`, `importTransactions`, `addCategory`, `deleteCategory`, `addBudget`, `updateBudget`, `deleteBudget`, `recoverHistory`, each atomically writing business data and outbox when cloud sync is enabled.

- [ ] **Step 1: Write failing atomic-domain tests**

Test these exact invariants:

```ts
it('writes one transaction and one mutation atomically', async () => {
  await repository.addTransaction(transaction)
  expect(await transactionOps.getAll()).toEqual([transaction])
  expect(await outboxOps.pending()).toMatchObject([
    { entityType: 'transaction', entityId: transaction.id, operation: 'upsert', baseRevision: 0 },
  ])
})

it('keeps local-only writes out of the cloud outbox', async () => {
  await syncMetaOps.set('sync_enabled', 'false')
  await repository.addTransaction(transaction)
  expect(await outboxOps.pending()).toEqual([])
})

it('rolls back the business row when the outbox write fails', async () => {
  failNextOutboxPut(new Error('quota'))
  await expect(repository.addTransaction(transaction)).rejects.toThrow('quota')
  expect(await transactionOps.getAll()).toEqual([])
})
```

Add equivalent delete, custom-category, budget, CSV batch, system-category-no-outbox, and history recovery tests. `recoverHistory` queues `restore` for a deleted record and `upsert` for an overwritten non-deleted version; it never calls Supabase directly.

The recovery signature is:

```ts
recoverHistory(change: RecoverableChange): Promise<void>
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/domain-repository.test.ts src/hooks/useTransactions.test.ts src/hooks/useCategories.test.ts`

Expected: FAIL because `domain-repository.ts` does not exist.

- [ ] **Step 3: Implement repository identity and mutation creation**

Use `sync_meta` keys `sync_enabled`, `user_id`, and `device_id`. Create mutations with `nanoid()`, ISO timestamps, `attemptCount: 0`, `state: 'pending'`, `nextAttemptAt: createdAt`, and the current local record revision. Coalesce consecutive pending upserts for the same entity only when neither has been attempted; never coalesce deletes or restore operations.

Expose this exact factory for deterministic tests:

```ts
export interface DomainRepositoryDeps {
  now: () => Date
  createId: () => string
  notifyLocalChange: () => void
}

export function createDomainRepository(deps: DomainRepositoryDeps): DomainRepository
export const domainRepository = createDomainRepository({
  now: () => new Date(),
  createId: nanoid,
  notifyLocalChange: () => window.dispatchEvent(new Event('kakeibo:local-change')),
})
```

- [ ] **Step 4: Migrate hooks without changing component contracts**

Replace direct write calls in the three hooks with `domainRepository` calls. Keep read methods, return shapes, loading behavior, `triggerRefresh`, CSV result counts, and focused component tests unchanged.

- [ ] **Step 5: Verify GREEN and regression**

Run:

```bash
npx vitest run src/sync/domain-repository.test.ts src/hooks/useTransactions.test.ts src/hooks/useCategories.test.ts src/components/budget/BudgetAccessibility.test.tsx
npx vitest run
npm run build
```

Expected: all focused and full tests PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/sync/domain-repository.ts src/sync/domain-repository.test.ts src/hooks/useTransactions.ts src/hooks/useTransactions.test.ts src/hooks/useCategories.ts src/hooks/useCategories.test.ts src/hooks/useBudget.ts
git commit -m "feat: make domain writes sync-atomic"
```

---

### Task 5: Typed Supabase Transport and Full-Snapshot Fallback

**Files:**
- Create: `src/sync/supabase-transport.ts`
- Create: `src/sync/supabase-transport.test.ts`
- Modify: `src/sync/contracts.ts`

**Interfaces:**
- Consumes: Task 1 client, Task 2 RPC contract, Task 3 contracts.
- Produces: `SyncTransport` with `pullChanges`, `pullSnapshot`, `pushMutations`, `subscribe`, `listRecoverable`, and `restore`.

- [ ] **Step 1: Add the transport interface and failing mapping tests**

Add to `contracts.ts`:

```ts
export interface PullPage {
  changes: RemoteChange[]
  latestSequence: number
  minAvailableSequence: number
  hasMore: boolean
}

export interface SyncSnapshot {
  transactions: Transaction[]
  categories: Category[]
  budgets: BudgetRule[]
  latestSequence: number
  minAvailableSequence: number
}

export interface MutationResult {
  mutationId: string
  status: 'applied' | 'duplicate' | 'deduplicated' | 'deleted' | 'restored' | 'rejected_deleted' | 'invalid'
  revision: number
  sequence: number
  conflict: boolean
  record: SyncPayload | null
}

export interface SyncTransport {
  pullChanges(after: number, limit: number): Promise<PullPage>
  pullSnapshot(): Promise<SyncSnapshot>
  pushMutations(batch: OutboxMutation[]): Promise<MutationResult[]>
  subscribe(onChange: () => void, onState: (connected: boolean) => void): Promise<() => Promise<void>>
  listRecoverable(): Promise<RecoverableChange[]>
}
```

Write tests with a fake Supabase client to verify camelCase mapping, RPC arguments, 500-page limit, snapshot fallback fields, Realtime filtering by the authenticated `user_id`, unsubscribe cleanup, and propagation of 401/403/429/5xx errors with typed status.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/supabase-transport.test.ts`

Expected: FAIL because transport implementation does not exist.

- [ ] **Step 3: Implement the adapter**

Create `createSupabaseTransport(client, userId)` and map RPC snake_case fields at one boundary. `subscribe` must subscribe only to inserts on `public.change_log` filtered by `user_id=eq.${userId}` and invoke `onChange` without trusting the payload as business state. All Supabase errors become:

```ts
export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'permission' | 'rate-limit' | 'transient' | 'protocol',
    readonly status?: number,
  ) { super(message) }
}
```

Validate every RPC response before returning it; malformed entity types, operations, revisions, or payloads throw `kind: 'protocol'`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npx vitest run src/sync/supabase-transport.test.ts && npx vitest run && npm run build`

Expected: all tests PASS and build succeeds.

```bash
git add src/sync/contracts.ts src/sync/supabase-transport.ts src/sync/supabase-transport.test.ts
git commit -m "feat: add typed Supabase sync transport"
```

---

### Task 6: SyncEngine, Retry State Machine, Realtime Wake-Up, and Leader Election

**Files:**
- Create: `src/sync/sync-engine.ts`
- Create: `src/sync/sync-engine.test.ts`
- Create: `src/sync/sync-store.ts`
- Create: `src/test/sync-harness.ts`

**Interfaces:**
- Consumes: Task 3 local stores/outbox, Task 5 `SyncTransport`.
- Produces: `createSyncEngine(deps)`, `start()`, `stop()`, `syncNow(reason)`, `useSyncStore`, browser lifecycle wiring.

- [ ] **Step 1: Build a deterministic failing harness**

Create a fake clock, fake online source, in-memory `SyncTransport`, and helper `flushEngine()`. Add tests for:

- pull all pages before push;
- full snapshot when cursor is older than `minAvailableSequence`;
- replay pending local payloads after snapshot without changing original `baseRevision`;
- outbox deletion only after matching mutation result;
- duplicate result treated as success;
- rejected deletion applies the server tombstone;
- transient retry sequence 1s, 2s, 4s with 20% deterministic jitter and five-minute cap;
- offline pauses without incrementing attempts;
- 401 enters `auth-required` after one session refresh attempt;
- 403/protocol errors move only the bad mutation to dead-letter;
- Realtime callback, `online`, `visibilitychange`, and local-change events schedule one serialized run;
- stop removes every listener and subscription;
- two leaders cannot push the same batch concurrently.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/sync-engine.test.ts`

Expected: FAIL because engine/store/harness do not exist.

- [ ] **Step 3: Implement the explicit state machine**

Use this dependency boundary:

```ts
export interface SyncEngineDeps {
  transport: SyncTransport
  now: () => Date
  random: () => number
  setTimer: (run: () => void, delayMs: number) => unknown
  clearTimer: (id: unknown) => void
  isOnline: () => boolean
  refreshSession: () => Promise<boolean>
  withLeadership: <T>(run: () => Promise<T>) => Promise<T | undefined>
  publish: (status: SyncStatus) => void
}

export interface SyncEngine {
  start(): Promise<void>
  stop(): Promise<void>
  syncNow(reason: 'start' | 'local-change' | 'realtime' | 'online' | 'foreground' | 'manual'): Promise<void>
}
```

The engine keeps one in-flight promise and one queued rerun flag. A run repeats pull pages until `hasMore=false`, pushes at most 100 pending mutations, then performs a short pull when any result advances sequence. Applying remote changes and cursor advancement occurs in one IndexedDB transaction. Applying a remote baseline must reapply pending local mutations for the same entity to the visible record.

- [ ] **Step 4: Add browser lifecycle and multi-tab leadership adapters**

Use `navigator.locks.request('kakeibo-sync', { ifAvailable: true }, callback)` when available. Fallback runs normally and relies on server idempotency. Broadcast status and successful sequence through `BroadcastChannel('kakeibo-sync')`. Export `createBrowserSyncLifecycle(engine)` with `start()` and `stop()`; do not mount it in `main.tsx` until Task 7 owns the authenticated workspace.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npx vitest run src/sync/sync-engine.test.ts
npx vitest run
npm run build
```

Expected: engine tests and full suite PASS; build succeeds.

```bash
git add src/sync/sync-engine.ts src/sync/sync-engine.test.ts src/sync/sync-store.ts src/test/sync-harness.ts
git commit -m "feat: add resilient local-first sync engine"
```

---

### Task 7: Email OTP, Session Lifecycle, and Account-Isolated Workspaces

**Files:**
- Create: `src/sync/auth-session.ts`
- Create: `src/sync/auth-session.test.ts`
- Create: `src/components/settings/CloudSyncCard.tsx`
- Create: `src/components/settings/CloudSyncCard.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: Supabase Auth, Task 3 workspaces, Task 6 engine lifecycle.
- Produces: `AuthSessionController`, OTP request/verify UI, safe login/logout/account switch.

- [ ] **Step 1: Write failing controller and component tests**

Test request OTP, verify six-digit OTP, invalid/expired code, resend cooldown, cached-session restore, token refresh, engine stop-before-workspace-switch, separate user databases, logout with zero pending mutations, logout confirmation with pending mutations, and auth expiration preserving outbox.

Use this component contract:

```tsx
<CloudSyncCard
  authState={authState}
  syncStatus={syncStatus}
  pendingCount={pendingCount}
  onRequestOtp={email => controller.requestOtp(email)}
  onVerifyOtp={(email, token) => controller.verifyOtp(email, token)}
  onRetry={() => engine.syncNow('manual')}
  onSignOut={() => controller.signOut()}
/>
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/auth-session.test.ts src/components/settings/CloudSyncCard.test.tsx`

Expected: FAIL because controller and card do not exist.

- [ ] **Step 3: Implement controller ordering**

Expose:

```ts
export type AuthState =
  | { kind: 'signed-out' }
  | { kind: 'sending-otp'; email: string }
  | { kind: 'awaiting-otp'; email: string; resendAt: number }
  | { kind: 'switching-workspace'; userId: string }
  | { kind: 'signed-in'; userId: string; email: string }
  | { kind: 'error'; message: string; email?: string }

export interface AuthSessionController {
  initialize(): Promise<void>
  requestOtp(email: string): Promise<void>
  verifyOtp(email: string, token: string): Promise<void>
  signOut(): Promise<void>
  subscribe(listener: (state: AuthState) => void): () => void
}
```

Construct the controller with an injected workspace boundary:

```ts
export interface AuthSessionDeps {
  prepareWorkspace(userId: string): Promise<void>
  startEngine(userId: string): Promise<void>
  stopEngine(): Promise<void>
  pendingCount(): Promise<number>
}
```

On session change, always: stop the old engine, close the old active workspace, call `prepareWorkspace` with the authenticated session user ID, then construct/start the new engine. In this task, `prepareWorkspace` opens the per-user workspace and writes `user_id` plus stable `device_id`. Task 8 replaces that injected function with the first-sync gate without changing controller code. Never let a user ID supplied by the UI select a workspace.

- [ ] **Step 4: Implement accessible OTP UI**

Use labelled email and numeric OTP inputs, `aria-invalid`, `aria-describedby`, a 60-second resend timer, pending button copy, and the existing `InlineNotice`/`Sheet` patterns. Do not log email, OTP, session, or Supabase error bodies. Add the card above manual disaster recovery in Settings.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/sync/auth-session.test.ts src/components/settings/CloudSyncCard.test.tsx && npx vitest run && npm run build`

Expected: focused/full tests PASS and build succeeds.

```bash
git add src/sync/auth-session.ts src/sync/auth-session.test.ts src/components/settings/CloudSyncCard.tsx src/components/settings/CloudSyncCard.test.tsx src/pages/SettingsPage.tsx src/main.tsx
git commit -m "feat: add secure email OTP sync sessions"
```

---

### Task 8: First-Sync Backup, Merge, and Resumable Migration

**Files:**
- Create: `src/sync/first-sync.ts`
- Create: `src/sync/first-sync.test.ts`
- Create: `src/components/settings/FirstSyncSheet.tsx`
- Create: `src/components/settings/FirstSyncSheet.test.tsx`
- Modify: `src/sync/auth-session.ts`
- Modify: `src/components/settings/CloudSyncCard.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: anonymous/user workspaces, snapshot transport, domain repository, JSON export shape.
- Produces: `runFirstSync`, resumable migration phases, local pre-migration backup download, first-sync UI.

- [ ] **Step 1: Write failing merge matrix tests**

Cover empty cloud upload, empty local download, both non-empty merge by stable ID, transaction dedupe by `externalId`, custom category merge, budget merge, same-ID conflict outbox, interrupted backup, interrupted pull, interrupted push, repeat invocation after each phase, and exclusion of sessions/WebDAV secrets.

Define phases exactly:

```ts
export type FirstSyncPhase =
  | 'not-started'
  | 'backup-created'
  | 'snapshot-loaded'
  | 'local-merged'
  | 'outbox-created'
  | 'complete'

export interface FirstSyncResult {
  uploaded: number
  downloaded: number
  deduplicated: number
  conflicts: number
}

export interface CompletedFirstSync {
  phase: 'complete'
  result: FirstSyncResult
}

export function runFirstSync(userId: string): Promise<CompletedFirstSync>
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/first-sync.test.ts src/components/settings/FirstSyncSheet.test.tsx`

Expected: FAIL because first-sync units do not exist.

- [ ] **Step 3: Implement resumable migration**

Persist the phase and snapshot hash in authenticated `sync_meta`. Export anonymous transactions, custom categories, and budgets into a Blob before any user-database mutation. Exclude `sync_config` keys `webdav_url`, `webdav_username`, `webdav_password`, Supabase sessions, device ID, and outbox.

When cloud is empty, create outbox mutations in one user-workspace transaction. When both sides contain data, choose unique IDs first, then deduplicate transactions by external ID. Same-ID different payload keeps the local payload visible and creates a mutation with the cloud revision as `baseRevision`; the server records the overwrite in history.

In `main.tsx`, compose `AuthSessionController.prepareWorkspace` with `runFirstSync`. Start the SyncEngine only after the returned phase is `complete`; signed-out mode publishes `local-only` and constructs no transport.

- [ ] **Step 4: Build the blocking first-sync sheet**

The sheet explains the local backup, shows the current phase, prevents close while a phase is writing, offers download of the migration JSON, and provides retry after failure. Cloud sync remains disabled until `complete`; local-only use remains available if the user cancels before any authenticated migration write.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/sync/first-sync.test.ts src/components/settings/FirstSyncSheet.test.tsx && npx vitest run && npm run build`

Expected: migration matrix and all regressions PASS; build succeeds.

```bash
git add src/sync/first-sync.ts src/sync/first-sync.test.ts src/components/settings/FirstSyncSheet.tsx src/components/settings/FirstSyncSheet.test.tsx src/sync/auth-session.ts src/components/settings/CloudSyncCard.tsx src/main.tsx
git commit -m "feat: add resumable first-device cloud merge"
```

---

### Task 9: Sync Status, Error Recovery, History Restore, and WebDAV Disaster Recovery

**Files:**
- Create: `src/components/settings/SyncRecoverySheet.tsx`
- Create: `src/components/settings/SyncRecoverySheet.test.tsx`
- Modify: `src/components/settings/CloudSyncCard.tsx`
- Modify: `src/components/settings/CloudSyncCard.test.tsx`
- Modify: `src/components/settings/WebDAVConfig.tsx`
- Modify: `src/components/settings/WebDAVConfig.test.tsx`
- Modify: `src/components/layout/TabBar.tsx`
- Modify: `src/components/layout/TabBar.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: Task 5 recovery-history reads, Task 6 sync store, Task 7 session, Task 4 `domainRepository.recoverHistory`.
- Produces: status presentation, manual retry, dead-letter diagnostics, 30-day restore UI, explicit WebDAV disaster-recovery copy.

- [ ] **Step 1: Write failing status and recovery tests**

Assert exact user-visible states:

```ts
expect(statusCopy({ kind: 'idle', lastSyncedAt: now })).toBe('已同步 · 刚刚')
expect(statusCopy({ kind: 'syncing', pending: 2 })).toBe('同步中 · 2 项')
expect(statusCopy({ kind: 'offline', pending: 3 })).toBe('离线 · 待同步 3 项')
expect(statusCopy({ kind: 'auth-required', pending: 1 })).toBe('需要重新登录 · 1 项未同步')
```

Test persistent notice only for auth-required, migration, permission, protocol, and consecutive-failure threshold; short transient errors remain in Settings only. Test history listing, restore confirmation, restore mutation result, expired item absence, dead-letter export without payload/credentials, and WebDAV heading/copy change to “手动灾备”.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/settings/SyncRecoverySheet.test.tsx src/components/settings/CloudSyncCard.test.tsx src/components/layout/TabBar.test.tsx src/components/settings/WebDAVConfig.test.tsx`

Expected: FAIL on missing recovery UI and old WebDAV copy.

- [ ] **Step 3: Implement unobtrusive status and recovery**

Add an icon-plus-text status row to `CloudSyncCard`, a small non-color-only status dot on the Settings navigation item, and a manual “立即重试” action. The recovery sheet groups `delete` and conflicting `upsert` history, displays entity label/time/device label, and restores only after custom confirmation. It calls `domainRepository.recoverHistory`, which writes the restored local payload and fresh outbox mutation atomically; the component never calls Supabase or directly edits IndexedDB.

Diagnostic export contains only: app version, device ID hash, sync state, cursor, pending/dead-letter counts, mutation IDs, entity types, error kinds, HTTP statuses, and timestamps. Exclude payload, amount, note, email, OTP, JWT, Supabase keys, and WebDAV credentials.

- [ ] **Step 4: Rename and clarify WebDAV**

Change heading to `WebDAV 手动灾备`, description to `手动上传或恢复完整 JSON 备份，不参与自动多设备同步。`, and retain the existing saved keys, upload/download protocol, error handling, and tests.

- [ ] **Step 5: Verify accessibility and commit**

Run:

```bash
npx vitest run src/components/settings/SyncRecoverySheet.test.tsx src/components/settings/CloudSyncCard.test.tsx src/components/layout/TabBar.test.tsx src/components/settings/WebDAVConfig.test.tsx
npx vitest run
npm run build
```

Expected: focused/full tests PASS; build succeeds; every status uses icon plus text and every control is at least 44px.

```bash
git add src/components/settings/SyncRecoverySheet.tsx src/components/settings/SyncRecoverySheet.test.tsx src/components/settings/CloudSyncCard.tsx src/components/settings/CloudSyncCard.test.tsx src/components/settings/WebDAVConfig.tsx src/components/settings/WebDAVConfig.test.tsx src/components/layout/TabBar.tsx src/components/layout/TabBar.test.tsx src/pages/SettingsPage.tsx
git commit -m "feat: add automatic sync status and recovery UI"
```

---

### Task 10: Two-Device E2E, Security Audit, Operations, and Release Gate

**Files:**
- Create: `e2e/automatic-sync.spec.ts`
- Create: `e2e/helpers.ts`
- Create: `playwright.config.ts`
- Create: `docs/automatic-sync-operations.md`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: complete Tasks 1–9 implementation.
- Produces: repeatable two-device acceptance harness, database CI gate, deployment/runbook, feature-flagged release.

- [ ] **Step 1: Add E2E dependencies, config, and scripts**

Run:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:db": "supabase test db",
  "test:e2e:sync": "playwright test e2e/automatic-sync.spec.ts",
  "verify:sync": "npm run test && npm run test:db && npm run test:e2e:sync && npm run build"
}
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: false,
    env: { ...process.env, VITE_CLOUD_SYNC_ENABLED: 'false' },
  },
})
```

- [ ] **Step 2: Write the failing two-device acceptance suite**

Create `e2e/helpers.ts` with exported helpers `signInWithLocalOtp`, `addExpense`, `addIncome`, `expectLedger`, `dropRealtime`, `foreground`, `setOffline`, `expireSession`, and `readSyncStatus`. Each helper must use accessible roles/labels from the production UI; `signInWithLocalOtp` reads the newest matching message from local Mailpit at `http://127.0.0.1:54324/api/v1/messages`, extracts the six-digit token, and never logs it.

Use two isolated browser contexts and Mailpit/local Auth. Cover:

```ts
test('two devices converge through realtime and cursor catch-up', async ({ browser }) => {
  const deviceA = await browser.newContext()
  const deviceB = await browser.newContext()
  await signInWithLocalOtp(deviceA, 'sync@example.test')
  await signInWithLocalOtp(deviceB, 'sync@example.test')
  await addExpense(deviceA, { amount: '29.00', category: '餐饮', note: '午饭' })
  await expectLedger(deviceB).toContainExpense('29.00', '午饭')
  await dropRealtime(deviceB)
  await addIncome(deviceA, { amount: '100.00', category: '工资' })
  await foreground(deviceB)
  await expectLedger(deviceB).toContainIncome('100.00')
})
```

Add tests for offline A queue/reconnect, same-budget conflict/history restore, delete plus stale offline upsert rejection, login expiry/outbox retention, first-sync interruption/retry, two tabs/idempotency, cursor older than 30 days/full snapshot with pending overlay, and user A/User B RLS isolation.

- [ ] **Step 3: Run E2E RED before enabling the feature**

Run:

```bash
npx supabase start
npx supabase db reset
npm run test:e2e:sync
```

Expected: FAIL because `开启多设备同步` is still visible when the test server starts with `VITE_CLOUD_SYNC_ENABLED=false`. This proves the release gate is absent; authentication, selectors, and local Supabase setup must already succeed before accepting this RED result.

- [ ] **Step 4: Add feature flag and production-safe caching**

Add `VITE_CLOUD_SYNC_ENABLED=false` to `.env.example` and gate cloud bootstrap/UI on the exact string `'true'`. Update `vite.config.ts` to load the configured origin and prepend this runtime rule when the URL is valid:

```ts
const supabaseOrigin = env.VITE_SUPABASE_URL
  ? new URL(env.VITE_SUPABASE_URL).origin
  : undefined

const supabaseNetworkOnly = supabaseOrigin ? [{
  urlPattern: ({ url }: { url: URL }) => url.origin === supabaseOrigin,
  handler: 'NetworkOnly' as const,
  options: { cacheName: 'supabase-network-only' },
}] : []
```

Spread `supabaseNetworkOnly` before the existing generic HTTPS rule so Auth, REST, RPC, and Realtime HTTP requests are never stored in Workbox API cache. Keep static app-shell caching unchanged. Change the E2E web server flag to `'true'` after the RED run and add a separate test server invocation with `'false'` that asserts the sync onboarding is absent.

- [ ] **Step 5: Write the operations runbook**

Document exact steps for local Docker startup, `supabase db reset`, Mailpit OTP, hosted project creation, migration push, RLS verification, Realtime publication, allowed redirect URLs, custom SMTP before non-personal rollout, environment variables, feature enablement, health checks, 30-day purge scheduling, diagnostic export, rollback to local-only, and recovery from migration JSON/WebDAV backup. State that service-role keys never enter Vite variables.

- [ ] **Step 6: Add CI gates**

Create `.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx supabase start
      - run: npx supabase db reset
      - run: npm run test:db
      - run: npm run test
      - run: npm run test:e2e:sync
      - run: npm run build
      - if: always()
        run: npx supabase stop --no-backup
```

Do not cache local database volumes or Auth mail.

- [ ] **Step 7: Run final verification**

Run:

```bash
npm run verify:sync
npx supabase db lint --level warning
git diff --check
rg -n "service_role|SUPABASE_SERVICE" src .env.example vite.config.ts
rg -n "console\.(log|warn|error)" src/sync src/components/settings
```

Expected:

- Vitest, pgTAP, two-device E2E, TypeScript, Vite, and PWA build all PASS.
- Database lint reports no security warning.
- `git diff --check` prints nothing.
- Service-role audit prints no client or Vite environment reference.
- Console audit prints no payload-bearing logging.

- [ ] **Step 8: Manual release verification**

At 390×844 and 430×932 in light and dark themes, verify OTP, first-sync backup, sync states, offline queue, retry, history restore, sign-out warning, WebDAV disaster-recovery copy, keyboard focus, 44px controls, safe areas, and reduced motion. Use two real devices on the hosted preview to verify online change propagation within 5 seconds and foreground catch-up after one device misses Realtime.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e docs/automatic-sync-operations.md README.md vite.config.ts .env.example .github/workflows/ci.yml
git commit -m "test: verify automatic sync across devices"
```

---

## Final Verification Checklist

- [ ] `npm run test` passes every existing and new Vitest test.
- [ ] `npm run test:db` passes ownership, idempotency, conflict, tombstone, history, cursor, and cleanup tests.
- [ ] `npm run test:e2e:sync` passes all two-device online/offline scenarios.
- [ ] `npm run build` completes TypeScript, Vite, and PWA production output.
- [ ] A local-only user can use every existing feature without Supabase configuration.
- [ ] A signed-in user can go offline, write, reconnect, and converge without manual sync.
- [ ] An offline stale write cannot revive a deleted ID.
- [ ] A device older than retained history performs a full snapshot and preserves pending local intent.
- [ ] Duplicate mutation delivery and multi-tab leadership never create duplicate data.
- [ ] RLS prevents cross-account reads and writes.
- [ ] No client bundle or diagnostic export contains a service-role key, OTP, JWT, email, amount, note, or WebDAV password.
- [ ] WebDAV remains functional as an explicitly manual disaster-recovery path.
- [ ] Feature flag rollback returns the app to local-only behavior without deleting local or cloud data.
