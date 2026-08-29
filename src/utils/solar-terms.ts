/**
 * solar-terms — 二十四节气
 * 数据为近似交节日期（每年浮动 ±1 天，用于文化展示足够）；
 * 「line」取《月令七十二候》物候意象的化用短句，非原文引用。
 */

export type SolarTerm = {
  /** 交节近似日期（月） */
  m: number
  /** 交节近似日期（日） */
  d: number
  name: string
  season: '春' | '夏' | '秋' | '冬'
  line: string
}

export const SOLAR_TERMS: readonly SolarTerm[] = [
  { m: 1, d: 5, name: '小寒', season: '冬', line: '雁北乡，鹊垒新巢；寒极处，春意暗生。' },
  { m: 1, d: 20, name: '大寒', season: '冬', line: '冰坚雪盛，岁暮天寒；静待东风解冻。' },
  { m: 2, d: 4, name: '立春', season: '春', line: '东风解冻，蛰虫始振；万物以荣。' },
  { m: 2, d: 19, name: '雨水', season: '春', line: '獭祭鱼，草木萌动；好雨知时。' },
  { m: 3, d: 5, name: '惊蛰', season: '春', line: '春雷乍动，惊醒蛰伏；桃始华。' },
  { m: 3, d: 20, name: '春分', season: '春', line: '玄鸟至，雷乃发声；昼夜均而寒暑平。' },
  { m: 4, d: 4, name: '清明', season: '春', line: '桐始华，虹始见；踏青寻春。' },
  { m: 4, d: 20, name: '谷雨', season: '春', line: '雨生百谷，萍始生；正是播种时节。' },
  { m: 5, d: 5, name: '立夏', season: '夏', line: '蝼蝈鸣，蚯蚓出；万物至此皆长大。' },
  { m: 5, d: 21, name: '小满', season: '夏', line: '麦粒渐满，江河渐盈；小得盈满。' },
  { m: 6, d: 5, name: '芒种', season: '夏', line: '有芒之谷可种；螳螂生，鵙始鸣。' },
  { m: 6, d: 21, name: '夏至', season: '夏', line: '鹿角解，蜩始鸣；日长之至，影短之至。' },
  { m: 7, d: 7, name: '小暑', season: '夏', line: '温风至，蟋蟀居宇；荷风送香。' },
  { m: 7, d: 22, name: '大暑', season: '夏', line: '腐草为萤，土润溽暑；大雨时行。' },
  { m: 8, d: 7, name: '立秋', season: '秋', line: '凉风至，白露生；寒蝉鸣柳。' },
  { m: 8, d: 23, name: '处暑', season: '秋', line: '鹰乃祭鸟，天地始肃；暑气至此而止。' },
  { m: 9, d: 7, name: '白露', season: '秋', line: '鸿雁来，玄鸟归；露从今夜白。' },
  { m: 9, d: 23, name: '秋分', season: '秋', line: '雷始收声，蛰虫坯户；平分秋色。' },
  { m: 10, d: 8, name: '寒露', season: '秋', line: '鸿雁南迁，菊有黄华；露气寒冷。' },
  { m: 10, d: 23, name: '霜降', season: '秋', line: '草木黄落，蛰虫咸俯；霜色染秋山。' },
  { m: 11, d: 7, name: '立冬', season: '冬', line: '水始冰，地始冻；万物收藏。' },
  { m: 11, d: 22, name: '小雪', season: '冬', line: '虹藏不见，闭塞成冬；初雪未盛。' },
  { m: 12, d: 7, name: '大雪', season: '冬', line: '积阴为雪，至此而盛；千里同云。' },
  { m: 12, d: 21, name: '冬至', season: '冬', line: '蚯蚓结，麋角解；日短之至，阳气回生。' },
] as const

/**
 * 取「日期」所属节气（含当日），默认现在。
 * 交节近似，前后一日误差属可接受范围。
 */
export function getSolarTerm(date: Date = new Date()): SolarTerm {
  const month = date.getMonth() + 1
  const day = date.getDate()

  let current = SOLAR_TERMS[SOLAR_TERMS.length - 1] as SolarTerm

  for (const term of SOLAR_TERMS) {
    if (month > term.m || (month === term.m && day >= term.d)) {
      current = term as SolarTerm
    }
  }

  return current
}
