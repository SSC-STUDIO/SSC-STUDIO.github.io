import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Milestone = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  image?: string;
};

type MilestonesResponse = {
  total: number;
  items: Milestone[];
};

type Status = "loading" | "ready" | "error";

/** Growth photos cycled across nodes in chronological order. */
const STEP_PHOTOS = [
  "/legacy-assets/step/step_0.jpg",
  "/legacy-assets/step/step_1.jpg",
  "/legacy-assets/step/step_2.jpg",
  "/legacy-assets/step/step_3.jpg",
];

/** 本地节点：API 未通时仍能画出河流与入场 */
const FALLBACK_ITEMS: Milestone[] = [
  {
    id: "HON-01",
    title: "CSP-J 入门级贰等",
    description: "中国计算机学会",
    date: "2024-10",
    image: "/legacy-assets/step/step_0.jpg",
  },
  {
    id: "HON-02",
    title: "人工智能算法设计二等奖",
    description: "上海市中小学生人工智能算法设计活动 · Python 初中组",
    date: "2024-11",
    image: "/legacy-assets/step/step_1.jpg",
  },
  {
    id: "HON-03",
    title: "创客新星大赛三等奖",
    description: "第十届上海创客新星大赛浦东区赛 · 趣味智造初中组",
    date: "2024-12",
    image: "/legacy-assets/step/step_2.jpg",
  },
  {
    id: "HON-04",
    title: "希望颂书画艺术大展一等奖",
    description: "中国国际书画艺术研究会 · 软笔书法初中组",
    date: "2025-03",
    image: "/legacy-assets/step/step_3.jpg",
  },
  {
    id: "HON-05",
    title: "车辆模型竞赛二等奖",
    description: "驾驭未来全国青少年车辆模型教育竞赛 · 四驱车拼装竞速中学组",
    date: "2024-08",
    image: "/legacy-assets/step/step_1.jpg",
  },
];

/** Wavy river inside a 40x100 viewBox, stretched to the body height. */
const RIVER_PATH =
  "M20 0 C34 8 34 17 20 25 C6 33 6 42 20 50 C34 58 34 67 20 75 C6 83 6 92 20 100";

const SKELETON_COUNT = 3;

function formatDate(date: string): string {
  return date.replace(/-/g, ".");
}

/**
 * Timeline island — "成长河流 · The River So Far".
 *
 * Fetches /api/milestones on mount and lays the nodes out along a thin SVG
 * river: the stroke draws itself and the nodes rise in once the section
 * scrolls into view. On fetch failure it degrades to static fallback text
 * instead of breaking the page; reduced-motion users always get the fully
 * drawn, static river.
 */
export default function Timeline() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [flowing, setFlowing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/milestones", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as MilestonesResponse;
        if (cancelled) return;
        const sorted = [...(data.items ?? [])].sort((a, b) =>
          (a.date ?? "").localeCompare(b.date ?? ""),
        );
        if (sorted.length === 0) throw new Error("empty");
        setItems(sorted);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setItems(
          [...FALLBACK_ITEMS].sort((a, b) =>
            (a.date ?? "").localeCompare(b.date ?? ""),
          ),
        );
        setStatus("ready");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Draw the river once it scrolls into view (static under reduced motion).
  useEffect(() => {
    if (status !== "ready") return;
    const body = bodyRef.current;
    if (!body) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setFlowing(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFlowing(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(body);
    return () => observer.disconnect();
  }, [status]);

  return (
    <section className="tl" aria-label="成长河流时间线">
      <header className="tl__head">
        <p className="tl__kicker">growth river</p>
        <h2 className="tl__title">成长河流 · The River So Far</h2>
        <p className="tl__summary">
          把成长整理成一条更清晰的河流 — 每个节点，都是一段被记住的水路。
        </p>
      </header>

      {status === "loading" ? (
        <div className="tl__body" role="status" aria-label="载入中…">
          <ol className="tl__list">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <li
                className="tl__node tl__node--static"
                key={index}
                aria-hidden="true"
              >
                <span className="tl__dot tl__dot--skeleton" />
                <div className="tl__card tl__card--skeleton">
                  <span className="tl__skeleton-bar tl__skeleton-bar--chip" />
                  <span className="tl__skeleton-bar tl__skeleton-bar--title" />
                  <span className="tl__skeleton-bar" />
                  <span className="tl__skeleton-bar tl__skeleton-bar--photo" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : status === "error" || items.length === 0 ? (
        <div className="tl__fallback">
          <p className="tl__fallback-title">河流暂且搁浅</p>
          <p className="tl__fallback-text">
            成长节点暂时没有接上源头 — 先去下方看看奖状存档，或过一会儿再回来。
          </p>
        </div>
      ) : (
        <div
          ref={bodyRef}
          className={flowing ? "tl__body is-flowing" : "tl__body"}
        >
          <svg
            className="tl__river"
            viewBox="0 0 40 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="tl__river-path"
              d={RIVER_PATH}
              pathLength={1}
              fill="none"
            />
          </svg>
          <ol className="tl__list">
            {items.map((milestone, index) => {
              const photo =
                milestone.image ?? STEP_PHOTOS[index % STEP_PHOTOS.length];
              return (
                <li
                  className="tl__node"
                  key={milestone.id}
                  style={{ "--tl-i": index } as CSSProperties}
                >
                  <span className="tl__dot" aria-hidden="true" />
                  <article className="tl__card">
                    {milestone.date ? (
                      <span className="tl__date">
                        {formatDate(milestone.date)}
                      </span>
                    ) : null}
                    <h3 className="tl__card-title">{milestone.title}</h3>
                    {milestone.description ? (
                      <p className="tl__card-desc">{milestone.description}</p>
                    ) : null}
                    <img
                      className="tl__photo"
                      src={photo}
                      alt={`${milestone.title} · 成长照片`}
                      loading="lazy"
                      width={1000}
                      height={517}
                    />
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
