import { useEffect, useState, type CSSProperties } from "react";

type ScoreItem = {
  id: string;
  playerName: string;
  score: number;
  createdAt: string;
};

type LeaderboardResponse = {
  total: number;
  items: ScoreItem[];
};

type BenchmarkTab = {
  id: string;
  label: string;
  /** "ms" for reaction-based, "level" for progression-based games. */
  unit: "ms" | "level";
  /** "asc" when a lower score is better (reaction time). */
  sort?: "asc" | "desc";
};

const BENCHMARK_TABS: BenchmarkTab[] = [
  { id: "reaction-test", label: "反应时间", unit: "ms", sort: "asc" },
  { id: "word-memory", label: "词语记忆", unit: "level" },
  { id: "number-memory", label: "数字记忆", unit: "level" },
  { id: "visual-memory", label: "视觉记忆", unit: "level" },
  { id: "sequence-memory", label: "顺序记忆", unit: "level" },
  { id: "chimp-test", label: "黑猩猩测试", unit: "level" },
];

/** Initial number of entries shown before "显示更多". */
const INITIAL_DISPLAY_COUNT = 10;
/** Extra entries revealed per click on "显示更多". */
const LOAD_MORE_INCREMENT = 10;

/** Gold / silver / bronze rank styling for the top 3 positions. */
const RANK_CLASSES: Record<number, string> = {
  1: "lb-rank--gold",
  2: "lb-rank--silver",
  3: "lb-rank--bronze",
};

/** 落墨错峰的最大档位 — 长榜不该让末几行等上好几秒。 */
const MAX_STAGGER_STEP = 11;

function formatScore(score: number, unit: "ms" | "level"): string {
  return unit === "ms" ? `${score}ms` : `等级 ${score}`;
}

/**
 * 分数墨痕的长度比：始终「越强越长」。
 * 反应时间越低越强，故取「榜首 / 本条」；等级类反之。
 * 留 6% 起底，垫底的一条也还看得见一笔。
 */
function barRatio(
  score: number,
  best: number,
  lowerIsBetter: boolean,
): number {
  if (!best || !score) return 0;
  const ratio = lowerIsBetter ? best / score : score / best;
  return Math.max(0.06, Math.min(1, ratio));
}

/**
 * Leaderboard island — fetches all six benchmark leaderboards from the API
 * and presents them as switchable tabs. Data source and tab metadata follow
 * the materials repo `leaderboard-client.tsx` / `leaderboard/page.tsx`.
 */
export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<string>(BENCHMARK_TABS[0].id);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  // null 表示该榜拉取失败 — 与「空榜」区分开，降级文案不能误导成没人玩过。
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreItem[] | null>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      const entries = await Promise.all(
        BENCHMARK_TABS.map(async (tab) => {
          try {
            const url = tab.sort === "asc"
              ? `/api/leaderboards/${tab.id}?sort=asc`
              : `/api/leaderboards/${tab.id}`;
            const response = await fetch(url, {
              headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error("failed");
            const data = (await response.json()) as LeaderboardResponse;
            return [tab.id, data.items ?? []] as const;
          } catch {
            // A failing table must not take the whole board down with it.
            return [tab.id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setScoreMap(Object.fromEntries(entries));
      setLoading(false);
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const activeMeta =
    BENCHMARK_TABS.find((t) => t.id === activeTab) ?? BENCHMARK_TABS[0];
  const unavailable = scoreMap[activeTab] === null;
  const scores = scoreMap[activeTab] ?? [];
  const visibleScores = scores.slice(0, displayCount);
  const hasMore = scores.length > displayCount;
  const lowerIsBetter = activeMeta.sort === "asc";
  const topScore = scores.length
    ? lowerIsBetter
      ? Math.min(...scores.map((s) => s.score))
      : Math.max(...scores.map((s) => s.score))
    : 0;

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  };

  return (
    <div className="lb">
      <div className="lb-tabs" role="tablist" aria-label="排行榜分类">
        {BENCHMARK_TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            key={tab.id}
            aria-selected={activeTab === tab.id}
            data-active={activeTab === tab.id || undefined}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lb-meta">
        <p>
          {activeMeta.sort === "asc"
            ? "⏱ 反应时间 — 越低越好"
            : `🏆 ${activeMeta.unit === "ms" ? "最低耗时" : "最高等级"} 排名`}
        </p>
        <p>{unavailable ? "连接失败" : `共 ${scores.length} 条`}</p>
      </div>

      <div className="lb-table" key={activeTab}>
        <div className="island-fade-in">
          {loading ? (
            <p className="lb-empty lb-empty--loading">载入中…</p>
          ) : unavailable ? (
            <p className="lb-empty">
              排行榜暂时连接不上，可能是服务在维护 — 分数不会丢，稍后再来看看。
            </p>
          ) : scores.length === 0 ? (
            <p className="lb-empty">暂无分数 — 虚位以待，去做一次挑战吧。</p>
          ) : (
            <>
              {visibleScores.map((score, index) => (
                <div
                  className={`lb-row${index < 3 ? " lb-row--podium" : ""}`}
                  key={score.id}
                  data-lift
                  style={
                    {
                      "--row-i": Math.min(index, MAX_STAGGER_STEP),
                      "--bar": barRatio(score.score, topScore, lowerIsBetter),
                    } as CSSProperties
                  }
                >
                  <span className={`lb-rank ${RANK_CLASSES[index + 1] ?? ""}`}>
                    #{index + 1}
                  </span>
                  <span className="lb-name">{score.playerName}</span>
                  <span className="lb-score">
                    {formatScore(score.score, activeMeta.unit)}
                  </span>
                  {/* 分数墨痕：行底一道朱砂，长度即与榜首之比 */}
                  <span className="lb-bar" aria-hidden="true" />
                </div>
              ))}
              {hasMore ? (
                <button
                  type="button"
                  className="p-card__link lb-more"
                  onClick={() =>
                    setDisplayCount((c) => c + LOAD_MORE_INCREMENT)
                  }
                >
                  显示更多 ({scores.length - displayCount} 条)
                </button>
              ) : null}
            </>
          )}
        </div>
        {!loading && unavailable ? (
          <div className="p-card__actions lb-empty-actions">
            <button
              type="button"
              className="p-card__link"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              重新加载
            </button>
            <a
              className="p-card__link p-card__link--ghost"
              href={`/benchmarks/${activeMeta.id}`}
            >
              先去挑战
            </a>
          </div>
        ) : null}
        {!loading && !unavailable && scores.length === 0 ? (
          <div className="p-card__actions lb-empty-actions">
            <a className="p-card__link" href={`/benchmarks/${activeMeta.id}`}>
              去挑战
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
