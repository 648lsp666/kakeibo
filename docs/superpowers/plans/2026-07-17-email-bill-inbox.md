# Email Bill Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let signed-in users receive encrypted WeChat and Alipay bill ZIP attachments through a private forwarding address, enter the password locally, preview parsed transactions, and import them without manually downloading and unpacking files.

**Architecture:** Resend Inbound sends verified `email.received` webhooks to a Supabase Edge Function. The function maps an unguessable alias to a user, downloads exactly one ZIP attachment, hashes it per user, and stores it in a private Supabase Storage bucket with a row in `pending_bills`. The browser lists the current user's rows through RLS, downloads the private ZIP, decrypts it in memory, reuses the existing WeChat/Alipay parsers, and confirms import before an authenticated cleanup function removes the raw attachment and retains only minimal completion metadata.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase Postgres/RLS/Storage/Realtime/Edge Functions, Resend Inbound, `@zip.js/zip.js`.

## Global Constraints

- Do not use brainstorming or ask further product questions; decisions in the conversation are final.
- Email receiving is available only to authenticated Supabase users.
- Passwords remain in browser memory, are never persisted or uploaded, and have no retry limit.
- Only encrypted ZIPs containing one supported WeChat/Alipay CSV statement are accepted; email-delivered Excel files never reach the legacy `xlsx` parser.
- No pending UI is rendered when the queue is empty.
- Successful import deletes the raw ZIP immediately and retains only source, filename, statement period, imported count, hash, and completion time.
- Failed/unprocessed raw attachments expire after seven days; explicit deletion is immediate and irreversible after confirmation.
- Duplicate attachments are suppressed per user by SHA-256; no cross-user hash lookup is exposed.
- First release uses Resend Inbound behind a replaceable webhook adapter and does not include test-email verification.

---

### Task 1: Database inbox contract

**Files:**
- Create: `supabase/migrations/202607170001_email_bill_inbox.sql`
- Modify: `supabase/tests/sync_schema.test.sql`

**Interfaces:**
- Produces: `bill_inboxes`, `pending_bills`, private `bill-attachments` bucket, `enable_bill_inbox()`, and RLS-selectable queue rows. Destructive mutations remain service-role-only behind the authenticated management function.

- [x] Add pgTAP assertions for authenticated alias creation, stable reuse, reset, user isolation, queue read isolation, and direct-write denial.
- [x] Run `npx supabase db reset && npx supabase test db` and confirm the new assertions fail before the migration exists.
- [x] Implement the migration with random 20-hex-character aliases, private per-user object paths, seven-day expiry, status checks, grants, RLS, and Realtime publication.
- [x] Re-run database reset, pgTAP, and `npx supabase db lint --level warning` until green.

### Task 2: Verified Resend inbound adapter

**Files:**
- Create: `supabase/functions/_shared/inbound-email.ts`
- Create: `supabase/functions/_shared/inbound-email.test.ts`
- Create: `supabase/functions/inbound-email/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: Resend `email.received` metadata and `bill_inboxes.alias`.
- Produces: validated recipient alias and exactly-one-ZIP attachment selection; uploads `{user_id}/{bill_id}/{safe_filename}` and inserts a pending or failed queue row idempotently.

- [x] Write failing Vitest tests for recipient parsing, domain enforcement, one-ZIP enforcement, filename sanitization, 20 MiB limit, and SHA-256 output.
- [x] Run the focused test and confirm failure because the adapter does not exist.
- [x] Implement pure validation helpers, then run the focused test to green.
- [x] Implement the Edge Function using the raw body and Svix headers for `resend.webhooks.verify`, the Resend Receiving Attachment API, service-role Supabase access, per-user hash dedupe, and private Storage upload.
- [x] Mark `inbound-email` as `verify_jwt = false`; keep all user-facing functions JWT-protected.

### Task 3: Local encrypted archive parser

**Files:**
- Create: `src/lib/bill-file.ts`
- Create: `src/lib/bill-file.test.ts`
- Create: `src/lib/bill-archive.ts`
- Create: `src/lib/bill-archive.test.ts`
- Modify: `src/components/import/CSVImportButton.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `parseBillFile(name, bytes)` and `parseEncryptedBillArchive(bytes, password)` returning `{ source, transactions }`.

- [x] Write failing tests that move manual CSV/XLSX source detection and encoding fallback behind `parseBillFile`.
- [x] Implement `bill-file.ts` and refactor the manual import button to use it; run focused tests green.
- [x] Write failing archive tests that create a password-protected ZIP in memory, reject a wrong password, reject zero/multiple supported files, and parse the correct statement.
- [x] Install `@zip.js/zip.js`, implement in-memory extraction with no password persistence, and run focused tests green.

### Task 4: Inbox client and pending-card UI

**Files:**
- Create: `src/bill-inbox/types.ts`
- Create: `src/bill-inbox/client.ts`
- Create: `src/bill-inbox/client.test.ts`
- Create: `src/bill-inbox/usePendingBills.ts`
- Create: `src/components/import/PendingBillsCard.tsx`
- Create: `src/components/import/PendingBillsCard.test.tsx`
- Modify: `src/components/ui/Icon.tsx`
- Modify: `src/pages/LedgerPage.tsx`
- Modify: `src/pages/LedgerPage.test.tsx`

**Interfaces:**
- Produces: authenticated enable/disable/reset/list/download/delete/complete operations and a card callback `onParsed(result, pendingBill)`.

- [x] Write failing client tests for RPC mapping, user-scoped download paths, deletion confirmation action, and cleanup completion metadata.
- [x] Implement the client and run focused tests green.
- [x] Write failing component tests for hidden-empty state, first-expanded/more-collapsed layout, password entry, wrong-password retry, refresh, immediate delete confirmation, and parsed callback.
- [x] Implement the foreground/Realtime refresh hook and soft UI card between `MonthHeader` and `TransactionList`; run focused tests green.

### Task 5: Import completion, settings, operations, and verification

**Files:**
- Create: `supabase/functions/manage-pending-bill/index.ts`
- Create: `src/components/settings/BillInboxConfig.tsx`
- Create: `src/components/settings/BillInboxConfig.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/LedgerPage.tsx`
- Modify: `src/pages/LedgerPage.test.tsx`
- Modify: `.env.example`
- Create: `docs/operations/email-bill-inbox.md`

**Interfaces:**
- Consumes: successful local transaction import and authenticated pending-bill ID.
- Produces: immediate object deletion, minimal completion record, configurable inbox address, and deployment instructions.

- [x] Write failing tests proving the pending row is completed only after transaction import succeeds and remains retryable after import failure.
- [x] Implement authenticated cleanup through `manage-pending-bill`, invoke it after successful import, and run Ledger tests green.
- [x] Write failing settings tests for signed-out hiding, enable/copy/reset/disable behavior, and disable warning.
- [x] Implement settings UI and add `VITE_INBOUND_EMAIL_DOMAIN` to `.env.example`.
- [x] Document Resend receiving-domain MX setup, webhook URL and signing secret, Supabase secrets, function deployment, seven-day cleanup scheduling, and the privacy boundary.
- [x] Run `npx vitest run`, `npm run build`, `npx supabase test db`, `npx supabase db lint --level warning`, and `git diff --check`.
