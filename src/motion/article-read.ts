/**
 * 文章阅读进度与章次落点
 *
 * 顶栏朱丝、左栏导轨共用：正文过视口中线为主；
 * 整页已经落在一屏里、或滚到页底，都算读完。
 * 章题只要进过视口（或已经翻到上面）就描朱丝，跳滚也不会漏。
 */

export function articleReadProgress(body: HTMLElement): number {
  const viewH = window.innerHeight
  const docH = Math.max(document.documentElement.scrollHeight, viewH)
  const maxScroll = docH - viewH

  if (maxScroll <= 1 || window.scrollY >= maxScroll - 2) return 1

  const rect = body.getBoundingClientRect()
  const span = Math.max(1, rect.height)
  const through = (viewH * 0.5 - rect.top) / span

  return Math.min(Math.max(through, 0), 1)
}

export function findArticleBody(
  from: Element,
  selector = '.p-prose'
): HTMLElement | null {
  const scope = from.closest('.p-article') || document
  return scope.querySelector(selector)
}

/** 读到哪一章、哪几道章题该落朱丝。ticks 可省略。 */
export function syncArticleHeads(
  heads: HTMLElement[],
  ticks?: Array<Element | null>
): void {
  if (!heads.length) return

  const viewH = window.innerHeight
  const line = viewH * 0.32
  let current = 0

  heads.forEach((head, index) => {
    const top = head.getBoundingClientRect().top
    if (top <= line) current = index
    if (top < viewH) head.classList.add('is-read')
  })

  ticks?.forEach((tick, index) => {
    tick?.classList.toggle('is-current', index === current)
  })
}
