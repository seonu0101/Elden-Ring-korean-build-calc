import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { calculateAttack, correctionGraphValue, CORRECTION_GRAPH_IDS } from '@/data/attackPower'
import { curveAt, curvePieces } from '@/data/curves'
import { calculateDamage, DAMAGE_CALC_STORAGE_KEY, defenseMultiplier } from '@/data/damage'
import { characterDefense, GRAPH, statGraphValue } from '@/data/defense'
import { ITEMS_BY_ID } from '@/data/items'
import DamageCalculator from '@/features/damage/DamageCalculator.vue'
import FormulaReference from '@/features/formulas/FormulaReference.vue'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import type { WeaponItem } from '@/types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

/** 화면에 쓴 식을 그대로 계산해 본다 (−, ×, ^ 를 JS 연산자로) */
function evaluate(expr: string): number {
  const js = expr.replace(/−/g, '-').replace(/×/g, '*').replace(/\^/g, '**')
  return Function(`"use strict"; return (${js})`)() as number
}

describe('곡선 식', () => {
  it('무기 보정 곡선 식(÷100)은 보정 곡선 표와 같고, 쓴 식을 계산하면 같은 값이 나온다', () => {
    for (const id of CORRECTION_GRAPH_IDS) {
      for (const x of [0, 1, 5, 17, 18, 19, 20, 33, 45, 60, 61, 79, 80, 99, 120, 150]) {
        const { expr, value } = curveAt(id, x, 100)
        expect(value).toBeCloseTo(correctionGraphValue(id, x), 8)
        expect(evaluate(expr)).toBeCloseTo(value, 8)
      }
    }
  })

  it('방어력 곡선 식도 실제 값과 같다', () => {
    for (const id of Object.values(GRAPH)) {
      for (let x = 0; x <= 300; x += 7) {
        const { expr, value } = curveAt(id, x)
        expect(value).toBeCloseTo(statGraphValue(id, x), 8)
        expect(evaluate(expr)).toBeCloseTo(value, 8)
      }
    }
  })

  it('구간 식: #0은 4구간 + 최대', () => {
    const pieces = curvePieces(0, 100)
    expect(pieces.map((p) => p.range)).toEqual(['1 ≤ x < 18', '18 ≤ x < 60', '60 ≤ x < 80', '80 ≤ x < 150', 'x ≥ 150'])
    expect(pieces[0]!.expr).toBe('(25 × ((x − 1) / 17)^1.2) / 100')
    expect(pieces[1]!.expr).toBe('(25 + 50 × (1 − (1 − (x − 18) / 42)^1.2)) / 100')
    expect(pieces[4]!.expr).toBe('(110) / 100')
  })
})

describe('실제 데미지 공식', () => {
  it('방어 배율은 구간 경계에서 이어진다', () => {
    const at = (r: number) => defenseMultiplier(r * 100, 100).multiplier
    expect(at(0.1)).toBe(0.1)
    expect(at(0.125)).toBeCloseTo(0.1, 12)
    expect(at(1)).toBeCloseTo(0.4, 12)
    expect(at(0.9999999)).toBeCloseTo(0.4, 5)
    expect(at(2.5)).toBeCloseTo(0.7, 12)
    expect(at(2.4999999)).toBeCloseTo(0.7, 5)
    expect(at(8)).toBe(0.9)
    expect(at(7.9999999)).toBeCloseTo(0.9, 5)
    expect(defenseMultiplier(100, 0).multiplier).toBe(0.9)
  })

  it('속성마다 계산해서 더하고, 물리는 공격 종류의 경감률을 쓴다', () => {
    const r = calculateDamage({
      attack: { physical: 300, magic: 100, fire: 0, lightning: 0, holy: 0 },
      attackMultiplier: { physical: 1.15, magic: 1.15 },
      motionValue: 120,
      defense: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      negation: { physical: 10, strike: 0, slash: 0, pierce: 30, magic: 20, fire: 0, lightning: 0, holy: 0 },
      physicalType: 'Pierce',
    })
    const phys = 300 * 1.15 * 1.2
    const mag = 100 * 1.15 * 1.2
    const f = (a: number) => (a / 100 >= 2.5 ? 0.9 - 0.2 * ((8 - a / 100) / 5.5) ** 2 : 0.7 - 0.3 * ((2.5 - a / 100) / 1.5) ** 2)
    expect(r.parts.map((p) => p.negationType)).toEqual(['pierce', 'magic'])
    expect(r.parts[0]!.damage).toBeCloseTo(phys * f(phys) * 0.7, 10)
    expect(r.parts[1]!.damage).toBeCloseTo(mag * f(mag) * 0.8, 10)
    expect(r.total).toBe(Math.floor(r.parts[0]!.damage + r.parts[1]!.damage))
  })
})

