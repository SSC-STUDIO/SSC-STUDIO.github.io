/**
 * 壳层小组件的纯函数回归：日戳、节气、时段、导航高亮。
 */
import assert from 'node:assert/strict'
import { formatSealDate } from '../src/utils/seal-date.ts'
import { getSolarTerm } from '../src/utils/solar-terms.ts'
import { formatClockTime, getDaypart } from '../src/utils/daypart.ts'
import { isNavCurrent } from '../src/utils/nav-current.ts'

function at(iso: string, hour = 12): Date {
  const date = new Date(`${iso}T00:00:00`)
  date.setHours(hour, 0, 0, 0)
  return date
}

{
  const samples: Array<[string, string]> = [
    ['2026-01-01', '正月一'],
    ['2026-10-10', '十月十'],
    ['2026-11-16', '十一月十六'],
    ['2026-12-21', '腊月廿一'],
    ['2026-09-04', '九月四'],
  ]
  for (const [iso, day] of samples) {
    const stamp = formatSealDate(at(iso))
    assert.equal(stamp.day, day, `日戳 ${iso}`)
  }
  assert.equal(formatSealDate(at('2026-09-04')).year, '二〇二六年')
}

{
  const samples: Array<[string, string]> = [
    ['2026-01-01', '冬至'],
    ['2026-01-05', '小寒'],
    ['2026-09-04', '处暑'],
    ['2026-09-07', '白露'],
    ['2026-12-21', '冬至'],
  ]
  for (const [iso, name] of samples) {
    assert.equal(getSolarTerm(at(iso)).name, name, `节气 ${iso}`)
  }
  assert.equal(getSolarTerm(at('2026-09-04')).season, '秋')
}

{
  assert.equal(getDaypart(at('2026-09-04', 4)).key, 'night')
  assert.equal(getDaypart(at('2026-09-04', 5)).key, 'dawn')
  assert.equal(getDaypart(at('2026-09-04', 8)).key, 'day')
  assert.equal(getDaypart(at('2026-09-04', 17)).key, 'dusk')
  assert.equal(getDaypart(at('2026-09-04', 20)).key, 'night')
  assert.equal(formatClockTime(at('2026-09-04', 8)), '08:00')
}

{
  const cases: Array<[string, string, string, boolean]> = [
    ['/', '/', '', true],
    ['/', '/', '#about', false],
    ['/#about', '/', '#about', true],
    ['#about', '/', '#about', true],
    ['/#about', '/about', '', true],
    ['/#work', '/projects', '', true],
    ['/#work', '/projects/my-website', '', true],
    ['/#work', '/', '', false],
    ['/messages', '/messages', '', true],
    ['/contact', '/contact', '', true],
    ['/#contact', '/', '#contact', true],
    ['/#contact', '/contact', '', true],
    ['/messages', '/contact', '', false],
  ]
  for (const [href, path, hash, expect] of cases) {
    assert.equal(isNavCurrent(href, path, hash), expect, `${href} @ ${path}${hash}`)
  }
}

console.log('shell-widgets: ok')
