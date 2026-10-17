# Transload Log iOS Web Push — implementation notes

This branch is a preview-only implementation. Nothing in this folder has been applied to the live Supabase project.

## Current foundation
- `sw.js` stays registered and handles `push` and `notificationclick` events.
- `index.html` registers `./sw.js` on HTTPS. Registration alone does not request notification permission.
- `supabase/migrations/20261017_push_subscriptions.sql` defines a per-user subscription table with owner-only RLS.

## Remaining work before notifications can be enabled
1. Add an explicit user-initiated “Enable overdue alerts” action. iOS requires permission requests to happen in response to a tap.
2. Generate a VAPID key pair outside source control. Put the private key in Supabase Edge Function secrets and expose only the public key to the client.
3. Add an authenticated subscription endpoint and a scheduled sender. The sender must use the service role only server-side, query unfinished loads older than 12 minutes, send a single alert per load, and mark stale subscriptions disabled when push endpoints return permanent-gone responses.
4. Add a deduplication table keyed by load entry and notification type; do not rely only on notification tags because tags do not prevent repeated pushes.
5. Enable and configure `pg_cron` and `pg_net` only after the Edge Function is deployed and tested in a preview environment. The job must not run against production until explicitly approved.
6. Test: permission denied, permission granted, duplicate schedule runs, finished/cancelled loads, deleted loads, invalid subscriptions, timezone handling, and iOS Home Screen delivery while the app is backgrounded.

## Safety constraints
- Do not commit VAPID private keys, Supabase service-role keys, or individual push endpoints.
- Do not send notifications merely because an old historical row has a start timestamp: only alert for a load that is still unfinished and belongs to the active operating day/site policy.
- Keep the existing 12-minute threshold as the source of truth.
- No Cloudflare services are used.
