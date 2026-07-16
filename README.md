# Kakeibo

Kakeibo is a local-first PWA. Cloud synchronization uses Supabase email magic-link/OTP login and runs automatically only while the app is open or foregrounded. It does not run as a background service when the page/PWA is closed.

Copy `.env.example` to `.env.local` and provide the public Supabase project URL and publishable (anon) key. Never put a service-role key in a Vite environment variable or browser bundle.

For local Supabase, hosted deployment, OTP testing, and two-device acceptance, see [the simple sync runbook](docs/operations/simple-sync-runbook.md). WebDAV/JSON export remains a manual disaster-recovery backup path; it is not part of automatic synchronization or Supabase merging. WebDAV recovery is available only after signing out, in the anonymous local workspace; it never creates cloud-sync operations.
