import { useCallback, useEffect, useState } from "react";
import { AUTH_FETCH_OPTIONS } from "./api";
import {
  ClassComments,
  ClassLoginLock,
  ClassOfflineNotice,
  roleLabel,
} from "./ClassSpace";

/**
 * Class profile island — one member's file inside the class space.
 *
 * The Astro route hands over the raw `slug` param; everything else is
 * client-side: `GET /api/class/profiles/:slug` (401 → login lock, 404 →
 * not-found card), then a single `POST /api/profile-visits/:slug` to
 * count the visit. The comment wall reuses `ClassComments` from the
 * class space island with targetKind `profile`.
 */

type LoadState =
  | "loading"
  | "ready"
  | "out"
  | "notfound"
  | "unavailable"
  | "error";

type ClassProfileDto = {
  slug: string;
  name: string;
  role: "student" | "teacher";
  bio: string;
  message?: string;
  tags: string[];
  visits?: { total: number; lastVisitedAt?: string };
};

type Visits = {
  total: number;
  lastVisitedAt?: string;
};

/** Slugs already counted this page load — the visit POST fires once. */
const countedVisits = new Set<string>();

function formatTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function ClassProfile({ slug }: { slug: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<ClassProfileDto | null>(null);
  const [visits, setVisits] = useState<Visits | null>(null);

  const loadProfile = useCallback(async () => {
    if (!slug) {
      setLoad("notfound");
      return;
    }
    setLoad("loading");
    try {
      const response = await fetch(
        `/api/class/profiles/${encodeURIComponent(slug)}`,
        { ...AUTH_FETCH_OPTIONS, cache: "no-store" },
      );
      if (response.status === 401) {
        setLoad("out");
        return;
      }
      if (response.status === 404) {
        setLoad("notfound");
        return;
      }
      if (response.status === 503) {
        setLoad("unavailable");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as ClassProfileDto;
      setProfile(data);
      setVisits(data.visits ?? null);
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, [slug]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Put the member's name in the tab title once the profile is readable.
  useEffect(() => {
    if (!profile) return;
    const previous = document.title;
    document.title = `${profile.name} · Class Profile · 陈润森`;
    return () => {
      document.title = previous;
    };
  }, [profile]);

  // Count the visit exactly once per slug per page load.
  useEffect(() => {
    if (!profile || countedVisits.has(profile.slug)) return;
    countedVisits.add(profile.slug);
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/profile-visits/${encodeURIComponent(profile.slug)}`,
          {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) return;
        const data = (await response.json()) as Visits;
        if (!cancelled) setVisits(data);
      } catch {
        // Visit counting is nice-to-have; keep the profile readable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (load === "loading") {
    return (
      <div className="p-class-profile">
        <p className="p-class-profile__state">正在打开档案…</p>
      </div>
    );
  }

  if (load === "out") {
    return (
      <div className="p-class-profile">
        <ClassLoginLock message="同学档案为成员专属内容，登录后即可查看。" />
      </div>
    );
  }

  if (load === "notfound") {
    return (
      <div className="p-class-profile">
        <div className="p-lock">
          <p className="p-lock__badge">not found</p>
          <p className="p-lock__message">
            没有找到「{slug}」这份档案——它可能已被移出班级空间。
          </p>
          <div className="p-card__actions">
            <a className="p-card__link" href="/class">
              返回班级空间
            </a>
            <a
              className="p-card__link p-card__link--ghost"
              href="/class/gallery"
            >
              班级画廊
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (load === "unavailable") {
    return (
      <div className="p-class-profile">
        <ClassOfflineNotice
          message="档案服务暂时不可用——不是你的问题，稍后再回来看看。"
          onRetry={() => void loadProfile()}
        />
      </div>
    );
  }

  if (load === "error" || !profile) {
    return (
      <div className="p-class-profile">
        <div className="p-class-profile__state">
          <p>档案没有载入成功，可能是网络波动。</p>
          <button
            type="button"
            className="p-class-profile__retry"
            onClick={() => void loadProfile()}
          >
            再试一次
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-class-profile">
      <p className="p-class-profile__back">
        <a href="/class">← 返回班级空间</a>
      </p>

      <header className="p-class-profile__head">
        <span
          className={`p-class-profile__role${
            profile.role === "teacher" ? " is-teacher" : ""
          }`}
        >
          {roleLabel(profile.role)}
        </span>
        <h2 className="p-class-profile__name">{profile.name}</h2>
        <p className="p-class-profile__slug">{profile.slug}</p>
        {profile.tags.length > 0 ? (
          <p className="p-class-profile__tags">
            {profile.tags.map((tag) => (
              <span className="p-class-profile__tag" key={tag}>
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </header>

      <div className="p-class-profile__layout">
        <section className="p-class-profile__panel">
          <p className="p-card__kicker">bio</p>
          <h3 className="p-class-profile__panel-title">简介</h3>
          <div className="p-class-profile__copy">
            {paragraphs(profile.bio).length > 0 ? (
              paragraphs(profile.bio).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            ) : (
              <p>这位成员还没有留下简介。</p>
            )}
          </div>
        </section>

        <aside className="p-class-profile__panel p-class-profile__panel--side">
          <p className="p-card__kicker">status</p>
          <dl className="p-class-profile__facts">
            <div>
              <dt>到访次数</dt>
              <dd>{visits ? visits.total : "—"}</dd>
            </div>
            <div>
              <dt>最近到访</dt>
              <dd>{formatTime(visits?.lastVisitedAt)}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{roleLabel(profile.role)}</dd>
            </div>
          </dl>
        </aside>

        <section className="p-class-profile__panel p-class-profile__panel--message">
          <p className="p-card__kicker">message</p>
          <h3 className="p-class-profile__panel-title">留言文本</h3>
          <div className="p-class-profile__copy">
            {profile.message ? (
              paragraphs(profile.message).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            ) : (
              <p>暂无留言文本。</p>
            )}
          </div>
        </section>
      </div>

      <section className="p-class-profile__panel">
        <p className="p-card__kicker">comments</p>
        <h3 className="p-class-profile__panel-title">
          给 {profile.name} 的留言
        </h3>
        <ClassComments
          targetKind="profile"
          targetId={profile.slug}
          title={`给 ${profile.name} 写一条留言`}
        />
      </section>

      <p className="p-class-profile__back">
        <a href="/class">← 返回班级空间</a>
      </p>
    </div>
  );
}
