import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { damageNegation } from '@/data/defense'
import { combineEffects, percentText } from '@/data/effects'
import type { EffectSource } from '@/data/effects'
import { BUFFS, BUFFS_BY_ID, ITEMS_BY_ID } from '@/data/items'
import { TALISMAN_ATTRIBUTE_LABELS, TALISMAN_CONDITION_LABELS } from '@/data/talismanEffects'
import BuffPanel from '@/features/buffs/BuffPanel.vue'
import { BUFFS_STORAGE_KEY, useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import type { BuffItem, ProtectorItem, TalismanItem } from '@/types'

const buff = (id: string): EffectSource => {
  const b = BUFFS_BY_ID.get(id) as BuffItem
  if (!b) throw new Error(`no buff ${id}`)
  return { id: b.id, name: b.name, type: b.kind, effects: b.effects }
}
const talisman = (id: string): EffectSource => {
  const t = ITEMS_BY_ID.get(id) as TalismanItem
  return { id: t.id, name: t.name, type: 'talisman', effects: t.effects }
}

describe('버프 데이터', () => {
  it('주문과 소비 아이템, 모든 효과·조건에 한국어 이름이 있다', () => {
    expect(BUFFS.some((b) => b.kind === 'spell')).toBe(true)
    expect(BUFFS.some((b) => b.kind === 'item')).toBe(true)
    for (const b of BUFFS) {
      for (const e of b.effects) {
        expect(TALISMAN_ATTRIBUTE_LABELS[e.attribute], `${b.name}: ${e.attribute}`).toBeDefined()
        for (const c of e.conditions ?? []) expect(TALISMAN_CONDITION_LABELS[c], c).toBeDefined()
      }
    }
  })

  it('황금 맹세(기도): 공격력 ×1.15, 경감 ×1.1', () => {
    const effects = BUFFS_BY_ID.get('spell-golden-vow')!.effects
    expect(effects.map((e) => [e.attribute, e.value])).toEqual([
      ['Attack Power', 1.15],
      ['Absorption', 1.1],
    ])
  })
})

describe('효과 합산 (곱연산)', () => {
  it('황금 맹세 + 샤브리리의 외침: 공격력 +15% × +25% = +43.75%', () => {
    const s = combineEffects([buff('spell-golden-vow'), buff('spell-howl-of-shabriri')])
    for (const d of ['physical', 'magic', 'fire', 'lightning', 'holy'] as const) {
      expect(s.attack[d].multiplier).toBeCloseTo(1.4375, 10)
    }
    expect(percentText(s.attack.physical.multiplier)).toBe('+43.75%')
    expect(s.attack.physical.parts.map((p) => percentText(p.value))).toEqual(['+15%', '+25%'])
    // 받는 피해: 황금 맹세 ×0.9, 샤브리리 ×1.3 → ×1.17 (+17%)
    expect(s.damageTaken.physical.multiplier).toBeCloseTo(0.9 * 1.3, 10)
    expect(percentText(s.damageTaken.holy.multiplier)).toBe('+17%')
  })

  it('PvP에서는 PvP 수치를 쓴다 (황금 맹세 +7.5%)', () => {
    const s = combineEffects([buff('spell-golden-vow')], true)
    expect(s.attack.physical.multiplier).toBeCloseTo(1.075, 10)
  })

  it('속성 한정 버프는 그 속성에만 붙는다 (고양된 고기: 물리 +20%)', () => {
    const s = combineEffects([buff('item-exalted-flesh'), buff('spell-golden-vow')])
    expect(s.attack.physical.multiplier).toBeCloseTo(1.2 * 1.15, 10)
    expect(s.attack.fire.multiplier).toBeCloseTo(1.15, 10)
  })

  it('물리 경감 탈리스만은 물리·타격·참격·관통에만', () => {
    const s = combineEffects([talisman('dragoncrest-shield-talisman')])
    for (const t of ['physical', 'strike', 'slash', 'pierce'] as const) expect(s.damageTaken[t].multiplier).toBeCloseTo(0.9, 10)
    expect(s.damageTaken.magic.multiplier).toBe(1)
  })

  it('능력치 같은 더하기 효과는 더하고, 조건부 효과는 합계에서 뺀다', () => {
    const s = combineEffects([talisman('radagons-soreseal'), talisman('claw-talisman')])
    const strength = s.others.find((o) => o.attribute === 'Strength')!
    expect(strength.total).toBe(5)
    expect(s.attack.physical.multiplier).toBe(1) // 발톱 탈리스만은 점프 공격 조건부
    expect(s.conditional.map((c) => c.source)).toEqual(['Claw Talisman'])
    expect(s.damageTaken.physical.multiplier).toBeCloseTo(1.15, 10) // 라다곤의 각인: 받는 피해 +15%
  })

  it('경감률 표에 버프 경감 효과가 들어간다: 100 × (1 − Π(1 − 방어구) × 받는 피해 배율)', () => {
    const helm = ITEMS_BY_ID.get('vagabond-knight-helm') as ProtectorItem
    const plain = damageNegation([helm]).physical
    const withVow = damageNegation([helm], { physical: 0.9 }).physical
    expect(withVow).toBeCloseTo(100 * (1 - (1 - helm.absorptions.physical / 100) * 0.9), 10)
    expect(withVow).toBeGreaterThan(plain)
  })
})

describe('버프 패널 화면', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  function mountPanel() {
    const pinia = createPinia()
    setActivePinia(pinia)
    return mount(BuffPanel, { global: { plugins: [pinia] } })
  }

  it('버프를 고르면 곱연산 결과와 출처가 보이고, 장착 무기 공격력도 오른다', async () => {
    const wrapper = mountPanel()
    // 기본 장비: 탈리스만 2개(황금나무의 가호, 초록 거북이)가 자동으로 들어간다
    expect(wrapper.findAll('[data-testid="talisman-chip"]')).toHaveLength(2)

    const select = wrapper.find('[data-testid="buff-select"]')
    await select.setValue('spell-golden-vow')
    await select.setValue('spell-howl-of-shabriri')
    expect(wrapper.findAll('[data-testid="buff-chip"]')).toHaveLength(2)

    const attack = wrapper.find('[data-testid="attack-line"]').text()
    expect(attack).toContain('모든 속성')
    expect(attack).toContain('+43.75%')
    expect(attack).toContain('Golden Vow +15% × Howl of Shabriri +25%')

    const buffed = wrapper.find('[data-testid="buffed-RH1"]').text()
    const [before, after] = buffed.match(/(\d+) → (\d+)/)!.slice(1).map(Number) as [number, number]
    expect(after).toBe(Math.floor(after)) // 정수
    expect(after / before).toBeGreaterThan(1.43)
    expect(after / before).toBeLessThan(1.44)

    // 저장된다
    expect(JSON.parse(localStorage.getItem(BUFFS_STORAGE_KEY)!).selected).toEqual(['spell-golden-vow', 'spell-howl-of-shabriri'])
    wrapper.unmount()
  })

  it('PvP로 바꾸면 PvP 수치, × 로 끄면 빠진다', async () => {
    const wrapper = mountPanel()
    useBuffsStore().add('spell-golden-vow')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="attack-line"]').text()).toContain('+15%')
    await wrapper.find('[data-testid="pvp"]').trigger('click')
    expect(wrapper.find('[data-testid="attack-line"]').text()).toContain('+7.5%')
    await wrapper.find('[data-testid="buff-chip"] button').trigger('click')
    expect(wrapper.find('[data-testid="attack-line"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('조건부 탈리스만 효과는 따로 보인다', async () => {
    const wrapper = mountPanel()
    const store = useCharacterStore()
    const claw = store.addItem('claw-talisman')!
    store.equip({ kind: 'talisman', equipIndex: 2 }, claw.uid)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="conditional-line"]').text()).toContain('점프 공격 시: 공격력 +15%')
    wrapper.unmount()
  })
})
