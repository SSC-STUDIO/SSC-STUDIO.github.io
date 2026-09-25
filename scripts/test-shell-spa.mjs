/**
 * 用本机 Chrome 走一遍 SPA：时钟 / 节气 / 导航高亮 / 导轨残留。
 * 默认打 127.0.0.1:4321，不启动、不杀掉开发服。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.SITE_URL || 'http://127.0.0.1:4321'
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((file) => existsSync(file))

if (!CHROME) {
  console.error('no chrome/edge')
  process.exit(1)
}

const profile = mkdtempSync(join(tmpdir(), 'crs-shell-'))
const port = 9339
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
)

let nextId = 1

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`timeout ${url}`)
}

function attach(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  let sessionId = null

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data))
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  })

  async function send(method, params = {}, session = sessionId) {
    const id = nextId++
    const payload = session
      ? { id, method, params, sessionId: session }
      : { id, method, params }
    const result = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
    })
    ws.send(JSON.stringify(payload))
    return result
  }

  return {
    ready,
    send,
    setSession(id) {
      sessionId = id
    },
    close() {
      ws.close()
    },
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

try {
  await waitFor(`${BASE}/contact`)
  const version = await waitFor(`http://127.0.0.1:${port}/json/version`).then((r) =>
    r.json()
  )
  const cdp = attach(version.webSocketDebuggerUrl)
  await cdp.ready

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })
  cdp.setSession(sessionId)

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'window.__shellErrs=[];window.addEventListener("error",(e)=>window.__shellErrs.push(String(e.message||e.error)));window.addEventListener("unhandledrejection",(e)=>window.__shellErrs.push(String(e.reason)));',
  })

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function evaluate(expression) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      const detail =
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        'evaluate failed'
      throw new Error(detail)
    }
    return result.result.value
  }

  async function waitEval(predicate, ms = 10000) {
    const deadline = Date.now() + ms
    let last
    while (Date.now() < deadline) {
      try {
        last = await evaluate(`(() => { try { return !!(${predicate}); } catch { return false; } })()`)
        if (last) return last
      } catch {
        last = false
      }
      await sleep(250)
    }
    return last
  }

  async function navigate(url) {
    await cdp.send('Page.navigate', { url })
    await waitEval(
      `document.documentElement.classList.contains('js') && document.readyState === 'complete'`,
      8000
    )
    const homeUrl = `${BASE}/`
    if (url === homeUrl || url === BASE) {
      await waitEval(
        `/^\\d{2}:\\d{2}$/.test(document.querySelector('.studio-clock__time')?.textContent || '')`,
        8000
      )
    }
    await sleep(300)
  }

  async function clickSelector(selector) {
    const clicked = await evaluate(
      `!!document.querySelector(${JSON.stringify(selector)}) && (document.querySelector(${JSON.stringify(selector)}).click(), true)`
    )
    if (!clicked) throw new Error(`missing ${selector}`)
    await sleep(1600)
    await waitEval(
      `document.documentElement.classList.contains('js')`,
      4000
    )
  }

  async function snapshot(label) {
    const state = await evaluate(`({
      path: location.pathname,
      hash: location.hash,
      current: [...document.querySelectorAll('.js-menu-link[aria-current="page"]')].map((a) => a.getAttribute('href')),
      term: document.querySelector('[data-term-name]')?.textContent || '',
      season: document.querySelector('[data-solar-term]')?.getAttribute('data-season') || '',
      clock: document.querySelector('.studio-clock__time')?.textContent || '',
      part: document.querySelector('.studio-clock__part')?.textContent || '',
      daypart: document.documentElement.getAttribute('data-daypart') || '',
      seal: document.querySelector('[data-date-seal] [data-seal-term]')?.textContent || '',
      rail: !!document.querySelector('.chapter-rail'),
      railParent: document.querySelector('.chapter-rail')?.parentElement?.tagName || '',
      duty: document.querySelector('.js-studio-duty')?.textContent || '',
    })`)
    console.log(label, JSON.stringify(state))
    return state
  }

  await navigate(`${BASE}/`)
  try {
    await evaluate(`sessionStorage.setItem('site-intro-seen','1')`)
  } catch {}
  await navigate(`${BASE}/`)
  const home = await snapshot('home')
  if (!/^\d{2}:\d{2}$/.test(home.clock)) {
    const errs = await evaluate(`window.__shellErrs || []`)
    throw new Error(`首页时钟应是 HH:MM，得到 ${home.clock}；errors=${JSON.stringify(errs)}`)
  }
  assert(home.clock !== '--:--', '首页时钟不能停在占位')
  assert(['晨光', '白昼', '暮色', '夜灯'].includes(home.part), `时段文案 ${home.part}`)
  assert(home.term.startsWith('今值'), `节气 ${home.term}`)
  assert(home.seal, '日戳应有节气')
  assert(home.rail, '首页应有章节导轨')
  assert(home.railParent === 'BODY', '导轨应挂到 body')
  assert(home.daypart, '应写入 data-daypart')
  assert(home.duty.includes('陈润森'), `值班文案 ${home.duty}`)

  await clickSelector('.sb-menu a[href="/messages"], .sb-menu a[href="/contact"]')
  const sub = await snapshot('sub')
  assert(sub.path === '/messages' || sub.path === '/contact', `应离开首页，得到 ${sub.path}`)
  assert(sub.current.includes(sub.path), `子页导航应高亮 ${sub.path}，得到 ${JSON.stringify(sub.current)}`)
  assert(sub.term.startsWith('今值'), `子页节气 ${sub.term}`)
  assert(sub.daypart, '子页仍应保持 data-daypart')
  assert(!sub.rail, '离开首页后导轨不应残留')
  assert(!sub.clock, '子页不应再有时钟节点')

  await clickSelector('.sb-menu a[href="/"]')
  const back = await snapshot('back-home')
  assert(back.path === '/', `应回到首页，得到 ${back.path}`)
  assert(/^\d{2}:\d{2}$/.test(back.clock), `回首页时钟 ${back.clock}`)
  assert(back.clock !== '--:--', '回首页时钟不能停在占位')
  assert(back.term.startsWith('今值'), `回首页节气 ${back.term}`)
  assert(back.rail, '回首页应重建导轨')
  assert(back.daypart === home.daypart, '时段在换页后应保持')

  await clickSelector('.js-index-open')
  assert(await evaluate(`document.querySelector('.js-site-index')?.open === true`), '目录应能打开')
  await clickSelector('.js-index-chapter[href="#about"]')
  const chapter = await snapshot('index-chapter')
  assert(chapter.path === '/' && chapter.hash === '#about', `目录本页章节应停在首页 #about，得到 ${chapter.path}${chapter.hash}`)
  assert(await evaluate(`document.querySelector('.js-site-index')?.open === false`), '跳章节后目录应收起')

  await navigate(`${BASE}/contact`)
  await clickSelector('.sb-menu a[href="/about"]')
  const fromContact = await snapshot('spa-about')
  assert(fromContact.path === '/about', `从联系点关于应到关于页，得到 ${fromContact.path}`)
  assert(fromContact.term.startsWith('今值'), `SPA 后节气 ${fromContact.term}`)
  assert(
    fromContact.current.includes('/about'),
    `SPA 后关于应高亮，得到 ${JSON.stringify(fromContact.current)}`
  )

  console.log('shell-spa: ok')
  cdp.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
}
