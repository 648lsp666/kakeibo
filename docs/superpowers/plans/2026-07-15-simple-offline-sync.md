# Kakeibo Simple Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build quiet, basic offline multi-device sync using Supabase-only authentication/data and a small IndexedDB outbox, while removing the unused advanced history/revision protocol.

**Architecture:** IndexedDB remains the immediate UI data source. Every user mutation updates the active account workspace and enqueues one operation atomically; a foreground-only engine pulls full account state, overlays pending local intent, pushes operations, and pulls once more. Supabase Auth identifies the user, RLS isolates rows, a small idempotent RPC applies one operation, and Realtime only wakes the pull loop.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, idb 8, Supabase JS 2.110, PostgreSQL/RLS/pgTAP, Vitest 4, Vite 7.

## Global Constraints

- Use Supabase Auth, Postgres, Realtime, and the existing IndexedDB; do not add Clerk or another backend.
- Support foreground basic offline use: local changes are immediate and upload automatically after connectivity returns.
- Resolve same-record conflicts by last valid server arrival; do not add revision comparison, field merge, history UI, or conflict dialogs.
- Keep only soft deletion; ordinary upsert must not revive an existing tombstone.
- Realtime is a wake-up signal only; never trust Realtime payloads as business state.
- Preserve `Transaction.amount` number precision behavior, `YYYY-MM-DD` dates, stable text IDs, CSV external-ID dedupe, and existing hook public APIs.
- Keep anonymous data in `kakeibo` and authenticated data in `kakeibo-user-<user-id>`; never mix handles, operations, or engine results across accounts.
- Keep JSON/WebDAV as manual disaster recovery only; it must not participate in automatic sync.
- No `change_log`, sequence cursor, snapshot fallback, revision protocol, deletion registry, history cron, E2EE, or leader election.
- Use TDD for every behavior change, run focused tests before full tests, and commit each task separately without pushing.

## File Map

- `supabase/migrations/202607150001_sync_schema.sql` — final simple cloud schema, RLS, idempotent single-operation RPC.
- `supabase/migrations/202607150002_sync_rpc.sql` — delete; superseded advanced RPC/history implementation.
- `supabase/tests/sync_schema.test.sql` — pgTAP contract for ownership, idempotency, last-arrival, tombstones, external-ID dedupe.
- `src/sync/contracts.ts` — minimal local operation, cloud row, transport, engine status types.
- `src/sync/local-db.ts` — IndexedDB v3, account-safe workspace lifecycle, atomic operations and sync metadata.
- `src/sync/domain-repository.ts` — only module allowed to atomically change synced domain data and outbox.
- `src/sync/supabase-transport.ts` — validates/maps Supabase rows and the lightweight RPC.
- `src/sync/sync-engine.ts` — pull/overlay/push/retry/realtime foreground loop bound to one account generation.
- `src/sync/sync-store.ts` — small Zustand status store used by UI.
- `src/sync/auth-session.tsx` — Supabase session lifecycle, workspace switch, engine start/stop, anonymous migration.
- `src/components/settings/CloudSyncCard.tsx` — email OTP, account controls, status, retry, first-login migration confirmation.

---

### Task 1: Replace the Advanced Server Protocol with a Small Idempotent Operation API

**Files:**
- Modify: `supabase/migrations/202607150001_sync_schema.sql`
- Delete: `supabase/migrations/202607150002_sync_rpc.sql`
- Modify: `supabase/tests/sync_schema.test.sql`

**Interfaces:**
- Consumes: Supabase `auth.uid()` and authenticated role.
- Produces: readable `transactions`, `categories`, `budgets`; RPC `public.apply_operation(p_operation_id text, p_entity_type text, p_entity_id text, p_operation text, p_payload jsonb) returns jsonb`.

- [ ] **Step 1: Replace the pgTAP suite with failing simple-protocol tests**

Cover all three entity types plus these exact assertions:

