/**
 * 站点源、私密路径与订阅/索引共用的拼装。
 * sitemap / RSS 只从这里取公开路由，避免和 data 各表各写一份。
 */

import { articles } from './articles'
import { benchmarkGames } from './benchmarks'
import { navLinks } from './nav'
import { projects } from './projects'

export const siteOrigin = String(
  import.meta.env.SITE || 'https://ssc-studio.github.io'
).replace(/\/$/, '')

/** 账号 / 管理 / 私信 / 班级：页面 noindex，且不得进入 sitemap */
export const privatePathPrefixes = [
  '/admin',
  '/account',
  '/messages',
  '/class',
] as const

export type SitemapRoute = {
  path: string
  priority: string
  lastmod?: string
}

export type RssItem = {
  title: string
  path: string
  description: string
  pubDate: string
}

export function isPrivatePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return privatePathPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

export function withTrailingSlash(path: string): string {
  if (path === '/') return '/'
  // rss.xml / sitemap.xml 是文件端点，不能收成目录斜杠
  if (/\.[a-z0-9]+$/i.test(path.split('/').pop() || '')) return path
  return path.endsWith('/') ? path : `${path}/`
}

export function toAbsoluteUrl(path: string): string {
  return `${siteOrigin}${withTrailingSlash(path)}`
}

export function isIsoDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function toRfc822(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toUTCString()
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getSitemapRoutes(): SitemapRoute[] {
  const seen = new Map<string, SitemapRoute>()

  const add = (route: SitemapRoute) => {
    if (isPrivatePath(route.path)) return
    const path = withTrailingSlash(route.path)
    if (seen.has(path)) return
    seen.set(path, {
      path,
      priority: route.priority,
      lastmod: isIsoDate(route.lastmod) ? route.lastmod : undefined,
    })
  }

  for (const link of navLinks) {
    if (!link.sitemap) continue
    add({
      path: link.href,
      priority: link.priority ?? '0.6',
    })
  }

  for (const project of projects) {
    add({
      path: project.href,
      priority: '0.6',
      lastmod: project.rssDate,
    })
  }

  for (const article of articles) {
    add({
      path: article.href,
      priority: '0.6',
      lastmod: article.isoDate,
    })
  }

  for (const game of benchmarkGames) {
    add({
      path: game.href,
      priority: '0.6',
    })
  }

  return [...seen.values()]
}

/** 文章 + 带 rssDate 的项目；标题/日期与正文同一份数据，新到旧 */
export function getRssItems(): RssItem[] {
  const items: RssItem[] = [
    ...articles.map((article) => ({
      title: article.title,
      path: withTrailingSlash(article.href),
      description: article.summary,
      pubDate: article.isoDate,
    })),
    ...projects.filter((project) => isIsoDate(project.rssDate)).map((project) => ({
      title: project.name,
      path: withTrailingSlash(project.href),
      description: project.summary,
      pubDate: project.rssDate as string,
    })),
  ]

  return items
    .filter((item) => isIsoDate(item.pubDate) && !isPrivatePath(item.path))
    .sort(
      (a, b) =>
        b.pubDate.localeCompare(a.pubDate) ||
        a.title.localeCompare(b.title, 'zh-CN')
    )
}
