import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_FETCH_OPTIONS, type AuthSession } from "./api";
import { prefersReducedMotion } from "../motion/core";
import {
  AttachmentPicker,
  MediaEmbed,
  uploadAttachment,
  type AttachmentMeta,
} from "./media";
import { formatTime } from "../utils/format-time";

/**
 * Messages island — private direct messages between accounts.
 *
 * Backend: GET/POST `/api/messages`, `GET /api/messages/:userId`,
 * `GET /api/messages/recipients`. A conversation exists only after either
 * side sends a message; sending is limited to classmates with an account
 * (role member/admin). Opening a thread marks inbound messages as read.
 */

type SessionState = "loading" | "out" | "in" | "down";
type ListState = "loading" | "error" | "ready";
type ThreadState = "loading" | "error" | "ready";

type MessageDto = {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  attachment?: AttachmentMeta;
  createdAt: string;
  readAt?: string;
};

type PeerDto = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
};

type ConversationDto = PeerDto & {
  lastMessage: MessageDto | null;
  unreadCount: number;
};

const LOGIN_PATH = "/account?returnTo=/messages";
const MAX_LENGTH = 2000;
/** 错峰入场的档位上限：长列表不该让最后一条等上好几秒 */
const FLOW_CAP = 10;
const SKELETON_ROWS = [0, 1, 2];

/**
 * 加载骨架 —— 墨色呼吸的占位条。
 *
 * 纯装饰（aria-hidden），真正的加载播报交给同级的 sr-only status，
 * 读屏用户听到的仍是一句「正在加载」，而不是一串空条。
 */
