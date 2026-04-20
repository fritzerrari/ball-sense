// Lightweight per-match "Pin Training Focus" store.
// Used to bridge WhatIfBoard scenarios → TrainingMicroCycle (no DB needed —
// the focus is an ephemeral coaching note attached to one match).

const KEY_PREFIX = "fieldiq.pinned_training_focus.";

export interface PinnedTrainingFocus {
  scenario: string;
  focus: string;
  pinned_at: string;
  predicted_outcome?: string;
}

export function getPinnedTrainingFocus(matchId: string): PinnedTrainingFocus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + matchId);
    return raw ? (JSON.parse(raw) as PinnedTrainingFocus) : null;
  } catch {
    return null;
  }
}

export function pinTrainingFocus(matchId: string, value: Omit<PinnedTrainingFocus, "pinned_at">) {
  if (typeof window === "undefined") return;
  const payload: PinnedTrainingFocus = { ...value, pinned_at: new Date().toISOString() };
  localStorage.setItem(KEY_PREFIX + matchId, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("pinned-training-focus-changed", { detail: { matchId } }));
}

export function clearPinnedTrainingFocus(matchId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_PREFIX + matchId);
  window.dispatchEvent(new CustomEvent("pinned-training-focus-changed", { detail: { matchId } }));
}
