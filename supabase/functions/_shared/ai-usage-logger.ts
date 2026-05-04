// _shared/ai-usage-logger.ts — schreibt AI-Call-Telemetrie nach ai_usage_log.
// Best-effort: Fehler beim Logging dürfen die eigentliche Function nicht killen.

interface LogParams {
  supabase: { from: (t: string) => { insert: (rows: unknown) => Promise<{ error: unknown }> } };
  function_name: string;
  model: string;
  club_id?: string | null;
  match_id?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  duration_ms?: number;
  status?: "ok" | "error" | "rate_limit" | "out_of_credits";
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAiUsage(p: LogParams) {
  try {
    await p.supabase.from("ai_usage_log").insert({
      function_name: p.function_name,
      model: p.model,
      club_id: p.club_id ?? null,
      match_id: p.match_id ?? null,
      prompt_tokens: p.prompt_tokens ?? null,
      completion_tokens: p.completion_tokens ?? null,
      total_tokens: p.total_tokens ?? null,
      duration_ms: p.duration_ms ?? null,
      status: p.status ?? "ok",
      error_message: p.error_message ?? null,
      metadata: p.metadata ?? {},
    });
  } catch (e) {
    console.warn("[ai-usage-logger] insert failed (ignored)", e);
  }
}

// Extrahiert Token-Counts aus OpenAI-kompatiblem Response (Lovable AI Gateway).
export function extractUsage(aiResponseJson: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }) {
  const u = aiResponseJson?.usage;
  return {
    prompt_tokens: u?.prompt_tokens ?? null,
    completion_tokens: u?.completion_tokens ?? null,
    total_tokens: u?.total_tokens ?? null,
  };
}
