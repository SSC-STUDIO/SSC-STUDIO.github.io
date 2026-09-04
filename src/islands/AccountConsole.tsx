import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTH_FETCH_OPTIONS,
  type AuthSession,
  type SessionUser,
} from "./api";
import { isSafeReturnTo, resolveReturnTo } from "../utils/safe-return-to";

type Panel = "loading" | "out" | "in";

type StatusKind = "" | "ok" | "error";

/** Session user as returned by the auth API, including class-roster fields. */
type AccountUser = SessionUser & { realName?: string };

type AccountSession = Omit<AuthSession, "user"> & { user: AccountUser | null };

type RegisterResponse = {
  error?: string;
  user?: AccountUser;
};

const API_DOWN = "无法连接 API，请确认开发服务已启动。";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "用户名或密码不正确。",
  invalid_request: "请检查输入后重试。",
  unauthorized: "会话已失效，请重新登录。",
  api_unavailable: API_DOWN,
};

const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  username_taken: "这个用户名已经被占用了。",
  invalid_request: "请检查输入后重试。",
  invalid_realname: "真实姓名需要 1–40 个字符。",
  weak_password: "密码至少 6 个字符。",
  api_unavailable: API_DOWN,
};

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Account console island — session check, login, register and logout.
 *
 * On successful login the browser navigates to a same-site `returnTo`
 * (query wins over the prop). Registration may send an optional `realName`
 * as profile data only — the UI never treats a filled name as classmate
 * verification. Class-space access is whatever the session role already is.
 */
