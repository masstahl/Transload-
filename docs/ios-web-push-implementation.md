# Transload Log iOS Web Push

Overdue load push notifications for iPhones. Live on `main` (served by GitHub Pages).

## How it works

- The app registers `sw.js` (persistent; it no longer unregisters itself) and shows an
  "Enable overdue alerts" button in the header. Tapping it requests notification
  permission, creates a Web Push subscription with the VAPID public key baked into
  `index.html`, and saves it to `push_subscriptions` (one row per device endpoint).
- `sw.js` handles `push` (shows the notification) and `notificationclick` (focuses/opens the app).
- The Edge Function `supabase/functions/notify-overdue` is the single sender. It finds
  outgoing loads with `load_started_at` 12+ minutes ago and no `load_finished_at`
  (today in America/Los_Angeles), then sends one push per enabled subscription.
- `push_overdue_deliveries` holds one idempotency claim per (load, subscription) so
  overlapping runs never double-notify; failed claims are released for retry and
  dead endpoints (404/410) are disabled automatically.
- `.github/workflows/transload-overdue-push.yml` invokes the function. It is
  **manual-only** (`workflow_dispatch`) until a real end-to-end delivery test passes.

## Server setup (Supabase dashboard)

1. Run `supabase/migrations/20261017000000_add_transload_web_push.sql` and
   `supabase/migrations/20261017010000_add_per_subscription_push_claims.sql` in the
   SQL editor (the tables already exist in production as of 2026-10-17).
2. Deploy the function: `supabase functions deploy notify-overdue`.
3. Set Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (a `mailto:` address), and `NOTIFICATION_KEY` (strong random
   string; also saved as the `NOTIFICATION_KEY` GitHub repo secret for the workflow).
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.
4. The VAPID keypair was reset on 2026-10-17: the public key in `index.html`
   (`VAPID_PUBLIC_KEY`) is the only one the server must use. After any key rotation,
   every device must Disable then re-Enable alerts to subscribe under the new key.

## Testing before enabling the schedule

1. On the iPhone Home Screen app (iOS 16.4+; web push does not work in Safari tabs),
   tap "Enable overdue alerts" and grant permission.
2. Start a load timer, wait 12 minutes, then run the workflow manually from the
   GitHub Actions tab. The phone should buzz even with the app backgrounded.
3. Only then add a `schedule` trigger (every minute) to `transload-overdue-push.yml`.

## Removed 2026-10-17

- Deleted the duplicate sender `supabase/functions/notify-overdue-loads` (it used a
  different auth scheme and was never wired to the scheduler).
- Deleted the competing migration `supabase/migrations/20261017_push_subscriptions.sql`
  (it created an unused `push_notification_deliveries` table and a duplicate RLS policy).
- The type-check workflow now checks the live function.
