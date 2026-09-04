import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTH_FETCH_OPTIONS, type AuthSession } from "./api";
import {
  AttachmentPicker,
  MediaEmbed,
  resolveSafeMediaUrl,
  uploadAttachment,
  type AttachmentMeta,
} from "./media";
import { formatTime } from "../utils/format-time";

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
 * that routes to `/account?returnTo=/guestbook`. A 503 / network failure
 * is an honest offline card, not a login lock.
 */

type CommentDto = {
  id: string;
  targetKind: string;
  targetId: string;
  parentId?: string;
  authorName: string;
  content: string;
  attachment?: AttachmentMeta;
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

type PeerDto = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
};

type Visibility = "public" | "private";

type SessionState = "loading" | "out" | "in" | "unavailable";
type FeedState = "loading" | "error" | "unavailable" | "ready";
type NoticeKind = "error" | "ok";

const TARGET_KIND = "site";
const TARGET_ID = "guestbook";
const LIST_URL = `/api/comments?targetKind=${TARGET_KIND}&targetId=${TARGET_ID}`;
const MAX_LENGTH = 2000;
const LOGIN_PATH = "/account?returnTo=/guestbook";

/** Submit the surrounding form on Ctrl/Cmd + Enter. */
function submitOnCtrlEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
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

/** 错峰入场的档位上限：长列表不该让最后一条等上好几秒 */
const FLOW_CAP = 12;

