/**
 * Shared API helpers for the interactive islands.
 *
 * All endpoints are same-origin relative paths; the dev server proxies
 * `/api/*` to production. Ported from the live dist bundles
 * (`reaction-test-client.DizBwTXs.js`, `BenchmarkPlay.CVDrFzZa.js`,
 * `AccountConsole.*.js`, `ContactForm.*.js`).
 */

/** Lifecycle of a leaderboard score submission. */
export type ScoreSubmitState =
  | "idle"
  | "submitting"
  | "submitted"
  | "auth_required"
  | "error";

export type SubmitScoreResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "error" };

/**
 * Submit a benchmark score to the leaderboard API.
 *
 * The API requires authentication — unauthenticated users get 401, which is
 * reported as `unauthorized` so the UI can prompt for login instead of
 * showing a misleading "retry" message.
 */
export async function postBenchmarkScore(
  game: string,
  score: number,
  metadata?: Record<string, unknown>,
): Promise<SubmitScoreResult> {
  try {
    const response = await fetch(`/api/leaderboards/${game}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        playerName: "Anonymous",
        score,
        metadata: metadata ?? { type: game },
      }),
    });

    if (response.status === 401) return { ok: false, reason: "unauthorized" };
    if (response.ok) return { ok: true };
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Shared fetch options for the auth API. */
export const AUTH_FETCH_OPTIONS: RequestInit = {
  credentials: "include",
  headers: { Accept: "application/json" },
};

export type SessionUser = {
  displayName: string;
  username: string;
  role: string;
};

export type AuthSession = {
  authenticated: boolean;
  user: SessionUser | null;
  expiresAt?: string;
};