```sql
select plan(18);

-- unauthenticated calls fail
select throws_ok(
  $$ select public.apply_operation('op-1','transaction','tx-1','upsert','{"id":"tx-1","amount":12}'::jsonb) $$,
  '42501', 'authentication required', 'operation requires authentication'
);

-- first request applies and a duplicate operation id does not rewrite the row
select is((public.apply_operation('op-1','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":12,"externalId":"ext-1"}'::jsonb))->>'status', 'applied');
select is((public.apply_operation('op-1','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":999,"externalId":"ext-1"}'::jsonb))->>'status', 'duplicate');
select is((select payload->>'amount' from public.transactions where id='tx-1'), '12');

-- a new operation is last-server-arrival wins
select is((public.apply_operation('op-2','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":18,"externalId":"ext-1"}'::jsonb))->>'status', 'applied');

-- delete creates a tombstone and ordinary upsert cannot revive it
select is((public.apply_operation('op-3','transaction','tx-1','delete',null))->>'status', 'deleted');
select is((public.apply_operation('op-4','transaction','tx-1','upsert',
  '{"id":"tx-1","amount":20,"externalId":"ext-1"}'::jsonb))->>'status', 'rejected_deleted');
```

Also prove a user cannot read another user's rows, clients cannot directly mutate tables, `payload.id` must equal `p_entity_id`, unknown entities/operations are invalid, category/budget paths work, and duplicate external IDs return the existing transaction without creating a second row.

- [ ] **Step 2: Run the database suite and verify RED**

Run:

```bash
npx supabase db reset
npx supabase test db
```

Expected: FAIL because the old schema exposes the advanced batch RPC and history objects instead of the simple `apply_operation` contract.

- [ ] **Step 3: Implement the minimal schema and RPC**

Use this table shape for all three business tables:

```sql
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

create table public.applied_operations (
  user_id uuid not null,
  operation_id text not null,
  entity_type text not null check (entity_type in ('transaction','category','budget')),
  entity_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, operation_id)
);
```

Repeat the business-table shape for categories and budgets. Preserve the partial `(user_id, payload->>'externalId')` unique index for live transactions. Enable RLS on every table; grant authenticated users `select` only on business tables; revoke direct writes and all access to receipts.

Add the three business tables to `supabase_realtime` in the migration so hosted and local environments have the same wake-up behavior.

Implement `apply_operation` as `security definer set search_path = ''`:

```sql
-- validate auth, ids, entity mapping, operation and payload first
insert into public.applied_operations(user_id, operation_id, entity_type, entity_id)
values (auth.uid(), p_operation_id, p_entity_type, p_entity_id)
on conflict do nothing;
get diagnostics inserted = row_count;

if inserted = 0 then
  -- return status=duplicate plus the current server row; never replay the old side effect
end if;

-- lock the selected current business row; if it is a tombstone and operation=upsert,
-- return status=rejected_deleted without changing it.
-- otherwise INSERT ... ON CONFLICT ... DO UPDATE using clock_timestamp().
```

Use a fixed text-to-regclass mapping; never interpolate a client-provided table name. For an external-ID unique conflict, return `status='deduplicated'` with the existing live transaction. Every return envelope has `operation_id`, `status`, `entity_type`, `entity_id`, `record`, `updated_at`, and `deleted_at`.

- [ ] **Step 4: Verify server security and behavior**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
```

Expected: pgTAP PASS; lint reports no warning-level schema errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202607150001_sync_schema.sql supabase/tests/sync_schema.test.sql
git rm supabase/migrations/202607150002_sync_rpc.sql
git commit -m "refactor: simplify cloud sync protocol"
```

---

### Task 2: Finalize Account-Safe IndexedDB v3 and the Minimal Outbox

