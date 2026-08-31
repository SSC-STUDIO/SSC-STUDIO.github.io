export type BenchmarkGame = {
  id: string
  href: string
  label: string
  title: string
  kicker: string
  summary: string
  unit: 'ms' | 'level'
  sort?: 'asc' | 'desc'
  ref: string
  refUnit: string
  tags: string[]
}

/** 游戏页、排行榜 tabs、sitemap 共用同一份 id */
export const benchmarkGames: BenchmarkGame[] = [
  {
    id: 'reaction-test',
    href: '/benchmarks/reaction-test',
    label: '反应时间',
    title: '反应时间',
    kicker: 'reaction',
    summary: '等待方块变绿立即点击，记录毫秒级的视觉反应延迟。',
    unit: 'ms',
    sort: 'asc',
    ref: '250',
    refUnit: 'avg ms',
    tags: ['视觉', '毫秒级', '5 次取平均'],
  },
  {
    id: 'number-memory',
    href: '/benchmarks/number-memory',
    label: '数字记忆',
    title: '数字记忆',
    kicker: 'memory',
    summary: '逐位闪过的数字越来越长，看你能复述到几位。',
    unit: 'level',
    ref: '9',
    refUnit: 'digits',
    tags: ['短时记忆', '递增', '键盘输入'],
  },
  {
    id: 'visual-memory',
    href: '/benchmarks/visual-memory',
    label: '视觉记忆',
    title: '视觉记忆',
    kicker: 'memory',
    summary: '记住同时闪烁的方块位置，按出现顺序逐一复现。',
    unit: 'level',
    ref: '7',
    refUnit: 'tiles',
    tags: ['空间', '同时闪烁', '复现'],
  },
  {
    id: 'sequence-memory',
    href: '/benchmarks/sequence-memory',
    label: '顺序记忆',
    title: '顺序记忆',
    kicker: 'memory',
    summary: '方块按顺序亮起，按相同顺序点击复现整条序列。',
    unit: 'level',
    ref: '11',
    refUnit: 'steps',
    tags: ['序列', '顺序复现', '可听'],
  },
  {
    id: 'chimp-test',
    href: '/benchmarks/chimp-test',
    label: '黑猩猩测试',
    title: '黑猩猩测试',
    kicker: 'memory',
    summary: '数字在网格中一闪消失，按从小到大顺序点击。',
    unit: 'level',
    ref: '8',
    refUnit: 'digits',
    tags: ['工作记忆', '数字', '5×5'],
  },
  {
    id: 'word-memory',
    href: '/benchmarks/word-memory',
    label: '词语记忆',
    title: '词语记忆',
    kicker: 'attention',
    summary: '记住屏幕上闪过的词语，判断下一个词是否出现过。',
    unit: 'level',
    ref: '12',
    refUnit: 'words',
    tags: ['词语', '再认', '递增'],
  },
  {
    id: 'schulte-grid',
    href: '/benchmarks/schulte-grid',
    label: '舒尔特表',
    title: '舒尔特表',
    kicker: 'attention',
    summary: '按 1 → 25 顺序点亮全部格子，比的是眼与手的协同。',
    unit: 'ms',
    sort: 'asc',
    ref: '20',
    refUnit: 's',
    tags: ['注意力', '5×5', '计时'],
  },
]
