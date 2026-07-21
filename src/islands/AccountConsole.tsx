import { useCallback, useEffect, useState } from "react";
import {
  AUTH_FETCH_OPTIONS,
  type AuthSession,
} from "./api";

type Panel = "loading" | "out" | "in";

type StatusKind = "" | "ok" | "error";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "用户名或密码不正确。",
  invalid_request: "请检查输入后重试。",
  unauthorized: "会话已失效，请重新登录。",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Account console island — session check, login and logout.
 *
 * Ported from the live dist `/account` page and its
 * `AccountConsole.astro_astro_type_script_index_0_lang.*.js` bundle.
 * On successful login the browser navigates to `returnTo` (same behaviour
 * as the dist script).
 */
export default function AccountConsole({
  returnTo = "/leaderboard",
}: {
  /** Where to continue after a successful login. */
  returnTo?: string;
}) {
  const [panel, setPanel] = useState<Panel>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [loginStatusKind, setLoginStatusKind] = useState<StatusKind>("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutStatus, setLogoutStatus] = useState("");
  const [logoutStatusKind, setLogoutStatusKind] = useState<StatusKind>("");
  const [logoutBusy, setLogoutBusy] = useState(false);

  const showLoginStatus = useCallback((message: string, kind: StatusKind) => {
    setLoginStatus(message);
    setLoginStatusKind(kind);
  }, []);

  const refreshSession = useCallback(async () => {
    setPanel("loading");
    try {
      const response = await fetch("/api/auth/session", {
        ...AUTH_FETCH_OPTIONS,
        cache: "no-store",
      });
      const data = (await response.json()) as AuthSession;
      setSession(data);
      setPanel(data.authenticated && data.user ? "in" : "out");
    } catch {
      setSession(null);
      setPanel("out");
      showLoginStatus("无法连接 API，请确认开发服务已启动。", "error");
    }
  }, [showLoginStatus]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

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
      window.location.href = returnTo;
    } catch {
      showLoginStatus("无法连接 API，请确认开发服务已启动。", "error");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutStatus("退出中…");
    setLogoutStatusKind("");
    try {
      await fetch("/api/auth/logout", {
        ...AUTH_FETCH_OPTIONS,
        method: "POST",
      });
      setLogoutStatus("已退出当前会话。");
      setLogoutStatusKind("ok");
      setUsername("");
      setPassword("");
      showLoginStatus("", "");
      await refreshSession();
    } catch {
      setLogoutStatus("退出失败，请重试。");
      setLogoutStatusKind("error");
    } finally {
      setLogoutBusy(false);
    }
  }

  const user = session?.user ?? null;

  return (
    <div className="p-account" data-return-to={returnTo}>
      {panel === "loading" ? (
        <section className="p-account__panel">
          <p className="p-card__kicker">session</p>
          <h2 className="p-card__title">检查会话</h2>
          <p className="p-account__hint">正在连接 API…</p>
        </section>
      ) : null}

      {panel === "out" ? (
        <section className="p-account__panel">
          <p className="p-card__kicker">login</p>
          <h2 className="p-card__title">登录账号</h2>
          <p className="p-account__hint">
            登录后可提交排行榜成绩、访问班级空间。
          </p>
          <form className="p-form" noValidate onSubmit={handleLogin}>
            <label>
              用户名
              <input
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
              登录
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
          <div className="p-card__actions">
            <a className="p-card__link p-card__link--ghost" href="/leaderboard">
              排行榜
            </a>
            <a className="p-card__link p-card__link--ghost" href="/class">
              班级空间
            </a>
          </div>
        </section>
      ) : null}

      {panel === "in" && user ? (
        <section className="p-account__panel">
          <p className="p-card__kicker">signed in</p>
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
            <div>
              <dt>会话到期</dt>
              <dd>{formatDate(session?.expiresAt)}</dd>
            </div>
          </dl>
          <div className="p-card__actions">
            <a className="p-card__link" href={returnTo}>
              继续
            </a>
            <a className="p-card__link p-card__link--ghost" href="/leaderboard">
              排行榜
            </a>
            <a className="p-card__link p-card__link--ghost" href="/class">
              班级空间
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
