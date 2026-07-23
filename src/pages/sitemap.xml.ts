/**
 * /sitemap.xml — 全站路由索引
 */
import type { APIRoute } from 'astro'

const site = 'https://chenrunsen.cn'

const routes = [
  { path: '/', priority: '1.0' },
  { path: '/about/', priority: '0.8' },
  { path: '/projects/', priority: '0.8' },
  { path: '/projects/my-website/', priority: '0.6' },
  { path: '/projects/ai-lab-notes/', priority: '0.6' },
  { path: '/projects/interactive-game-kit/', priority: '0.6' },
  { path: '/articles/', priority: '0.8' },
  { path: '/articles/why-build-personal-site/', priority: '0.6' },
  { path: '/articles/ai-prototype-loop/', priority: '0.6' },
  { path: '/honors/', priority: '0.8' },
  { path: '/benchmarks/', priority: '0.8' },
  { path: '/benchmarks/reaction-test/', priority: '0.6' },
  { path: '/benchmarks/number-memory/', priority: '0.6' },
  { path: '/benchmarks/visual-memory/', priority: '0.6' },
  { path: '/benchmarks/sequence-memory/', priority: '0.6' },
  { path: '/benchmarks/chimp-test/', priority: '0.6' },
  { path: '/benchmarks/word-memory/', priority: '0.6' },
  { path: '/benchmarks/schulte-grid/', priority: '0.6' },
  { path: '/leaderboard/', priority: '0.7' },
  { path: '/class/', priority: '0.7' },
  { path: '/class/gallery/', priority: '0.6' },
  { path: '/guestbook/', priority: '0.7' },
  { path: '/sponsor/', priority: '0.5' },
  { path: '/contact/', priority: '0.7' },
  { path: '/account/', priority: '0.4' },
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
