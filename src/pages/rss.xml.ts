/**
 * /rss.xml — 文章 + 项目订阅源（标题/日期与正文同一份数据）
 */
import type { APIRoute } from 'astro'
import {
  escapeXml,
  getRssItems,
  siteOrigin,
  toAbsoluteUrl,
  toRfc822,
} from '../data/site'

export const GET: APIRoute = () => {
  const items = getRssItems()
  const lastBuild = items[0]?.pubDate
    ? toRfc822(items[0].pubDate)
    : new Date().toUTCString()
  const feedUrl = escapeXml(toAbsoluteUrl('/rss.xml'))

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>陈润森 · Chen Runsen</title>
    <link>${escapeXml(`${siteOrigin}/`)}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <description>个人空间：收藏 AI 实验、Web 与游戏作品、文章、奖项，也保存一处属于班级的记忆现场。</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items
  .map((item) => {
    const link = escapeXml(toAbsoluteUrl(item.path))
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${toRfc822(item.pubDate)}</pubDate>
    </item>`
  })
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
