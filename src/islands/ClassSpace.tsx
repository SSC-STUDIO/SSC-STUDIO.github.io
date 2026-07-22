import { useCallback, useEffect, useState } from "react";
import { AUTH_FETCH_OPTIONS, type AuthSession } from "./api";

/**
 * Class space island — members-only overview of the class archive.
 *
 * Flow: check `/api/auth/session` first, then branch on `user.role`:
 * - logged-out visitors get a p-lock login card;
 * - `student` (logged in but not on the class roster) gets a notice card
 *   explaining that a roster-matching `realName` unlocks the space;
 * - `member` / `admin` get the space stats (media / members / comments),
 *   the dual message boards (from-owner read-only + to-owner
 *   interactive), the member profile grid and the class comment wall.
 *
 * Data: `GET /api/class/summary` + `GET /api/class/profiles` (both answer
 * 401 without a session). Comments hang off `/api/comments` with
 * targetKind `class-space` and target ids `from-owner` / `to-owner` /
 * `wall`, mirroring the guestbook interaction model (list, post, reply
 * threads, optimistic likes).
 *
 * `ClassComments` is exported as a named export so the profile island can
 * reuse the exact same thread logic with targetKind `profile`.
 */

type SessionState = "loading" | "out" | "student" | "in";
type LoadState = "loading" | "error" | "ready";

type ClassSummary = {
  media: { total: number; images: number; videos: number; bytes: number };
  profiles: { total: number; students: number; teachers: number };
  comments: { total: number };
};

type ClassProfileDto = {
  slug: string;
  name: string;
  role: "student" | "teacher";
  bio: string;
  message?: string;
  tags: string[];
  visits?: { total: number; lastVisitedAt?: string };
};

type ProfilesResponse = {
  total: number;
  items: ClassProfileDto[];
};

export type ClassComment = {
  id: string;
  targetKind: string;
  targetId: string;
  parentId?: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  liked: boolean;
  replies: ClassComment[];
};

type CommentsResponse = {
  total: number;
  items: ClassComment[];
};

const MAX_LENGTH = 2000;
const LOGIN_PATH = "/account";

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** One-line excerpt for the profile cards in the grid. */
function bioExcerpt(bio: string): string {
  const firstLine = bio
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0];
  if (!firstLine) return "这位成员还没有留下简介。";
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

export function roleLabel(role: "student" | "teacher"): string {
  return role === "teacher" ? "老师" : "同学";
}

