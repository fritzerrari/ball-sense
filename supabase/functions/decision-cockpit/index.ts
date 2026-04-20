import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Priority {
  rank: 1 | 2 | 3;
  impact_type: "kostet_tore" | "bringt_tore" | "risiko" | "staerke";
  title: string;
  evidence: string;
  linked_event_minutes: number[];
  linked_video_id: string;
  linked_drill_key: string;
  recommendation: string;
}

interface CockpitResponse {
  dna_match_score: number;
  dna_comment: string;
  priorities: Priority[];
  generated_at?: string;
  team_identity?: string;
  fallback?: boolean;
}

const drillKeyByEventType: Record<string, string> = {
  conceded_goal: "restverteidigung_6v6",
  goal: "abschluss_im_letzten_drittel",
  counter_attack: "umschalten_6v6",
  foul: "gegenpressing_reaktion",
  yellow_card: "zweikampf_timing",
  red_card: "unterzahl_kompakt",
  bad_pass: "passdruck_gegenpressing",
  lost_duel: "zweikampf_timing",
  shot: "abschluss_im_letzten_drittel",
  shot_on_target: "abschluss_im_letzten_drittel",
};

function findLinkedVideoId(videos: any[], minutes: number[]) {
  for (const minute of minutes) {
    const match = videos.find((video: any) =>
      Number(video.event_minute) === Number(minute)
    );
    if (match?.id) return String(match.id);
  }
  return "";
}

