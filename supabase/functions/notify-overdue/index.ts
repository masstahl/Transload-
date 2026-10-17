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
  catch { return reply({ error: "Invalid VAPID configuration" }, 500); }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const { start, end } = pacificDayBounds(now);
  const cutoff = new Date(now.getTime() - 12 * 60 * 1000).toISOString();
  const { data: loads, error: loadError } = await db.from("outgoing_entries")
    .select("id, location, truck, site_id, load_started_at")
    .gte("load_started_at", start).lt("load_started_at", end)
    .not("load_started_at", "is", null).is("load_finished_at", null)
    .lte("load_started_at", cutoff).order("load_started_at", { ascending: true }).limit(200);
  if (loadError) { console.error("notify-overdue diagnostic", JSON.stringify({ category: "load_query_failed", code: loadError.code ?? null })); return reply({ error: "Could not read active timers", diagnostic: { category: "load_query_failed", code: loadError.code ?? null } }, 500); }

  const { data: subs, error: subError } = await db.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_secret").eq("enabled", true).limit(1000);
  if (subError) { console.error("notify-overdue diagnostic", JSON.stringify({ category: "subscription_query_failed", code: subError.code ?? null })); return reply({ error: "Could not read subscriptions", diagnostic: { category: "subscription_query_failed", code: subError.code ?? null } }, 500); }
  if (!loads?.length || !subs?.length) return reply({ checked: loads?.length ?? 0, subscriptions: subs?.length ?? 0, sent: 0, skipped: 0, failed: 0 });

  let sent = 0, skipped = 0, failed = 0;
  const diagnosticCounts: Record<string, number> = {};
  const noteFailure = (category: string, statusCode?: number, code?: string | null) => {
    diagnosticCounts[category] = (diagnosticCounts[category] ?? 0) + 1;
    console.error("notify-overdue diagnostic", JSON.stringify({ category, status_code: statusCode ?? null, code: code ?? null }));
  };
  for (const load of loads) {
    for (const sub of subs) {
      const key = { entry_id: load.id, load_started_at: load.load_started_at, subscription_id: sub.id };
      let { data: claim, error: claimError } = await db.from("push_overdue_deliveries")
        .insert(key).select("id, sent_at, claimed_at").maybeSingle();

      if (claimError?.code === "23505") {
        const existing = await db.from("push_overdue_deliveries").select("id, sent_at, claimed_at").match(key).maybeSingle();
        if (existing.error || !existing.data) { failed++; noteFailure("delivery_claim_lookup_failed", undefined, existing.error?.code); continue; }
        if (existing.data.sent_at) { skipped++; continue; }
        const staleAt = Date.now() - 10 * 60 * 1000;
        if (new Date(existing.data.claimed_at).getTime() >= staleAt) { skipped++; continue; }
        const removed = await db.from("push_overdue_deliveries").delete().eq("id", existing.data.id);
        if (removed.error) { failed++; noteFailure("stale_claim_cleanup_failed", undefined, removed.error.code); continue; }
        const retry = await db.from("push_overdue_deliveries").insert(key).select("id").maybeSingle();
        claim = retry.data;
        claimError = retry.error;
      }
      if (claimError || !claim) { failed++; noteFailure("delivery_claim_insert_failed", undefined, claimError?.code); continue; }

      const payload = JSON.stringify({
        title: "Loading timer over 12 minutes",
        body: `Truck ${load.truck || "—"} at ${load.location || "the transload"} is still loading.`,
        location: load.location || "", entryId: load.id, tag: `transload-overdue-${load.id}`
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } },
          payload,
          { TTL: 300 }
        );
        const marked = await db.from("push_overdue_deliveries").update({ sent_at: new Date().toISOString() }).eq("id", claim.id);
        if (marked.error) { failed++; noteFailure("delivery_mark_sent_failed", undefined, marked.error.code); } else sent++;
      } catch (e) {
        const status = Number((e as { statusCode?: number })?.statusCode ?? 0);
        noteFailure("push_send_failed", status || undefined, (e as { name?: string })?.name ?? null);
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", sub.id);
        }
        const cleanup = await db.from("push_overdue_deliveries").delete().eq("id", claim.id);
        if (cleanup.error) noteFailure("failed_claim_cleanup_failed", undefined, cleanup.error.code);
        failed++;
      }
    }
  }
  return reply({ checked: loads.length, subscriptions: subs.length, sent, skipped, failed, diagnostics: diagnosticCounts, pacific_day_start: start, pacific_day_end: end });
});

function pacificDayBounds(now: Date): { start: string; end: string } {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((p) => p.type === type)?.value ?? "";
  const y = Number(part("year")), m = Number(part("month")), d = Number(part("day"));
  return {
    start: localMidnightUtc(y, m, d),
    end: localMidnightUtc(y, m, d + 1)
  };
}
function localMidnightUtc(y: number, m: number, d: number): string {
  const target = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = target;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const representedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    guess += target - representedAsUtc;
  }
  return new Date(guess).toISOString();
}
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
