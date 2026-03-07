import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist der KI Co-Trainer von FieldIQ – ein taktischer Fußball-Assistent auf höchstem Niveau.

Deine Rolle:
- Du analysierst Spieler-, Match- und Tracking-Daten deines Vereins
- Du gibst taktische Empfehlungen auf Deutsch
- Du bewertest Formationen, Laufleistungen, Sprints und Heatmaps
- Du identifizierst Stärken und Schwächen im Kader
- Du schlägst Aufstellungen und taktische Anpassungen vor
- Du sprichst wie ein erfahrener, moderner Co-Trainer

Regeln:
- Antworte immer auf Deutsch
- Nutze die bereitgestellten Daten als Grundlage
- Wenn keine Daten vorhanden sind, sage das ehrlich
- Formatiere deine Antworten mit Markdown (Überschriften, Listen, fett)
- Sei präzise, datengetrieben und praxisnah
- Verwende Fußball-Fachbegriffe korrekt`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { messages, includeContext, selectedPlayersContext } = await req.json();

    // Build context from DB if requested
    let contextBlock = "";
    if (includeContext) {
      // Get club_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("user_id", userId)
        .single();

      if (profile?.club_id) {
        const clubId = profile.club_id;

        // Parallel queries
        const [playersRes, matchesRes, clubRes] = await Promise.all([
          supabase.from("players").select("name, number, position, active").eq("club_id", clubId).order("number"),
          supabase.from("matches").select("id, date, status, away_club_name, home_formation, away_formation").eq("home_club_id", clubId).order("date", { ascending: false }).limit(10),
          supabase.from("clubs").select("name, league, plan").eq("id", clubId).single(),
        ]);

        // Get stats for recent matches
        const matchIds = (matchesRes.data || []).map((m: any) => m.id);
        let playerStatsData: any[] = [];
        let teamStatsData: any[] = [];

        if (matchIds.length > 0) {
          const [psRes, tsRes] = await Promise.all([
            supabase.from("player_match_stats").select("match_id, player_id, distance_km, top_speed_kmh, sprint_count, minutes_played").in("match_id", matchIds),
            supabase.from("team_match_stats").select("match_id, team, total_distance_km, top_speed_kmh, possession_pct").in("match_id", matchIds),
          ]);
          playerStatsData = psRes.data || [];
          teamStatsData = tsRes.data || [];
        }

        contextBlock = `\n\n--- VEREINSDATEN ---
Verein: ${clubRes.data?.name || "Unbekannt"}
Liga: ${clubRes.data?.league || "Nicht angegeben"}
Plan: ${clubRes.data?.plan || "trial"}

KADER (${(playersRes.data || []).length} Spieler):
${(playersRes.data || []).map((p: any) => `- #${p.number || "?"} ${p.name} (${p.position || "keine Pos."}) ${p.active ? "✓" : "inaktiv"}`).join("\n")}

LETZTE SPIELE (${(matchesRes.data || []).length}):
${(matchesRes.data || []).map((m: any) => `- ${m.date}: vs ${m.away_club_name || "Unbekannt"} [${m.status}] Formation: ${m.home_formation || "-"}`).join("\n")}

${playerStatsData.length > 0 ? `SPIELER-STATISTIKEN (letzte Spiele):
${playerStatsData.slice(0, 20).map((s: any) => `- Spieler ${s.player_id?.slice(0, 8)}: ${s.distance_km?.toFixed(1) || "?"}km, Top ${s.top_speed_kmh?.toFixed(1) || "?"}km/h, ${s.sprint_count || 0} Sprints, ${s.minutes_played || "?"}min`).join("\n")}` : "Noch keine Spieler-Statistiken vorhanden."}

${teamStatsData.length > 0 ? `TEAM-STATISTIKEN:
${teamStatsData.map((s: any) => `- Match ${s.match_id?.slice(0, 8)} (${s.team}): ${s.total_distance_km?.toFixed(1) || "?"}km gesamt, Top ${s.top_speed_kmh?.toFixed(1) || "?"}km/h, Ballbesitz ${s.possession_pct?.toFixed(0) || "?"}%`).join("\n")}` : "Noch keine Team-Statistiken vorhanden."}
--- ENDE VEREINSDATEN ---`;
      }
    }

    // Append selected players context if provided
    if (selectedPlayersContext) {
      contextBlock += `\n\n--- AKTUELL AUSGEWÄHLTE SPIELER ---
Der Trainer hat folgende Spieler in der Analyse-Ansicht ausgewählt. Beziehe dich bei Antworten besonders auf diese Spieler:
${selectedPlayersContext}
--- ENDE AUSWAHL ---`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextBlock },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte versuche es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Credits aufgebraucht. Bitte Credits aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Dienst nicht verfügbar" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