function buildFallbackCockpit(
  teamIdentity: string,
  events: any[],
  videos: any[],
  stats: any[],
): CockpitResponse {
  const sortedEvents = [...events]
    .filter((event: any) => typeof event.minute === "number")
    .sort((a: any, b: any) => a.minute - b.minute);

  const homeStats = stats.find((row: any) => row.team === "home") ?? stats[0] ??
    null;
  const conceded = sortedEvents.filter((event: any) =>
    event.event_type === "conceded_goal"
  );
  const attacking = sortedEvents.filter((event: any) =>
    ["goal", "shot", "shot_on_target", "assist"].includes(event.event_type)
  );
  const discipline = sortedEvents.filter((event: any) =>
    ["foul", "yellow_card", "red_card", "yellow_red_card"].includes(
      event.event_type,
    )
  );

  const templates: Array<Omit<Priority, "rank">> = [];

  if (conceded.length > 0) {
    const minutes = conceded.slice(0, 3).map((event: any) =>
      Number(event.minute)
    );
    templates.push({
      impact_type: "kostet_tore",
      title: "Gegentore aus Schlüsselmomenten verhindern",
      evidence: `Gegentore bzw. klare Negativmomente in Min ${
        minutes.join(", ")
      }. Fokus auf Absicherung nach Ballverlust und Restverteidigung.`,
      linked_event_minutes: minutes,
      linked_video_id: findLinkedVideoId(videos, minutes),
      linked_drill_key: "restverteidigung_6v6",
      recommendation:
        "Trainiere Restverteidigung und die ersten 5 Sekunden nach Ballverlust unter Gegnerdruck.",
    });
  }

  if (discipline.length > 0) {
    const minutes = discipline.slice(0, 3).map((event: any) =>
      Number(event.minute)
    );
    templates.push({
      impact_type: "risiko",
      title: "Foul- und Kartenmanagement schärfen",
      evidence: `Mehrere Risikoaktionen in Min ${
        minutes.join(", ")
      }. Das kann gegen stärkere Gegner direkt kippen.`,
      linked_event_minutes: minutes,
      linked_video_id: findLinkedVideoId(videos, minutes),
      linked_drill_key: drillKeyByEventType[discipline[0]?.event_type] ??
        "zweikampf_timing",
      recommendation:
        "Trainiere Anlaufwinkel, Zweikampf-Timing und die Absicherung nach überspieltem Druck.",
    });
  }

  if (attacking.length > 0) {
    const minutes = attacking.slice(0, 3).map((event: any) =>
      Number(event.minute)
    );
    templates.push({
      impact_type: "bringt_tore",
      title: "Offensivmuster konsequent ausbauen",
      evidence: `Positive Offensivaktionen in Min ${
        minutes.join(", ")
      }. Daraus lässt sich ein wiederholbares Muster ableiten.`,
      linked_event_minutes: minutes,
      linked_video_id: findLinkedVideoId(videos, minutes),
      linked_drill_key: drillKeyByEventType[attacking[0]?.event_type] ??
        "abschluss_im_letzten_drittel",
      recommendation:
        "Wiederhole die erfolgreichsten Angriffe im Training mit klaren Triggern für Tiefgang und Abschluss.",
    });
  }

  if (homeStats && typeof homeStats.possession_pct === "number") {
    templates.push({
      impact_type: homeStats.possession_pct >= 55 ? "staerke" : "risiko",
      title: homeStats.possession_pct >= 55
        ? "Ballkontrolle gezielt nutzen"
        : "Ballbesitz unter Druck stabilisieren",
      evidence: `Team-Statistik: ${
        Math.round(homeStats.possession_pct)
      }% Ballbesitz. Das muss klarer in Chance oder Kontrolle übersetzt werden.`,
      linked_event_minutes: sortedEvents.slice(0, 2).map((event: any) =>
        Number(event.minute)
      ).filter(Number.isFinite),
      linked_video_id: "",
      linked_drill_key: homeStats.possession_pct >= 55
        ? "positionsspiel_7v7"
        : "druckresistenz_aufbau",
      recommendation: homeStats.possession_pct >= 55
        ? "Verbinde Ballkontrolle mit vertikalen Anschlussaktionen statt sterilem Besitz."
        : "Trainiere Aufbau unter Gegnerdruck mit klaren Klatsch-/Dreh-Optionen.",
    });
  }

  while (templates.length < 3) {
    templates.push({
      impact_type: templates.length === 0
        ? "kostet_tore"
        : templates.length === 1
        ? "risiko"
        : "staerke",
      title: templates.length === 0
        ? "Kritische Spielsituation präziser absichern"
        : templates.length === 1
        ? "Risikomuster früher stoppen"
        : "Stärke gezielt verstärken",
      evidence:
        "Die vorhandenen Match-Daten reichen für eine belastbare Trainer-Priorisierung, auch ohne vollständige AI-Antwort.",
      linked_event_minutes: sortedEvents.slice(
        templates.length,
        templates.length + 2,
      ).map((event: any) => Number(event.minute)).filter(Number.isFinite),
      linked_video_id: "",
      linked_drill_key: templates.length === 0
        ? "restverteidigung_6v6"
        : templates.length === 1
        ? "gegenpressing_reaktion"
        : "positionsspiel_7v7",
      recommendation: templates.length === 0
        ? "Arbeite an Absicherung und Rollenverhalten in Umschaltmomenten."
        : templates.length === 1
        ? "Definiere klare Auslöser, wann Druck, Foul oder Rückzug die beste Entscheidung ist."
        : "Identifiziere euer bestes Muster und trainiere es mit Wiederholungen unter Gegnerdruck.",
    });
  }

  const priorities = templates.slice(0, 3).map((item, index) => ({
    ...item,
    rank: (index + 1) as 1 | 2 | 3,
  }));
  const dnaMatchScore = teamIdentity === "unbekannt"
    ? 50
    : homeStats && typeof homeStats.possession_pct === "number"
    ? Math.max(35, Math.min(85, Math.round(homeStats.possession_pct)))
    : 58;

  return {
    dna_match_score: dnaMatchScore,
    dna_comment:
      "Fallback-Modus aktiv: Priorisierung wurde aus vorhandenen Match-Daten und Events statt aus der AI-Antwort erzeugt.",
    priorities,
    fallback: true,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { match_id, force_refresh = false } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: matchRow } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", match_id)
      .single();

    if (!matchRow) {
      return new Response(JSON.stringify({ error: "match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force_refresh && matchRow.cockpit_cache?.priorities) {
      return new Response(
        JSON.stringify({ cockpit: matchRow.cockpit_cache, cached: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const [eventsRes, sectionsRes, videosRes, statsRes] = await Promise.all([
      supabase.from("match_events").select("*").eq("match_id", match_id).order(
        "minute",
      ),
      supabase.from("report_sections").select("*").eq("match_id", match_id),
      supabase
        .from("match_videos")
        .select("id, event_type, event_minute, duration_sec")
        .eq("match_id", match_id)
        .eq("video_type", "highlight"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
    ]);

    const events = eventsRes.data ?? [];
    const sections = sectionsRes.data ?? [];
    const videos = videosRes.data ?? [];
    const stats = statsRes.data ?? [];

    const teamIdentity = matchRow.team_identity ?? "unbekannt";
    const homeScore = matchRow.home_score ?? 0;
    const awayScore = matchRow.away_score ?? 0;
    const opponent = matchRow.away_club_name ?? "Gegner";

    const eventsSummary = events
      .map((e: any) =>
        `Min ${e.minute} ${e.team}: ${e.event_type}${
          e.player_name ? ` (${e.player_name})` : ""
        }${e.event_zone ? ` [${e.event_zone}]` : ""}`
      )
      .join("\n");

    const sectionsCompact = sections
      .filter((s: any) =>
        [
          "summary",
          "coaching",
          "tactical_blueprint",
          "risk_matrix",
          "next_match_actions",
        ].includes(s.section_type)
      )
      .map((s: any) => `## ${s.title}\n${s.content.slice(0, 800)}`)
      .join("\n\n");

    const videoMap = videos
      .map((v: any) => `Min ${v.event_minute} → ${v.event_type} (id:${v.id})`)
      .join("\n");

    const systemPrompt =
      `Du bist ein Profi-Trainer-Coach. Aufgabe: Aus den Spieldaten die EXAKT 3 wichtigsten Entscheidungs-Punkte für den Trainer extrahieren — keine schönen Texte, sondern harte Priorisierung nach Impact.

Regeln:
- Rank 1 = das, was Tore gekostet hat oder am meisten Verbesserung bringt
- Rank 2 = nächst-größtes Risiko oder Stärke zum Ausbauen
- Rank 3 = drittwichtigster Punkt
- Jede Aussage MUSS auf konkreten Spielminuten basieren (linked_event_minutes)
- Verknüpfe wo möglich mit Highlight-Videos (linked_video_id)
- Berücksichtige die Spielidentität: ${teamIdentity}
- Sei brutal ehrlich, kein Marketing-Sprech, kein "Champions-League-Niveau"`;

    const userPrompt = `SPIEL: ${homeScore}:${awayScore} gegen ${opponent}
SPIEL-IDENTITÄT (gewählt): ${teamIdentity}

EVENTS:
${eventsSummary || "(keine Events erfasst)"}

VERFÜGBARE HIGHLIGHT-VIDEOS:
${videoMap || "(keine)"}

ANALYSE-SEKTIONEN:
${sectionsCompact || "(noch keine)"}

TEAM-STATS: ${JSON.stringify(stats).slice(0, 500)}

Liefere Top 3 Entscheidungen + DNA-Match-Score (0-100, wie nah am gewählten Stil gespielt).`;

    let cockpit: CockpitResponse;

    try {
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "set_cockpit_decisions",
                  description: "Liefert Top-3-Entscheidungen + DNA-Bewertung",
                  parameters: {
                    type: "object",
                    properties: {
                      dna_match_score: {
                        type: "number",
                        description: "0-100: wie nah am gewählten Spielstil",
                      },
                      dna_comment: { type: "string" },
                      priorities: {
                        type: "array",
                        minItems: 3,
                        maxItems: 3,
                        items: {
                          type: "object",
                          properties: {
                            rank: { type: "integer", enum: [1, 2, 3] },
                            impact_type: {
                              type: "string",
                              enum: [
                                "kostet_tore",
                                "bringt_tore",
                                "risiko",
                                "staerke",
                              ],
                            },
                            title: {
                              type: "string",
                              description: "kurz, max 60 Zeichen",
                            },
                            evidence: {
                              type: "string",
                              description:
                                "Konkreter Beleg mit Minute(n), z.B. 'Min 23, 67: Gegentor nach Ballverlust im Zentrum'",
                            },
                            linked_event_minutes: {
                              type: "array",
                              items: { type: "integer" },
                            },
                            linked_video_id: {
                              type: "string",
                              description:
                                "ID eines passenden Highlight-Videos oder leer",
                            },
                            linked_drill_key: {
                              type: "string",
                              description:
                                "Slug der passenden Übung, z.B. '6v6_umschalt' oder leer",
                            },
                            recommendation: {
                              type: "string",
                              description: "Eine konkrete Handlung",
                            },
                          },
                          required: [
                            "rank",
                            "impact_type",
                            "title",
                            "evidence",
                            "linked_event_minutes",
                            "linked_video_id",
                            "linked_drill_key",
                            "recommendation",
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["dna_match_score", "dna_comment", "priorities"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "set_cockpit_decisions" },
            },
          }),
        },
      );

      if (!aiResp.ok) {
        const bodyText = await aiResp.text();
        console.error("AI error", aiResp.status, bodyText);
        if (aiResp.status === 429) {
          return new Response(
            JSON.stringify({
              error: "Rate limit erreicht, bitte gleich nochmal versuchen.",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (aiResp.status === 402) {
          return new Response(
            JSON.stringify({
              error:
                "AI-Guthaben aufgebraucht. Bitte in Lovable Cloud aufladen.",
            }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        throw new Error(`AI gateway failed: ${aiResp.status}`);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("Kein Tool-Call von der KI");
      }

      cockpit = JSON.parse(toolCall.function.arguments) as CockpitResponse;
    } catch (aiError) {
      console.error("decision-cockpit AI fallback", aiError);
      cockpit = buildFallbackCockpit(teamIdentity, events, videos, stats);
    }

    if (cockpit.priorities) {
      cockpit.priorities = cockpit.priorities
        .slice(0, 3)
        .sort((a: Priority, b: Priority) => a.rank - b.rank)
        .map((priority, index) => ({
          ...priority,
          rank: (index + 1) as 1 | 2 | 3,
          linked_video_id: priority.linked_video_id ?? "",
          linked_drill_key: priority.linked_drill_key ?? "",
          linked_event_minutes: Array.isArray(priority.linked_event_minutes)
            ? priority.linked_event_minutes
            : [],
        }));
    }

    cockpit.generated_at = new Date().toISOString();
    cockpit.team_identity = teamIdentity;

    await supabase
      .from("matches")
      .update({ cockpit_cache: cockpit })
      .eq("id", match_id);

    return new Response(
      JSON.stringify({
        cockpit,
        cached: false,
        fallback: cockpit.fallback ?? false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("decision-cockpit error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