type CommentItemProps = {
  comment: CommentDto;
  /** 落墨次序，写进 --gb-i 供页面样式错峰 */
  index: number;
  canInteract: boolean;
  threadOpen: boolean;
  replyDraft: string;
  replyBusy: boolean;
  likeBusyId: string | null;
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
  index,
  canInteract,
  threadOpen,
  replyDraft,
  replyBusy,
  likeBusyId,
  onToggleThread,
  onReplyDraftChange,
  onReplySubmit,
  onLike,
}: CommentItemProps) {
  return (
    <li
      className="p-guestbook__item"
      data-lift
      style={{ "--gb-i": Math.min(index, FLOW_CAP) } as React.CSSProperties}
    >
      <span className="p-guestbook__sheen" aria-hidden="true" />
      <div className="p-guestbook__meta">
        <span className="p-guestbook__author">{comment.authorName}</span>
        <time className="p-guestbook__time" dateTime={comment.createdAt}>
          {formatTime(comment.createdAt)}
        </time>
      </div>
      {comment.content ? (
        <p className="p-guestbook__content">{comment.content}</p>
      ) : null}
      <MediaEmbed attachment={comment.attachment} />
      <div className="p-guestbook__actions">
        <LikeButton
          comment={comment}
          busy={likeBusyId === comment.id}
          onLike={onLike}
        />
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
              {comment.replies.map((reply, replyIndex) => (
                <li
                  key={reply.id}
                  className="p-guestbook__reply"
                  style={
                    {
                      "--gb-i": Math.min(replyIndex, FLOW_CAP),
                    } as React.CSSProperties
                  }
                >
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
                  {reply.content ? (
                    <p className="p-guestbook__content">{reply.content}</p>
                  ) : null}
                  <MediaEmbed attachment={reply.attachment} />
                  <div className="p-guestbook__actions">
                    <LikeButton
                      comment={reply}
                      busy={likeBusyId === reply.id}
                      onLike={onLike}
                    />
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
                  onKeyDown={submitOnCtrlEnter}
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
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("error");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [recipients, setRecipients] = useState<PeerDto[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentMeta | null>(null);
  // 发布成功后的落印：非 0 时钤一记朱砂印，动画收梢后自行归零
  const [stamp, setStamp] = useState(0);

  const sortedComments = useMemo(
    () =>
      [...comments].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    [comments],
  );

  function showNotice(message: string, kind: NoticeKind = "error") {
    setNoticeKind(kind);
    setNotice(message);
  }

  const loadComments = useCallback(async (signal?: { cancelled: boolean }) => {
    setFeed("loading");
    try {
      const response = await fetch(LIST_URL, {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (signal?.cancelled) return;
      if (response.status === 503) {
        setFeed("unavailable");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as CommentsResponse;
      if (signal?.cancelled) return;
      setComments(Array.isArray(data.items) ? data.items : []);
      setFeed("ready");
    } catch {
      if (!signal?.cancelled) setFeed("error");
    }
  }, []);

  const loadRecipients = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/recipients", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { items: PeerDto[] };
      setRecipients(Array.isArray(data.items) ? data.items : []);
    } catch {
      setRecipients([]);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadComments(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadComments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSession("loading");
      try {
        const response = await fetch("/api/auth/session", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok) {
          setSession("unavailable");
          return;
        }
        const data = (await response.json()) as AuthSession;
        const isIn = Boolean(data.authenticated && data.user);
        setSession(isIn ? "in" : "out");
        if (isIn) await loadRecipients();
      } catch {
        if (!cancelled) setSession("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRecipients, sessionAttempt]);

  async function handleFile(file: File) {
    setUploadBusy(true);
    setNotice("");
    try {
      const meta = await uploadAttachment(file);
      setAttachment(meta);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "unauthorized") {
        setSession("out");
        showNotice("会话已失效，无法上传附件，请重新登录。");
      } else if (code === "too_large") {
        showNotice("文件太大了，请换一个小一些的附件。");
      } else if (code === "invalid_type") {
        showNotice("这种文件先不收，请换图片、短视频或音频。");
      } else if (code === "unsafe_url") {
        showNotice("附件地址不是本站同源路径，已拒绝保存。");
      } else {
        showNotice("附件没有传上去，请重试。");
      }
    } finally {
      setUploadBusy(false);
    }
  }

  async function handlePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content && !attachment) {
      showNotice("先写点什么，或附上一张图/一段视频。");
      return;
    }
    let safeAttachment: AttachmentMeta | undefined;
    if (attachment) {
      const url = resolveSafeMediaUrl(attachment.url);
      if (!url) {
        showNotice("附件地址不是本站同源路径，已取消发送。");
        setAttachment(null);
        return;
      }
      safeAttachment = { ...attachment, url };
    }
    if (visibility === "private" && !recipientId) {
      showNotice("选了“仅某人”，请先选择一位同学。");
      return;
    }
    setPosting(true);
    setNotice("");
    try {
      if (visibility === "private") {
        const response = await fetch("/api/messages", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            toUserId: recipientId,
            content,
            attachment: safeAttachment,
          }),
        });
        if (response.status === 401) {
          setSession("out");
          showNotice("会话已失效，请重新登录后再发布。");
          return;
        }
        if (response.status === 403) {
          showNotice("这位同学还没有账号，暂时无法私发。");
          return;
        }
        if (response.status === 503) {
          showNotice("留言后端暂时连不上，请稍后再试。");
          return;
        }
        if (!response.ok) throw new Error("failed");
        const peer = recipients.find((r) => r.userId === recipientId);
        setDraft("");
        setRecipientId("");
        setVisibility("public");
        setAttachment(null);
        setStamp(Date.now());
        showNotice(
          peer
            ? `已私发给${peer.displayName}，可在“消息”页查看。`
            : "已私发成功，可在“消息”页查看。",
          "ok",
        );
      } else {
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
            attachment: safeAttachment,
          }),
        });
        if (response.status === 401) {
          setSession("out");
          showNotice("会话已失效，请重新登录后再发布。");
          return;
        }
        if (response.status === 429) {
          showNotice("脚印太密了，歇一会儿再写。");
          return;
        }
        if (response.status === 503) {
          showNotice("留言后端暂时连不上，请稍后再试。");
          return;
        }
        if (!response.ok) throw new Error("failed");
        const created = (await response.json()) as CommentDto;
        setComments((current) => [created, ...current]);
        setDraft("");
        setAttachment(null);
        setStamp(Date.now());
      }
    } catch {
      showNotice("发布失败，请检查网络后重试。");
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
        showNotice("会话已失效，请重新登录后再回复。");
        return;
      }
      if (response.status === 503) {
        showNotice("留言后端暂时连不上，回复没有发出去。");
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
      showNotice("回复没有发出去，请重试。");
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
      if (response.status === 503) {
        throw new Error("unavailable");
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
      showNotice("点赞没有点上，请重试。");
    } finally {
      setLikeBusyId(null);
    }
  }

  return (
    <div className="p-guestbook">
      {session === "loading" ? (
        <p className="p-guestbook__hint" role="status">
          正在检查会话…
        </p>
      ) : session === "unavailable" ? (
        <div className="p-lock">
          <p className="p-lock__badge">temporarily offline</p>
          <p className="p-lock__message">
            留言后端暂时连不上——不是你没登录，稍后再试就能写。
          </p>
          <div className="p-card__actions">
            <button
              type="button"
              className="p-guestbook__retry"
              onClick={() => setSessionAttempt((attempt) => attempt + 1)}
            >
              再试一次
            </button>
          </div>
        </div>
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
              required={!attachment}
              maxLength={MAX_LENGTH}
              placeholder="问题、想法、路过的心情，都欢迎。（Ctrl+Enter 快速发布）"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={submitOnCtrlEnter}
            />
            <span
              className="p-guestbook__count"
              hidden={draft.length < MAX_LENGTH - 400}
              aria-live="polite"
            >
              {draft.length} / {MAX_LENGTH}
            </span>
          </label>

          <AttachmentPicker
            attachment={attachment}
            busy={uploadBusy}
            onFileChange={(file) => void handleFile(file)}
            onRemove={() => setAttachment(null)}
          />

          <div className="p-guestbook__vis">
            <div
              className="p-guestbook__vis-row"
              role="radiogroup"
              aria-label="可见性"
            >
              <label className="p-guestbook__vis-opt is-public">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <span>公开到留言板</span>
              </label>
              <label className="p-guestbook__vis-opt is-private">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>仅某人可见</span>
              </label>
            </div>

            {visibility === "private" ? (
              <label className="p-guestbook__vis-peer">
                <span className="u-sr-only">选择接收的同学</span>
                <select
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                >
                  <option value="">选择一位同学…</option>
                  {recipients.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.displayName}（@{r.username}）
                    </option>
                  ))}
                </select>
                {recipients.length === 0 ? (
                  <span className="p-guestbook__vis-hint">
                    暂无有账号的同学可私发
                  </span>
                ) : null}
              </label>
            ) : null}

            <p className="p-guestbook__vis-note">
              {visibility === "private"
                ? "只发给你选中的同学，其他人看不到。"
                : "所有人都能在留言板上看到这条。"}
            </p>
          </div>

          <button type="submit" disabled={posting || uploadBusy}>
            {posting
              ? "发送中…"
              : visibility === "private"
                ? "私发给TA"
                : "发布留言"}
          </button>

          {stamp ? (
            <span
              key={stamp}
              className="p-guestbook__stamp"
              aria-hidden="true"
              onAnimationEnd={() => setStamp(0)}
            />
          ) : null}
        </form>
      )}

      <p
        className={`p-guestbook__notice${noticeKind === "ok" ? " is-ok" : ""}`}
        role="alert"
        hidden={!notice}
      >
        {notice}
      </p>

      {feed === "loading" ? (
        <p
          className="p-guestbook__state p-guestbook__state--loading"
          role="status"
        >
          正在打捞河边的脚印…
        </p>
      ) : feed === "unavailable" ? (
        <div className="p-guestbook__state p-guestbook__state--error">
          <p>留言后端暂时连不上，河面上的脚印稍后再捞。</p>
          <button
            type="button"
            className="p-guestbook__retry"
            onClick={() => void loadComments()}
          >
            再试一次
          </button>
        </div>
      ) : feed === "error" ? (
        <div className="p-guestbook__state p-guestbook__state--error">
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
        <p className="p-guestbook__state p-guestbook__state--empty">
          <span className="p-guestbook__state-title">河面还很安静</span>
          {session === "in"
            ? "做第一个留下脚印的人。"
            : session === "unavailable"
              ? "后端连上之后，脚印会在这里浮上来。"
              : (
                <>
                  <a href={LOGIN_PATH}>登录</a>
                  后即可留下第一枚脚印。
                </>
              )}
        </p>
      ) : (
        <ol className="p-guestbook__list">
          {sortedComments.map((comment, index) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              index={index}
              canInteract={session === "in"}
              threadOpen={Boolean(openThreads[comment.id])}
              replyDraft={replyDrafts[comment.id] ?? ""}
              replyBusy={replyBusyId === comment.id}
              likeBusyId={likeBusyId}
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
