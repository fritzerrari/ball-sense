// Auto-Highlight-Reel: generates a 60s shareable storyboard for social media.
// Picks top events (goals, big chances, saves), adds club branding & narration captions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  match_id: string;
  format?: "square" | "portrait" | "landscape";
  duration_sec?: number;
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.match_id) return json({ error: "match_id required" }, 400);

    const format = body.format ?? "square";
    const duration = Math.max(20, Math.min(90, body.duration_sec ?? 60));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [matchRes, eventsRes, clipsRes, clubLogoRes] = await Promise.all([
      supabase.from("matches").select("id, date, away_club_name, home_score, away_score, home_club_id").eq("id", body.match_id).maybeSingle(),
      supabase.from("match_events").select("minute, team, event_type, player_name, severity, notes").eq("match_id", body.match_id).order("minute"),
      supabase.from("video_highlight_clips").select("event_id, clip_url, duration_sec, minute").eq("match_id", body.match_id),
      supabase.from("matches").select("home_club_id, clubs:home_club_id(logo_url, name)").eq("id", body.match_id).maybeSingle(),
    ]);

    const match = matchRes.data;
    if (!match) return json({ error: "match not found" }, 404);

    const events = eventsRes.data ?? [];
    const clipsByEvent = new Map((clipsRes.data ?? []).map((c: any) => [c.event_id, c]));
    const clubLogo = (clubLogoRes.data as any)?.clubs?.logo_url ?? null;
    const clubName = (clubLogoRes.data as any)?.clubs?.name ?? "Heim";

    // Score events for highlight worthiness
    const scoreEvent = (e: any) => {
      let s = 0;
      if (e.event_type === "goal") s += 100;
      if (e.event_type === "big_chance") s += 60;
      if (e.event_type === "save") s += 40;
      if (e.event_type === "shot") s += 20;
      if (e.event_type === "card" && e.severity === "red") s += 30;
      if (e.team === "home") s += 5;
      return s;
    };

    const scored = events
      .map((e: any) => ({ e, score: scoreEvent(e), clip: clipsByEvent.get(e.id) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Pick events that fit duration. Each scene ~ 5-7s; intro 3s, outro 4s.
    const sceneDur = format === "portrait" ? 5 : 6;
    const maxScenes = Math.max(3, Math.floor((duration - 7) / sceneDur));
    const picked = scored.slice(0, maxScenes).sort((a, b) => a.e.minute - b.e.minute);

    const storyboard = {
      meta: {
        match_id: body.match_id,
        format,
        duration_sec: duration,
        score: `${match.home_score ?? 0}:${match.away_score ?? 0}`,
        opponent: match.away_club_name ?? "",
        date: match.date,
        club_logo: clubLogo,
        club_name: clubName,
      },
      intro: {
        type: "intro",
        duration_sec: 3,
        headline: `${clubName} ${match.home_score ?? 0}:${match.away_score ?? 0} ${match.away_club_name ?? ""}`,
        subline: new Date(match.date).toLocaleDateString("de-DE"),
      },
      scenes: picked.map(({ e, clip }) => ({
        type: "scene",
        duration_sec: sceneDur,
        minute: e.minute,
        team: e.team,
        event_type: e.event_type,
        caption: buildCaption(e),
        player_name: e.player_name,
        clip_url: clip?.clip_url ?? null,
      })),
      outro: {
        type: "outro",
        duration_sec: 4,
        cta: `Folge ${clubName} für mehr Highlights ⚽`,
      },
    };

    const { data: stored } = await supabase
      .from("highlight_reels")
      .insert({
        match_id: body.match_id,
        format,
        duration_sec: duration,
        storyboard,
        status: "ready",
      })
      .select()
      .single();

    return json({ reel: stored, storyboard });
  } catch (e: any) {
    console.error("highlight-reel error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function buildCaption(e: any): string {
  const min = `${e.minute}'`;
  switch (e.event_type) {
    case "goal": return `${min} ⚽ TOR! ${e.player_name ?? ""}`.trim();
    case "big_chance": return `${min} 🔥 Riesenchance${e.player_name ? ` – ${e.player_name}` : ""}`;
    case "save": return `${min} 🧤 Klasse Parade`;
    case "shot": return `${min} 🎯 Abschluss${e.player_name ? ` – ${e.player_name}` : ""}`;
    case "card": return `${min} 🟥 Platzverweis`;
    default: return `${min} ${e.event_type}`;
  }
}
