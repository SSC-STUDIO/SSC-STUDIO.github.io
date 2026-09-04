import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:4321";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "account-test-"));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let id = 0;
let ws;
const pending = new Map();
const fails = [];
const fetchHandlers = [];
const eventWaiters = [];

function ok(name, pass, detail = "") {
  const line = `${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!pass) fails.push(name);
}

function send(method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(msgId);
      reject(new Error(`CDP timeout ${method}`));
    }, 15000);
    pending.set(msgId, (result, error) => {
      clearTimeout(timer);
      if (error) reject(Object.assign(new Error(error.message), error));
      else resolve(result);
    });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.text ||
        result.exceptionDetails.exception?.description ||
        "evaluate failed",
    );
  }
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 8000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await evaluate(`Boolean(${expression})`);
    if (last) return last;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`waitFor timeout: ${expression}`);
}

async function goto(path) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor(
    `document.querySelector('.p-account') && document.querySelector('.p-account').dataset.panel !== 'loading'`,
  );
}

async function connect() {
  const start = Date.now();
  let version;
  while (Date.now() - start < 10000) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      version = await r.json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  if (!version) throw new Error("chrome debug port not ready");
  let page;
  const pageWait = Date.now();
  while (Date.now() - pageWait < 8000) {
    const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) =>
      r.json(),
    );
    page =
      pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl) ||
      pages.find((p) => p.webSocketDebuggerUrl);
    if (page?.webSocketDebuggerUrl) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("no page target");
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Fetch.requestPaused") {
      void handleFetch(msg.params);
      return;
    }
    if (msg.method) {
      for (const waiter of [...eventWaiters]) {
        if (waiter.method === msg.method) waiter.fn(msg.params);
      }
    }
    if (msg.id && pending.has(msg.id)) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg.result, msg.error);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*/api/auth/*", requestStage: "Request" }],
  });
}

async function handleFetch(params) {
  try {
    const url = params.request.url;
    const method = params.request.method;
    for (const handler of fetchHandlers) {
      const body = handler({ url, method, request: params.request });
      if (body) {
        await send("Fetch.fulfillRequest", {
          requestId: params.requestId,
          responseCode: body.status ?? 200,
          responseHeaders: [
            { name: "Content-Type", value: "application/json; charset=utf-8" },
          ],
          body: Buffer.from(JSON.stringify(body.json ?? {})).toString("base64"),
        });
        return;
      }
    }
    await send("Fetch.continueRequest", { requestId: params.requestId });
  } catch {
    try {
      await send("Fetch.continueRequest", { requestId: params.requestId });
    } catch {
      /* request already settled */
    }
  }
}

function mockAuth(handler) {
  fetchHandlers.push(handler);
  return () => {
    const i = fetchHandlers.indexOf(handler);
    if (i >= 0) fetchHandlers.splice(i, 1);
  };
}

const FILL_AND_SUBMIT = `async (fields) => {
  const nativeSet = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  for (const [name, value] of Object.entries(fields)) {
    nativeSet(document.querySelector('input[name="' + name + '"]'), value);
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  document.querySelector('.p-form button[type="submit"]').click();
}`;

try {
  await connect();

  await goto("/account");
  const login = await evaluate(`(() => {
    const root = document.querySelector('.p-account');
    const title = document.querySelector('.p-account__panel .p-card__title')?.textContent?.trim();
    const hint = document.querySelector('.p-account__hint')?.textContent || '';
    const hero = document.querySelector('.p-hero__summary')?.textContent || '';
    return {
      panel: root?.dataset.panel,
      mode: root?.dataset.mode,
      returnTo: root?.dataset.returnTo,
      hasReturnTo: root?.dataset.hasReturnTo,
      title,
      hint,
      hero,
      hasRealName: Boolean(document.querySelector('input[name="realName"]')),
      switchCount: document.querySelectorAll('.p-account__switch-btn').length,
      status: document.querySelector('.p-form__status')?.textContent || '',
    };
  })()`);
  ok("default panel is out or in", login.panel === "out" || login.panel === "in", login.panel);
  ok("default returnTo is /leaderboard", login.returnTo === "/leaderboard", login.returnTo);
  ok("no returnTo flag on bare /account", login.hasReturnTo === "0", login.hasReturnTo);
  ok("hero does not promise name-auth", !/解锁班级|填.*即.*认证/.test(login.hero) && /不会自动获得同学认证/.test(login.hero), login.hero);
  if (login.panel === "out") {
    ok("login title", login.title === "登录账号", login.title);
    ok("login hint does not unlock class by name", !/填上真实姓名即可|已认证/.test(login.hint) && /服务端名单/.test(login.hint), login.hint);
    ok("login has no realName field", login.hasRealName === false);
    ok("switch has two buttons", login.switchCount === 2);

    await evaluate(`document.querySelectorAll('.p-account__switch-btn')[1].click()`);
    await waitFor(`document.querySelector('.p-account')?.dataset.mode === 'register'`);
    const reg = await evaluate(`(() => {
      const hint = document.querySelector('.p-account__hint')?.textContent || '';
      const note = document.querySelector('.p-account__note')?.textContent || '';
      const title = document.querySelector('.p-account__panel .p-card__title')?.textContent?.trim();
      const active = [...document.querySelectorAll('.p-account__switch-btn')].map((b) => ({
        text: b.textContent.trim(),
        pressed: b.getAttribute('aria-pressed'),
        active: b.classList.contains('is-active'),
      }));
      return {
        title,
        hint,
        note,
        hasRealName: Boolean(document.querySelector('input[name="realName"]')),
        mode: document.querySelector('.p-account')?.dataset.mode,
        active,
      };
    })()`);
    ok("register title", reg.title === "注册账号", reg.title);
    ok("register mode", reg.mode === "register");
    ok("register has realName", reg.hasRealName === true);
    ok("register hint no name-auth promise", /不会自动认证/.test(reg.hint) && !/即可解锁|已认证为/.test(reg.hint), reg.hint);
    ok("register note no name-auth promise", /不会自动认证/.test(reg.note) && !/填上真实姓名即可/.test(reg.note), reg.note);
    ok("register tab active", reg.active[1]?.pressed === "true" && reg.active[1]?.active === true, JSON.stringify(reg.active));

    await evaluate(`document.querySelectorAll('.p-account__switch-btn')[0].click()`);
    await waitFor(`document.querySelector('.p-account')?.dataset.mode === 'login'`);
    const back = await evaluate(`document.querySelector('.p-account__panel .p-card__title')?.textContent?.trim()`);
    ok("switch back to login", back === "登录账号", back);

    await evaluate(`(${FILL_AND_SUBMIT})({ username: "a", password: "123" })`);
    await waitFor(`document.querySelector('.p-form__field-error:not([hidden])')`);
    const errs = await evaluate(`([...document.querySelectorAll('.p-form__field-error')].map((el) => ({ hidden: el.hidden, text: el.textContent.trim() })))`);
    ok("login validates short username", errs.some((e) => e.text.includes("用户名至少")), JSON.stringify(errs));

    await evaluate(`(${FILL_AND_SUBMIT})({ username: "tester", password: "123" })`);
    await waitFor(`([...document.querySelectorAll('.p-form__field-error')].some((el) => !el.hidden && el.textContent.includes('密码至少')))`);
    ok("login validates short password", true);

    await evaluate(`document.querySelectorAll('.p-account__switch-btn')[1].click()`);
    await waitFor(`document.querySelector('input[name="realName"]')`);
    await evaluate(`(${FILL_AND_SUBMIT})({ username: "ab", password: "123456", realName: ${JSON.stringify("名".repeat(41))} })`);
    await waitFor(`([...document.querySelectorAll('.p-form__field-error')].some((el) => !el.hidden && el.textContent.includes('真实姓名最多')))`);
    ok("register validates long realName", true);
  } else {
    const signed = await evaluate(`(() => {
      const badge = document.querySelector('.p-account__badge')?.textContent || '';
      const facts = [...document.querySelectorAll('.p-account__facts dd')].map((d) => d.textContent.trim());
      return { badge, facts, continueHref: document.querySelector('.p-card__actions a.p-card__link:not(.p-card__link--ghost)')?.getAttribute('href') };
    })()`);
    ok("signed-in badge is not name-auth", !/已认证/.test(signed.badge), signed.badge);
    ok("signed-in continue default", signed.continueHref === "/leaderboard", signed.continueHref);
  }

  await goto("/account?returnTo=/messages");
  const rt = await evaluate(`(() => {
    const root = document.querySelector('.p-account');
    const cont = document.querySelector('.p-card__actions a.p-card__link:not(.p-card__link--ghost)');
    return {
      panel: root?.dataset.panel,
      returnTo: root?.dataset.returnTo,
      hasReturnTo: root?.dataset.hasReturnTo,
      hint: document.querySelector('.p-account__hint')?.textContent || '',
      continueHref: cont?.getAttribute('href') || null,
    };
  })()`);
  ok("returnTo=/messages stored", rt.returnTo === "/messages", rt.returnTo);
  ok("has-return-to flag", rt.hasReturnTo === "1", rt.hasReturnTo);
  if (rt.panel === "out") {
    ok("returnTo mentioned in login hint", /刚才的页面/.test(rt.hint), rt.hint);
  } else {
    ok("continue honors returnTo", rt.continueHref === "/messages", rt.continueHref);
  }

  await goto("/account?returnTo=https://evil.example");
  const evil = await evaluate(`document.querySelector('.p-account')?.dataset.returnTo`);
  ok("reject absolute returnTo", evil === "/leaderboard", evil);

  await goto("/account?returnTo=//evil.example");
  const proto = await evaluate(`document.querySelector('.p-account')?.dataset.returnTo`);
  ok("reject protocol-relative returnTo", proto === "/leaderboard", proto);

  await goto("/account?returnTo=/\\\\evil.example");
  const slash = await evaluate(`document.querySelector('.p-account')?.dataset.returnTo`);
  ok("reject backslash returnTo", slash === "/leaderboard", slash);

  await goto("/account?returnTo=/admin");
  const admin = await evaluate(`document.querySelector('.p-account')?.dataset.returnTo`);
  ok("allow /admin returnTo", admin === "/admin", admin);

  if (login.panel === "out") {
    const stopBadLogin = mockAuth(({ url, method }) => {
      if (method === "POST" && url.includes("/api/auth/login")) {
        return { status: 401, json: { error: "invalid_credentials" } };
      }
    });
    await goto("/account");
    await waitFor(`document.querySelector('input[name="username"]')`);
    const loginResult = await evaluate(`(async () => {
      await (${FILL_AND_SUBMIT})({ username: "not-a-real-user-xyz", password: "wrong-password" });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 150));
        const status = document.querySelector('.p-form__status');
        if (status && !status.hidden && status.textContent && !status.textContent.includes("登录中")) {
          return { kind: status.className, text: status.textContent.trim(), href: location.pathname };
        }
      }
      return { kind: "timeout", text: document.querySelector('.p-form__status')?.textContent || "", href: location.pathname };
    })()`);
    stopBadLogin();
    ok(
      "bad login stays on account and shows error",
      loginResult.href === "/account" && /不正确|无法连接|失败|重试/.test(loginResult.text),
      JSON.stringify(loginResult),
    );

    let sessionUser = {
      displayName: "测试同学",
      username: "tmpstudent",
      role: "student",
      realName: "张三",
    };
    let registered = false;
    const stopRegister = mockAuth(({ url, method }) => {
      if (method === "POST" && url.includes("/api/auth/register")) {
        registered = true;
        return { status: 200, json: { user: sessionUser, classmateVerified: true } };
      }
      if (registered && url.includes("/api/auth/session")) {
        return { status: 200, json: { authenticated: true, user: sessionUser, expiresAt: "2030-01-01T00:00:00.000Z" } };
      }
    });
    await goto("/account");
    await waitFor(`document.querySelectorAll('.p-account__switch-btn').length === 2`);
    await evaluate(`document.querySelectorAll('.p-account__switch-btn')[1].click()`);
    await waitFor(`document.querySelector('input[name="realName"]')`);
    await evaluate(`(${FILL_AND_SUBMIT})({ username: "tmpstudent", password: "123456", realName: "张三" })`);
    await waitFor(`document.querySelector('.p-account')?.dataset.panel === 'in'`);
    const regResult = await evaluate(`(() => ({
      panel: document.querySelector('.p-account')?.dataset.panel,
      text: document.querySelector('.p-form__status')?.textContent?.trim() || "",
      badge: document.querySelector('.p-account__badge')?.textContent || "",
      title: document.querySelector('.p-account__panel .p-card__title')?.textContent?.trim() || "",
    }))()`);
    stopRegister();
    ok("register lands signed-in", regResult.panel === "in", JSON.stringify(regResult));
    ok("register success does not claim name-auth", /注册成功/.test(regResult.text) && !/已认证/.test(regResult.text), regResult.text);
    ok("student with realName has no verified badge", regResult.badge === "", JSON.stringify(regResult));

    const stopMember = mockAuth(({ url }) => {
      if (url.includes("/api/auth/session")) {
        return {
          status: 200,
          json: {
            authenticated: true,
            user: { displayName: "成员", username: "member1", role: "member", realName: "李四" },
            expiresAt: "2030-01-01T00:00:00.000Z",
          },
        };
      }
    });
    await goto("/account?returnTo=/messages");
    const member = await evaluate(`(() => ({
      badge: document.querySelector('.p-account__badge')?.textContent || "",
      continueHref: document.querySelector('.p-card__actions a.p-card__link:not(.p-card__link--ghost)')?.getAttribute('href'),
      facts: [...document.querySelectorAll('.p-account__facts dt, .p-account__facts dd')].map((el) => el.textContent.trim()),
    }))()`);
    stopMember();
    ok("member badge is session fact, not 认证", member.badge === "班级空间已开放", member.badge);
    ok("member continue uses returnTo", member.continueHref === "/messages", member.continueHref);

    const stopLoginJump = mockAuth(({ url, method }) => {
      if (method === "POST" && url.includes("/api/auth/login")) {
        return { status: 200, json: { ok: true } };
      }
      if (url.includes("/api/auth/session")) {
        return { status: 200, json: { authenticated: false, user: null } };
      }
    });
    await goto("/account?returnTo=/messages");
    await waitFor(`document.querySelector('input[name="username"]')`);
    const jumpedPromise = new Promise((resolve) => {
      const waiter = {
        method: "Page.frameNavigated",
        fn: () => {
          const i = eventWaiters.indexOf(waiter);
          if (i >= 0) eventWaiters.splice(i, 1);
          resolve(true);
        },
      };
      eventWaiters.push(waiter);
      setTimeout(() => resolve(false), 8000);
    });
    await evaluate(`(${FILL_AND_SUBMIT})({ username: "okuser", password: "123456" })`);
    const didNav = await jumpedPromise;
    const jumped = didNav
      ? await evaluate(`location.pathname + location.search`).catch(() => "(detached)")
      : "(no navigation)";
    stopLoginJump();
    ok("login follows returnTo=/messages", jumped === "/messages", jumped);
  }
} catch (err) {
  ok("browser harness", false, err.stack || err.message);
} finally {
  try {
    ws?.close();
  } catch {}
  chrome.kill();
  setTimeout(() => {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
    if (fails.length) {
      console.error(`\n${fails.length} failed`);
      process.exit(1);
    }
    console.log("\naccount-browser-test: ok");
  }, 300);
}
