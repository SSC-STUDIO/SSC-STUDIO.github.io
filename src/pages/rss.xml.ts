/**
 * /rss.xml — 文章 + 项目订阅源（零依赖手写 endpoint）
 */
import type { APIRoute } from 'astro'

const site = 'https://chenrunsen.cn'

const items = [
  {
    title: '为什么要做一个自己的网站',
    link: '/articles/why-build-personal-site/',
    description: '关于这个空间的起点：把好奇、作品和记忆收进同一个可以滚动回放的地方。',
    pubDate: '2026-04-18',
  },
  {
    title: '一个 AI 原型的迭代回路',
    link: '/articles/ai-prototype-loop/',
    description: '从想法到可运行原型的最短路径：记录一次 AI 实验的完整迭代。',
    pubDate: '2026-05-02',
  },
  {
    title: 'MyWebsite 个人站',
    link: '/projects/my-website/',
    description: '个人站 monorepo：作品集、文章、Human Benchmark 与班级空间。',
    pubDate: '2026-03-01',
  },
  {
    title: 'AI Lab Notes',
    link: '/projects/ai-lab-notes/',
    description: '自托管 LLM 网关与 CV 实验：模型路由、故障回退、遥测，以及可复现的训练笔记。',
    pubDate: '2026-04-10',
  },
  {
    title: 'Interactive Game Kit',
    link: '/projects/interactive-game-kit/',
    description: '浏览器棋类、Roguelite 与 Godot 原型 — 手感、反馈与排行榜一体。',
    pubDate: '2025-12-20',
  },
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
