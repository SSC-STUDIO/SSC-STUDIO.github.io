export type Article = {
  slug: string
  href: string
  kicker: string
  title: string
  summary: string
  date: string
  isoDate: string
  words: number
  tags: string[]
}

/** 与正文页标题、日期、字数保持同一份，RSS / 目录都从这里出 */
export const articles: Article[] = [
  {
    slug: 'why-build-personal-site',
    href: '/articles/why-build-personal-site',
    kicker: 'featured',
    title: '为什么还在做个人网站',
    summary: '在模板和社交平台之间，个人站仍然值得投入。',
    date: '2026年3月1日',
    isoDate: '2026-03-01',
    words: 260,
    tags: ['meta', 'writing'],
  },
  {
    slug: 'ai-prototype-loop',
    href: '/articles/ai-prototype-loop',
    kicker: 'note',
    title: 'AI 原型的快速迭代循环',
    summary: '从想法到可点击 demo，我使用的四步循环。',
    date: '2026年2月15日',
    isoDate: '2026-02-15',
    words: 200,
    tags: ['ai', 'engineering'],
  },
]