function InkSkeleton({
  variant,
  label,
}: {
  variant: "rail" | "thread";
  label: string;
}) {
  return (
    <>
      <p className="u-sr-only" role="status">
        {label}
      </p>
      <ul
        className={`p-msg__skeleton p-msg__skeleton--${variant}`}
        aria-hidden="true"
      >
        {SKELETON_ROWS.map((i) => (
          <li
            key={i}
            className="p-msg__skeleton-row"
            style={{ "--sk-i": i } as React.CSSProperties}
          >
            <span className="p-msg__skeleton-bar p-msg__skeleton-bar--head" />
            <span className="p-msg__skeleton-bar p-msg__skeleton-bar--body" />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Submit the surrounding form on Ctrl/Cmd + Enter. */
function submitOnCtrlEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

/** Rail preview line for a conversation's last message. */
function previewText(message: MessageDto | null): string {
  if (!message) return "";
  if (message.content) return message.content;
  return message.attachment ? "[附件]" : "";
}

function formatShortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function MessagesConsole() {
  const [session, setSession] = useState<SessionState>("loading");
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [recipients, setRecipients] = useState<PeerDto[]>([]);
  const [listState, setListState] = useState<ListState>("loading");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<PeerDto | null>(null);
  const [thread, setThread] = useState<MessageDto[]>([]);
  const [threadState, setThreadState] = useState<ThreadState>("loading");
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentMeta | null>(null);
  const [notice, setNotice] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const threadReq = useRef(0);
  const aliveRef = useRef(true);

  // 新消息或切换会话后把时间线滚到底部（尊重减动效偏好）。
  useEffect(() => {
    const el = threadRef.current;
    if (!el || threadState !== "ready" || thread.length === 0) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [thread, threadState]);

  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setComposeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composeOpen]);

  const kickOut = useCallback((message?: string) => {
    setSession("out");
    setActiveUserId(null);
    setActivePeer(null);
    setThread([]);
    setComposeOpen(false);
    if (message) setNotice(message);
  }, []);

  const loadRecipients = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/recipients", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (response.status === 401) {
        kickOut("会话已失效，请重新登录。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { items: PeerDto[] };
      setRecipients(Array.isArray(data.items) ? data.items : []);
    } catch {
      setRecipients([]);
    }
  }, [kickOut]);

  const loadConversations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setListState("loading");
      try {
        const response = await fetch("/api/messages", {
          ...AUTH_FETCH_OPTIONS,
          cache: "no-store",
        });
        if (response.status === 401) {
          kickOut("会话已失效，请重新登录。");
          return;
        }
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as { items: ConversationDto[] };
        setConversations(Array.isArray(data.items) ? data.items : []);
        setListState("ready");
      } catch {
        if (!opts?.silent) setListState("error");
      }
    },
    [kickOut],
  );

  const checkSession = useCallback(async () => {
    setSession("loading");
    setNotice("");
    try {
      const response = await fetch("/api/auth/session", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!aliveRef.current) return;
      if (response.status === 401) {
        setSession("out");
        return;
      }
      if (!response.ok) {
        setSession("down");
        return;
      }
      const data = (await response.json()) as AuthSession;
      if (!aliveRef.current) return;
      if (data.authenticated && data.user) {
        setSession("in");
        await Promise.all([loadRecipients(), loadConversations()]);
      } else {
        setSession("out");
      }
    } catch {
      if (aliveRef.current) setSession("down");
    }
  }, [loadRecipients, loadConversations]);

  useEffect(() => {
    aliveRef.current = true;
    void checkSession();
    return () => {
      aliveRef.current = false;
    };
  }, [checkSession]);

  const rememberActiveConversation = useCallback(
    (last: MessageDto | null, peerId: string, peer: PeerDto | null) => {
      setConversations((current) => {
        const idx = current.findIndex((c) => c.userId === peerId);
        if (idx >= 0) {
          return current.map((c) =>
            c.userId === peerId
              ? { ...c, lastMessage: last ?? c.lastMessage, unreadCount: 0 }
              : c,
          );
        }
        if (!peer) return current;
        return [{ ...peer, lastMessage: last, unreadCount: 0 }, ...current];
      });
    },
    [],
  );

  async function openThread(userId: string) {
    const req = ++threadReq.current;
    const peer =
      conversations.find((c) => c.userId === userId) ??
      recipients.find((r) => r.userId === userId) ??
      null;
    const peerDto = peer
      ? {
          userId,
          username: peer.username,
          displayName: peer.displayName,
          role: peer.role,
        }
      : null;
    setActiveUserId(userId);
    setActivePeer(peerDto);
    setComposeOpen(false);
    setNotice("");
    setThreadState("loading");
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(userId)}`, {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (req !== threadReq.current) return;
      if (response.status === 401) {
        kickOut("会话已失效，请重新登录。");
        return;
      }
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { items: MessageDto[] };
      if (req !== threadReq.current) return;
      const items = Array.isArray(data.items) ? data.items : [];
      setThread(items);
      setThreadState("ready");
      rememberActiveConversation(items.length ? items[items.length - 1] : null, userId, peerDto);
    } catch {
      if (req === threadReq.current) setThreadState("error");
    }
  }

  async function handleFile(file: File) {
    setUploadBusy(true);
    setNotice("");
    try {
      const meta = await uploadAttachment(file);
      setAttachment(meta);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "unauthorized") {
        kickOut("会话已失效，无法上传附件，请重新登录。");
      } else if (code === "too_large") {
        setNotice("文件太大了，请换一个小一些的附件。");
      } else {
        setNotice("附件没有传上去，请重试。");
      }
    } finally {
      setUploadBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content && !attachment) return;
    if (!activeUserId) {
      setNotice("请先选择一位同学开始对话。");
      return;
    }
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          toUserId: activeUserId,
          content,
          attachment: attachment ?? undefined,
        }),
      });
      if (response.status === 401) {
        kickOut("会话已失效，请重新登录。");
        return;
      }
      if (response.status === 429) {
        setNotice("消息发得太快了，歇一会儿。");
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setNotice(
          data.error === "recipient_not_classmate"
            ? "这位同学还没有账号，暂时无法私信。"
            : data.error === "user_not_found"
              ? "找不到这位同学。"
              : "消息没有发出去，请重试。",
        );
        return;
      }
      const created = (await response.json()) as MessageDto;
      setThread((current) => [...current, created]);
      setDraft("");
      setAttachment(null);
      if (activeUserId) {
        rememberActiveConversation(created, activeUserId, activePeer);
      }
      await loadConversations({ silent: true });
    } catch {
      setNotice("消息没有发出去，请检查网络后重试。");
    } finally {
      setSending(false);
    }
  }

  const sortedConversations = [...conversations].sort((a, b) =>
    (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""),
  );

  return (
    <div className="p-msg">
      {session === "loading" ? (
        <p className="p-msg__hint p-msg__hint--checking" role="status">
          正在检查会话…
        </p>
      ) : session === "down" ? (
        <div className="p-lock">
          <p className="p-lock__badge">temporarily offline</p>
          <p className="p-lock__message">
            信匣暂时连不上。会话还在，过一会儿再试，不必重新登录。
          </p>
          <div className="p-card__actions">
            <button
              type="button"
              className="p-msg__retry"
              onClick={() => void checkSession()}
            >
              再试一次
            </button>
          </div>
        </div>
      ) : session === "out" ? (
        <div className="p-lock">
          <p className="p-lock__badge">login required</p>
          <p className="p-lock__message">
            私信只对登录账号开放——登录后才能看到你和别人互相写的留言。
          </p>
          {notice ? (
            <p className="p-msg__notice" role="alert">
              {notice}
            </p>
          ) : null}
          <div className="p-card__actions">
            <a className="p-card__link" href={LOGIN_PATH}>
              去登录
            </a>
          </div>
        </div>
      ) : (
        <div className="p-msg__shell">
          <aside className="p-msg__rail" aria-label="会话列表">
            <div className="p-msg__rail-head">
              <span className="p-msg__rail-title">会话</span>
              <button
                type="button"
                className="p-msg__new"
                onClick={() => {
                  setComposeOpen((current) => !current);
                }}
                aria-expanded={composeOpen}
                aria-controls={composeOpen ? "p-msg-compose" : undefined}
              >
                {composeOpen ? "收起" : "+ 新消息"}
              </button>
            </div>

            {composeOpen ? (
              <div className="p-msg__compose" id="p-msg-compose">
                {recipients.length === 0 ? (
                  <p className="p-msg__hint">
                    暂时没有可私信的同学（需要有账号）。
                  </p>
                ) : (
                  recipients.map((r, index) => (
                    <button
                      type="button"
                      key={r.userId}
                      className="p-msg__recipient"
                      style={
                        {
                          "--conv-i": Math.min(index, FLOW_CAP),
                        } as React.CSSProperties
                      }
                      onClick={() => void openThread(r.userId)}
                    >
                      {r.displayName}
                      <span className="p-msg__recipient-role">@{r.username}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {listState === "loading" ? (
              <InkSkeleton variant="rail" label="正在加载会话…" />
            ) : listState === "error" ? (
              <div className="p-msg__state">
                <p>会话加载失败。</p>
                <button
                  type="button"
                  className="p-msg__retry"
                  onClick={() => void loadConversations()}
                >
                  再试一次
                </button>
              </div>
            ) : sortedConversations.length === 0 ? (
              <p className="p-msg__state">
                还没有会话。点“新消息”给有账号的同学写第一条吧。
              </p>
            ) : (
              <ul className="p-msg__list">
                {sortedConversations.map((c, index) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      className={`p-msg__conv${activeUserId === c.userId ? " is-active" : ""}${c.unreadCount > 0 ? " is-unread" : ""}`}
                      style={
                        {
                          "--conv-i": Math.min(index, FLOW_CAP),
                        } as React.CSSProperties
                      }
                      aria-current={activeUserId === c.userId ? "true" : undefined}
                      onClick={() => void openThread(c.userId)}
                    >
                      <span className="p-msg__conv-name">
                        {c.displayName}
                        {c.unreadCount > 0 ? (
                          <span
                            className="p-msg__conv-unread"
                            aria-label={`${c.unreadCount} 条未读`}
                          >
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <time className="p-msg__conv-time" dateTime={c.lastMessage?.createdAt}>
                        {c.lastMessage ? formatShortTime(c.lastMessage.createdAt) : ""}
                      </time>
                      <span className="p-msg__conv-preview">
                        {previewText(c.lastMessage)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section
            className={`p-msg__pane${!activeUserId ? " p-msg__pane--idle" : ""}`}
            aria-label="对话"
          >
            {!activeUserId ? (
              <div className="p-msg__empty">
                <p>选择左侧的会话，或点“新消息”开始和同学聊天。</p>
              </div>
            ) : (
              <>
                <header className="p-msg__pane-head">
                  {activePeer ? (
                    <>
                      <span className="p-msg__pane-name">{activePeer.displayName}</span>
                      <span className="p-msg__pane-role">@{activePeer.username}</span>
                    </>
                  ) : (
                    <span className="p-msg__pane-name">对话</span>
                  )}
                </header>

                <div className="p-msg__thread" ref={threadRef}>
                  {threadState === "loading" ? (
                    <InkSkeleton variant="thread" label="正在加载对话…" />
                  ) : threadState === "error" ? (
                    <div className="p-msg__state">
                      <p>对话加载失败。</p>
                      <button
                        type="button"
                        className="p-msg__retry"
                        onClick={() => {
                          if (activeUserId) void openThread(activeUserId);
                        }}
                      >
                        再试一次
                      </button>
                    </div>
                  ) : thread.length === 0 ? (
                    <p className="p-msg__state">
                      还没有消息。写一句开场白吧。
                    </p>
                  ) : (
                    <ol className="p-msg__bubbles">
                      {thread.map((m) => {
                        const mine = m.fromUserId !== activeUserId;
                        return (
                          <li
                            key={m.id}
                            className={`p-msg__bubble${mine ? " is-mine" : " is-theirs"}`}
                          >
                            {m.content ? (
                              <p className="p-msg__bubble-content">{m.content}</p>
                            ) : null}
                            <MediaEmbed attachment={m.attachment} />
                            <time className="p-msg__bubble-time" dateTime={m.createdAt}>
                              {formatTime(m.createdAt)}
                            </time>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                <form
                  className="p-form p-msg__composer"
                  noValidate
                  onSubmit={sendMessage}
                >
                  <label>
                    回复 {activePeer?.displayName ?? ""}
                    <textarea
                      name="content"
                      required={!attachment}
                      maxLength={MAX_LENGTH}
                      placeholder="写一句想说的话…（Ctrl+Enter 发送）"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={submitOnCtrlEnter}
                    />
                    <span
                      className="p-msg__count"
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
                  <button
                    type="submit"
                    disabled={sending || uploadBusy || threadState !== "ready"}
                  >
                    {sending ? "发送中…" : "发送"}
                  </button>
                </form>
              </>
            )}

            <p className="p-msg__notice" role="alert" hidden={!notice}>
              {notice}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}