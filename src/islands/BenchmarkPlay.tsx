import { useCallback, useEffect, useRef, useState } from "react";
import { postBenchmarkScore, type ScoreSubmitState } from "./api";
import SubmitSection from "./SubmitSection";
import { ReactionGame } from "./ReactionTest";

/**
 * Benchmark playground — one island hosting all six benchmark games.
 * The `game` prop selects which one to render.
 *
 * Game logic (state machines, difficulty curves, scoring) is ported from
 * the live dist bundle `BenchmarkPlay.CVDrFzZa.js`; the materials repo's
 * `apps/web/app/benchmarks/*-client.tsx` files share the same origin and
 * were used as a readability reference. Where the two differ (dist
 * wording, fixed 3-tile sequence grid, simplified game-over states), the
 * dist behaviour is followed.
 */

export type BenchmarkGame =
  | "reaction-test"
  | "number-memory"
  | "visual-memory"
  | "sequence-memory"
  | "chimp-test"
  | "word-memory"
  | "schulte-grid";

type Phase = "idle" | "showing" | "input" | "correct" | "gameover";

type Cell = { row: number; col: number };
type ChimpCell = { row: number; col: number; value: number };

// ---------------------------------------------------------------------------
// Shared helpers (ported from the dist bundle / benchmark-utils.ts)
// ---------------------------------------------------------------------------

/** Schedule `fn` after `ms`, replacing any previously pending timer. */
function useSingleTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return later;
}

/** Number memory: random number with `digits` digits, no leading zero. */
function generateNumber(digits: number): string {
  if (digits <= 0) return "";
  let num = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < digits; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

/** Number memory: how long the number stays visible. */
function showDuration(level: number): number {
  return Math.max(1500, 800 + level * 200);
}

/** Visual memory: distinct random cells in a size×size grid. */
function generatePattern(size: number, count: number): Cell[] {
  const cells: Cell[] = [];
  const used = new Set<string>();
  while (cells.length < count) {
    const row = Math.floor(Math.random() * size);
    const col = Math.floor(Math.random() * size);
    const key = `${row},${col}`;
    if (!used.has(key)) {
      used.add(key);
      cells.push({ row, col });
    }
  }
  return cells;
}

function visualGridSize(level: number): number {
  return level <= 3 ? 3 : level <= 6 ? 4 : 5;
}

function visualCellCount(level: number, gridSize: number): number {
  return Math.min(level + 2, gridSize * gridSize - 1);
}

/** Visual memory: how long the pattern stays lit. */
function visualShowDuration(level: number): number {
  return 1200 + level * 200;
}

/** Chimp test: `count` shuffled numbers on distinct grid cells. */
function generateGridCells(count: number, size: number): ChimpCell[] {
  const cells: ChimpCell[] = [];
  const used = new Set<string>();
  const values = Array.from({ length: count }, (_, i) => i + 1);
  // Fisher-Yates shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  for (let i = 0; i < count; i++) {
    let row = 0;
    let col = 0;
    let key = "";
    do {
      row = Math.floor(Math.random() * size);
      col = Math.floor(Math.random() * size);
      key = `${row},${col}`;
    } while (used.has(key));
    used.add(key);
    cells.push({ row, col, value: values[i] });
  }
  return cells;
}

function chimpCellCount(level: number): number {
  return Math.min(level + 2, 9);
}

function chimpGridSize(cellCount: number): number {
  return cellCount <= 4 ? 4 : cellCount <= 6 ? 5 : 6;
}

/** Word memory pool — verbatim from the dist bundle (54 words). */
const WORD_POOL = [
  "苹果", "月亮", "海洋", "火车", "钢琴", "蝴蝶", "森林", "雨伞", "星星",
  "西瓜", "太阳", "河流", "飞机", "吉他", "蜻蜓", "竹林", "帽子", "云朵",
  "草莓", "微风", "山峰", "轮船", "小提琴", "蜜蜂", "沙漠", "手套", "彩虹",
  "橙子", "闪电", "瀑布", "汽车", "鼓", "蚂蚁", "雪原", "围巾", "流星",
  "葡萄", "雪花", "珊瑚", "地铁", "口琴", "金鱼", "草地", "眼镜", "极光",
  "菠萝", "灯塔", "峡谷", "高铁", "二胡", "鸽子", "沼泽", "戒指", "薄雾",
];

