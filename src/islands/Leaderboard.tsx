import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { benchmarkGames } from "../data/benchmarks";

type ScoreItem = {
  id: string;
  playerName: string;
  score: number;
  createdAt: string;
};

type BenchmarkTab = {
  id: string;
  label: string;
  unit: "ms" | "level";
  sort?: "asc" | "desc";
};

type BoardPhase = "loading" | "refreshing" | "ready";

const BENCHMARK_TABS: BenchmarkTab[] = benchmarkGames.map((game) => ({
  id: game.id,
  label: game.label,
  unit: game.unit,
  sort: game.sort,
}));

const DEFAULT_TAB = BENCHMARK_TABS[0]?.id ?? "reaction-test";

/** Initial number of entries shown before "显示更多". */
const INITIAL_DISPLAY_COUNT = 10;
/** Extra entries revealed per click on "显示更多". */
const LOAD_MORE_INCREMENT = 10;
/** Drop a hanging board so one stalled table cannot freeze the island. */
const FETCH_TIMEOUT_MS = 8000;

/** Gold / silver / bronze rank styling for the top 3 positions. */
const RANK_CLASSES: Record<number, string> = {
  1: "lb-rank--gold",
  2: "lb-rank--silver",
  3: "lb-rank--bronze",
};

/** 落墨错峰的最大档位 — 长榜不该让末几行等上好几秒。 */
const MAX_STAGGER_STEP = 11;

function isTabId(value: string): boolean {
  return BENCHMARK_TABS.some((tab) => tab.id === value);
}

/** Hash first (`#schulte-grid`), then `?tab=`, otherwise the first game. */
function readRequestedTab(): string {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const fromHash = window.location.hash.replace(/^#/, "");
  if (isTabId(fromHash)) return fromHash;
  const fromQuery = new URLSearchParams(window.location.search).get("tab");
  if (fromQuery && isTabId(fromQuery)) return fromQuery;
  return DEFAULT_TAB;
}

function writeTabHash(tabId: string) {
  if (typeof window === "undefined") return;
  const next = new URL(window.location.href);
  next.hash = tabId;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = `${next.pathname}${next.search}${next.hash}`;
  if (current !== target) {
    window.history.replaceState(null, "", target);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toScoreItem(raw: unknown): ScoreItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const score =
    typeof item.score === "string" ? Number(item.score) : item.score;
  if (!isFiniteNumber(score)) return null;
  const id = typeof item.id === "string" && item.id ? item.id : null;
  if (!id) return null;
  const playerName =
    typeof item.playerName === "string" && item.playerName.trim()
      ? item.playerName.trim()
      : "匿名";
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : "";
  return { id, playerName, score, createdAt };
}

function sortItems(items: ScoreItem[], sort?: "asc" | "desc"): ScoreItem[] {
  const factor = sort === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.score !== b.score) return (a.score - b.score) * factor;
    return 0;
  });
}

function parseBoardItems(payload: unknown, sort?: "asc" | "desc"): ScoreItem[] {
  const raw =
    payload && typeof payload === "object" && "items" in payload
      ? (payload as { items: unknown }).items
      : null;
  if (!Array.isArray(raw)) return [];
  return sortItems(raw.map(toScoreItem).filter((item): item is ScoreItem => item !== null), sort);
}

function formatScore(score: number, tab: BenchmarkTab): string {
  if (tab.unit === "level") return `等级 ${score}`;
  // 舒尔特存的是整盘毫秒，按秒读才和游戏页的参考值同一量纲。
  if (tab.id === "schulte-grid") {
    return `${(score / 1000).toFixed(2)}s`;
  }
  return `${score}ms`;
}

function boardHint(tab: BenchmarkTab): string {
  if (tab.id === "schulte-grid") return "⏱ 完成耗时 — 越低越好";
  if (tab.sort === "asc") return "⏱ 反应时间 — 越低越好";
  return `🏆 ${tab.unit === "ms" ? "最低耗时" : "最高等级"} 排名`;
}

