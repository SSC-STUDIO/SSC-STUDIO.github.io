/**
 * /sitemap.xml — 公开路由索引（私密页不收录）
 */
import type { APIRoute } from 'astro'
import { articles } from '../data/articles'
import { projects } from '../data/projects'
import { benchmarkGames } from '../data/benchmarks'
import { navLinks } from '../data/nav'

const site = 'https://chenrunsen.cn'

const routes = [
  ...navLinks
    .filter((link) => link.sitemap)
    .map((link) => ({
      path: link.href === '/' ? '/' : `${link.href}/`,
      priority: link.priority ?? '0.6',
    })),
  ...projects.map((project) => ({
    path: `${project.href}/`,
    priority: '0.6',
  })),
  ...articles.map((article) => ({
    path: `${article.href}/`,
    priority: '0.6',
  })),
  ...benchmarkGames.map((game) => ({
    path: `${game.href}/`,
    priority: '0.6',
  })),
]

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10)
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${site}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
