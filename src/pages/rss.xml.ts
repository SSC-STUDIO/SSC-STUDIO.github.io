/**
 * /rss.xml — 文章 + 项目订阅源（标题/日期与正文同一份数据）
 */
import type { APIRoute } from 'astro'
import { articles } from '../data/articles'
import { projects } from '../data/projects'

const site = 'https://chenrunsen.cn'

const items = [
  ...articles.map((article) => ({
    title: article.title,
    link: `${article.href}/`,
    description: article.summary,
    pubDate: article.isoDate,
  })),
  ...projects
    .filter((project) => project.rssDate)
    .map((project) => ({
      title: project.name,
      link: `${project.href}/`,
      description: project.summary,
      pubDate: project.rssDate as string,
    })),
]

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const GET: APIRoute = () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>陈润森 · Chen Runsen</title>
    <link>${site}/</link>
    <description>个人空间：收藏 AI 实验、Web 与游戏作品、文章、奖项，也保存一处属于班级的记忆现场。</description>
    <language>zh-CN</language>
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${site}${item.link}</link>
      <guid>${site}${item.link}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
