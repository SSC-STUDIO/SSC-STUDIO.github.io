import { useEffect, useState } from "react";

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

function formatScore(score: number, unit: "ms" | "level"): string {
  return unit === "ms" ? `${score}ms` : `等级 ${score}`;
}

/**
 * Leaderboard island — fetches all six benchmark leaderboards from the API
 * and presents them as switchable tabs. Data source and tab metadata follow
 * the materials repo `leaderboard-client.tsx` / `leaderboard/page.tsx`.
 */
export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<string>(BENCHMARK_TABS[0].id);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreItem[]>>({});
  const [loading, setLoading] = useState(true);

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
            return [tab.id, []] as const;
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
  }, []);

  const activeMeta =
    BENCHMARK_TABS.find((t) => t.id === activeTab) ?? BENCHMARK_TABS[0];
  const scores = scoreMap[activeTab] ?? [];
  const visibleScores = scores.slice(0, displayCount);
  const hasMore = scores.length > displayCount;

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
        <p>共 {scores.length} 条</p>
      </div>

      <div className="lb-table" key={activeTab}>
        <div className="island-fade-in">
          {loading ? (
            <p className="lb-empty">载入中…</p>
          ) : scores.length === 0 ? (
            <p className="lb-empty">暂无分数 — 虚位以待，去做一次挑战吧。</p>
          ) : (
            <>
              {visibleScores.map((score, index) => (
                <div className="lb-row" key={score.id}>
                  <span className={`lb-rank ${RANK_CLASSES[index + 1] ?? ""}`}>
                    #{index + 1}
                  </span>
                  <span className="lb-name">{score.playerName}</span>
                  <span className="lb-score">
                    {formatScore(score.score, activeMeta.unit)}
                  </span>
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
        {!loading && scores.length === 0 ? (
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