**Files:**
- Modify: `src/sync/contracts.ts`
- Modify: `src/sync/local-db.ts`
- Modify: `src/sync/local-db.test.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: existing `Transaction`, `Category`, `BudgetRule`.
- Produces: `PendingOperation`, `CloudRecord`, `SyncStatus`, `switchWorkspace`, `getActiveWorkspace`, `withWorkspaceWrite`, `outboxOps`, `syncMetaOps`, `getWorkspaceSnapshot`, `isWorkspaceCurrent`.

- [ ] **Step 1: Preserve and finish the interrupted workspace-race RED tests**

Keep the existing uncommitted tests proving delayed anonymous open cannot override login and the last concurrent switch wins. Add tests for a stale open handle being closed and `transactionOps.addMany()` binding one database handle for its full call.

Run:

```bash
npx vitest run src/sync/local-db.test.ts src/lib/db.test.ts
```

Expected: at least the addMany stable-handle test fails before implementation; record exact failures in the task report.

- [ ] **Step 2: Replace advanced contracts with the minimal public contract**

```ts
export type EntityType = 'transaction' | 'category' | 'budget'
export type OperationKind = 'upsert' | 'delete'
export type SyncPayload = Transaction | Category | BudgetRule

export interface PendingOperation {
  operationId: string
  entityType: EntityType
  entityId: string
  operation: OperationKind
  payload: SyncPayload | null
  createdAt: string
  attemptCount: number
  nextAttemptAt: string
  state: 'pending' | 'isolated'
  lastError?: string
}

export interface CloudRecord {
  entityType: EntityType
  entityId: string
  record: SyncPayload | null
  updatedAt: string
  deletedAt: string | null
}

export type SyncStatus =
  | { kind: 'local-only' }
  | { kind: 'idle'; lastSyncedAt?: string }
  | { kind: 'syncing'; pending: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'auth-required'; pending: number }
  | { kind: 'error'; pending: number; message: string }