function shuffleArray<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandomWord(exclude: ReadonlySet<string>): string {
  const available = WORD_POOL.filter((w) => !exclude.has(w));
  if (available.length === 0) {
    return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function wordsPerRound(level: number): number {
  return Math.min(3 + Math.floor(level / 2), 8);
}

/** Shared start/restart pad (idle & game-over states). */
function StartTarget({
  gameover,
  title,
  subtitle,
  onStart,
}: {
  gameover: boolean;
  title: string;
  subtitle: string;
  onStart: () => void;
}) {
  return (
    <div
      className={`benchmark-target ${gameover ? "benchmark-target--fail" : ""}`}
      data-state="idle"
      onClick={onStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.repeat) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart();
        }
      }}
    >
      <div className="benchmark-target__inner">
        {gameover ? (
          <>
            <span>{title}</span>
            <small>点击重新开始</small>
          </>
        ) : (
          <>
            <span>{title}</span>
            <small>{subtitle}</small>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number memory
// ---------------------------------------------------------------------------

function NumberMemoryGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [currentNumber, setCurrentNumber] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [bestLevel, setBestLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const later = useSingleTimer();

  const startRound = useCallback(
    (lvl: number) => {
      const num = generateNumber(lvl);
      setCurrentNumber(num);
      setInputValue("");
      setPhase("showing");
      later(() => {
        setPhase("input");
      }, showDuration(lvl));
    },
    [later],
  );

  const startGame = useCallback(() => {
    setLevel(1);
    setAttempts((prev) => prev + 1);
    setSubmitState("idle");
    startRound(1);
  }, [startRound]);

  useEffect(() => {
    if (phase === "input") {
      inputRef.current?.focus();
    }
  }, [phase]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (phase !== "input") return;
      // 空输入不判负：误按回车不该直接结束一局。
      if (inputValue.length === 0) return;

      if (inputValue === currentNumber) {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setPhase("correct");
        later(() => startRound(nextLevel), 800);
      } else {
        setBestLevel((prev) => Math.max(prev, level - 1));
        setPhase("gameover");
      }
    },
    [phase, inputValue, currentNumber, level, startRound, later],
  );

  const score = bestLevel || (phase === "gameover" ? level - 1 : 0);

  async function submitScore() {
    if (score === 0 || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("number-memory", score);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" || phase === "gameover" ? (
        <div
          className={`benchmark-target ${phase === "gameover" ? "benchmark-target--fail" : ""}`}
          data-state="idle"
          onClick={startGame}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.repeat) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startGame();
            }
          }}
        >
          <div className="benchmark-target__inner">
            {phase === "gameover" ? (
              <>
                <span>第 {level - 1} 位</span>
                <small>正确数字: {currentNumber}</small>
                <small>你的输入: {inputValue}</small>
                <small>点击重新开始</small>
              </>
            ) : (
              <>
                <span>数字记忆</span>
                <small>记住不断变长的数字</small>
              </>
            )}
          </div>
        </div>
      ) : null}

      {phase === "showing" ? (
        <div className="benchmark-target benchmark-target--pop" data-state="ready">
          <div className="benchmark-target__inner">
            <span className="benchmark-number">{currentNumber}</span>
            <small>第 {level} 位 — 记住这个数字</small>
            <span
              key={level}
              className="benchmark-timebar"
              style={{ animationDuration: `${showDuration(level)}ms` }}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}

      {phase === "input" ? (
        <div className="benchmark-target" data-state="waiting">
          <div className="benchmark-target__inner">
            <small>输入你记住的数字</small>
            <form onSubmit={handleSubmit} className="benchmark-form">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.replace(/\D/g, ""))}
                className="benchmark-input"
                autoComplete="off"
              />
              <button type="submit" className="p-card__link">
                确认
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {phase === "correct" ? (
        <div className="benchmark-target benchmark-target--pop" data-state="ready">
          <div className="benchmark-target__inner">
            <span>正确！</span>
            <small>进入第 {level} 位...</small>
          </div>
        </div>
      ) : null}

      {phase === "gameover" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>最高: {bestLevel} 位</span>
          <span>当前: {level - 1} 位</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual memory
// ---------------------------------------------------------------------------

function VisualMemoryGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(3);
  const [pattern, setPattern] = useState<Cell[]>([]);
  const [selected, setSelected] = useState<Cell[]>([]);
  const [bestLevel, setBestLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const later = useSingleTimer();

  const cellCount = visualCellCount(level, gridSize);

  const startRound = useCallback(
    (lvl: number) => {
      const size = visualGridSize(lvl);
      setGridSize(size);
      const pat = generatePattern(size, visualCellCount(lvl, size));
      setPattern(pat);
      setSelected([]);
      setPhase("showing");
      later(() => {
        setPhase("input");
      }, visualShowDuration(lvl));
    },
    [later],
  );

  const startGame = useCallback(() => {
    setLevel(1);
    setAttempts((prev) => prev + 1);
    setSubmitState("idle");
    startRound(1);
  }, [startRound]);

  const toggleCell = useCallback(
    (row: number, col: number) => {
      if (phase !== "input") return;
      setSelected((prev) => {
        const exists = prev.find((c) => c.row === row && c.col === col);
        if (exists) return prev.filter((c) => !(c.row === row && c.col === col));
        return [...prev, { row, col }];
      });
    },
    [phase],
  );

  const handleConfirm = useCallback(() => {
    if (phase !== "input") return;
    // 一个都没选就确认多半是误触，不判负。
    if (selected.length === 0) return;
    const patternSet = new Set(pattern.map((c) => `${c.row},${c.col}`));
    const allCorrect =
      selected.length === pattern.length &&
      selected.every((c) => patternSet.has(`${c.row},${c.col}`));
    if (allCorrect) {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setBestLevel((prev) => Math.max(prev, level));
      setPhase("correct");
      later(() => startRound(nextLevel), 800);
    } else {
      setBestLevel((prev) => Math.max(prev, level - 1));
      setPhase("gameover");
    }
  }, [phase, pattern, selected, level, startRound, later]);

  // 键盘可玩：输入阶段按回车确认。
  useEffect(() => {
    if (phase !== "input") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Enter") handleConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleConfirm]);

  const isActive = (row: number, col: number): boolean => {
    if (phase === "showing" || phase === "correct") {
      return pattern.some((c) => c.row === row && c.col === col);
    }
    if (phase === "input") {
      return selected.some((c) => c.row === row && c.col === col);
    }
    return false;
  };

  const score = bestLevel || (phase === "gameover" ? level - 1 : 0);

  async function submitScore() {
    if (score === 0 || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("visual-memory", score);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" || phase === "gameover" ? (
        <StartTarget
          gameover={phase === "gameover"}
          title={phase === "gameover" ? `第 ${level} 级失败` : "视觉记忆"}
          subtitle="记住闪烁的方块位置"
          onStart={startGame}
        />
      ) : null}

      {phase === "showing" || phase === "input" || phase === "correct" ? (
        <div>
          <div
            className="benchmark-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const active = isActive(row, col);
              return (
                <button
                  key={`${row}-${col}`}
                  className={`benchmark-grid-cell ${active ? "active" : ""}`}
                  onClick={() => toggleCell(row, col)}
                  disabled={phase !== "input"}
                  type="button"
                />
              );
            })}
          </div>
          {phase === "input" ? (
            <div className="benchmark-grid-actions">
              <small>
                选中 {selected.length} / {pattern.length} 个方块
              </small>
              <button
                type="button"
                className="p-card__link"
                onClick={handleConfirm}
              >
                确认
              </button>
            </div>
          ) : null}
          {phase === "showing" ? (
            <>
              <small className="benchmark-grid-hint">
                第 {level} 级 — 记住方块位置 ({cellCount} 个)
              </small>
              <span
                key={level}
                className="benchmark-timebar"
                style={{ animationDuration: `${visualShowDuration(level)}ms` }}
                aria-hidden="true"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {phase === "gameover" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>最高: 第 {bestLevel} 级</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sequence memory (fixed 3 tiles, as in the dist bundle)
// ---------------------------------------------------------------------------

const SEQUENCE_TILE_COUNT = 3;

function SequenceMemoryGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  /** 玩家点击时的短促高亮 — 与出题回放的常亮区分开。 */
  const [pressedTile, setPressedTile] = useState<number | null>(null);
  const [bestLevel, setBestLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const later = useSingleTimer();
  // 按压反馈用独立计时器：`later` 是单槽的，复用会顶掉进入下一关的排程。
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const playSequence = useCallback(
    (seq: number[]) => {
      setPhase("showing");
      let i = 0;
      const step = () => {
        if (i < seq.length) {
          setHighlighted(seq[i]);
          later(() => {
            setHighlighted(null);
            later(() => {
              i += 1;
              step();
            }, 200);
          }, 600);
        } else {
          setHighlighted(null);
          setPhase("input");
          setPlayerInput([]);
        }
      };
      later(step, 500);
    },
    [later],
  );

  const startRound = useCallback(
    (lvl: number, seq: number[]) => {
      const newTile = Math.floor(Math.random() * SEQUENCE_TILE_COUNT);
      const newSeq = [...seq, newTile];
      setSequence(newSeq);
      setPlayerInput([]);
      playSequence(newSeq);
    },
    [playSequence],
  );

  const startGame = useCallback(() => {
    setLevel(1);
    setAttempts((prev) => prev + 1);
    setSubmitState("idle");
    setSequence([]);
    startRound(1, []);
  }, [startRound]);

  const handleTileClick = useCallback(
    (index: number) => {
      if (phase !== "input") return;

      // 每次点击都给一个 ~180ms 的高亮回响，确认「点到了」。
      setPressedTile(index);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      pressTimerRef.current = setTimeout(() => setPressedTile(null), 180);

      const nextInput = [...playerInput, index];
      setPlayerInput(nextInput);
      const pos = nextInput.length - 1;
      if (nextInput[pos] !== sequence[pos]) {
        setBestLevel((prev) => Math.max(prev, level - 1));
        setPhase("gameover");
        return;
      }
      if (nextInput.length === sequence.length) {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setBestLevel((prev) => Math.max(prev, level));
        setPhase("correct");
        later(() => startRound(nextLevel, sequence), 800);
      }
    },
    [phase, playerInput, sequence, level, startRound, later],
  );

  // 键盘可玩：输入阶段按 1 / 2 / 3 对应左中右三块。
  useEffect(() => {
    if (phase !== "input") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx !== -1 && idx < SEQUENCE_TILE_COUNT) handleTileClick(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleTileClick]);

  const score = bestLevel || (phase === "gameover" ? level - 1 : 0);

  async function submitScore() {
    if (score === 0 || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("sequence-memory", score);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" || phase === "gameover" ? (
        <StartTarget
          gameover={phase === "gameover"}
          title={phase === "gameover" ? `第 ${level} 级失败` : "顺序记忆"}
          subtitle="记住方块亮起的顺序"
          onStart={startGame}
        />
      ) : null}

      {phase === "showing" || phase === "input" || phase === "correct" ? (
        <div>
          <div className="benchmark-sequence-row">
            {Array.from({ length: SEQUENCE_TILE_COUNT }, (_, i) => (
              <button
                key={i}
                className={`benchmark-sequence-tile ${highlighted === i ? "active" : ""} ${pressedTile === i ? "pressed" : ""}`}
                onClick={() => handleTileClick(i)}
                disabled={phase !== "input"}
                aria-label={`第 ${i + 1} 块`}
                type="button"
              />
            ))}
          </div>
          <small className="benchmark-grid-hint">
            {phase === "showing"
              ? `第 ${level} 级 — 观察顺序`
              : phase === "input"
                ? `第 ${level} 级 — 重复顺序 (${playerInput.length}/${sequence.length})，可按键 1/2/3`
                : null}
          </small>
        </div>
      ) : null}

      {phase === "gameover" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>最高: 第 {bestLevel} 级</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chimp test
// ---------------------------------------------------------------------------

function chimpShowDuration(level: number): number {
  return 2000 + level * 300;
}

function ChimpTestGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(4);
  const [cells, setCells] = useState<ChimpCell[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  /** 点错的格子 — 先闪朱砂再进结算，让玩家看清错在哪。 */
  const [wrongCell, setWrongCell] = useState<Cell | null>(null);
  const [bestLevel, setBestLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const later = useSingleTimer();

  const startRound = useCallback(
    (lvl: number) => {
      const count = chimpCellCount(lvl);
      const size = chimpGridSize(count);
      setGridSize(size);
      const newCells = generateGridCells(count, size);
      setCells(newCells);
      setRevealed(new Set(newCells.map((c) => c.value)));
      setNextExpected(1);
      setWrongCell(null);
      setPhase("showing");
      later(() => {
        setRevealed(new Set());
        setPhase("input");
      }, chimpShowDuration(lvl));
    },
    [later],
  );

  const startGame = useCallback(() => {
    setLevel(1);
    setAttempts((prev) => prev + 1);
    setSubmitState("idle");
    startRound(1);
  }, [startRound]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (phase !== "input" || wrongCell) return;
      const cell = cells.find((c) => c.row === row && c.col === col);
      if (!cell) return;

      if (cell.value === nextExpected) {
        const newRevealed = new Set(revealed);
        newRevealed.add(cell.value);
        setRevealed(newRevealed);

        if (cell.value === cells.length) {
          const nextLevel = level + 1;
          setLevel(nextLevel);
          setBestLevel((prev) => Math.max(prev, level));
          setPhase("correct");
          later(() => startRound(nextLevel), 800);
        } else {
          setNextExpected(cell.value + 1);
        }
      } else {
        // 先把点错的格子亮出来（含真实数字）晃一下，再进结算，
        // 不然玩家连自己错在哪都没看见画面就切走了。
        setBestLevel((prev) => Math.max(prev, level - 1));
        setWrongCell({ row, col });
        setRevealed(new Set(cells.map((c) => c.value)));
        later(() => setPhase("gameover"), 900);
      }
    },
    [phase, wrongCell, cells, nextExpected, revealed, level, startRound, later],
  );

  const score = bestLevel || (phase === "gameover" ? level - 1 : 0);

  async function submitScore() {
    if (score === 0 || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("chimp-test", score);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" || phase === "gameover" ? (
        <StartTarget
          gameover={phase === "gameover"}
          title={phase === "gameover" ? `第 ${level} 级失败` : "黑猩猩测试"}
          subtitle="按数字顺序点击消失的方块"
          onStart={startGame}
        />
      ) : null}

      {phase === "showing" || phase === "input" || phase === "correct" ? (
        <div>
          <div
            className="benchmark-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const cell = cells.find((c) => c.row === row && c.col === col);
              const isVisible = Boolean(cell && revealed.has(cell.value));
              const isWrong = Boolean(
                wrongCell && wrongCell.row === row && wrongCell.col === col,
              );
              return (
                <button
                  key={`${row},${col}`}
                  className={`benchmark-grid-cell ${isVisible ? "active" : ""} ${isWrong ? "wrong" : ""}`}
                  onClick={() => handleCellClick(row, col)}
                  disabled={phase !== "input" || !cell}
                  type="button"
                >
                  {isVisible && cell ? String(cell.value) : ""}
                </button>
              );
            })}
          </div>
          <small className="benchmark-grid-hint">
            {wrongCell
              ? `点错了 — 应该点 ${nextExpected}`
              : phase === "showing"
                ? `第 ${level} 级 — 记住数字位置`
                : phase === "input"
                  ? `按 1-${cells.length} 顺序点击 (下一个: ${nextExpected})`
                  : null}
          </small>
          {phase === "showing" ? (
            <span
              key={level}
              className="benchmark-timebar"
              style={{ animationDuration: `${chimpShowDuration(level)}ms` }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : null}

      {phase === "gameover" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>最高: 第 {bestLevel} 级</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Word memory
// ---------------------------------------------------------------------------

function WordMemoryGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [currentWords, setCurrentWords] = useState<string[]>([]);
  const [seenWords, setSeenWords] = useState<Set<string>>(new Set());
  const [testWord, setTestWord] = useState("");
  const [isNewWord, setIsNewWord] = useState(true);
  const [bestLevel, setBestLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const later = useSingleTimer();

  const startRound = useCallback(
    (lvl: number, previousSeen: Set<string>) => {
      const count = wordsPerRound(lvl);
      const shuffled = shuffleArray(WORD_POOL.filter((w) => !previousSeen.has(w)));
      const newWords = shuffled.slice(0, Math.min(count, shuffled.length));
      setCurrentWords(newWords);
      setPhase("showing");

      later(() => {
        const allSeen = new Set([...previousSeen, ...newWords]);
        setSeenWords(allSeen);

        // Decide: show a word seen before or a brand-new one
        const showOld = Math.random() < 0.5 && previousSeen.size > 0;
        if (showOld) {
          const oldWords = [...previousSeen];
          const word = oldWords[Math.floor(Math.random() * oldWords.length)];
          setTestWord(word);
          setIsNewWord(false);
        } else {
          setTestWord(pickRandomWord(allSeen));
          setIsNewWord(true);
        }
        setPhase("input");
      }, 2000 + lvl * 300);
    },
    [later],
  );

  const startGame = useCallback(() => {
    setLevel(1);
    setSeenWords(new Set());
    setAttempts((prev) => prev + 1);
    setSubmitState("idle");
    startRound(1, new Set());
  }, [startRound]);

  const handleAnswer = useCallback(
    (saidNew: boolean) => {
      if (phase !== "input") return;
      if (saidNew === isNewWord) {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setBestLevel((prev) => Math.max(prev, level));
        setPhase("correct");
        if (isNewWord) {
          later(() => startRound(nextLevel, new Set([...seenWords, testWord])), 800);
        } else {
          later(() => startRound(nextLevel, seenWords), 800);
        }
      } else {
        setBestLevel((prev) => Math.max(prev, level - 1));
        setPhase("gameover");
      }
    },
    [phase, isNewWord, level, seenWords, testWord, startRound, later],
  );

  const score = bestLevel || (phase === "gameover" ? level - 1 : 0);

  async function submitScore() {
    if (score === 0 || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("word-memory", score);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" || phase === "gameover" ? (
        <StartTarget
          gameover={phase === "gameover"}
          title={phase === "gameover" ? `第 ${level} 级失败` : "词语记忆"}
          subtitle="判断词语是否之前出现过"
          onStart={startGame}
        />
      ) : null}

      {phase === "showing" ? (
        <div className="benchmark-target" data-state="ready">
          <div className="benchmark-target__inner">
            <div className="benchmark-word-list">
              {currentWords.map((w) => (
                <span key={w} className="benchmark-word">
                  {w}
                </span>
              ))}
            </div>
            <small>第 {level} 级 — 记住这些词语</small>
          </div>
        </div>
      ) : null}

      {phase === "input" ? (
        <div>
          <div className="benchmark-target" data-state="waiting">
            <div className="benchmark-target__inner">
              <span className="benchmark-word-display">{testWord}</span>
              <small>这个词出现过吗？</small>
            </div>
          </div>
          <div className="p-card__actions">
            <button
              type="button"
              className="p-card__link"
              onClick={() => handleAnswer(true)}
            >
              没见过 (新的)
            </button>
            <button
              type="button"
              className="p-card__link p-card__link--ghost"
              onClick={() => handleAnswer(false)}
            >
              见过 (旧的)
            </button>
          </div>
        </div>
      ) : null}

      {phase === "correct" ? (
        <div className="benchmark-target" data-state="ready">
          <div className="benchmark-target__inner">
            <span>正确！</span>
            <small>进入第 {level} 级...</small>
          </div>
        </div>
      ) : null}

      {phase === "gameover" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>最高: 第 {bestLevel} 级</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schulte grid (5×5, original implementation — not from the dist bundle)
// ---------------------------------------------------------------------------

const SCHULTE_SIZE = 5;
const SCHULTE_CELL_COUNT = SCHULTE_SIZE * SCHULTE_SIZE;

type SchultePhase = "idle" | "countdown" | "playing" | "done";

/** Random permutation of 1–25. */
function generateSchulteNumbers(): number[] {
  return shuffleArray(
    Array.from({ length: SCHULTE_CELL_COUNT }, (_, i) => i + 1),
  );
}

function SchulteGridGame() {
  const [phase, setPhase] = useState<SchultePhase>("idle");
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [errorCell, setErrorCell] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState<number | null>(null);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");
  const startTimeRef = useRef<number | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopClock = useCallback(() => {
    if (clockRef.current) {
      clearInterval(clockRef.current);
      clockRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const startGame = useCallback(() => {
    stopClock();
    startTimeRef.current = null;
    setNumbers(generateSchulteNumbers());
    setNextExpected(1);
    setMistakes(0);
    setErrorCell(null);
    setElapsedMs(0);
    setFinalMs(null);
    setSubmitState("idle");
    setAttempts((prev) => prev + 1);
    setCountdown(3);
    setPhase("countdown");
  }, [stopClock]);

  // 3-2-1 countdown before the grid becomes clickable.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("playing");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const handleCellClick = useCallback(
    (index: number) => {
      if (phase !== "playing") return;
      const value = numbers[index];
      if (value === undefined || value < nextExpected) return;

      if (value !== nextExpected) {
        setMistakes((prev) => prev + 1);
        setErrorCell(index);
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setErrorCell(null), 400);
        return;
      }

      // The clock starts on hitting 1, not when the grid appears.
      if (value === 1) {
        startTimeRef.current = performance.now();
        clockRef.current = setInterval(() => {
          if (startTimeRef.current !== null) {
            setElapsedMs(performance.now() - startTimeRef.current);
          }
        }, 31);
      }

      if (value === SCHULTE_CELL_COUNT) {
        stopClock();
        const elapsed =
          startTimeRef.current !== null
            ? performance.now() - startTimeRef.current
            : 0;
        startTimeRef.current = null;
        setElapsedMs(elapsed);
        setFinalMs(elapsed);
        setBestMs((prev) => (prev === null ? elapsed : Math.min(prev, elapsed)));
        setPhase("done");
        return;
      }

      setNextExpected(value + 1);
    },
    [phase, numbers, nextExpected, stopClock],
  );

  async function submitScore() {
    if (
      finalMs === null ||
      submitState === "submitting" ||
      submitState === "submitted"
    )
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore("schulte-grid", Math.round(finalMs), {
      type: "schulte-grid",
      mistakes,
    });
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  return (
    <div className="benchmark-game">
      {phase === "idle" ? (
        <StartTarget
          gameover={false}
          title="舒尔特表"
          subtitle="按 1 → 25 顺序点亮全部格子，比的是眼与手的协同。"
          onStart={startGame}
        />
      ) : null}

      {phase === "countdown" ? (
        <div className="benchmark-target" data-state="ready">
          <div className="benchmark-target__inner">
            <span className="benchmark-number">{countdown}</span>
            <small>准备 — 倒数结束后找到数字 1</small>
          </div>
        </div>
      ) : null}

      {phase === "playing" ? (
        <div>
          <div className="schulte-grid">
            {numbers.map((value, index) => {
              const cleared = value < nextExpected;
              const className = [
                "schulte-cell",
                cleared ? "schulte-cell--cleared" : "",
                errorCell === index ? "schulte-cell--error" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={value}
                  type="button"
                  className={className}
                  onClick={() => handleCellClick(index)}
                  disabled={cleared}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <div className="schulte-hud">
            <span>下一个: {nextExpected}</span>
            <span>用时: {(elapsedMs / 1000).toFixed(2)} s</span>
            <span>失误: {mistakes}</span>
          </div>
        </div>
      ) : null}

      {phase === "done" && finalMs !== null ? (
        <>
          <div className="benchmark-target" data-state="result">
            <div className="benchmark-target__inner">
              <span>{(finalMs / 1000).toFixed(2)} s</span>
              <small>点亮了全部 25 格，失误 {mistakes} 次</small>
            </div>
          </div>
          <div className="p-card__actions">
            <button type="button" className="p-card__link" onClick={startGame}>
              再来一局
            </button>
          </div>
          <SubmitSection state={submitState} onSubmit={submitScore} />
        </>
      ) : null}

      {attempts > 0 ? (
        <div className="benchmark-stats">
          <span>游戏次数: {attempts}</span>
          <span>
            最佳: {bestMs !== null ? `${(bestMs / 1000).toFixed(2)} s` : "—"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Benchmark playground island.
 *
 * ```astro
 * <BenchmarkPlay client:load game="number-memory" />
 * ```
 */
export default function BenchmarkPlay({ game }: { game: BenchmarkGame }) {
  switch (game) {
    case "reaction-test":
      return <ReactionGame benchmarkType="reaction-test" />;
    case "number-memory":
      return <NumberMemoryGame />;
    case "visual-memory":
      return <VisualMemoryGame />;
    case "sequence-memory":
      return <SequenceMemoryGame />;
    case "chimp-test":
      return <ChimpTestGame />;
    case "word-memory":
      return <WordMemoryGame />;
    case "schulte-grid":
      return <SchulteGridGame />;
    default:
      return (
        <div className="p-lock">
          <p className="p-lock__badge">即将上线</p>
          <p className="p-lock__message">
            此挑战的交互试玩正在迁移，可先查看说明与排行榜。
          </p>
          <div className="p-card__actions">
            <a href="/leaderboard" className="p-card__link">
              查看排行榜
            </a>
            <a href="/benchmarks" className="p-card__link p-card__link--ghost">
              全部挑战
            </a>
          </div>
        </div>
      );
  }
}
