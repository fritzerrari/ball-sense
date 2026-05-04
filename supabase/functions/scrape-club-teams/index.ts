// Scrapes a club's team library from fussball.de via Firecrawl
// and persists teams, fixtures, players, and standings into the DB.
// Modes:
//  - default (with club_url + club_id + auth): per-user import
//  - resync_all (internal): nightly cron — re-scrapes every club_team with external_url
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v2";

async function fcScrape(url: string, key: string, prompt: string, schema: any) {
  const res = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt, schema }],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Firecrawl ${res.status}`);
  return data?.data?.json ?? data?.json ?? {};
}

async function importClub(
  supabase: any,
  FC_KEY: string,
  club_url: string,
  club_id: string,
  scope: string = "all",
) {
  const clubData = await fcScrape(
    club_url,
    FC_KEY,
    "Extract all teams (Mannschaften) listed on this club page. Each team has a name, age group (Herren, A-Junioren / U19, B-Junioren / U17, etc.), league/Spielklasse, and a link to the team page. Return team_url as full absolute URL.",
    {
      type: "object",
      properties: {
        club_name: { type: "string" },
        teams: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              age_group: { type: "string" },
              spielklasse: { type: "string" },
              team_url: { type: "string" },
            },
            required: ["name", "team_url"],
          },
        },
      },
    },
  );

  const teamsList: any[] = clubData.teams || [];
  const filtered = teamsList.filter((t) => {
    if (scope === "all") return true;
    const ag = (t.age_group || t.name || "").toLowerCase();
    if (scope === "active") return /herren|damen|senior/i.test(ag);
    if (scope === "youth") return /junior|jugend|u\d+/i.test(ag);
    return true;
  });

  let teamsImported = 0, fixturesImported = 0, playersImported = 0;

  for (const t of filtered) {
    try {
      const externalId = (t.team_url.match(/team-id\/([A-Z0-9]+)/i) || [])[1] || t.team_url;
      const { data: teamRow, error: teamErr } = await supabase
        .from("club_teams")
        .upsert({
          club_id,
          name: t.name,
          age_group: t.age_group ?? null,
          spielklasse: t.spielklasse ?? null,
          external_team_id: externalId,
          external_url: t.team_url,
          external_source: "fussball.de",
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "club_id,external_team_id" })
        .select()
        .single();
      if (teamErr) { console.error("team upsert", teamErr); continue; }
      teamsImported++;

      const teamData = await fcScrape(
        t.team_url,
        FC_KEY,
        "Extract upcoming and past fixtures (Spielplan & Ergebnisse), the team's current league position with points and goal difference, and any visible roster (Kader: name, shirt number, position, goals, assists, yellow_cards, red_cards, matches_played). Dates as ISO YYYY-MM-DD. Times as HH:MM.",
        {
          type: "object",
          properties: {
            table_position: { type: "number" },
            points: { type: "number" },
            goal_difference: { type: "string" },
            league: { type: "string" },
            fixtures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  match_date: { type: "string" },
                  kickoff_time: { type: "string" },
                  competition: { type: "string" },
                  home_team_name: { type: "string" },
                  away_team_name: { type: "string" },
                  home_score: { type: "number" },
                  away_score: { type: "number" },
                  status: { type: "string" },
                },
                required: ["match_date", "home_team_name", "away_team_name"],
              },
            },
            players: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  player_name: { type: "string" },
                  shirt_number: { type: "number" },
                  position: { type: "string" },
                  goals: { type: "number" },
                  assists: { type: "number" },
                  yellow_cards: { type: "number" },
                  red_cards: { type: "number" },
                  matches_played: { type: "number" },
                },
                required: ["player_name"],
              },
            },
          },
        },
      );

      await supabase.from("club_teams").update({
        table_position: teamData.table_position ?? null,
        points: teamData.points ?? null,
        goal_difference: teamData.goal_difference ?? null,
        league: teamData.league ?? t.spielklasse ?? null,
      }).eq("id", teamRow.id);

      const ourName = clubData.club_name?.toLowerCase() || "";
      const fxs = (teamData.fixtures || []).map((f: any) => ({
        team_id: teamRow.id,
        club_id,
        match_date: f.match_date,
        kickoff_time: f.kickoff_time || null,
        competition: f.competition || null,
        home_team_name: f.home_team_name,
        away_team_name: f.away_team_name,
        is_home: ourName ? f.home_team_name?.toLowerCase().includes(ourName.split(" ")[0]) : true,
        home_score: f.home_score ?? null,
        away_score: f.away_score ?? null,
        status: f.status || (f.home_score != null ? "finished" : "scheduled"),
        external_match_id: `${f.match_date}_${f.home_team_name}_${f.away_team_name}`.replace(/\s+/g, "_"),
      }));
      if (fxs.length) {
        const { error } = await supabase.from("team_fixtures")
          .upsert(fxs, { onConflict: "team_id,external_match_id" });
        if (!error) fixturesImported += fxs.length;
      }

      const players = (teamData.players || []).map((p: any) => ({
        team_id: teamRow.id,
        club_id,
        player_name: p.player_name,
        shirt_number: p.shirt_number ?? null,
        position: p.position ?? null,
        goals: p.goals ?? 0,
        assists: p.assists ?? 0,
        yellow_cards: p.yellow_cards ?? 0,
        red_cards: p.red_cards ?? 0,
        matches_played: p.matches_played ?? 0,
      }));
      if (players.length) {
        const { error } = await supabase.from("team_players")
          .upsert(players, { onConflict: "team_id,player_name,shirt_number" });
        if (!error) playersImported += players.length;
      }
    } catch (e) {
      console.error(`[scrape] team failed: ${t.name}`, e);
    }
  }

  return {
    club_name: clubData.club_name,
    teams_found: teamsList.length,
    teams_imported: teamsImported,
    fixtures_imported: fixturesImported,
    players_imported: playersImported,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode, club_url, club_id, scope = "all" } = body;

    const FC_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FC_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ====== MODE: resync_all (cron) ======
    if (mode === "resync_all") {
      const { data: roots } = await supabase
        .from("club_teams")
        .select("club_id, external_url, metadata")
        .not("external_url", "is", null);

      // group by club_id; pick a representative club URL from metadata.club_root_url
      const clubMap = new Map<string, string>();
      for (const row of roots ?? []) {
        const root = (row.metadata as any)?.club_root_url;
        if (root && !clubMap.has(row.club_id)) clubMap.set(row.club_id, root);
      }

      const results: any[] = [];
      for (const [cid, url] of clubMap) {
        try {
          const r = await importClub(supabase, FC_KEY, url, cid, "all");
          results.push({ club_id: cid, ...r });
        } catch (e) {
          results.push({ club_id: cid, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ success: true, mode: "resync_all", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== MODE: per-user (auth required) ======
    if (!club_url || !club_id) throw new Error("club_url and club_id required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profile?.club_id !== club_id) {
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userData.user.id });
      if (!isSuper) throw new Error("Forbidden");
    }

    const result = await importClub(supabase, FC_KEY, club_url, club_id, scope);

    // remember club root URL on each team for the nightly resync
    await supabase
      .from("club_teams")
      .update({ metadata: { club_root_url: club_url } })
      .eq("club_id", club_id);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[scrape-club-teams]", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