```

- [ ] **Step 3: Upgrade the local database to version 3**

Store `PendingOperation & { enqueueOrder: number }` internally. During v2→v3, recreate the unused pre-release outbox store with key path `operationId` and indexes `by-state`, `by-entity`, and `by-order`; retain all business/config/meta data. Add a `sync_meta` monotonic `outbox_sequence` updated in the same transaction as enqueue.

Finish the existing generation guard so stale async opens close themselves and cannot become active. Export a read-only generation token:

```ts
export interface WorkspaceSnapshot {
  db: IDBPDatabase<KakeiboSchemaV3>
  generation: number
  id: WorkspaceId
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot>
export function isWorkspaceCurrent(snapshot: WorkspaceSnapshot): boolean
```

Make `outboxOps.add` use IndexedDB `add`, reject duplicate IDs, and return pending items by `enqueueOrder`. Make `transactionOps.addMany` resolve one workspace once and run duplicate checks plus writes inside one transaction.

- [ ] **Step 4: Verify focused and full compatibility**

Run:

```bash
npx vitest run src/sync/local-db.test.ts src/lib/db.test.ts src/components/settings/DataManager.test.tsx
npx vitest run
npm run build
git diff --check
```

Expected: focused and full suites PASS; build succeeds; the pre-existing UI APIs remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/sync/contracts.ts src/sync/local-db.ts src/sync/local-db.test.ts src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: add minimal account-safe sync outbox"
```

---

### Task 3: Make Domain Writes Local-First and Outbox-Atomic

**Files:**
- Create: `src/sync/domain-repository.ts`
- Create: `src/sync/domain-repository.test.ts`
- Create: `src/sync/wake-bus.ts`
- Modify: `src/hooks/useTransactions.ts`
- Modify: `src/hooks/useTransactions.test.ts`
- Modify: `src/hooks/useCategories.ts`
- Modify: `src/hooks/useCategories.test.ts`
- Modify: `src/hooks/useBudget.ts`
- Modify: `src/components/settings/DataManager.tsx`

**Interfaces:**
- Consumes: Task 2 workspace transactions and `PendingOperation`.
- Produces: `domainRepository.upsert`, `domainRepository.remove`, `domainRepository.importTransactions`, `domainRepository.applyCloudRecords`, `domainRepository.exportSnapshot`, `emitSyncWake`, `subscribeSyncWake`.

- [ ] **Step 1: Write failing repository atomicity and overlay tests**

Use fake IndexedDB to prove:

```ts
await domainRepository.upsert('transaction', transaction)
expect(await db.get('transactions', transaction.id)).toMatchObject(transaction)
expect(await outboxOps.pending()).toHaveLength(1)

// Arrange the repository's injected id factory to reuse an existing operationId,
// so the outbox `add()` fails after the business-store `put()` in the same transaction.
await expect(repositoryWithDuplicateId.upsert('transaction', brokenPayload)).rejects.toThrow()
expect(await db.get('transactions', brokenPayload.id)).toBeUndefined()
expect(await outboxOps.pending()).toHaveLength(0)
```

Also prove delete removes the record locally and enqueues a delete, system categories remain local-only, CSV import is one-workspace atomic, cloud tombstones remove local rows, pending local payload overlays pulled cloud data, and an isolated operation does not overlay cloud data.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/sync/domain-repository.test.ts`

Expected: FAIL because `domain-repository.ts` does not exist.

- [ ] **Step 3: Implement the repository boundary**

```ts
export interface DomainRepository {
  upsert(entityType: EntityType, payload: SyncPayload): Promise<void>
  remove(entityType: EntityType, entityId: string): Promise<void>
  importTransactions(records: Transaction[]): Promise<{ added: number; skipped: number }>
  applyCloudRecords(records: CloudRecord[]): Promise<void>
  exportSnapshot(): Promise<DomainSnapshot>
}

export interface DomainSnapshot {
  transactions: Transaction[]
  categories: Category[]
  budgets: BudgetRule[]
}
```

Every synced write must use one `withWorkspaceWrite([...businessStore, 'outbox', 'sync_meta'])` transaction. Create the repository through `createDomainRepository({ operationId?: () => string, now?: () => Date })`, defaulting to `nanoid()` and the real clock, so rollback behavior is testable without production-only flags. Set retry fields to zero/now/pending and assign monotonic `enqueueOrder`. `applyCloudRecords` uses one workspace snapshot, applies cloud rows, then overlays only `state='pending'` operations without creating new outbox entries.

Create a tiny synchronous wake bus:

```ts
export type SyncWakeReason = 'local-write' | 'realtime' | 'online' | 'foreground' | 'manual'
export function emitSyncWake(reason: SyncWakeReason): void
export function subscribeSyncWake(listener: (reason: SyncWakeReason) => void): () => void
```

Emit `local-write` only after the IndexedDB transaction commits successfully.

- [ ] **Step 4: Route UI mutations through the repository**

Keep the hooks' returned signatures unchanged. Replace transaction/category/budget writes with repository calls. Keep system category seeding local-only. Change DataManager clear into explicit synced deletion of user records; do not directly clear stores for logged-in workspaces.

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run src/sync/domain-repository.test.ts src/hooks/useTransactions.test.ts src/hooks/useCategories.test.ts src/components/budget/BudgetAccessibility.test.tsx src/components/settings/DataManager.test.tsx
npx vitest run
npm run build
```

Expected: all tests PASS and existing hook/UI contracts remain intact.

- [ ] **Step 6: Commit**

```bash
git add src/sync/domain-repository.ts src/sync/domain-repository.test.ts src/sync/wake-bus.ts src/hooks/useTransactions.ts src/hooks/useTransactions.test.ts src/hooks/useCategories.ts src/hooks/useCategories.test.ts src/hooks/useBudget.ts src/components/settings/DataManager.tsx
git commit -m "feat: make local writes sync-atomic"
```

---

### Task 4: Add the Typed Supabase Transport and Foreground Sync Engine

**Files:**
- Create: `src/sync/supabase-transport.ts`
- Create: `src/sync/supabase-transport.test.ts`
- Create: `src/sync/sync-engine.ts`
- Create: `src/sync/sync-engine.test.ts`
- Create: `src/sync/sync-store.ts`
- Modify: `src/sync/contracts.ts`

**Interfaces:**
- Consumes: Task 1 RPC, Task 2 outbox/workspace generation, Task 3 repository.
- Produces: `SyncTransport`, `createSupabaseTransport`, `createSyncEngine`, `useSyncStore`.

- [ ] **Step 1: Add failing transport mapping tests**

Define:

```ts
export interface OperationResult extends CloudRecord {
  operationId: string
  status: 'applied' | 'deleted' | 'duplicate' | 'deduplicated' | 'rejected_deleted'
}

export interface SyncTransport {
  pullAll(): Promise<CloudRecord[]>
  push(operation: PendingOperation): Promise<OperationResult>
  subscribe(onWake: () => void, onConnection: (online: boolean) => void): Promise<() => Promise<void>>
}

export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'transient' | 'protocol',
    readonly status?: number,
  ) { super(message) }
}
```

Test snake_case→camelCase mapping, three-table pulls including tombstones, exact RPC arguments, malformed response rejection, auth/rate-limit/transient error classification, Realtime user filter, wake-only behavior, and unsubscribe cleanup.

- [ ] **Step 2: Run transport RED and implement the adapter**

Run: `npx vitest run src/sync/supabase-transport.test.ts`

Expected: FAIL because the module is absent.

Implement `createSupabaseTransport(client, userId)` using `.from(table).select(...)`, `client.rpc('apply_operation', ...)`, and three Realtime table subscriptions filtered with `user_id=eq.${userId}`. Validate entity IDs, payload shape, timestamps, and status before returning.

- [ ] **Step 3: Add failing engine state-machine tests**

With fake transport and fake timers, prove:

- pull → overlay → ordered push → final pull;
- offline keeps pending items and reports `offline`;
- 401 reports `auth-required` without deleting outbox;
- 429/5xx increment attempts and set jittered exponential `nextAttemptAt`;
- invalid payload isolates only that operation;
- Realtime/network/visibility wake a quiet engine;
- stop/account-generation change prevents late results from writing another workspace;
- duplicate wake events coalesce into one active loop.

- [ ] **Step 4: Implement the foreground engine**

```ts
export interface SyncEngine {
  start(): Promise<void>
  wake(reason: 'local-write' | 'realtime' | 'online' | 'foreground' | 'manual'): void
  stop(): Promise<void>
}

export function createSyncEngine(input: {
  userId: string
  workspace: WorkspaceSnapshot
  transport: SyncTransport
  repository: DomainRepository
  now?: () => Date
  random?: () => number
}): SyncEngine
```

Allow one loop per engine instance. Before and after every awaited network call, require both `running` and `isWorkspaceCurrent(workspace)`. Retry delay is `min(2 ** attemptCount * 1000 + random() * 500, 300_000)`. While started, subscribe to Task 3's wake bus plus `online`, `visibilitychange`, and Realtime; unsubscribe all four sources on stop. Do not add service-worker background sync or leader election.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx vitest run src/sync/supabase-transport.test.ts src/sync/sync-engine.test.ts
npx vitest run
npm run build
```

Expected: all tests PASS; build succeeds.

```bash
git add src/sync/contracts.ts src/sync/supabase-transport.ts src/sync/supabase-transport.test.ts src/sync/sync-engine.ts src/sync/sync-engine.test.ts src/sync/sync-store.ts
git commit -m "feat: add quiet foreground sync engine"
```

---

### Task 5: Add Email OTP, Session-Bound Workspaces, and Safe First Login

**Files:**
- Create: `src/sync/auth-session.tsx`
- Create: `src/sync/auth-session.test.tsx`
- Create: `src/components/settings/CloudSyncCard.tsx`
- Create: `src/components/settings/CloudSyncCard.test.tsx`
- Create: `src/pages/SettingsPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/sync/supabase-client.ts`

**Interfaces:**
- Consumes: Supabase Auth, Task 2 workspace APIs, Task 3 export/repository, Task 4 engine.
- Produces: `AuthSyncProvider`, `useAuthSync`, account/migration actions used by `CloudSyncCard`.

- [ ] **Step 1: Write failing session lifecycle tests**

Prove: missing cloud env leaves anonymous local-only mode usable; restored session switches to `kakeibo-user-<sub>` before starting engine; sign-out stops engine before switching; late old-engine result is ignored; OTP calls `signInWithOtp({ email, options: { emailRedirectTo } })`; auth expiry retains pending items; first login does not migrate anonymously without confirmation.

- [ ] **Step 2: Write failing first-login migration tests**

Use a fake backup writer and repositories to prove this order:

```text
export anonymous JSON → user confirms → switch user workspace → import stable IDs into outbox → start engine
```

If export or import fails, keep the anonymous database unchanged, do not start the engine, and show a recoverable error. Store `anonymous_migration_complete:<userId>` only after the import transaction succeeds.

- [ ] **Step 3: Implement `AuthSyncProvider`**

Expose:

```ts
interface AuthSyncContextValue {
  session: Session | null
  loading: boolean
  migrationRequired: boolean
  pending: number
  sendOtp(email: string): Promise<void>
  confirmMigration(): Promise<void>
  skipMigration(): Promise<void>
  signOut(): Promise<void>
  retry(): void
}
```

Use an internal `AnonymousMigrationService` with exact methods `prepare(userId): Promise<{ blob: Blob; snapshot: DomainSnapshot }>`, `commit(userId, snapshot): Promise<void>`, and `markSkipped(userId): Promise<void>`. `prepare` creates/downloads the JSON backup before exposing the confirmation action; `commit` switches workspace, imports stable IDs atomically, then writes the completion marker.

Create exactly one engine for the current session/workspace. Subscribe to `onAuthStateChange`, serialize lifecycle transitions, and compare a lifecycle generation after each await. Keep cloud misconfiguration as `local-only`, not an application crash.

- [ ] **Step 4: Build the settings account card**

Use existing `surface`, `Sheet`, `InlineNotice`, `ConfirmDialog`, `Icon`, and design tokens. Provide email OTP input when signed out; signed-in email/status/pending count/retry/sign-out when signed in; and a confirmation sheet before anonymous migration. Copy must state that synchronization runs automatically while the app is open.

- [ ] **Step 5: Mount and verify**

Wrap `App` with `AuthSyncProvider` in `App.tsx` (not `main.tsx`, so tests can render with providers). Put `CloudSyncCard` above manual WebDAV backup in Settings.

Run:

```bash
npx vitest run src/sync/auth-session.test.tsx src/components/settings/CloudSyncCard.test.tsx src/pages/SettingsPage.test.tsx
npx vitest run
npm run build
```

Expected: session, migration, UI tests and full suite PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/sync/auth-session.tsx src/sync/auth-session.test.tsx src/components/settings/CloudSyncCard.tsx src/components/settings/CloudSyncCard.test.tsx src/App.tsx src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx src/sync/supabase-client.ts
git commit -m "feat: add automatic account sync sessions"
```

---

### Task 6: Make Sync Status Calm and WebDAV Explicitly Manual

**Files:**
- Create: `src/components/sync/SyncStatusPill.tsx`
- Create: `src/components/sync/SyncStatusPill.test.tsx`
- Modify: `src/components/settings/WebDAVConfig.tsx`
- Modify: `src/components/settings/WebDAVConfig.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Task 4 `useSyncStore`, Task 5 `useAuthSync`.
- Produces: accessible status copy and manual disaster-recovery presentation.

- [ ] **Step 1: Write failing status/copy tests**

Assert exact visible mappings:

```ts
idle            -> '已同步'
syncing(3)      -> '同步中 · 3 项'
offline(2)      -> '离线 · 2 项待同步'
auth-required   -> '需要重新登录'
error           -> '同步失败'
local-only      -> '仅保存在本机'
```

Assert status uses `role=status`, errors do not repeatedly toast, WebDAV heading reads `手动灾备`, and its description says it does not participate in automatic synchronization.

- [ ] **Step 2: Implement the minimal status UI**

Render a compact soft icon pill in the application shell; show it only when signed in or when there is actionable offline/error state. Keep detailed retry/error text inside Settings. Reuse the existing cloud/check/warning icons; add no emoji.

- [ ] **Step 3: Verify and commit**

Run:

```bash
npx vitest run src/components/sync/SyncStatusPill.test.tsx src/components/settings/WebDAVConfig.test.tsx src/pages/SettingsPage.test.tsx
npx vitest run
npm run build
```

Expected: all tests PASS; visual tokens and keyboard accessibility remain intact.

```bash
git add src/components/sync/SyncStatusPill.tsx src/components/sync/SyncStatusPill.test.tsx src/components/settings/WebDAVConfig.tsx src/components/settings/WebDAVConfig.test.tsx src/pages/SettingsPage.tsx src/App.tsx
git commit -m "feat: add calm automatic sync status"
```

---

### Task 7: Two-Device Acceptance, Security Gate, and Advanced-Code Cleanup

**Files:**
- Create: `src/test/simple-sync-harness.ts`
- Create: `src/sync/simple-sync.e2e.test.ts`
- Create: `docs/operations/simple-sync-runbook.md`
- Modify: `.env.example` if present, otherwise create it.
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-15-automatic-multi-device-sync-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-automatic-multi-device-sync.md`

**Interfaces:**
- Consumes: the complete simple sync runtime.
- Produces: repeatable two-device regression, local/hosted setup instructions, and explicit supersession markers on advanced docs.

- [ ] **Step 1: Add the two-device harness and failing scenarios**

Model two independent IndexedDB workspaces against one fake server. Cover:

1. Device A offline adds a transaction; Device B online adds another; A reconnects; both converge.
2. A and B edit the same category; the operation accepted last by server appears on both.
3. A deletes a transaction; B's stale ordinary upsert is rejected; both remove it.
4. The same operation response is lost and retried; the business row changes once.
5. Switching A from user one to user two during a delayed pull writes nothing into user two.

- [ ] **Step 2: Run RED, then complete only missing integration seams**

Run: `npx vitest run src/sync/simple-sync.e2e.test.ts`

Expected: FAIL only for uncovered integration seams. Fix those seams in their owning small module; do not introduce history, revisions, leader election, or background service-worker sync.

- [ ] **Step 3: Document setup and operations**

`.env.example` contains only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

The runbook documents local `supabase start`, `supabase db reset`, Inbucket OTP testing, hosted migration deployment, RLS verification, Realtime table enablement, trusted-local Docker warning, stopping local services, and manual two-browser/device acceptance. State clearly that sync runs only while the app is open/foregrounded.

Mark both old advanced design/plan documents `Superseded by 2026-07-15-simple-offline-sync-design.md`; do not delete history.

- [ ] **Step 4: Run the full release gate**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
npx vitest run
npm run build
git diff --check
git status --short
```

Expected: database tests/lint, all Vitest files, TypeScript/Vite/PWA build, and whitespace checks PASS; status contains only the intended task files before commit.

- [ ] **Step 5: Commit**

```bash
git add src/test/simple-sync-harness.ts src/sync/simple-sync.e2e.test.ts docs/operations/simple-sync-runbook.md .env.example README.md docs/superpowers/specs/2026-07-15-automatic-multi-device-sync-design.md docs/superpowers/plans/2026-07-15-automatic-multi-device-sync.md
git commit -m "test: verify simple two-device synchronization"
```

---

## Final Review Gate

- Run an independent whole-branch code review from `6fd1a2f` to final HEAD.
- Fix every Critical and Important issue, then re-run the relevant task review and the full release gate.
- Confirm no advanced runtime artifacts remain: `rg 'change_log|deletion_registry|baseRevision|pull_changes|sync_snapshot|leader election' src supabase` must return only deliberate supersession documentation or no matches.
- Confirm no Clerk dependency, secret, service-role key, WebDAV credential, or real user email is committed.
- Keep the branch unpushed until the user chooses the finishing action.
