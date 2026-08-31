import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_FETCH_OPTIONS } from "./api";
import { ClassLoginLock } from "./ClassSpace";

/**
 * Class gallery island — protected media grid with a self-drawn lightbox.
 *
 * Data strategy:
 * 1. Try `GET /api/class/media?limit=120` (session required). Media URLs
 *    then point at the protected `/api/class/media/:fileName/file` route.
 * 2. Unauthenticated or unreachable API: show the login lock only.
 *    Do not fall back to a public static classmate-photo list.
 *
 * Grid: native lazy loading, uniform aspect ratio, cover crop, video
 * badge, ink-wash skeleton that fades out once each thumb decodes.
 * Lightbox: fullscreen overlay, prev/next, ESC / backdrop click to close,
 * arrow keys + Home/End navigation, drag / swipe to step, Tab focus trap,
 * body scroll lock, spinner while the large media loads, adjacent images
 * preloaded, focus restore on close. Stepping slides the new frame in from
 * the direction of travel, like turning a page in an album.
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

type LoadState = "loading" | "ready" | "error";

/**
 * Grid thumbnail with its own loaded flag so the ink-wash skeleton on the
 * tile can fade away per item. The callback ref covers cached images that
 * complete before React attaches the load listener.
 */
function GalleryThumb({
  item,
  index,
  onOpen,
}: {
  item: GalleryItem;
  index: number;
  onOpen: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      className={`p-class-gallery__item${loaded ? " is-loaded" : ""}`}
      aria-label={`查看 ${item.title}`}
      onClick={() => onOpen(index)}
    >
      {item.kind === "video" ? (
        <video
          className="p-class-gallery__thumb"
          muted
          playsInline
          preload="metadata"
          src={item.url}
          onLoadedData={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : (
        <img
          className="p-class-gallery__thumb"
          src={item.url}
          alt={item.title}
          loading="lazy"
          decoding="async"
          ref={(element) => {
            if (element?.complete && element.naturalWidth > 0) {
              setLoaded(true);
            }
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
      <span className="p-class-gallery__no" aria-hidden="true">
        {String(index + 1).padStart(3, "0")}
      </span>
      {item.kind === "video" ? (
        <span className="p-class-gallery__badge">▶ 视频</span>
      ) : null}
    </button>
  );
}

export default function ClassGallery() {
  const [load, setLoad] = useState<LoadState>("loading");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  // URL of the lightbox media that finished loading — comparing against
  // the current item avoids reset races with cached images.
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  // 翻页方向：新帧从来处滑入，一眼看得出往前还是往后
  const [dir, setDir] = useState<-1 | 1>(1);
  // 拖拽位移（px），松手前画面跟着手走
  const [drag, setDrag] = useState(0);
  const dragRef = useRef<{ id: number; x: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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
        setItems([]);
        setLoad("ready");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as ClassMediaResponse;
      const apiItems = Array.isArray(data.items) ? data.items : [];
      setItems(
        apiItems.map((item) => ({
          fileName: item.fileName,
          kind: item.kind,
          title: item.title,
          url: item.url,
        })),
      );
      setLoad("ready");
    } catch {
      setItems([]);
      setLoad("error");
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
      setDir(direction);
      setSelected((current) =>
        current === null || items.length === 0
          ? current
          : (current + direction + items.length) % items.length,
      );
    },
    [items.length],
  );

  /* 拖拽翻页：一套指针事件同时吃下鼠标与触屏；
     视频上的手势留给原生控件，不抢它的进度条。 */
  const onDragStart = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("video")) return;
    dragRef.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onDragMove = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current || event.pointerId !== dragRef.current.id) return;
    setDrag(event.clientX - dragRef.current.x);
  }, []);

  const onDragEnd = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current || event.pointerId !== dragRef.current.id) return;
      const dx = event.clientX - dragRef.current.x;
      dragRef.current = null;
      setDrag(0);
      // 甩过一指宽才算翻页，免得轻轻一点就跳走
      if (Math.abs(dx) > 64) step(dx < 0 ? 1 : -1);
    },
    [step],
  );

  const lightboxOpen = selected !== null;

  // Keyboard: ESC close, ←/→ step, Home/End jump, Tab cycles inside the
  // dialog so focus never escapes to the page behind the overlay.
  useEffect(() => {
    if (!lightboxOpen) return;
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
      } else if (event.key === "Home") {
        event.preventDefault();
        setSelected((current) => (current === null ? current : 0));
      } else if (event.key === "End") {
        event.preventDefault();
        setSelected((current) =>
          current === null ? current : Math.max(0, items.length - 1),
        );
      } else if (event.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], video[controls]',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !root.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !root.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, close, step, items.length]);

  // Lock page scroll while the overlay is up.
  useEffect(() => {
    if (!lightboxOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lightboxOpen]);

  // Warm the browser cache for the two neighbours so stepping feels instant.
  useEffect(() => {
    if (selected === null || items.length < 2) return;
    for (const direction of [-1, 1]) {
      const neighbour =
        items[(selected + direction + items.length) % items.length];
      if (neighbour?.kind === "image") {
        const image = new Image();
        image.src = neighbour.url;
      }
    }
  }, [selected, items]);

  const current = selected !== null ? items[selected] : null;
  const mediaReady = current !== null && readyUrl === current.url;

  return (
    <div className="p-class-gallery">
      {unauthorized ? (
        <ClassLoginLock message="相册需要登录后通过受保护接口加载。未登录不会展示班级照片。" />
      ) : null}

      {unauthorized ? null : load === "loading" ? (
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
            共 {items.length} 项 ·
            点击任意一张打开灯箱（← → 或左右拖动切换，ESC 关闭）
          </p>
          <ul className="p-class-gallery__grid">
            {items.map((item, index) => (
              <li key={item.fileName}>
                <GalleryThumb item={item} index={index} onOpen={openAt} />
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
          ref={dialogRef}
        >
          <button
            type="button"
            className="p-class-lightbox__backdrop"
            aria-label="关闭灯箱"
            onClick={close}
          />
          <div className="p-class-lightbox__panel">
            <div className="p-class-lightbox__bar">
              <span
                className="p-class-lightbox__counter"
                aria-live="polite"
              >
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
            <figure
              className={`p-class-lightbox__figure${
                mediaReady ? "" : " is-loading"
              }${drag !== 0 ? " is-dragging" : ""}`}
              data-dir={dir > 0 ? "next" : "prev"}
              style={{ "--drag-x": `${drag}px` } as React.CSSProperties}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              {current.kind === "video" ? (
                // key forces a remount per file so the previous clip stops
                // playing the moment the visitor steps to the next item.
                <video
                  key={current.fileName}
                  className="p-class-lightbox__media"
                  controls
                  playsInline
                  preload="metadata"
                  src={current.url}
                  onLoadedData={() => setReadyUrl(current.url)}
                  onError={() => setReadyUrl(current.url)}
                />
              ) : (
                <img
                  key={current.fileName}
                  className="p-class-lightbox__media"
                  src={current.url}
                  alt={current.title}
                  ref={(element) => {
                    if (element?.complete && element.naturalWidth > 0) {
                      setReadyUrl(current.url);
                    }
                  }}
                  onLoad={() => setReadyUrl(current.url)}
                  onError={() => setReadyUrl(current.url)}
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
