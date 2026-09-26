import { benchmarkGames } from './benchmarks'
import { projects } from './projects'

export type NavLink = {
  href: string
  label: string
  sitemap?: boolean
  priority?: string
}

/**
 * 卷末「继续逛」与 sitemap 公开路由同一份。
 * 班级空间可出现在页脚，但 sitemap:false；sitemap 另有私密路径 denylist。
 */
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

export type HeaderLink = {
  href: string
  label: string
  /**
   * 顶栏放不下时的收起顺序：2 在 1530px 以下、3 在 1280px 以下收进「目录」。
   * 手机上菜单本身可横向滑动，三档都保留。
   */
  tier: 1 | 2 | 3
}

/** 顶栏常驻项；首页与内页同一份，内页再在最前补「首页」。 */
export const headerLinks: HeaderLink[] = [
  { href: '/about', label: '关于', tier: 1 },
  { href: '/projects', label: '作品', tier: 1 },
  { href: '/articles', label: '文章', tier: 1 },
  { href: '/benchmarks', label: '游戏', tier: 2 },
  { href: '/guestbook', label: '留言', tier: 2 },
  { href: '/messages', label: '消息', tier: 3 },
  { href: '/contact', label: '联系', tier: 1 },
]

export type SiteIndexItem = {
  href: string
  label: string
  note: string
  /** public/ 下的独立 HTML，不走 ClientRouter 换页 */
  standalone?: boolean
}

export type SiteIndexGroup = {
  title: string
  items: SiteIndexItem[]
}

const cnDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const cnCount = (n: number) => cnDigits[n] ?? String(n)

/** 顶栏「目录」弹层：全站每个可访问的页面都要在这里有一格。 */
export const siteIndex: SiteIndexGroup[] = [
  {
    title: '作品',
    items: [
      {
        href: '/projects',
        label: '项目',
        note: `${cnCount(projects.length)}件作品的想法、技术与演示`,
      },
      { href: '/articles', label: '文章', note: '把灵感写慢，把问题写透' },
      { href: '/honors', label: '荣誉', note: '奖状原件与成长节点' },
    ],
  },
  {
    title: '游戏',
    items: [
      {
        href: '/benchmarks',
        label: '反应力',
        note: `反应、记忆与专注的${cnCount(benchmarkGames.length)}个小挑战`,
      },
      { href: '/leaderboard', label: '排行榜', note: '每个挑战的最好成绩' },
      {
        href: '/jay-town/',
        label: '樱花小镇',
        note: '沿着周杰伦的歌，散步到花开的街角',
        standalone: true,
      },
    ],
  },
  {
    title: '关于',
    items: [
      { href: '/about', label: '关于我', note: '照片、方向和自我介绍' },
      { href: '/class', label: '班级空间', note: '只属于我们这一班的相册与档案' },
    ],
  },
  {
    title: '往来',
    items: [
      { href: '/guestbook', label: '留言簿', note: '路过的人，留一句话' },
      { href: '/contact', label: '联系', note: '合作、交流或反馈' },
      { href: '/messages', label: '消息', note: '登录后的私信' },
      { href: '/account', label: '账号', note: '登录与注册' },
      { href: '/sponsor', label: '赞助', note: '支持这件长期作品' },
    ],
  },
  {
    title: '信笺',
    items: [
      {
        href: '/fulei-night/',
        label: '傅雷中学的夜晚',
        note: '给潘潘和朋友的一段夜路',
        standalone: true,
      },
      {
        href: '/mini-love/',
        label: '写给诗菡',
        note: '那次合唱，后来有了回声',
        standalone: true,
      },
      {
        href: '/mid-autumn/',
        label: '中秋 · 给诗菡',
        note: '今晚的月亮，分你一半',
        standalone: true,
      },
    ],
  },
]

/** 首页「目录」里额外给一排本页章节，替代原先顶栏的锚点跳转。 */
export const homeChapters = [
  { href: '#about', label: '关于' },
  { href: '#work', label: '作品' },
  { href: '#my-way', label: '我的路' },
  { href: '#contact', label: '联系' },
]
