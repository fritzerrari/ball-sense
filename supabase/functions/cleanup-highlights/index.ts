import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get all matches with highlights in storage
    const { data: files, error: listError } = await supabase.storage
      .from("tracking")
      .list("", { limit: 1000 });

    if (listError) throw listError;

    // Get all match folders
    const matchFolders = files?.filter(f => f.id) ?? [];
    let deletedCount = 0;

    for (const folder of matchFolders) {
      const matchId = folder.name;

      // Check if highlights folder exists
      const { data: matchFiles } = await supabase.storage
        .from("tracking")
        .list(matchId, { limit: 100 });

      const hasHighlights = matchFiles?.some(f => f.name === "highlights");
      if (!hasHighlights) continue;

      // List highlight clips
      const { data: clips } = await supabase.storage
        .from("tracking")
        .list(`${matchId}/highlights`, { limit: 100 });

      if (!clips || clips.length === 0) continue;

      // Check match date and next match date
      const { data: match } = await supabase
        .from("matches")
        .select("id, date, home_club_id")
        .eq("id", matchId)
        .single();

      if (!match) continue;

      const matchDate = new Date(match.date);
      const now = new Date();
      const daysSinceMatch = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);

      // Rule 1: Delete after 7 days
      let shouldDelete = daysSinceMatch >= 7;

      // Rule 2: Delete if next match is sooner (within 7 days)
      if (!shouldDelete) {
        const { data: nextMatch } = await supabase
          .from("matches")
          .select("id, date")
          .eq("home_club_id", match.home_club_id)
          .gt("date", match.date)
          .order("date", { ascending: true })
          .limit(1)
          .single();

        if (nextMatch) {
          const nextMatchDate = new Date(nextMatch.date);
          // Delete if we're past the next match date
          if (now >= nextMatchDate) {
            shouldDelete = true;
          }
        }
      }

      if (shouldDelete) {
        const clipPaths = clips.map(c => `${matchId}/highlights/${c.name}`);
        const { error: deleteError } = await supabase.storage
          .from("tracking")
          .remove(clipPaths);

        if (!deleteError) {
          deletedCount += clipPaths.length;
          console.log(`[cleanup] Deleted ${clipPaths.length} clips for match ${matchId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, deletedClips: deletedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cleanup-highlights] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
