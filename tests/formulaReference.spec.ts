import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { calculateAttack } from '@/data/attackPower'
import { GRAPH, statGraphValue } from '@/data/defense'
import { ITEMS_BY_ID } from '@/data/items'
import FormulaReference from '@/features/formulas/FormulaReference.vue'
import { statGraphSteps } from '@/features/formulas/formulas'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import type { WeaponItem } from '@/types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('계산식 페이지', () => {
  it('곡선 단계 계산은 실제 곡선 함수와 같다', () => {
    for (const id of Object.values(GRAPH)) {
      for (let x = 0; x <= 200; x++) expect(statGraphSteps(id, x).value).toBeCloseTo(statGraphValue(id, x), 10)
    }
  })

  it('모든 항목과 예시가 보이고, 예시 결과가 실제 계산과 같다', () => {
    const wrapper = mount(FormulaReference)
    for (const id of ['stats', 'upgrade', 'attack', 'status', 'defense', 'curve', 'negation', 'effects', 'weight', 'tables']) {
      expect(wrapper.find(`[data-testid="fr-${id}"]`).exists()).toBe(true)
    }
    const total = calculateAttack(ITEMS_BY_ID.get('longsword') as WeaponItem, 'Standard', 25, {
      strength: 20,
      dexterity: 20,
      intelligence: 10,
      faith: 10,
      arcane: 10,
    })!.total
    expect(wrapper.find('[data-testid="fr-attack-example"]').text()).toContain(`= ${total}`)
    expect(wrapper.find('[data-testid="fr-negation-example"]').text()).toContain('35.2%')
    expect(wrapper.find('[data-testid="fr-effects-example"]').text()).toContain('×1.4375')
    expect(wrapper.find('[data-testid="fr-effects-example"]').text()).toContain('×1.17')
    expect(wrapper.findAll('[data-testid="fr-correction-table"] tbody tr').length).toBeGreaterThan(10)
    wrapper.unmount()
  })

  it('장비·스탯을 바꿔도 내용이 바뀌지 않는다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(FormulaReference, { global: { plugins: [pinia] } })
    const before = wrapper.text()
    useStatsStore().setAttribute('strength', 60)
    const character = useCharacterStore()
    const slot = character.addItem('radagons-soreseal')!
    character.equip({ kind: 'talisman', equipIndex: 0 }, slot.uid)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe(before)
    wrapper.unmount()
  })

  it('스탯 옆 "계산식" 탭으로 연다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    const nav = wrapper.findAll('nav button').map((b) => b.text())
    expect(nav.indexOf('계산식')).toBe(nav.indexOf('스탯') + 1)
    await wrapper.find('[data-testid="nav-formulas"]').trigger('click')
    expect(wrapper.find('[data-testid="fr-attack"]').exists()).toBe(true)
    expect(localStorage.getItem('er-planner/view')).toBe('formulas')
    wrapper.unmount()
  })
})
