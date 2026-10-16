import { describe, expect, it } from 'vitest'
import { WEAPONS } from '@/data/items'
import { scalingGrade, scalingValue } from '@/data/labels'
import {
  MAX_REGULAR_LEVEL,
  MAX_SOMBER_LEVEL,
  levelFor,
  maxUpgradeLevel,
  regularFromSomber,
  somberFromRegular,
  upgradeStats,
} from '@/data/upgrade'
import { buildRows, sortRows, weaponStats } from '@/features/weaponTable/weaponTable'
import type { WeaponItem } from '@/types'

function weapon(id: string): WeaponItem {
  const w = WEAPONS.find((x) => x.id === id)
  if (!w) throw new Error(`no weapon ${id}`)
  return w
}

describe('최대 강화 단계', () => {
  it('일반 무기 +25, 특수 무기 +10', () => {
    expect(maxUpgradeLevel(weapon('uchigatana'))).toBe(MAX_REGULAR_LEVEL)
    expect(maxUpgradeLevel(weapon('rivers-of-blood'))).toBe(MAX_SOMBER_LEVEL)
  })

  it('모든 무기의 최대 단계는 0, 10, 25 중 하나', () => {
    const levels = new Set(WEAPONS.flatMap((w) => [w, ...Object.values(w.affinities ?? {})]).map(maxUpgradeLevel))
    for (const l of levels) expect([0, 10, 25]).toContain(l)
  })

  it('최대 단계는 강화 재료와 맞는다', () => {
    for (const w of WEAPONS) {
      const max = maxUpgradeLevel(w)
      if (max === 25) expect(w.upgradeMaterial).toBe('Smithing Stone')
      if (max === 10) expect(w.upgradeMaterial).toBe('Somber Smithing Stone')
    }
  })
})

describe('일반 ↔ 특수 단계 변환', () => {
  it('+25 ↔ +10, +10 → +4', () => {
    expect(somberFromRegular(25)).toBe(10)
    expect(somberFromRegular(10)).toBe(4)
    expect(somberFromRegular(0)).toBe(0)
    expect(regularFromSomber(10)).toBe(25)
    expect(regularFromSomber(4)).toBe(10)
  })

  it('특수 → 일반 → 특수로 바꿔도 같은 단계로 돌아온다', () => {
    for (let s = 0; s <= MAX_SOMBER_LEVEL; s++) expect(somberFromRegular(regularFromSomber(s))).toBe(s)
  })

  it('levelFor는 무기 종류에 맞는 단계를 고르고 최대 단계를 넘지 않는다', () => {
    const setting = { regular: 25, somber: 7 }
    expect(levelFor(weapon('uchigatana'), setting)).toBe(25)
    expect(levelFor(weapon('rivers-of-blood'), setting)).toBe(7)
    expect(levelFor(weapon('uchigatana'), { regular: 99, somber: 0 })).toBe(25)
    expect(levelFor(weapon('uchigatana'), { regular: -3, somber: 0 })).toBe(0)
  })
})

describe('강화 수치 (게임 값과 비교)', () => {
  it('우치가타나 +25: 물리 281, 근력 D(54), 기량 C(82), 출혈 45 그대로', () => {
    const u = upgradeStats(weapon('uchigatana'), 25)
    expect(u.damage.physical).toBe(281)
    expect(scalingValue(u.scaling.strength)).toBe(54)
    expect([scalingGrade(u.scaling.strength), scalingGrade(u.scaling.dexterity)]).toEqual(['D', 'C'])
    expect(scalingValue(u.scaling.dexterity)).toBe(82)
    expect(u.status.bleed).toBe(45)
  })

  it('피의 강 +10: 물리 186, 화염 186', () => {
    const r = upgradeStats(weapon('rivers-of-blood'), 10)
    expect(r.damage.physical).toBe(186)
    expect(r.damage.fire).toBe(186)
  })

  it('피 변질 우치가타나: 출혈이 강화 단계마다 오른다 (+0 57 → +25 82)', () => {
    const blood = weaponStats(weapon('uchigatana'), 'Blood')!
    expect(upgradeStats(blood, 0).status.bleed).toBe(57)
    expect(upgradeStats(blood, 10).status.bleed).toBe(67)
    expect(upgradeStats(blood, 25).status.bleed).toBe(82)
  })

  it('표준 변질 +0은 데이터 값 그대로, 원본 객체는 바뀌지 않는다', () => {
    const u = weapon('uchigatana')
    const zero = upgradeStats(u, 0)
    expect(zero.damage).toEqual(u.damage)
    expect(zero.scaling).toEqual(u.scaling)
    expect(zero.guard).toEqual(u.guard)
    upgradeStats(u, 25)
    expect(u.damage.physical).toBe(115)
  })

  it('다른 변질은 +0에도 강화 배율을 곱한다 (원본 사이트와 같은 계산)', () => {
    const heavy = weaponStats(weapon('uchigatana'), 'Heavy')!
    expect(heavy.damage.physical).toBe(110) // 데이터 값
    expect(upgradeStats(heavy, 0).damage.physical).toBe(104) // 110 × 0.95
  })

  it('가드 경감률은 100을 넘지 않는다', () => {
    for (const w of WEAPONS) {
      for (const st of [w, ...Object.values(w.affinities ?? {})]) {
        const g = upgradeStats(st, maxUpgradeLevel(st)).guard
        for (const v of [g.physical, g.magic, g.fire, g.lightning, g.holy]) expect(v ?? 0).toBeLessThanOrEqual(100)
      }
    }
  })

  it('강화할수록 공격력이 줄지 않는다 (모든 무기·변질)', () => {
    for (const w of WEAPONS) {
      for (const st of [w, ...Object.values(w.affinities ?? {})]) {
        let prev = 0
        for (let l = 0; l <= maxUpgradeLevel(st); l++) {
          const total = Object.values(upgradeStats(st, l).damage).reduce((a, b) => a + (b ?? 0), 0)
          expect(total).toBeGreaterThanOrEqual(prev)
          prev = total
        }
      }
    }
  })
})

describe('표에 강화 적용', () => {
  it('행마다 적용된 강화 단계가 들어가고, 정렬도 강화 수치로 한다', () => {
    const rows = buildRows([weapon('uchigatana'), weapon('rivers-of-blood')], 'Standard', { regular: 25, somber: 10 })
    expect(rows.map((r) => [r.w.id, r.level])).toEqual([
      ['uchigatana', 25],
      ['rivers-of-blood', 10],
    ])
    const sorted = sortRows(rows, 'dmg.physical', 'desc')
    expect(sorted.map((r) => r.st.damage.physical)).toEqual([281, 186])
  })
})
