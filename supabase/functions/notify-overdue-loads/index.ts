import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const headers = { "Content-Type": "application/json; charset=utf-8" };
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}
function localDayStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  // At UTC noon the LA local hour is 04:00 PST or 05:00 PDT; this selects
  // the correct offset for the current operating date, including DST changes.
  const noon = new Date(`${date}T12:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(noon).find((p) => p.type === "hour")?.value ?? "4");
  const offsetMinutes = hour <= 4 ? -480 : -420;
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetMinutes * 60_000).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "POST required" });
  const secret = Deno.env.get("PUSH_CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json(401, { error: "Unauthorized" });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!url || !serviceKey || !publicKey || !privateKey || !subject) {
    return json(503, { error: "Push sender is not fully configured" });
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const cutoff = new Date(Date.now() - 12 * 60_000).toISOString();
    const dayStart = localDayStartIso();

    const { data: loads, error: loadError } = await db.from("outgoing_entries")
      .select("id, location, truck, site_id, load_started_at")
      .not("load_started_at", "is", null)
      .is("load_finished_at", null)
      .lte("load_started_at", cutoff)
      .gte("load_started_at", dayStart)
      .order("load_started_at", { ascending: true })
      .limit(250);
    if (loadError) throw loadError;
    if (!loads?.length) return json(200, { checked: 0, sent: 0, skipped: 0 });

    const { data: subscriptions, error: subError } = await db.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("enabled", true)
      .limit(1000);
    if (subError) throw subError;
    if (!subscriptions?.length) return json(200, { checked: loads.length, sent: 0, skipped: 0 });

    let sent = 0, skipped = 0, failed = 0, stale = 0;
    for (const load of loads) {
      for (const sub of subscriptions) {
        // Unique insert is the atomic claim, preventing duplicate sends from overlapping runs.
        const { data: claim, error: claimError } = await db.from("push_notification_deliveries")
          .insert({ entry_id: load.id, subscription_id: sub.id, notification_type: "load_overdue", status: "sending" })
          .select("id").maybeSingle();
        if (claimError?.code === "23505") { skipped++; continue; }
        if (claimError || !claim) throw claimError ?? new Error("Could not claim notification");

        const minutes = Math.floor((Date.now() - new Date(load.load_started_at).getTime()) / 60_000);
        const payload = {
          title: "Loading timer overdue",
          body: `Truck ${load.truck || "—"} at ${load.location || "your location"} has been loading for ${minutes} minutes.`,
          tag: `overdue-${load.id}`, url: "./", location: load.location, entryId: load.id,
        };
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret },
          }, JSON.stringify(payload), { TTL: 300, urgency: "high" });
          const { error } = await db.from("push_notification_deliveries")
            .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
            .eq("id", claim.id);
          if (error) throw error;
          await db.from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), last_error_at: null }).eq("id", sub.id);
          sent++;
        } catch (error) {
          const status = Number((error as { statusCode?: number })?.statusCode ?? 0);
          if (status === 404 || status === 410) {
            await db.from("push_subscriptions")
              .update({ enabled: false, last_error_at: new Date().toISOString() }).eq("id", sub.id);
            stale++;
          } else failed++;
          // Release failed claim to allow a later scheduler retry.
          await db.from("push_notification_deliveries").delete().eq("id", claim.id);
        }
      }
    }
    return json(200, { checked: loads.length, sent, skipped, failed, stale });
  } catch (error) {
    console.error("notify-overdue-loads failed", error);
    return json(500, { error: "Notification check failed" });
  }
});
