import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const expected = Deno.env.get("NOTIFICATION_KEY") ?? "";
  const supplied = req.headers.get("x-notification-key") ?? "";
  if (!expected || !supplied || !safeEqual(expected, supplied)) return reply({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "";
  if (!url || !serviceKey || !publicKey || !privateKey || !subject) return reply({ error: "Server configuration is incomplete" }, 500);

  try { webpush.setVapidDetails(subject, publicKey, privateKey); }
  catch (e) { return reply({ error: "Invalid VAPID configuration", detail: String(e) }, 500); }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const cutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString();
  const { data: loads, error: loadError } = await db.from("outgoing_entries")
    .select("id, location, truck, site_id, load_started_at")
    .not("load_started_at", "is", null).is("load_finished_at", null)
    .lte("load_started_at", cutoff).order("load_started_at", { ascending: true }).limit(100);
  if (loadError) return reply({ error: "Could not read active timers", detail: loadError.message }, 500);

  const { data: subs, error: subError } = await db.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_secret").eq("enabled", true).limit(1000);
  if (subError) return reply({ error: "Could not read subscriptions", detail: subError.message }, 500);
  if (!loads?.length || !subs?.length) return reply({ checked: loads?.length ?? 0, subscriptions: subs?.length ?? 0, sent: 0 });

  let sent = 0, skipped = 0, failed = 0;
  for (const load of loads) {
    const { data: claim, error: claimError } = await db.from("push_overdue_events")
      .insert({ entry_id: load.id, load_started_at: load.load_started_at }).select("id").maybeSingle();
    if (claimError?.code === "23505") { skipped++; continue; }
    if (claimError || !claim) { failed++; continue; }

    let deliveries = 0;
    const payload = JSON.stringify({
      title: "Loading timer over 12 minutes",
      body: `Truck ${load.truck || "—"} at ${load.location || "the transload"} is still loading.`,
      location: load.location || "", entryId: load.id, tag: `transload-overdue-${load.id}`
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, payload, { TTL: 300 });
        deliveries++;
      } catch (e) {
        const status = Number((e as { statusCode?: number })?.statusCode ?? 0);
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", sub.id);
        }
      }
    }
    if (deliveries) {
      await db.from("push_overdue_events").update({ sent_at: new Date().toISOString(), deliveries }).eq("id", claim.id);
      sent += deliveries;
    } else {
      await db.from("push_overdue_events").delete().eq("id", claim.id);
      failed++;
    }
  }
  return reply({ checked: loads.length, subscriptions: subs.length, sent, skipped, failed });
});

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
