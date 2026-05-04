// Pipeline Watchdog — runs every 5 minutes via pg_cron.
// Detects analysis_jobs stuck in queued/analyzing/interpreting for >30 min,
// marks them as failed, and creates a notification so the user can retry.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STUCK_AFTER_MIN = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - STUCK_AFTER_MIN * 60 * 1000).toISOString();

  // Find stuck jobs
  const { data: stuck, error } = await supabase
    .from("analysis_jobs")
    .select("id, match_id, status, progress, created_at, updated_at, job_kind")
    .in("status", ["queued", "analyzing", "interpreting"])
    .lt("updated_at", cutoff);

  if (error) {
    console.error("[watchdog] query failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stuckJobs = stuck ?? [];
  console.log(`[watchdog] found ${stuckJobs.length} stuck jobs (cutoff=${cutoff})`);

  let recovered = 0;
  for (const job of stuckJobs) {
    // Mark job as failed
    const { error: updErr } = await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        error_message: `Watchdog: Job blockiert seit >${STUCK_AFTER_MIN} min in Status '${job.status}' (Progress ${job.progress ?? 0}%). Bitte erneut starten.`,
      })
      .eq("id", job.id);

    if (updErr) {
      console.warn(`[watchdog] could not fail job ${job.id}:`, updErr);
      continue;
    }

    // Reset match status so user can retry
    if (job.job_kind === "final") {
      await supabase
        .from("matches")
        .update({ status: "recorded" })
        .eq("id", job.match_id);
    }

    // Find club_id of match owners to send notification
    const { data: match } = await supabase
      .from("matches")
      .select("home_club_id, away_club_name, date")
      .eq("id", job.match_id)
      .maybeSingle();

    if (match?.home_club_id) {
      // Notify all users in that club
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("club_id", match.home_club_id);

      const notifications = (profiles ?? []).map((p: { user_id: string }) => ({
        user_id: p.user_id,
        type: "analysis_stuck",
        title: "Analyse blockiert",
        message: `Spiel vom ${match.date}${match.away_club_name ? ` gegen ${match.away_club_name}` : ""}: Analyse seit >${STUCK_AFTER_MIN} min in Wartestellung — bitte erneut starten.`,
        link: `/matches/${job.match_id}`,
      }));

      if (notifications.length > 0) {
        const { error: notifErr } = await supabase.from("notifications").insert(notifications);
        if (notifErr) console.warn(`[watchdog] notif insert failed for job ${job.id}:`, notifErr);
      }
    }

    recovered++;
  }

  return new Response(
    JSON.stringify({ checked: stuckJobs.length, recovered, cutoff }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