export default function AccountConsole({
  returnTo = "/leaderboard",
}: {
  /** Where to continue after a successful login. */
  returnTo?: string;
}) {
  const [panel, setPanel] = useState<Panel>("loading");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [realName, setRealName] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [realNameError, setRealNameError] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [loginStatusKind, setLoginStatusKind] = useState<StatusKind>("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [registerStatus, setRegisterStatus] = useState("");
  const [registerStatusKind, setRegisterStatusKind] = useState<StatusKind>("");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [inStatus, setInStatus] = useState("");
  const [inStatusKind, setInStatusKind] = useState<StatusKind>("");
  const [logoutStatus, setLogoutStatus] = useState("");
  const [logoutStatusKind, setLogoutStatusKind] = useState<StatusKind>("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  // 挂载后再读 URL 上的 returnTo，避免 SSR/hydration 不一致。
  const [target, setTarget] = useState(returnTo);
  const [hasReturnTo, setHasReturnTo] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    const resolved = resolveReturnTo(returnTo);
    setTarget(resolved);
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    setHasReturnTo(isSafeReturnTo(raw));
  }, [returnTo]);

  const showLoginStatus = useCallback((message: string, kind: StatusKind) => {
    setLoginStatus(message);
    setLoginStatusKind(kind);
  }, []);

  const showRegisterStatus = useCallback((message: string, kind: StatusKind) => {
    setRegisterStatus(message);
    setRegisterStatusKind(kind);
  }, []);

  const refreshSession = useCallback(async (opts?: {
    silent?: boolean;
  }): Promise<AccountSession | null> => {
    if (!opts?.silent) setPanel("loading");
    try {
      const response = await fetch("/api/auth/session", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      if (!response.ok) {
        setSession(null);
        setPanel("out");
        showLoginStatus(API_DOWN, "error");
        return null;
      }
      const data = (await response.json()) as AccountSession;
      setSession(data);
      setPanel(data.authenticated && data.user ? "in" : "out");
      return data;
    } catch {
      setSession(null);
      setPanel("out");
      showLoginStatus(API_DOWN, "error");
      return null;
    }
  }, [showLoginStatus]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!pendingFocusRef.current || panel !== "out") return;
    pendingFocusRef.current = false;
    usernameInputRef.current?.focus();
  }, [mode, panel]);

  function switchMode(next: "login" | "register") {
    if (next === mode) return;
    pendingFocusRef.current = true;
    setMode(next);
    setUsernameError("");
    setPasswordError("");
    setRealNameError("");
    showLoginStatus("", "");
    showRegisterStatus("", "");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameError("");
    setPasswordError("");
    showLoginStatus("", "");

    const credentials = {
      username: username.trim(),
      password,
    };
    if (credentials.username.length < 2) {
      setUsernameError("用户名至少 2 个字符");
      return;
    }
    if (credentials.password.length < 6) {
      setPasswordError("密码至少 6 个字符");
      return;
    }

    setLoginBusy(true);
    showLoginStatus("登录中…", "");
    try {
      const response = await fetch("/api/auth/login", {
        ...AUTH_FETCH_OPTIONS,
        method: "POST",
        headers: {
          ...AUTH_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        showLoginStatus(
          LOGIN_ERROR_MESSAGES[data.error ?? ""] ?? "登录失败，请重试。",
          "error",
        );
        return;
      }
      window.location.href = resolveReturnTo(returnTo);
    } catch {
      showLoginStatus(API_DOWN, "error");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameError("");
    setPasswordError("");
    setRealNameError("");
    showRegisterStatus("", "");

    const payload: {
      username: string;
      password: string;
      realName?: string;
    } = {
      username: username.trim(),
      password,
    };
    const trimmedRealName = realName.trim();
    if (payload.username.length < 2) {
      setUsernameError("用户名至少 2 个字符");
      return;
    }
    if (payload.password.length < 6) {
      setPasswordError("密码至少 6 个字符");
      return;
    }
    if (trimmedRealName) {
      if (trimmedRealName.length > 40) {
        setRealNameError("真实姓名最多 40 个字符");
        return;
      }
      payload.realName = trimmedRealName;
    }

    setRegisterBusy(true);
    showRegisterStatus("注册中…", "");
    try {
      const response = await fetch("/api/auth/register", {
        ...AUTH_FETCH_OPTIONS,
        method: "POST",
        headers: {
          ...AUTH_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as RegisterResponse;
      if (!response.ok) {
        showRegisterStatus(
          REGISTER_ERROR_MESSAGES[data.error ?? ""] ?? "注册失败，请重试。",
          "error",
        );
        return;
      }
      setPassword("");
      setRealName("");
      const next = await refreshSession({ silent: true });
      if (next?.authenticated && next.user) {
        setInStatus("注册成功，已自动登录。");
        setInStatusKind("ok");
      } else {
        setMode("login");
        showLoginStatus("注册成功，请登录。", "ok");
      }
    } catch {
      showRegisterStatus(API_DOWN, "error");
    } finally {
      setRegisterBusy(false);
    }
  }

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutStatus("退出中…");
    setLogoutStatusKind("");
    try {
      const response = await fetch("/api/auth/logout", {
        ...AUTH_FETCH_OPTIONS,
        method: "POST",
      });
      if (!response.ok) {
        setLogoutStatus(response.status === 503 ? API_DOWN : "退出失败，请重试。");
        setLogoutStatusKind("error");
        return;
      }
      setUsername("");
      setPassword("");
      setRealName("");
      setInStatus("");
      setInStatusKind("");
      showRegisterStatus("", "");
      const next = await refreshSession({ silent: true });
      if (!next?.authenticated) {
        setLogoutStatus("");
        setLogoutStatusKind("");
        showLoginStatus("已退出当前会话。", "ok");
      } else {
        setLogoutStatus("已退出，但会话仍有效，请刷新后再试。");
        setLogoutStatusKind("error");
      }
    } catch {
      setLogoutStatus("退出失败，请重试。");
      setLogoutStatusKind("error");
    } finally {
      setLogoutBusy(false);
    }
  }

  const user = session?.user ?? null;

  return (
    <div
      className="p-account"
      data-return-to={target}
      data-has-return-to={hasReturnTo ? "1" : "0"}
      data-panel={panel}
      data-mode={mode}
    >
      {panel === "loading" ? (
        <section className="p-account__panel" key="loading">
          <p className="p-card__kicker">session</p>
          <h2 className="p-card__title">检查会话</h2>
          <p className="p-account__hint" role="status">
            正在连接 API…
          </p>
          <div className="p-account__skeleton" aria-hidden="true">
            <span style={{ "--sk-i": 0 } as React.CSSProperties} />
            <span style={{ "--sk-i": 1 } as React.CSSProperties} />
            <span style={{ "--sk-i": 2 } as React.CSSProperties} />
          </div>
        </section>
      ) : null}

      {panel === "out" ? (
        <section className="p-account__panel" key={`out-${mode}`}>
          <p className="p-card__kicker">{mode === "login" ? "login" : "register"}</p>
          <h2 className="p-card__title">
            {mode === "login" ? "登录账号" : "注册账号"}
          </h2>
          <div className="p-account__switch" role="group" aria-label="登录或注册">
            <button
              type="button"
              className={`p-account__switch-btn${mode === "login" ? " is-active" : ""}`}
              aria-pressed={mode === "login"}
              onClick={() => switchMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={`p-account__switch-btn${mode === "register" ? " is-active" : ""}`}
              aria-pressed={mode === "register"}
              onClick={() => switchMode("register")}
            >
              注册
            </button>
          </div>
          <p className="p-account__hint">
            {mode === "login"
              ? hasReturnTo
                ? "登录后可提交排行榜成绩，并回到刚才的页面。班级空间是否开放由服务端名单决定。"
                : "登录后可提交排行榜成绩。班级空间是否开放由服务端名单决定，与是否填写姓名无关。"
              : "注册账号即可提交排行榜成绩。真实姓名选填，填写不会自动认证为同学。"}
          </p>
          {mode === "login" ? (
            <form className="p-form" noValidate onSubmit={handleLogin}>
              <label>
                用户名
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="username"
                  required
                  minLength={2}
                  maxLength={40}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="p-form__field-error" hidden={!usernameError}>
                  {usernameError}
                </span>
              </label>
              <label>
                密码
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  maxLength={200}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="p-form__field-error" hidden={!passwordError}>
                  {passwordError}
                </span>
              </label>
              <button type="submit" disabled={loginBusy}>
                {loginBusy ? "登录中…" : "登录"}
              </button>
              <p
                className={`p-form__status${
                  loginStatusKind === "ok"
                    ? " is-ok"
                    : loginStatusKind === "error"
                      ? " is-error"
                      : ""
                }`}
                role="status"
                hidden={!loginStatus}
              >
                {loginStatus}
              </p>
            </form>
          ) : (
            <form className="p-form" noValidate onSubmit={handleRegister}>
              <label>
                用户名
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="username"
                  required
                  minLength={2}
                  maxLength={40}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="p-form__field-error" hidden={!usernameError}>
                  {usernameError}
                </span>
              </label>
              <label>
                密码
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  maxLength={200}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="p-form__field-error" hidden={!passwordError}>
                  {passwordError}
                </span>
              </label>
              <label>
                真实姓名（选填）
                <input
                  type="text"
                  name="realName"
                  maxLength={40}
                  autoComplete="name"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                />
                <span className="p-account__note">
                  选填，仅作资料。班级空间是否开放由服务端名单与会话角色决定，填写姓名不会自动认证。
                </span>
                <span className="p-form__field-error" hidden={!realNameError}>
                  {realNameError}
                </span>
              </label>
              <button type="submit" disabled={registerBusy}>
                {registerBusy ? "注册中…" : "注册"}
              </button>
              <p
                className={`p-form__status${
                  registerStatusKind === "ok"
                    ? " is-ok"
                    : registerStatusKind === "error"
                      ? " is-error"
                      : ""
                }`}
                role="status"
                hidden={!registerStatus}
              >
                {registerStatus}
              </p>
            </form>
          )}
          <div className="p-card__actions">
            <a className="p-card__link p-card__link--ghost" href="/leaderboard">
              排行榜
            </a>
            <a className="p-card__link p-card__link--ghost" href="/class">
              班级空间
            </a>
            <a className="p-card__link p-card__link--ghost" href="/messages">
              消息
            </a>
          </div>
        </section>
      ) : null}

      {panel === "in" && user ? (
        <section className="p-account__panel" key="in">
          <p className="p-card__kicker">signed in</p>
          {user.role === "member" || user.role === "admin" ? (
            <p className="p-account__badge">班级空间已开放</p>
          ) : null}
          <h2 className="p-card__title">{user.displayName}</h2>
          <dl className="p-account__facts">
            <div>
              <dt>用户名</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{user.role}</dd>
            </div>
            {user.realName ? (
              <div>
                <dt>真实姓名</dt>
                <dd>{user.realName}</dd>
              </div>
            ) : null}
            <div>
              <dt>会话到期</dt>
              <dd>{formatDate(session?.expiresAt)}</dd>
            </div>
          </dl>
          <p
            className={`p-form__status${
              inStatusKind === "ok"
                ? " is-ok"
                : inStatusKind === "error"
                  ? " is-error"
                  : ""
            }`}
            role="status"
            hidden={!inStatus}
          >
            {inStatus}
          </p>
          <div className="p-card__actions">
            <a className="p-card__link" href={target}>
              继续
            </a>
            <a className="p-card__link p-card__link--ghost" href="/leaderboard">
              排行榜
            </a>
            <a className="p-card__link p-card__link--ghost" href="/class">
              班级空间
            </a>
            <a className="p-card__link p-card__link--ghost" href="/messages">
              消息
            </a>
            <button
              type="button"
              className="p-account__logout"
              onClick={handleLogout}
              disabled={logoutBusy}
            >
              退出登录
            </button>
          </div>
          <p
            className={`p-form__status${
              logoutStatusKind === "ok"
                ? " is-ok"
                : logoutStatusKind === "error"
                  ? " is-error"
                  : ""
            }`}
            role="status"
            hidden={!logoutStatus}
          >
            {logoutStatus}
          </p>
        </section>
      ) : null}
    </div>
  );
}
