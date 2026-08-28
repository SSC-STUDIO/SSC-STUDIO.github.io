import { useCallback, useEffect, useState } from "react";
import { AUTH_FETCH_OPTIONS, type AuthSession } from "./api";
import {
  AttachmentPicker,
  MediaEmbed,
  uploadAttachment,
  type AttachmentMeta,
} from "./media";

/**
 * Messages island — private direct messages between accounts.
 *
 * Backend: GET/POST `/api/messages`, `GET /api/messages/:userId`,
 * `GET /api/messages/recipients`. A conversation exists only after either
 * side sends a message; sending is limited to classmates with an account
 * (role member/admin). Opening a thread marks inbound messages as read.
 */

type SessionState = "loading" | "out" | "in";

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

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  const [listState, setListState] = useState<"loading" | "error" | "ready">("loading");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<PeerDto | null>(null);
  const [thread, setThread] = useState<MessageDto[]>([]);
  const [threadState, setThreadState] = useState<"loading" | "error" | "ready">("loading");
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentMeta | null>(null);
  const [notice, setNotice] = useState("");

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

  const loadConversations = useCallback(async () => {
    setListState("loading");
    try {
      const response = await fetch("/api/messages", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { items: ConversationDto[] };
      setConversations(Array.isArray(data.items) ? data.items : []);
      setListState("ready");
    } catch {
      setListState("error");
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
          setSession("in");
          await Promise.all([loadRecipients(), loadConversations()]);
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
  }, [loadRecipients, loadConversations]);

  const updateConversationFromActive = useCallback(
    (threadList: MessageDto[]) => {
      if (!threadList.length) return;
      const last = threadList[threadList.length - 1];
      setConversations((current) => {
        const idx = current.findIndex((c) => c.userId === last.toUserId || c.userId === last.fromUserId);
        if (idx < 0) return current;
        const next = current.map((c) =>
          c.userId === activeUserId
            ? { ...c, lastMessage: last, unreadCount: 0 }
            : c,
        );
        return next;
      });
    },
    [activeUserId],
  );

  async function openThread(userId: string) {
    const peer =
      conversations.find((c) => c.userId === userId) ??
      recipients.find((r) => r.userId === userId) ??
      null;
    setActiveUserId(userId);
    setActivePeer(peer ? { userId, username: peer.username, displayName: peer.displayName, role: peer.role } : null);
    setComposeOpen(false);
    setThreadState("loading");
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(userId)}`, {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { items: MessageDto[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setThread(items);
      setThreadState("ready");
      updateConversationFromActive(items);
      setConversations((current) =>
        current.map((c) =>
          c.userId === userId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    } catch {
      setThreadState("error");
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
        setSession("out");
        setNotice("会话已失效，无法上传附件，请重新登录。");
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
        setSession("out");
        setNotice("会话已失效，请重新登录。");
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
      updateConversationFromActive([...thread, created]);
      await loadConversations();
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
        <p className="p-msg__hint">正在检查会话…</p>
      ) : session === "out" ? (
        <div className="p-lock">
          <p className="p-lock__badge">login required</p>
          <p className="p-lock__message">
            私信只对登录账号开放——登录后才能看到你和别人互相写的留言。
          </p>
          <div className="p-card__actions">
            <a className="p-card__link" href={LOGIN_PATH}>
              去登录
            </a>
          </div>
        </div>
      ) : (
        <div className="p-msg__shell">
          <aside className="p-msg__rail">
            <div className="p-msg__rail-head">
              <span className="p-msg__rail-title">会话</span>
              <button
                type="button"
                className="p-msg__new"
                onClick={() => {
                  setComposeOpen((current) => !current);
                }}
                aria-expanded={composeOpen}
              >
                + 新消息
              </button>
            </div>

            {composeOpen ? (
              <div className="p-msg__compose">
                {recipients.length === 0 ? (
                  <p className="p-msg__hint">
                    暂时没有可私信的同学（需要有账号）。
                  </p>
                ) : (
                  recipients.map((r) => (
                    <button
                      type="button"
                      key={r.userId}
                      className="p-msg__recipient"
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
              <p className="p-msg__state">正在加载会话…</p>
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
                {sortedConversations.map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      className={`p-msg__conv${activeUserId === c.userId ? " is-active" : ""}${c.unreadCount > 0 ? " is-unread" : ""}`}
                      onClick={() => void openThread(c.userId)}
                    >
                      <span className="p-msg__conv-name">{c.displayName}</span>
                      <time className="p-msg__conv-time" dateTime={c.lastMessage?.createdAt}>
                        {c.lastMessage ? formatShortTime(c.lastMessage.createdAt) : ""}
                      </time>
                      <span className="p-msg__conv-preview">
                        {c.unreadCount > 0 ? `[${c.unreadCount} 条未读] ` : ""}
                        {c.lastMessage ? c.lastMessage.content : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="p-msg__pane">
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

                <div className="p-msg__thread">
                  {threadState === "loading" ? (
                    <p className="p-msg__state">正在加载对话…</p>
                  ) : threadState === "error" ? (
                    <p className="p-msg__state">对话加载失败，请重试。</p>
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
                            <p className="p-msg__bubble-content">{m.content}</p>
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
                      placeholder="写一句想说的话…"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
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