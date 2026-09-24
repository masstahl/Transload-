# Transload Log

Shared live log for outgoing loads and incoming drivers.

## Publish (Cloudflare Pages)

This repo is a static site. The fastest host is Cloudflare Pages:

1. Open https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Choose the `masstahl/Transload-` repository and the `main` branch.
3. Build command: leave empty. Output directory: `/` (repo root).
4. Save and deploy. Cloudflare will give you a `*.pages.dev` URL and will auto-update on every GitHub push.

Do not use GitHub Pages for the crew's installed home-screen app. GitHub Pages plus the old service worker kept serving a stale copy.

## One-time Supabase setup

1. Enable Anonymous sign-ins in Authentication → Providers.
2. Run `supabase.sql` in the SQL Editor if tables are missing.

## What this version fixes

- Deletes actually remove the load from today's list, plant remaining, and the field chart.
- Pick any previous day to see plant needs and loads dug that day.
- Incoming side is driver + field only (no truck number), with a running field chart.
- Field format hint sits under the field number box.
- Old cached copies are cleared so phones pick up the latest version.
