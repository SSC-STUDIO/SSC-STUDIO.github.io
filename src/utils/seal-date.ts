/**
 * 朱砂日戳用的中文纪年 / 月日 / 星期。
 * 给 DateSeal 的构建期兜底和客户端覆写共用，避免两套算法各写各的。
 */

export const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

export const NUMERALS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

/** 2026 → 二〇二六 */
export function toChineseNumber(value: number): string {
  return String(value)
    .split('')
    .map((digit) => NUMERALS[Number(digit)] ?? digit)
    .join('')
}

/** 7 → 七月；10 → 十月；11 → 十一月（不再误写成「十月」） */
export function toChineseMonth(value: number): string {
  if (value === 1) return '正月'
  if (value === 10) return '十月'
  if (value === 11) return '十一月'
  if (value === 12) return '腊月'
  return `${NUMERALS[value] ?? value}月`
}

/** 1 → 一；10 → 十；16 → 十六；21 → 廿一 */
export function toChineseDay(value: number): string {
  if (value <= 0) return String(value)
  if (value < 10) return NUMERALS[value]
  if (value === 10) return '十'
  if (value < 20) return `十${NUMERALS[value % 10]}`
  if (value === 20) return '二十'
  if (value < 30) return `廿${NUMERALS[value % 10]}`
  if (value === 30) return '三十'
  return `三十${NUMERALS[value % 10] ?? value % 10}`
}

export type SealDateParts = {
  year: string
  day: string
  week: string
  iso: string
}

export function formatSealDate(date: Date = new Date()): SealDateParts {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return {
    year: `${toChineseNumber(year)}年`,
    day: `${toChineseMonth(month)}${toChineseDay(day)}`,
    week: `星期${WEEKDAY_CN[date.getDay()]}`,
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}
