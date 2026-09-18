# Transload Log PWA

A shared, live log for outgoing loads and incoming trucks/drivers. Every operator signs in anonymously and chooses a display name. The name is saved with each record and every edit, so the team can see who entered or last changed it.

## One-time Supabase setup

1. In the linked Supabase project, open **Authentication → Providers** and enable **Anonymous sign-ins**.
2. Open the **SQL Editor**, paste and run [`supabase.sql`](supabase.sql).
3. Deploy all files in this directory together on an HTTPS web host.

The SQL creates the common database tables, permits authenticated anonymous operators to read/write the shared log, and adds them to Realtime. Do **not** skip it: without it each device cannot share records.

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
