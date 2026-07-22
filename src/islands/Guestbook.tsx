import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTH_FETCH_OPTIONS, type AuthSession } from "./api";

/**
 * Guestbook island — public comment feed with login-gated posting,
 * replies and likes.
 *
 * Backend: `GET/POST /api/comments`. The API only accepts a fixed set of
 * target kinds (`site`, `class-space`, `class-media`, `profile`,
 * `comment`), so the guestbook feed hangs off the public `site` kind
 * with target id `guestbook`. Replies use
 * `POST /api/comments/:commentId/replies`, likes use
 * `PUT /api/comments/:commentId/likes` (auth required, 401 otherwise).
 *
 * The feed itself is public; posting / replying / liking require a
 * session. Unauthenticated visitors get a `p-lock` style login prompt
 * that routes to `/account`.
 */

type CommentDto = {
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
  replies: CommentDto[];
};

type CommentsResponse = {
  total: number;
  items: CommentDto[];
};

type SessionState = "loading" | "out" | "in";
type FeedState = "loading" | "error" | "ready";

const TARGET_KIND = "site";
const TARGET_ID = "guestbook";
const LIST_URL = `/api/comments?targetKind=${TARGET_KIND}&targetId=${TARGET_ID}`;
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

/** Apply `fn` to the comment or reply with the given id. */
function updateComment(
  list: CommentDto[],
  id: string,
  fn: (comment: CommentDto) => CommentDto,
): CommentDto[] {
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

type CommentItemProps = {
  comment: CommentDto;
  canInteract: boolean;
  threadOpen: boolean;
  replyDraft: string;
  replyBusy: boolean;
  likeBusy: boolean;
  onToggleThread: (id: string) => void;
  onReplyDraftChange: (id: string, value: string) => void;
  onReplySubmit: (
    event: React.FormEvent<HTMLFormElement>,
    parentId: string,
  ) => void;
  onLike: (comment: CommentDto) => void;
};

function LikeButton({
  comment,
  busy,
  onLike,
}: {
  comment: CommentDto;
  busy: boolean;
  onLike: (comment: CommentDto) => void;
}) {
  return (
    <button
      type="button"
      className={`p-guestbook__like${comment.liked ? " is-liked" : ""}`}
      aria-pressed={comment.liked}
      aria-label={`点赞，当前 ${comment.likesCount} 个赞`}
      disabled={busy}
      onClick={() => onLike(comment)}
    >
      ♥ {comment.likesCount}
    </button>
  );
}

function CommentItem({
  comment,
  canInteract,
  threadOpen,
  replyDraft,
  replyBusy,
  likeBusy,
  onToggleThread,
  onReplyDraftChange,
  onReplySubmit,
  onLike,
}: CommentItemProps) {
  return (
    <li className="p-guestbook__item">
      <div className="p-guestbook__meta">
        <span className="p-guestbook__author">{comment.authorName}</span>
        <time className="p-guestbook__time" dateTime={comment.createdAt}>
          {formatTime(comment.createdAt)}
        </time>
      </div>
      <p className="p-guestbook__content">{comment.content}</p>
      <div className="p-guestbook__actions">
        <LikeButton comment={comment} busy={likeBusy} onLike={onLike} />
        <button
          type="button"
          className="p-guestbook__action"
          aria-expanded={threadOpen}
          onClick={() => onToggleThread(comment.id)}
        >
          {threadOpen
            ? "收起"
            : comment.replies.length > 0
              ? `回复 · ${comment.replies.length}`
              : "回复"}
        </button>
      </div>

      {threadOpen ? (
        <div className="p-guestbook__thread">
          {comment.replies.length > 0 ? (
            <ol className="p-guestbook__replies">
              {comment.replies.map((reply) => (
                <li key={reply.id} className="p-guestbook__reply">
                  <div className="p-guestbook__meta">
                    <span className="p-guestbook__author">
                      {reply.authorName}
                    </span>
                    <time
                      className="p-guestbook__time"
                      dateTime={reply.createdAt}
                    >
                      {formatTime(reply.createdAt)}
                    </time>
                  </div>
                  <p className="p-guestbook__content">{reply.content}</p>
                  <div className="p-guestbook__actions">
                    <LikeButton comment={reply} busy={likeBusy} onLike={onLike} />
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {canInteract ? (
            <form
              className="p-form p-guestbook__reply-form"
              noValidate
              onSubmit={(event) => onReplySubmit(event, comment.id)}
            >
              <label>
                回复 {comment.authorName}
                <textarea
                  name="reply"
                  required
                  maxLength={MAX_LENGTH}
                  value={replyDraft}
                  onChange={(event) =>
                    onReplyDraftChange(comment.id, event.target.value)
                  }
                />
              </label>
              <button type="submit" disabled={replyBusy}>
                {replyBusy ? "发送中…" : "发送回复"}
              </button>
            </form>
          ) : (
            <p className="p-guestbook__hint">
              <a href={LOGIN_PATH}>登录</a> 后即可回复这条留言。
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function Guestbook() {
  const [session, setSession] = useState<SessionState>("loading");
  const [feed, setFeed] = useState<FeedState>("loading");
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);

  const sortedComments = useMemo(
    () =>
      [...comments].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    [comments],
  );

  const loadComments = useCallback(async () => {
    setFeed("loading");
    try {
      const response = await fetch(LIST_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as CommentsResponse;
      setComments(Array.isArray(data.items) ? data.items : []);
      setFeed("ready");
    } catch {
      setFeed("error");
    }
  }, []);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        });
        const data = (await response.json()) as AuthSession;
        if (!cancelled) {
          setSession(data.authenticated && data.user ? "in" : "out");
        }
      } catch {
        if (!cancelled) setSession("out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      setNotice("先写点什么，再把脚印放下。");
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
        body: JSON.stringify({
          targetKind: TARGET_KIND,
          targetId: TARGET_ID,
          content,
        }),
      });
      if (response.status === 401) {
        setSession("out");
        setNotice("会话已失效，请重新登录后再发布。");
        return;
      }
      if (response.status === 429) {
        setNotice("脚印太密了，歇一会儿再写。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const created = (await response.json()) as CommentDto;
      setComments((current) => [created, ...current]);
      setDraft("");
    } catch {
      setNotice("发布失败，请检查网络后重试。");
    } finally {
      setPosting(false);
    }
  }

  function handleToggleThread(id: string) {
    setOpenThreads((current) => ({ ...current, [id]: !current[id] }));
  }

  function handleReplyDraftChange(id: string, value: string) {
    setReplyDrafts((current) => ({ ...current, [id]: value }));
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
        setSession("out");
        setNotice("会话已失效，请重新登录后再回复。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const created = (await response.json()) as CommentDto;
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

  async function handleLike(comment: CommentDto) {
    if (session !== "in") {
      window.location.href = LOGIN_PATH;
      return;
    }
    if (likeBusyId === comment.id) return;
    const previousLiked = comment.liked;
    const previousCount = comment.likesCount;
    const nextLiked = !previousLiked;
    setLikeBusyId(comment.id);
    setNotice("");
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
        window.location.href = LOGIN_PATH;
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
    <div className="p-guestbook">
      {session === "loading" ? (
        <p className="p-guestbook__hint">正在检查会话…</p>
      ) : session === "out" ? (
        <div className="p-lock">
          <p className="p-lock__badge">login required</p>
          <p className="p-lock__message">
            登录后即可在河边留下脚印，也能给喜欢的留言点赞、回复。
          </p>
          <div className="p-card__actions">
            <a className="p-card__link" href={LOGIN_PATH}>
              去登录
            </a>
          </div>
        </div>
      ) : (
        <form
          className="p-form p-guestbook__composer"
          noValidate
          onSubmit={handlePost}
        >
          <label>
            写下你的脚印
            <textarea
              name="content"
              required
              maxLength={MAX_LENGTH}
              placeholder="问题、想法、路过的心情，都欢迎。"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button type="submit" disabled={posting}>
            {posting ? "发布中…" : "发布留言"}
          </button>
        </form>
      )}

      <p className="p-guestbook__notice" role="alert" hidden={!notice}>
        {notice}
      </p>

      {feed === "loading" ? (
        <p className="p-guestbook__state">正在打捞河边的脚印…</p>
      ) : feed === "error" ? (
        <div className="p-guestbook__state">
          <p>留言暂时没有捞上来。</p>
          <button
            type="button"
            className="p-guestbook__retry"
            onClick={() => void loadComments()}
          >
            再试一次
          </button>
        </div>
      ) : sortedComments.length === 0 ? (
        <p className="p-guestbook__state">
          河面还很安静——做第一个留下脚印的人。
        </p>
      ) : (
        <ol className="p-guestbook__list">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canInteract={session === "in"}
              threadOpen={Boolean(openThreads[comment.id])}
              replyDraft={replyDrafts[comment.id] ?? ""}
              replyBusy={replyBusyId === comment.id}
              likeBusy={likeBusyId === comment.id}
              onToggleThread={handleToggleThread}
              onReplyDraftChange={handleReplyDraftChange}
              onReplySubmit={handleReplySubmit}
              onLike={handleLike}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