/** Apply `fn` to the comment or reply with the given id. */
function updateComment(
  list: ClassComment[],
  id: string,
  fn: (comment: ClassComment) => ClassComment,
): ClassComment[] {
  return list.map((comment) => {
    if (comment.id === id) return fn(comment);
    if (comment.replies.some((reply) => reply.id === id)) {
      return {
        ...comment,
        replies: comment.replies.map((reply) =>
          reply.id === id ? fn(reply) : reply,
        ),
      };
    }
    return comment;
  });
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

type ClassCommentsProps = {
  targetKind: "class-space" | "profile";
  targetId: string;
  title: string;
  /**
   * Read-only feed: no composer, no likes, no reply form. Threads can
   * still be expanded to read existing replies. Used for the owner's
   * `from-owner` board.
   */
  readOnly?: boolean;
  /** Badge chip rendered next to each top-level author (e.g. 「站长」). */
  authorBadge?: string;
  /** Empty-feed placeholder copy. */
  emptyMessage?: string;
};

/**
 * Comment wall used by the class space (targetKind `class-space`) and by
 * profile pages (targetKind `profile`). Posting, replying and liking all
 * require the session the parent island already verified; a mid-session
 * 401 surfaces an expired-session notice with a login link.
 */
export function ClassComments({
  targetKind,
  targetId,
  title,
  readOnly = false,
  authorBadge,
  emptyMessage,
}: ClassCommentsProps) {
  const [feed, setFeed] = useState<LoadState>("loading");
  const [comments, setComments] = useState<ClassComment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setFeed("loading");
    try {
      const params = new URLSearchParams({ targetKind, targetId });
      const response = await fetch(`/api/comments?${params.toString()}`, {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as CommentsResponse;
      setComments(Array.isArray(data.items) ? data.items : []);
      setFeed("ready");
    } catch {
      setFeed("error");
    }
  }, [targetKind, targetId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handlePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      setNotice("先写点什么，再发布。");
      return;
    }
    setPosting(true);
    setNotice("");
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ targetKind, targetId, content }),
      });
      if (response.status === 401) {
        setNotice("会话已失效，请重新登录后再发布。");
        return;
      }
      if (response.status === 429) {
        setNotice("发布太频繁了，歇一会儿再写。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const created = (await response.json()) as ClassComment;
      setComments((current) => [created, ...current]);
      setDraft("");
    } catch {
      setNotice("发布失败，请检查网络后重试。");
    } finally {
      setPosting(false);
    }
  }

  async function handleReplySubmit(
    event: React.FormEvent<HTMLFormElement>,
    parentId: string,
  ) {
    event.preventDefault();
    const content = (replyDrafts[parentId] ?? "").trim();
    if (!content) return;
    setReplyBusyId(parentId);
    setNotice("");
    try {
      const response = await fetch(
        `/api/comments/${encodeURIComponent(parentId)}/replies`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );
      if (response.status === 401) {
        setNotice("会话已失效，请重新登录后再回复。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const created = (await response.json()) as ClassComment;
      setComments((current) =>
        updateComment(current, parentId, (comment) => ({
          ...comment,
          replies: [...comment.replies, created],
        })),
      );
      setReplyDrafts((current) => ({ ...current, [parentId]: "" }));
    } catch {
      setNotice("回复没有发出去，请重试。");
    } finally {
      setReplyBusyId(null);
    }
  }

  async function handleLike(comment: ClassComment) {
    if (likeBusyId === comment.id) return;
    const previousLiked = comment.liked;
    const previousCount = comment.likesCount;
    const nextLiked = !previousLiked;
    setLikeBusyId(comment.id);
    setNotice("");
    // Optimistic toggle, rolled back on failure.
    setComments((current) =>
      updateComment(current, comment.id, (item) => ({
        ...item,
        liked: nextLiked,
        likesCount: Math.max(0, item.likesCount + (nextLiked ? 1 : -1)),
      })),
    );
    try {
      const response = await fetch(
        `/api/comments/${encodeURIComponent(comment.id)}/likes`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ liked: nextLiked }),
        },
      );
      if (response.status === 401) {
        setComments((current) =>
          updateComment(current, comment.id, (item) => ({
            ...item,
            liked: previousLiked,
            likesCount: previousCount,
          })),
        );
        setNotice("会话已失效，请重新登录后再点赞。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as {
        liked: boolean;
        likesCount: number;
      };
      setComments((current) =>
        updateComment(current, comment.id, (item) => ({
          ...item,
          liked: data.liked,
          likesCount: data.likesCount,
        })),
      );
    } catch {
      setComments((current) =>
        updateComment(current, comment.id, (item) => ({
          ...item,
          liked: previousLiked,
          likesCount: previousCount,
        })),
      );
      setNotice("点赞没有点上，请重试。");
    } finally {
      setLikeBusyId(null);
    }
  }

  return (
    <div className="p-class-comments">
      {readOnly ? null : (
        <form
          className="p-form p-class-comments__form"
          noValidate
          onSubmit={handlePost}
        >
          <label>
            {title}
            <textarea
              name="content"
              required
              maxLength={MAX_LENGTH}
              placeholder="写点什么，留在这个房间里。"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button type="submit" disabled={posting}>
            {posting ? "发布中…" : "发布留言"}
          </button>
        </form>
      )}

      <p className="p-class-comments__notice" role="alert" hidden={!notice}>
        {notice}
      </p>

      {feed === "loading" ? (
        <p className="p-class-comments__state">正在载入留言…</p>
      ) : feed === "error" ? (
        <div className="p-class-comments__state">
          <p>留言暂时没有载入。</p>
          <button
            type="button"
            className="p-class-comments__retry"
            onClick={() => void loadComments()}
          >
            再试一次
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="p-class-comments__state">
          {emptyMessage ?? "还没有留言——做第一个写下回忆的人。"}
        </p>
      ) : (
        <ol className="p-class-comments__list">
          {comments.map((comment) => {
            const threadOpen = Boolean(openThreads[comment.id]);
            const hasReplies = comment.replies.length > 0;
            return (
              <li className="p-class-comments__item" key={comment.id}>
                <div className="p-class-comments__meta">
                  <span className="p-class-comments__author">
                    {comment.authorName}
                  </span>
                  {authorBadge ? (
                    <span className="p-class-comments__badge">
                      {authorBadge}
                    </span>
                  ) : null}
                  <time
                    className="p-class-comments__time"
                    dateTime={comment.createdAt}
                  >
                    {formatTime(comment.createdAt)}
                  </time>
                </div>
                <p className="p-class-comments__content">{comment.content}</p>
                {!readOnly || hasReplies ? (
                  <div className="p-class-comments__actions">
                    {readOnly ? null : (
                      <button
                        type="button"
                        className={`p-class-comments__like${
                          comment.liked ? " is-liked" : ""
                        }`}
                        aria-pressed={comment.liked}
                        aria-label={`点赞，当前 ${comment.likesCount} 个赞`}
                        disabled={likeBusyId === comment.id}
                        onClick={() => void handleLike(comment)}
                      >
                        ♥ {comment.likesCount}
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-class-comments__action"
                      aria-expanded={threadOpen}
                      onClick={() =>
                        setOpenThreads((current) => ({
                          ...current,
                          [comment.id]: !current[comment.id],
                        }))
                      }
                    >
                      {threadOpen
                        ? "收起"
                        : hasReplies
                          ? `回复 · ${comment.replies.length}`
                          : "回复"}
                    </button>
                  </div>
                ) : null}

                {threadOpen ? (
                  <div className="p-class-comments__thread">
                    {hasReplies ? (
                      <ol className="p-class-comments__replies">
                        {comment.replies.map((reply) => (
                          <li
                            className="p-class-comments__reply"
                            key={reply.id}
                          >
                            <div className="p-class-comments__meta">
                              <span className="p-class-comments__author">
                                {reply.authorName}
                              </span>
                              <time
                                className="p-class-comments__time"
                                dateTime={reply.createdAt}
                              >
                                {formatTime(reply.createdAt)}
                              </time>
                            </div>
                            <p className="p-class-comments__content">
                              {reply.content}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {readOnly ? null : (
                      <form
                        className="p-form p-class-comments__reply-form"
                        noValidate
                        onSubmit={(event) =>
                          void handleReplySubmit(event, comment.id)
                        }
                      >
                        <label>
                          回复 {comment.authorName}
                          <textarea
                            name="reply"
                            required
                            maxLength={MAX_LENGTH}
                            value={replyDrafts[comment.id] ?? ""}
                            onChange={(event) =>
                              setReplyDrafts((current) => ({
                                ...current,
                                [comment.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={replyBusyId === comment.id}
                        >
                          {replyBusyId === comment.id ? "发送中…" : "发送回复"}
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login gate (shared copy with the gallery / profile islands)         */
/* ------------------------------------------------------------------ */

export function ClassLoginLock({ message }: { message: string }) {
  return (
    <div className="p-lock">
      <p className="p-lock__badge">members only</p>
      <p className="p-lock__message">{message}</p>
      <div className="p-card__actions">
        <a className="p-card__link" href={LOGIN_PATH}>
          登录账号
        </a>
        <a className="p-card__link p-card__link--ghost" href="/class/gallery">
          公开画廊预览
        </a>
      </div>
    </div>
  );
}

/**
 * Notice for logged-in `student` accounts: the session is valid but the
 * registered real name has not matched the class roster, so the space
 * stays locked until it does (or the owner is asked to check the roster).
 */
function ClassStudentNotice() {
  return (
    <div className="p-class__student">
      <p className="p-class__student-badge">class roster</p>
      <p className="p-class__student-title">
        已登录，但还没有匹配到班级名单
      </p>
      <p className="p-class__student-message">
        注册时填写的真实姓名与班级名单一致后自动解锁。
        如果你是我们班的同学，可以联系站长核对名单。
      </p>
      <div className="p-card__actions">
        <a className="p-card__link" href="/contact">
          联系站长
        </a>
        <a className="p-card__link p-card__link--ghost" href="/class/gallery">
          公开画廊预览
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Class space                                                         */
/* ------------------------------------------------------------------ */

export default function ClassSpace() {
  const [session, setSession] = useState<SessionState>("loading");
  const [load, setLoad] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [profiles, setProfiles] = useState<ClassProfileDto[]>([]);

  const loadSpace = useCallback(async () => {
    setLoad("loading");
    try {
      const [summaryResponse, profilesResponse] = await Promise.all([
        fetch("/api/class/summary", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        }),
        fetch("/api/class/profiles?limit=120", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        }),
      ]);
      if (summaryResponse.status === 401 || profilesResponse.status === 401) {
        setSession("out");
        return;
      }
      if (!summaryResponse.ok || !profilesResponse.ok) throw new Error("failed");
      const summaryData = (await summaryResponse.json()) as ClassSummary;
      const profilesData = (await profilesResponse.json()) as ProfilesResponse;
      setSummary(summaryData);
      setProfiles(
        Array.isArray(profilesData.items) ? profilesData.items : [],
      );
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        });
        const data = (await response.json()) as AuthSession;
        if (cancelled) return;
        if (data.authenticated && data.user) {
          // Only roster-verified members (and the owner) open the space;
          // a plain student account gets the roster notice instead.
          if (data.user.role === "member" || data.user.role === "admin") {
            setSession("in");
            void loadSpace();
          } else {
            setSession("student");
          }
        } else {
          setSession("out");
        }
      } catch {
        if (!cancelled) setSession("out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSpace]);

  if (session === "loading") {
    return (
      <div className="p-class">
        <p className="p-class__state">正在检查会话…</p>
      </div>
    );
  }

  if (session === "out") {
    return (
      <div className="p-class">
        <ClassLoginLock message="班级空间为成员专属区域——相册、同学档案与班级留言，登录后完整开放。" />
      </div>
    );
  }

  if (session === "student") {
    return (
      <div className="p-class">
        <ClassStudentNotice />
      </div>
    );
  }

  return (
    <div className="p-class">
      {load === "loading" ? (
        <p className="p-class__state">正在打开班级空间…</p>
      ) : load === "error" ? (
        <div className="p-class__state">
          <p>空间数据没有载入成功。</p>
          <button
            type="button"
            className="p-class__retry"
            onClick={() => void loadSpace()}
          >
            再试一次
          </button>
        </div>
      ) : summary ? (
        <>
          <dl className="p-class__metrics">
            <div className="p-class__metric">
              <dt>媒体</dt>
              <dd>{summary.media.total}</dd>
              <dd className="p-class__metric-sub">
                照片 {summary.media.images} · 视频 {summary.media.videos}
              </dd>
              <a className="p-class__metric-link" href="/class/gallery">
                进入画廊 →
              </a>
            </div>
            <div className="p-class__metric">
              <dt>成员</dt>
              <dd>{summary.profiles.total}</dd>
              <dd className="p-class__metric-sub">
                同学 {summary.profiles.students} · 老师{" "}
                {summary.profiles.teachers}
              </dd>
            </div>
            <div className="p-class__metric">
              <dt>留言</dt>
              <dd>{summary.comments.total}</dd>
              <dd className="p-class__metric-sub">班级空间的全部留言</dd>
            </div>
          </dl>

          <section className="p-class__section">
            <div className="p-class__section-head">
              <p className="p-card__kicker">letters</p>
              <h2 className="p-class__section-title">双向留言墙</h2>
            </div>
            <div className="p-class-boards">
              <section className="p-class-boards__panel p-class-boards__panel--owner">
                <header className="p-class-boards__head">
                  <p className="p-class-boards__kicker">from-owner</p>
                  <h3 className="p-class-boards__title">我想对你说</h3>
                  <p className="p-class-boards__note">
                    站长写给同学的话，只读陈列于此。
                  </p>
                </header>
                <ClassComments
                  targetKind="class-space"
                  targetId="from-owner"
                  title="站长的话"
                  readOnly
                  authorBadge="站长"
                  emptyMessage="站长还没有写下什么——先去翻翻相册吧。"
                />
              </section>
              <section className="p-class-boards__panel">
                <header className="p-class-boards__head">
                  <p className="p-class-boards__kicker">to-owner</p>
                  <h3 className="p-class-boards__title">写给我</h3>
                  <p className="p-class-boards__note">
                    同学写给站长的留言，可以回复与点赞。
                  </p>
                </header>
                <ClassComments
                  targetKind="class-space"
                  targetId="to-owner"
                  title="写下想对站长说的话"
                  emptyMessage="还没有人写信给我——做第一个提笔的人。"
                />
              </section>
            </div>
          </section>

          <section className="p-class__section">
            <div className="p-class__section-head">
              <p className="p-card__kicker">people</p>
              <h2 className="p-class__section-title">成员档案</h2>
            </div>
            {profiles.length === 0 ? (
              <p className="p-class__state">档案还在整理中。</p>
            ) : (
              <div className="p-class__profiles">
                {profiles.map((profile) => (
                  <a
                    className="p-class__profile"
                    href={`/class/profiles/${encodeURIComponent(profile.slug)}`}
                    key={profile.slug}
                  >
                    <span className="p-class__profile-top">
                      <span
                        className={`p-class__profile-role${
                          profile.role === "teacher" ? " is-teacher" : ""
                        }`}
                      >
                        {roleLabel(profile.role)}
                      </span>
                      <span className="p-class__profile-slug">
                        {profile.slug}
                      </span>
                    </span>
                    <span className="p-class__profile-name">
                      {profile.name}
                    </span>
                    <span className="p-class__profile-bio">
                      {bioExcerpt(profile.bio)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="p-class__section">
            <div className="p-class__section-head">
              <p className="p-card__kicker">comments</p>
              <h2 className="p-class__section-title">班级留言</h2>
            </div>
            <ClassComments
              targetKind="class-space"
              targetId="wall"
              title="写下一条班级留言"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
