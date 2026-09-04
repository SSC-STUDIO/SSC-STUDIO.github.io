/**
 * 顶栏当前页判断：同时覆盖真实路由、首页锚点和 SPA 换页后的 location.hash。
 */

export function normalizePath(pathname: string): string {
  if (!pathname) return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function parseNavHref(href: string): { path: string; hash: string } {
  if (!href) return { path: '/', hash: '' }
  if (href.startsWith('#')) {
    return { path: '/', hash: href }
  }

  const hashAt = href.indexOf('#')
  if (hashAt === -1) {
    return { path: normalizePath(href), hash: '' }
  }

  return {
    path: normalizePath(href.slice(0, hashAt) || '/'),
    hash: href.slice(hashAt),
  }
}

function hashOf(value: string): string {
  if (!value) return ''
  return value.startsWith('#') ? value : `#${value}`
}

/**
 * 顶栏五项的「当前」规则：
 * - 首页：仅在 `/` 且没有章节 hash
 * - 关于：`/about`，或首页 `#about`
 * - 作品：`/projects` 及其子页，或首页 `#work`
 * - 消息：`/messages`
 * - 联系：`/contact`，或首页 `#contact`
 */
export function isNavCurrent(
  href: string,
  pathname: string,
  hash = ''
): boolean {
  const locPath = normalizePath(pathname)
  const locHash = hashOf(hash)
  const link = parseNavHref(href)

  if (!link.hash) {
    if (link.path === '/') return locPath === '/' && locHash === ''
    return locPath === link.path || locPath.startsWith(`${link.path}/`)
  }

  const section = link.hash.slice(1)

  if (section === 'about') {
    return locPath === '/about' || (locPath === '/' && locHash === '#about')
  }

  if (section === 'work') {
    return (
      locPath === '/projects' ||
      locPath.startsWith('/projects/') ||
      (locPath === '/' && locHash === '#work')
    )
  }

  if (section === 'contact') {
    return locPath === '/contact' || (locPath === '/' && locHash === '#contact')
  }

  return locPath === link.path && locHash === link.hash
}
