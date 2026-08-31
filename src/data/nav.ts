export type NavLink = {
  href: string
  label: string
  sitemap?: boolean
  priority?: string
}

/** 卷末「继续逛」与 sitemap 公开路由同一份（私密页不进 sitemap） */
export const navLinks: NavLink[] = [
  { href: '/', label: '首页', sitemap: true, priority: '1.0' },
  { href: '/about', label: '关于', sitemap: true, priority: '0.8' },
  { href: '/projects', label: '项目', sitemap: true, priority: '0.8' },
  { href: '/articles', label: '文章', sitemap: true, priority: '0.8' },
  { href: '/honors', label: '荣誉', sitemap: true, priority: '0.8' },
  { href: '/sponsor', label: '赞助', sitemap: true, priority: '0.5' },
  { href: '/leaderboard', label: '排行榜', sitemap: true, priority: '0.7' },
  { href: '/benchmarks', label: '反应力', sitemap: true, priority: '0.8' },
  { href: '/class', label: '班级空间', sitemap: false },
  { href: '/guestbook', label: '留言簿', sitemap: true, priority: '0.7' },
  { href: '/contact', label: '联系', sitemap: true, priority: '0.7' },
]
