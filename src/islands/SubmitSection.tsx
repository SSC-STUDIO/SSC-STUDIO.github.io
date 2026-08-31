import type { ScoreSubmitState } from "./api";

/**
 * Shared score submission section for all benchmark games.
 *
 * Renders the submit-to-leaderboard button plus the permanent leaderboard
 * link, and the follow-up notes for the auth-required / error states.
 * Markup and copy follow the live dist bundle (`BenchmarkPlay.CVDrFzZa.js`).
 */
export default function SubmitSection({
  state,
  onSubmit,
}: {
  /** Current submission lifecycle state. */
  state: ScoreSubmitState;
  /** Called when the user clicks "提交到排行榜". */
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="p-card__actions">
        <button
          type="button"
          className="p-card__link"
          onClick={onSubmit}
          disabled={state === "submitting" || state === "submitted"}
        >
          {state === "submitted"
            ? "已提交 ✓"
            : state === "submitting"
              ? "提交中..."
              : state === "error"
                ? "重试提交"
                : "提交到排行榜"}
        </button>
        <a href="/leaderboard" className="p-card__link p-card__link--ghost">
          查看排行榜
        </a>
      </div>
      {state === "auth_required" ? (
        <p className="benchmark-note">
          这个成绩不错 — <a href="/account">登录账号</a>后即可提交上榜。
        </p>
      ) : null}
      {state === "error" ? (
        <p className="benchmark-note benchmark-note--error">
          暂时没提交上去，可能是排行榜服务在维护 — 成绩还留在本页，稍后可点「重试提交」。
        </p>
      ) : null}
    </>
  );
}
