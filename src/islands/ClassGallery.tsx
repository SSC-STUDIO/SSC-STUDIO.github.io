import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_FETCH_OPTIONS } from "./api";
import { ClassLoginLock } from "./ClassSpace";

/**
 * Class gallery island — protected media grid with a self-drawn lightbox.
 *
 * Data strategy:
 * 1. Try `GET /api/class/media?limit=120` (session required). Media URLs
 *    then point at the protected `/api/class/media/:fileName/file` route.
 * 2. Static degradation: when the API answers 401 (logged out) or is
 *    unreachable, fall back to the public files under
 *    `/legacy-assets/my_classmate/` (hard-coded manifest below) and show a
 *    notice banner — logged-out visitors also get the p-lock login card.
 *
 * Grid: native lazy loading, uniform aspect ratio, cover crop, video
 * badge. Lightbox: fullscreen overlay, prev/next, ESC / backdrop click to
 * close, arrow-key navigation, focus restore on close.
 */

type MediaKind = "image" | "video";

type GalleryItem = {
  fileName: string;
  kind: MediaKind;
  title: string;
  url: string;
};

type ClassMediaResponse = {
  total: number;
  items: {
    id: string;
    fileName: string;
    kind: MediaKind;
    title: string;
    url: string;
  }[];
};

type Source = "api" | "static";
type LoadState = "loading" | "ready" | "error";

/**
 * Public manifest of `/legacy-assets/my_classmate/` (numeric jpg/png
 * photos plus a few mp4 clips), sorted numerically. Used only when the
 * protected API cannot serve the media list.
 */
const STATIC_MEDIA_FILES = [
  "0.jpg", "1.jpg", "2.jpg", "3.jpg", "7.jpg", "8.jpg", "9.jpg",
  "10.jpg", "11.jpg", "12.jpg", "13.jpg", "14.jpg", "15.jpg", "16.jpg",
  "17.jpg", "18.jpg", "19.jpg", "20.jpg", "22.mp4", "23.jpg", "33.jpg",
  "35.jpg", "36.jpg", "37.jpg", "38.jpg", "39.jpg", "40.jpg", "41.jpg",
  "42.jpg", "44.jpg", "45.jpg", "46.jpg", "47.jpg", "48.jpg", "49.jpg",
  "50.jpg", "51.jpg", "52.jpg", "54.jpg", "55.jpg", "56.jpg", "57.jpg",
  "58.jpg", "60.jpg", "61.jpg", "62.jpg", "63.jpg", "64.png", "65.mp4",
  "66.jpg", "67.jpg", "68.jpg", "69.jpg", "70.jpg", "71.jpg", "72.jpg",
  "73.jpg", "74.jpg", "75.jpg", "76.jpg", "77.jpg", "78.jpg", "79.jpg",
  "80.jpg", "81.jpg", "82.jpg", "83.jpg", "84.jpg", "85.jpg", "86.jpg",
  "87.mp4", "88.mp4", "89.jpg", "90.jpg", "91.jpg", "92.jpg", "93.jpg",
  "94.jpg", "95.jpg", "96.jpg", "98.mp4", "99.mp4", "100.jpg", "101.jpg",
  "102.jpg", "105.jpg",
];

const STATIC_ITEMS: GalleryItem[] = STATIC_MEDIA_FILES.map((fileName) => {
  const id = fileName.replace(/\.[^.]+$/, "");
  const kind: MediaKind = fileName.endsWith(".mp4") ? "video" : "image";
  return {
    fileName,
    kind,
    title: kind === "video" ? `班级视频 ${id}` : `班级照片 ${id}`,
    url: `/legacy-assets/my_classmate/${fileName}`,
  };
});

