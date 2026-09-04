export type Project = {
  slug: string
  href: string
  title: string
  name: string
  year: string
  kicker: string
  id: string
  cover: string
  summary: string
  tags: string[]
  homeKey: string
  rssDate?: string
}

type ProjectDraft = Omit<Project, 'href' | 'id'>

const drafts: ProjectDraft[] = [
  {
    slug: 'my-website',
    title: 'MyWebsite 个人站 · 2026',
    name: 'MyWebsite 个人站',
    year: '2026',
    kicker: 'active · 2026',
    cover: '/images/work-covers/my-website.svg',
    summary:
      'Chen Runsen 的个人站 monorepo：作品集、文章、Human Benchmark 与班级空间。',
    tags: ['Astro', 'TypeScript', 'Fastify', 'Prisma', 'PostgreSQL'],
    homeKey: '1w83',
    rssDate: '2026-03-01',
  },
  {
    slug: 'ai-lab-notes',
    title: 'AI Lab Notes · 2026',
    name: 'AI Lab Notes',
    year: '2026',
    kicker: 'active · 2026',
    cover: '/images/work-covers/ai-lab.svg',
    summary:
      '自托管 LLM 网关与 CV 实验：模型路由、故障回退、遥测，以及可复现的训练笔记。',
    tags: ['Go', 'Python', 'PyTorch', 'LLM Ops', 'OpenAI API'],
    homeKey: 'p20h',
    rssDate: '2026-04-10',
  },
  {
    slug: 'interactive-game-kit',
    title: 'Interactive Game Kit · 2025',
    name: 'Interactive Game Kit',
    year: '2025',
    kicker: 'active · 2025',
    cover: '/images/work-covers/game-kit.svg',
    summary: '浏览器棋类、Roguelite 与 Godot 原型 — 手感、反馈与排行榜一体。',
    tags: ['JavaScript', 'Godot', 'GDScript', 'TypeScript', 'Canvas'],
    homeKey: '965w',
    rssDate: '2025-12-20',
  },
  {
    slug: 'games-lab',
    title: 'Games Lab · 2025',
    name: 'Games Lab',
    year: '2025',
    kicker: 'active · 2025',
    cover: '/images/work-covers/games.svg',
    summary: '把棋盘规则、弹幕生存与 Godot 竞技场做成可试玩的游戏集合。',
    tags: ['JavaScript', 'GDScript', 'Godot'],
    homeKey: 'v9d8',
  },
  {
    slug: 'benchmarks',
    title: 'Human Benchmarks · 2025',
    name: 'Human Benchmarks',
    year: '2025',
    kicker: 'active · 2025',
    cover: '/images/work-covers/benchmarks.svg',
    summary: '反应、记忆、序列挑战 — 内置在 MyWebsite，分数可提交、可排行。',
    tags: ['TypeScript', 'Fastify', 'Canvas'],
    homeKey: '4hg5',
  },
  {
    slug: 'class-space',
    title: 'Class Space · 2025',
    name: 'Class Space',
    year: '2025',
    kicker: 'active · 2025',
    cover: '/images/work-covers/class.svg',
    summary: '班级记忆现场：相册、同学档案与只属于我们这一班的片段。',
    tags: ['Astro', 'TypeScript', 'Fastify'],
    homeKey: 'sgc6',
  },
  {
    slug: 'articles',
    title: 'Articles & Notes · 2025',
    name: 'Articles & Notes',
    year: '2025',
    kicker: 'active · 2025',
    cover: '/images/work-covers/articles.svg',
    summary:
      '把灵感写慢，把问题写透 — LLM 网关、CV 实验与工程复盘的文字记录。',
    tags: ['Markdown', 'TypeScript'],
    homeKey: 'yfjd',
  },
  {
    slug: 'honors',
    title: 'Honors & Growth · 2024',
    name: 'Honors & Growth',
    year: '2024',
    kicker: 'active · 2024',
    cover: '/images/work-covers/honors.svg',
    summary: '创客、竞赛与成长节点 — 努力被看见的那些瞬间。',
    tags: ['Scratch', '创客', '信息学'],
    homeKey: 'yyfm',
  },
]

/** href 由 slug 算出，与 src/pages/projects/<slug>.astro 对齐；卷号随条数生成 */
export const projects: Project[] = drafts.map((project, index, all) => ({
  ...project,
  href: `/projects/${project.slug}`,
  id: `#CRS-${String(index + 1).padStart(3, '0')}/${String(all.length).padStart(2, '0')}`,
}))
