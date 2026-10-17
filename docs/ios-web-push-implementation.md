# Transload Log iOS Web Push

This is a preview-only implementation on `feature/turnaround-wave-chart-push`. The production app and Supabase database have not been changed.

## Implemented in source
- HTTPS service-worker registration without automatically prompting for permission.
- An operator-tap “Enable overdue alerts” control; it requests permission only after a tap, saves the device subscription under the current Supabase user, and offers a disable action.
- A server-side sender at `supabase/functions/notify-overdue-loads/index.ts`.
- Additive SQL for per-user push subscriptions and unique per-entry/per-subscription delivery claims.
- The sender only considers unfinished loads started at least 12 minutes ago and since midnight in America/Los_Angeles. Old unfinished rows from prior operating days are excluded.
- A unique delivery claim prevents overlapping scheduled runs from sending duplicate alerts. Failed claims are released for retry; stale 404/410 endpoints are disabled.
- UI audit has passed on the feature branch after correcting alert-button touch target sizing.

## Still required before live activation
1. Review and merge the PR only after the Edge Function type-check workflow passes.
2. Apply the SQL migration to the intended Supabase project. It is **not** applied yet.
3. Configure Edge Function secrets in Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a mailto: address), and a strong random `PUSH_CRON_SECRET`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Edge Function environment. Never expose the service-role key or VAPID private key in client code or Git.
4. Deploy the function with JWT verification disabled only because it authenticates requests using `PUSH_CRON_SECRET`. The secret must be passed as a bearer token only from the scheduler.
5. Configure a scheduler to POST to the function on a short interval (for example every minute) using the bearer secret. Do not enable it until migration, secrets and manual function tests are confirmed.
6. Test permission grant/denial, enable/disable, duplicate scheduler calls, completed loads, stale subscriptions, DST/day boundary, and real iOS Home Screen delivery while the app is backgrounded.

## Important limitations
- GitHub Actions UI audit does not test real iOS push delivery.
- No preview Supabase project is currently configured, so live database/function changes are deliberately held until runtime configuration and testing can be done safely.
- No production migration, function deployment, secrets, or scheduler has been changed.