export default function ClassGallery() {
  const [load, setLoad] = useState<LoadState>("loading");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [source, setSource] = useState<Source>("api");
  const [unauthorized, setUnauthorized] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const loadMedia = useCallback(async () => {
    setLoad("loading");
    try {
      const response = await fetch("/api/class/media?limit=120", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (response.status === 401) {
        setUnauthorized(true);
        setSource("static");
        setItems(STATIC_ITEMS);
        setLoad("ready");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as ClassMediaResponse;
      const apiItems = Array.isArray(data.items) ? data.items : [];
      if (apiItems.length === 0) {
        // Empty archive (e.g. assets missing on the API host) — degrade
        // to the public manifest instead of showing a blank page.
        setSource("static");
        setItems(STATIC_ITEMS);
      } else {
        setSource("api");
        setItems(
          apiItems.map((item) => ({
            fileName: item.fileName,
            kind: item.kind,
            title: item.title,
            url: item.url,
          })),
        );
      }
      setLoad("ready");
    } catch {
      // API unreachable — static degradation.
      setSource("static");
      setItems(STATIC_ITEMS);
      setLoad("ready");
    }
  }, []);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const openAt = useCallback((index: number) => {
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelected(index);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    lastFocusedRef.current?.focus();
    lastFocusedRef.current = null;
  }, []);

  const step = useCallback(
    (direction: -1 | 1) => {
      setSelected((current) =>
        current === null || items.length === 0
          ? current
          : (current + direction + items.length) % items.length,
      );
    },
    [items.length],
  );

  useEffect(() => {
    if (selected === null) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, close, step]);

  const current = selected !== null ? items[selected] : null;

  return (
    <div className="p-class-gallery">
      {unauthorized ? (
        <ClassLoginLock message="完整相册通过受保护接口加载。当前展示的是公开预览；登录后获得完整浏览体验。" />
      ) : null}

      {source === "static" && !unauthorized ? (
        <p className="p-class-gallery__notice" role="status">
          API 暂时不可用——正在展示 /legacy-assets 下的公开媒体清单。
        </p>
      ) : null}

      {load === "loading" ? (
        <p className="p-class-gallery__state">正在载入相册…</p>
      ) : load === "error" ? (
        <div className="p-class-gallery__state">
          <p>相册没有载入成功。</p>
          <button
            type="button"
            className="p-class-gallery__retry"
            onClick={() => void loadMedia()}
          >
            再试一次
          </button>
        </div>
      ) : (
        <>
          <p className="p-class-gallery__count">
            共 {items.length} 项 · 点击任意一张打开灯箱（← → 切换，ESC 关闭）
          </p>
          <ul className="p-class-gallery__grid">
            {items.map((item, index) => (
              <li key={item.fileName}>
                <button
                  type="button"
                  className="p-class-gallery__item"
                  aria-label={`查看 ${item.title}`}
                  onClick={() => openAt(index)}
                >
                  {item.kind === "video" ? (
                    <video
                      className="p-class-gallery__thumb"
                      muted
                      playsInline
                      preload="metadata"
                      src={item.url}
                    />
                  ) : (
                    <img
                      className="p-class-gallery__thumb"
                      src={item.url}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className="p-class-gallery__no" aria-hidden="true">
                    {String(index + 1).padStart(3, "0")}
                  </span>
                  {item.kind === "video" ? (
                    <span className="p-class-gallery__badge">▶ 视频</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {current ? (
        <div
          className="p-class-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <button
            type="button"
            className="p-class-lightbox__backdrop"
            aria-label="关闭灯箱"
            onClick={close}
          />
          <div className="p-class-lightbox__panel">
            <div className="p-class-lightbox__bar">
              <span className="p-class-lightbox__counter">
                {(selected ?? 0) + 1} / {items.length}
              </span>
              <button
                type="button"
                className="p-class-lightbox__close"
                onClick={close}
                ref={closeRef}
              >
                关闭 ✕
              </button>
            </div>
            <figure className="p-class-lightbox__figure">
              {current.kind === "video" ? (
                <video
                  className="p-class-lightbox__media"
                  controls
                  playsInline
                  src={current.url}
                />
              ) : (
                <img
                  className="p-class-lightbox__media"
                  src={current.url}
                  alt={current.title}
                />
              )}
              <figcaption className="p-class-lightbox__caption">
                {current.title}
              </figcaption>
            </figure>
            <button
              type="button"
              className="p-class-lightbox__nav p-class-lightbox__nav--prev"
              aria-label="上一张"
              onClick={() => step(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="p-class-lightbox__nav p-class-lightbox__nav--next"
              aria-label="下一张"
              onClick={() => step(1)}
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
