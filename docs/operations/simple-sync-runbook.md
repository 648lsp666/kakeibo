# Simple Sync Runbook

## Scope and security

Synchronization runs while the web app/PWA is open or foregrounded. Startup, returning to the foreground, network recovery, and Realtime notifications trigger catch-up; a closed app has no background sync worker. Sign in using the Supabase email magic-link/OTP flow. The browser receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never expose a service-role key, database password, or WebDAV credential.

WebDAV and JSON export are manual disaster-recovery backups only. They do not authenticate a cloud account or merge with automatic Supabase sync.

## Local Supabase and OTP

Docker is trusted-local development infrastructure: it starts database, Auth, and related services with local credentials. Do not expose its ports to an untrusted network or use its generated secrets in hosted environments.

```sh
npx supabase start
npx supabase db reset
npx supabase test db
```

Set `.env.local` to the local API URL and local anonymous key printed by `supabase status`, then start the app. Request an email magic link/OTP and open Inbucket at `http://127.0.0.1:54324`; use the newest message's code/link to finish sign-in. Stop local services when finished:

```sh
npx supabase stop
```

## Hosted deployment

Create/link the hosted Supabase project, configure allowed application redirect URLs for magic links, set the two public Vite variables in the hosting environment, then deploy schema changes:

```sh
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Before release, verify RLS as two separate authenticated users: each can read only its own `transactions`, `categories`, and `budgets`, and direct table writes remain denied. Confirm the `apply_operation` RPC works for an authenticated user and rejects unauthenticated calls. Ensure Postgres Changes/Realtime is enabled for `transactions`, `categories`, and `budgets` (the migration adds them to `supabase_realtime`); Realtime is a wake-up hint, while the subsequent pull supplies authoritative state.

## Manual two-device acceptance

Use two independent browser profiles or physical devices, signed into the same email account.

1. Put device A offline and create a transaction. On online device B, create another transaction.
2. Restore A's network/foreground the app. Wait for both devices to show both transactions.
3. Edit the same custom category on A and B, syncing A then B; both must show the server-last accepted value.
4. Delete a transaction on A, then let B attempt an older offline edit. Both devices must retain the deletion.
5. Refresh/reopen either device and confirm it catches up. Sign out and sign in as a different account; no prior account rows may appear.

If cloud sync is unavailable, continue using the local ledger and export JSON or use WebDAV manually for disaster recovery. Do not treat either backup as an automatic-sync substitute.