describe('장비 화면 실제 데미지', () => {
  function setup() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const character = useCharacterStore()
    character.clearInventory()
    const slot = character.addItem('longsword')!
    character.equip({ kind: 'weapon', equipIndex: 0 }, slot.uid)
    return mount(DamageCalculator, { global: { plugins: [pinia] } })
  }

  it('상대 방어력·경감률을 넣으면 피해가 나오고, 값은 저장된다', async () => {
    const wrapper = setup()
    await wrapper.find('[data-testid="damage-defense-physical"]').setValue('120')
    await wrapper.find('[data-testid="damage-defense-physical"]').trigger('change')
    await wrapper.find('[data-testid="damage-negation-physical"]').setValue('20')
    await wrapper.find('[data-testid="damage-negation-physical"]').trigger('change')
    await wrapper.find('[data-testid="damage-physical-type"]').setValue('Standard')

    const stats = useStatsStore()
    const attack = calculateAttack(ITEMS_BY_ID.get('longsword') as WeaponItem, 'Standard', 25, stats.combatStats)!
    const expected = calculateDamage({
      attack: { physical: attack.damage.physical.base + attack.damage.physical.scaling, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValue: 100,
      defense: { physical: 120, magic: 100, fire: 100, lightning: 100, holy: 100 },
      negation: { physical: 20, strike: 0, slash: 0, pierce: 0, magic: 0, fire: 0, lightning: 0, holy: 0 },
      physicalType: 'Standard',
    })
    expect(wrapper.find('[data-testid="damage-total"]').text()).toBe(`${expected.total}`)
    expect(JSON.parse(localStorage.getItem(DAMAGE_CALC_STORAGE_KEY)!).defense.physical).toBe(120)

    // 모션 값을 바꾸면 피해도 바뀐다
    await wrapper.find('[data-testid="damage-motion"]').setValue('200')
    await wrapper.find('[data-testid="damage-motion"]').trigger('change')
    expect(Number(wrapper.find('[data-testid="damage-total"]').text())).toBeGreaterThan(expected.total)
    wrapper.unmount()
  })

  it('"내 값 넣기"는 내 캐릭터의 방어력·경감률을 넣는다', async () => {
    const wrapper = setup()
    await wrapper.find('[data-testid="damage-fill-me"]').trigger('click')
    const defense = characterDefense(useStatsStore().defenseAttributes)
    expect((wrapper.find('[data-testid="damage-defense-magic"]').element as HTMLInputElement).value).toBe(`${defense.magic}`)
    expect((wrapper.find('[data-testid="damage-negation-physical"]').element as HTMLInputElement).value).toBe('0')
    wrapper.unmount()
  })

  it('무기가 없으면 안내만 보인다', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useCharacterStore().clearInventory()
    const wrapper = mount(DamageCalculator, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('장착한 무기가 없습니다')
    wrapper.unmount()
  })
})

describe('계산식 페이지', () => {
  it('"곡선"에 정확한 식이 붙고, 실제 데미지 항목이 있다', () => {
    const wrapper = mount(FormulaReference)
    expect(wrapper.find('[data-testid="fr-weapon-curves"]').text()).toContain('(25 + 50 × (1 − (1 − (x − 18) / 42)^1.2)) / 100')
    expect(wrapper.find('[data-testid="fr-defense-curve-102"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fr-attack-example"]').text()).toContain('곡선 #0(20) = (25 + 50 × (1 − (1 − (20 − 18) / 42)^1.2)) / 100')
    expect(wrapper.find('[data-testid="fr-damage"]').text()).toContain('0.9 − 0.2 × ((8 − r) / 5.5)²')
    expect(wrapper.find('[data-testid="fr-damage-example"]').text()).toMatch(/= \d+$/)
    wrapper.unmount()
  })
})
