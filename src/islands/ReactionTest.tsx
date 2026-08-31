import { useCallback, useEffect, useRef, useState } from "react";
import { postBenchmarkScore, type ScoreSubmitState } from "./api";
import SubmitSection from "./SubmitSection";

type ReactionState = "idle" | "waiting" | "ready" | "result";

type Attempt = {
  time: number;
  date: number;
};

/**
 * Reaction time game — wait for the pad to turn green, then click as fast
 * as possible. Ported from the live dist `reaction-test-client.DizBwTXs.js`
 * bundle (same logic as the materials repo `benchmark-client.tsx`).
 */
export function ReactionGame({
  benchmarkType = "reaction-test",
}: {
  benchmarkType?: string;
}) {
  const [state, setState] = useState<ReactionState>("idle");
  const [result, setResult] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [tooEarly, setTooEarly] = useState(false);
  const [submitState, setSubmitState] = useState<ScoreSubmitState>("idle");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  /** When the pad entered "waiting" — used to swallow double-click tails. */
  const armedAtRef = useRef<number>(0);
  /** When the result appeared — brief lockout so the reaction click's
   *  accidental second click doesn't instantly restart the test. */
  const resultAtRef = useRef<number>(0);

  const average = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + a.time, 0) / attempts.length)
    : null;
  const best = attempts.length
    ? Math.min(...attempts.map((a) => a.time))
    : null;

  const startTest = useCallback(() => {
    setState("waiting");
    setTooEarly(false);
    setSubmitState("idle");
    armedAtRef.current = performance.now();
    const delay = 2000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => {
      setState("ready");
      // 先立即起表兜底，再在两帧 rAF 后校准到绿色真正绘制出来的时刻，
      // 避免把 React 渲染 + 浏览器绘制的耗时算进玩家的反应时间。
      startTimeRef.current = performance.now();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          startTimeRef.current = performance.now();
        });
      });
    }, delay);
  }, []);

  const handleClick = useCallback(() => {
    if (state === "idle") {
      startTest();
      return;
    }

    if (state === "waiting") {
      // 开始后 250ms 内的点击视为开始那一下的双击尾巴，不判失败。
      if (performance.now() - armedAtRef.current < 250) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setTooEarly(true);
      setState("idle");
      return;
    }

    if (state === "ready") {
      const time = Math.round(performance.now() - startTimeRef.current);
      resultAtRef.current = performance.now();
      setResult(time);
      setAttempts((prev) => [...prev, { time, date: Date.now() }]);
      setState("result");
      return;
    }

    if (state === "result") {
      // 结果刚出现时短暂锁定，防止反应那一下的连点直接把结果顶掉。
      if (performance.now() - resultAtRef.current < 350) return;
      startTest();
    }
  }, [state, startTest]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function submitScore() {
    if (!result || submitState === "submitting" || submitState === "submitted")
      return;
    setSubmitState("submitting");
    const res = await postBenchmarkScore(benchmarkType, result);
    if (res.ok) {
      setSubmitState("submitted");
      return;
    }
    setSubmitState(res.reason === "unauthorized" ? "auth_required" : "error");
  }

  const label =
    state === "idle"
      ? "点击开始测试"
      : state === "waiting"
        ? "等待绿色..."
        : state === "ready"
          ? "点击！"
          : `${result}ms`;

  const sublabel =
    state === "idle"
      ? "测试你的反应时间"
      : state === "waiting"
        ? "太早点击会失败"
        : state === "ready"
          ? "越快越好"
          : tooEarly
            ? "太早了！"
            : "点击再次挑战";

  return (
    <div className="benchmark-game">
      <div
        className="benchmark-target"
        data-state={state}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.repeat) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="benchmark-target__inner">
          <span>{label}</span>
          <small>{sublabel}</small>
          {tooEarly ? (
            <small className="benchmark-target__warn">
              你点击得太早了，请重新开始。
            </small>
          ) : null}
        </div>
      </div>

      {state === "result" ? (
        <SubmitSection state={submitState} onSubmit={submitScore} />
      ) : null}

      {attempts.length > 0 ? (
        <div className="benchmark-stats">
          <span>尝试: {attempts.length}</span>
          {average !== null ? <span>平均: {average}ms</span> : null}
          {best !== null ? <span>最佳: {best}ms</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Standalone reaction test island — the reaction game with leaderboard
 * submission, as used on the /reaction-test page.
 */
export default function ReactionTest() {
  return <ReactionGame benchmarkType="reaction-test" />;
}