function metaCount(phase: BoardPhase, unavailable: boolean, total: number): string {
  if (phase === "loading") return "载入中";
  if (unavailable) return phase === "refreshing" ? "连接失败 · 重试中" : "连接失败";
  if (phase === "refreshing") return `共 ${total} 条 · 刷新中`;
  return `共 ${total} 条`;
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

async function fetchBoard(
  tab: BenchmarkTab,
  signal: AbortSignal,
): Promise<ScoreItem[] | null> {
  try {
    const url =
      tab.sort === "asc"
        ? `/api/leaderboards/${tab.id}?sort=asc`
        : `/api/leaderboards/${tab.id}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });
    // 未建表的新游戏（如舒尔特刚上线）按空榜处理，不要误报成整站掉线。
    if (response.status === 404) return [];
    if (!response.ok) throw new Error("failed");
    const data: unknown = await response.json();
    return parseBoardItems(data, tab.sort);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal.aborted) return null;
    }
    return null;
  }
}

/**
 * Leaderboard island — fetches all benchmark leaderboards from the API
 * and presents them as switchable tabs. Data source and tab metadata follow
 * the materials repo `leaderboard-client.tsx` / `leaderboard/page.tsx`.
 */
export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  // null 表示该榜拉取失败 — 与「空榜」区分开，降级文案不能误导成没人玩过。
  const [scoreMap, setScoreMap] = useState<Record<string, ScoreItem[] | null>>(
    {},
  );
  const [phase, setPhase] = useState<BoardPhase>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleTabChange = useCallback((tabId: string) => {
    if (!isTabId(tabId)) return;
    setActiveTab(tabId);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
    writeTabHash(tabId);
  }, []);

  useEffect(() => {
    // 只在地址栏已经带榜名时对齐；无 hash 的首次挂载不要把用户刚点的 tab 打回默认榜。
    const syncFromHash = () => {
      if (!window.location.hash) return;
      const next = readRequestedTab();
      if (next === activeTabRef.current) return;
      setActiveTab(next);
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let cancelled = false;

    async function loadAll() {
      setPhase((current) => (current === "ready" ? "refreshing" : "loading"));
      const entries = await Promise.all(
        BENCHMARK_TABS.map(async (tab) => {
          const items = await fetchBoard(tab, controller.signal);
          return [tab.id, items] as const;
        }),
      );
      if (cancelled) return;
      setScoreMap(Object.fromEntries(entries));
      setPhase("ready");
    }

    void loadAll();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
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
  const loading = phase === "loading";
  const boardState = loading
    ? "loading"
    : unavailable
      ? "offline"
      : scores.length === 0
        ? "empty"
        : "ready";

  const handleTabsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key || event.code;
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = activeTabRef.current;
    const index = BENCHMARK_TABS.findIndex((tab) => tab.id === current);
    const last = BENCHMARK_TABS.length - 1;
    let next = index < 0 ? 0 : index;
    if (key === "ArrowRight") next = index >= last ? 0 : index + 1;
    else if (key === "ArrowLeft") next = index <= 0 ? last : index - 1;
    else if (key === "Home") next = 0;
    else if (key === "End") next = last;
    const tabId = BENCHMARK_TABS[next].id;
    handleTabChange(tabId);
    window.requestAnimationFrame(() => {
      document.getElementById(`lb-tab-${tabId}`)?.focus();
    });
  };

  return (
    <div className="lb">
      <div
        className="lb-tabs"
        role="tablist"
        aria-label="排行榜分类"
        onKeyDown={handleTabsKeyDown}
      >
        {BENCHMARK_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              type="button"
              role="tab"
              id={`lb-tab-${tab.id}`}
              key={tab.id}
              aria-selected={selected}
              aria-controls={`lb-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              data-active={selected || undefined}
              data-tab={tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="lb-meta" data-state={boardState} data-phase={phase}>
        <p>{boardHint(activeMeta)}</p>
        <p>{metaCount(phase, unavailable, scores.length)}</p>
      </div>

      <div
        className="lb-table"
        id={`lb-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`lb-tab-${activeTab}`}
        aria-busy={phase !== "ready" || undefined}
        data-state={boardState}
      >
        <div className="island-fade-in" key={activeTab}>
          {loading ? (
            <p className="lb-empty lb-empty--loading">载入中…</p>
          ) : unavailable ? (
            <p className="lb-empty lb-empty--offline">
              排行榜暂时连接不上，可能是服务在维护 — 分数不会丢，稍后再来看看。
            </p>
          ) : scores.length === 0 ? (
            <p className="lb-empty lb-empty--vacant">
              暂无分数 — 虚位以待，去做一次挑战吧。
            </p>
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
                  {index === 0 ? (
                    <span className="lb-champ" aria-hidden="true">
                      魁
                    </span>
                  ) : null}
                  <span className={`lb-rank ${RANK_CLASSES[index + 1] ?? ""}`}>
                    #{index + 1}
                  </span>
                  <span className="lb-name">{score.playerName}</span>
                  <span className="lb-score">
                    {formatScore(score.score, activeMeta)}
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
              disabled={phase === "refreshing"}
              onClick={() => setReloadKey((k) => k + 1)}
            >
              {phase === "refreshing" ? "正在加载…" : "重新加载"}
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
