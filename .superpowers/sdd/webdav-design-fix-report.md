# WebDAV disaster-recovery isolation

## Design boundary

WebDAV remains a manual disaster-recovery path. It is neither an automatic-sync trigger nor a bidirectional merge with Supabase.

## Change

- `downloadAndMerge` checks the active workspace before any fetch. A signed-in workspace receives the clear instruction to sign out and restore in local mode.
- Anonymous restoration uses `importAnonymousWebDavTransactions` in `local-db`. That path writes only the anonymous `transactions` store and intentionally does not touch the outbox or emit a sync wake.
- The restore path rechecks the active workspace inside the local DB import, protecting against a workspace switch while the backup is being downloaded.
- Settings copy, README, and the sync runbook state the sign-out/local-mode recovery flow and no-cloud-merge rule.

## Regression coverage

- Signed-in recovery is rejected before download, import, or metadata write.
- Anonymous recovery delegates to the local-only import path.
- A real anonymous IndexedDB recovery adds the restored transaction while leaving an existing outbox entry unchanged.

## Verification

- `npx vitest run src/lib/webdav.test.ts src/sync/local-db.test.ts src/components/settings/WebDAVConfig.test.tsx` — 20 passed.
- `npx vitest run` — 38 files, 247 tests passed.
- `npm run build` — passed.
- `git diff --check` — passed.

## Concern

The existing WebDAV payload format includes categories, but the historic downloader restored transactions only. This fix preserves that established scope rather than expanding disaster-recovery semantics.
