# Transload Log PWA

A shared, live log for outgoing loads and incoming trucks/drivers. Every operator signs in anonymously and chooses a display name. The name is saved with each record and every edit, so the team can see who entered or last changed it.

## One-time Supabase setup

1. In the linked Supabase project, open **Authentication → Providers** and enable **Anonymous sign-ins**.
2. Open the **SQL Editor**, paste and run [`supabase.sql`](supabase.sql).
3. Deploy all files in this directory together on an HTTPS web host.

The SQL creates the common database tables, permits authenticated anonymous operators to read/write the shared log, and adds them to Realtime. Do **not** skip it: without it each device cannot share records.

## Fixing “Invalid API key”

Running `supabase.sql` does **not** fix an invalid API key. That error means the value in `SUPABASE_ANON_KEY` in [`index.html`](index.html) was revoked, rotated, copied incorrectly, or belongs to a different project.

1. In the same Supabase project as `SUPABASE_URL`, open **Project Settings → API**.
2. Copy the current **Publishable key** (preferred) or legacy **anon key**. Never use the `service_role`/secret key in this browser app.
3. Replace only the value assigned to `SUPABASE_ANON_KEY` in [`index.html`](index.html), deploy the updated file, then hard-refresh the app (or remove and re-add the installed PWA if it still shows an old cached version).
4. Run `supabase.sql` only if the next error reports missing tables, policies, or Realtime setup.

The app now distinguishes invalid-key errors from database-setup errors and gives the matching recovery step.

## What is shared

- Outgoing: add, edit location/truck/trailer/date/time, and delete loads.
- Incoming: add truck/driver, edit truck/driver/date/time, and delete entries.
- Quick-driver buttons: created/updated from incoming entries and shared by all operators.
- Live updates: inserts, edits, and deletes from other users appear automatically while the app is open.
- Attribution: every row shows who entered it and who last edited it.

## iPhone install

1. Open the deployed HTTPS URL in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. Keep **Open as Web App** enabled and tap **Add**.
