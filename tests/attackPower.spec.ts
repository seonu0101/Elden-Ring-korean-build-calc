import { describe, expect, it } from 'vitest'
import { WEAPONS } from '@/data/items'
import { calculateAttack, canTwoHandBonus, effectiveStats, partTotal } from '@/data/attackPower'
import { DAMAGE_TYPES, STATUS_TYPES } from '@/types'
import type { AffinityName, CharacterStats } from '@/types'
import reference from './fixtures/attackReference.json'

interface ReferenceCase {
  name: string
  inf: string
  level: number
  two: boolean
  stats: { str: number; dex: number; int: number; fth: number; arc: number }
  total: number
  /** [기본값, 보정값] */
  dmg: Record<string, [number, number]>
  st: Record<string, [number, number]>
}

function weaponByName(name: string) {
  const w = WEAPONS.find((x) => x.name === name)
  if (!w) throw new Error(`no weapon ${name}`)
  return w
}

function toStats(s: ReferenceCase['stats']): CharacterStats {
  return { strength: s.str, dexterity: s.dex, intelligence: s.int, faith: s.fth, arcane: s.arc }
}

describe('원본 사이트 계산기와 같은 값 (15개 사례)', () => {
  // JSON 추론 타입은 [기본값, 보정값] 쌍을 number[]로 보므로 unknown을 거친다.
  for (const c of reference.cases as unknown as ReferenceCase[]) {
    const label = `${c.name} ${c.inf} +${c.level} ${c.two ? '양손' : '한손'}`
    it(label, () => {
      const result = calculateAttack(weaponByName(c.name), c.inf as AffinityName, c.level, toStats(c.stats), c.two)!
      expect(result).not.toBeNull()
      expect(result.total).toBe(c.total)
      for (const d of DAMAGE_TYPES) {
        const [base, scaling] = c.dmg[d] ?? [0, 0]
        expect(result.damage[d].base).toBeCloseTo(base, 4)
        expect(result.damage[d].scaling).toBeCloseTo(scaling, 4)
      }
      for (const t of STATUS_TYPES) {
        const [base, scaling] = c.st[t] ?? [0, 0]
        expect(result.status[t].base).toBeCloseTo(base, 4)
        expect(result.status[t].scaling).toBeCloseTo(scaling, 4)
      }
    })
  }
})

describe('양손 근력', () => {
  it('양손이면 근력 × 1.5 (최대 150)', () => {
    const gs = weaponByName('Greatsword')
    const base = { strength: 40, dexterity: 10, intelligence: 10, faith: 10, arcane: 10 }
    expect(effectiveStats(base, gs, true).strength).toBe(60)
    expect(effectiveStats({ ...base, strength: 99 }, gs, true).strength).toBe(148)
    expect(effectiveStats(base, gs, false).strength).toBe(40)
  })

  it('주먹·갈고리 등은 양손 보너스가 없다', () => {
    expect(canTwoHandBonus(weaponByName('Caestus'))).toBe(false)
    expect(canTwoHandBonus(weaponByName('Greatsword'))).toBe(true)
  })

  it('양손으로 요구 근력을 채우면 감소가 풀린다 (특대검 근력 31 필요, 21 × 1.5 = 31)', () => {
    const gs = weaponByName('Greatsword')
    const stats = { strength: 21, dexterity: 12, intelligence: 10, faith: 10, arcane: 10 }
    const one = calculateAttack(gs, 'Standard', 0, stats, false)!
    const two = calculateAttack(gs, 'Standard', 0, stats, true)!
    expect(one.unmet).toContain('strength')
    expect(one.damage.physical.scaling).toBeLessThan(0)
    expect(two.unmet).toEqual([])
    expect(two.damage.physical.scaling).toBeGreaterThan(0)
  })
})

describe('기타', () => {
  it('변질할 수 없는 무기에 다른 변질을 주면 null', () => {
    const stats = { strength: 30, dexterity: 30, intelligence: 30, faith: 30, arcane: 30 }
    expect(calculateAttack(weaponByName('Rivers of Blood'), 'Heavy', 0, stats)).toBeNull()
  })

  it('partTotal은 기본값과 보정값을 합해 소수점을 버린다', () => {
    expect(partTotal({ base: 281.75, scaling: 216.87 })).toBe(498)
    expect(partTotal({ base: 401.8, scaling: -160.72 })).toBe(241)
  })

  it('모든 무기·변질에서 계산이 숫자를 돌려준다', () => {
    const stats = { strength: 40, dexterity: 40, intelligence: 40, faith: 40, arcane: 40 }
    for (const w of WEAPONS) {
      for (const a of ['Standard', ...Object.keys(w.affinities ?? {})] as AffinityName[]) {
        const r = calculateAttack(w, a, 0, stats)!
        expect(Number.isFinite(r.total)).toBe(true)
      }
    }
  })
})
