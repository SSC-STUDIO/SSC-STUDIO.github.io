/**
 * /sitemap.xml — 公开路由索引（私密页不收录）
 */
import type { APIRoute } from 'astro'
import { escapeXml, getSitemapRoutes, siteOrigin } from '../data/site'

export const GET: APIRoute = () => {
  const routes = getSitemapRoutes()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map((route) => {
    const lastmod = route.lastmod
      ? `\n    <lastmod>${route.lastmod}</lastmod>`
      : ''
    return `  <url>
    <loc>${escapeXml(`${siteOrigin}${route.path}`)}</loc>${lastmod}
    <priority>${route.priority}</priority>
  </url>`
  })
  .join('\n')}
</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
