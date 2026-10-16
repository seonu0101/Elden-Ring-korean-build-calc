import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { calculateAttack } from '@/data/attackPower'
import { conflictsWith, resolveStacking } from '@/data/buffStacking'
import { characterDefense } from '@/data/defense'
import { BUFFS_BY_ID, ITEMS_BY_ID } from '@/data/items'
import BuffPanel from '@/features/buffs/BuffPanel.vue'
import StatsView from '@/features/stats/StatsView.vue'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import type { BuffItem, WeaponItem } from '@/types'

const buff = (id: string) => BUFFS_BY_ID.get(id) as BuffItem

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('버프 중첩 규칙', () => {
  it('불이여 힘을 → 고양된 고기 순서로 켜면 앞의 것이 덮인다 (나중 것만 적용)', () => {
    const r = resolveStacking([buff('spell-flame-grant-me-strength'), buff('item-exalted-flesh')])
    expect(r.active.map((b) => b.id)).toEqual(['item-exalted-flesh'])
    expect(r.overridden.get('spell-flame-grant-me-strength')?.by.id).toBe('item-exalted-flesh')
  })

  it('황금 맹세는 위 둘과 겹친다', () => {
    const r = resolveStacking([buff('spell-golden-vow'), buff('spell-flame-grant-me-strength'), buff('item-exalted-flesh')])
    expect(r.active.map((b) => b.id)).toEqual(['spell-golden-vow', 'item-exalted-flesh'])
  })

  it('무기 버프(기름·인챈트 주문)는 하나만, 방패 기름은 따로', () => {
    const r = resolveStacking([buff('item-fire-grease'), buff('spell-bloodflame-blade'), buff('item-shield-grease')])
    expect(r.active.map((b) => b.id)).toEqual(['spell-bloodflame-blade', 'item-shield-grease'])
    expect(r.overridden.get('item-fire-grease')?.group).toBe('무기 버프')
  })

  it('같은 이름의 버프(황금 맹세 기도·전회판)는 겹치지 않는다', () => {
    const r = resolveStacking([buff('spell-golden-vow'), buff('item-golden-vow')])
    expect(r.active.map((b) => b.id)).toEqual(['item-golden-vow'])
    expect(r.overridden.get('spell-golden-vow')?.group).toBe('같은 버프')
  })

  it('합계에는 적용되는 버프만 들어간다', () => {
    const store = useBuffsStore()
    store.add('spell-flame-grant-me-strength')
    store.add('item-exalted-flesh')
    expect(store.summary.attack.physical.multiplier).toBeCloseTo(1.2, 10) // 1.44가 아니다
  })

  it('고르기 목록에서 겹치는 버프를 알려준다', () => {
    expect(conflictsWith(buff('item-exalted-flesh'), [buff('spell-flame-grant-me-strength')])?.name).toBe(
      'Flame, Grant Me Strength',
    )
    expect(conflictsWith(buff('spell-golden-vow'), [buff('spell-flame-grant-me-strength')])).toBeNull()
  })

  it('패널에 중첩 불가 표시가 붙고 계산에서 뺀다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(BuffPanel, { global: { plugins: [pinia] } })
    const store = useBuffsStore()
    store.add('spell-flame-grant-me-strength')
    store.add('item-exalted-flesh')
    await wrapper.vm.$nextTick()
    const chips = wrapper.findAll('[data-testid="buff-chip"]')
    expect(chips[0]!.find('[data-testid="stack-badge"]').text()).toBe('중첩 불가')
    expect(chips[1]!.find('[data-testid="stack-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stack-notes"]').text()).toContain('Exalted Flesh가 덮어씀')
    const options = wrapper.findAll('[data-testid="buff-select"] option').map((o) => o.text())
    expect(options.some((t) => t.startsWith('Drawstring Fire Grease'))).toBe(true)
    wrapper.unmount()
  })
})

describe('탈리스만·버프 능력치 적용', () => {
  function equipTalisman(id: string, slot: number) {
    const character = useCharacterStore()
    const s = character.addItem(id)!
    expect(character.equip({ kind: 'talisman', equipIndex: slot }, s.uid)).toBe(true)
  }

  it('라다곤의 각인을 끼면 근력·기량·생명력·지구력 +5가 최종 능력치에 들어간다', () => {
    const stats = useStatsStore()
    stats.setAttribute('strength', 20)
    equipTalisman('radagons-soreseal', 2)
    expect(stats.bonusAttributes.strength).toBe(5)
    expect(stats.finalAttributes.strength).toBe(25)
    expect(stats.finalAttributes.vigor).toBe(stats.attributes.vigor + 5)
    expect(stats.finalAttributes.intelligence).toBe(stats.attributes.intelligence) // 지력은 그대로
    expect(stats.combatStats.strength).toBe(25)
  })

  it('공격력은 최종 능력치로 계산된다', () => {
    const stats = useStatsStore()
    stats.setAttribute('strength', 20)
    const longsword = ITEMS_BY_ID.get('longsword') as WeaponItem
    const before = calculateAttack(longsword, 'Standard', 0, stats.combatStats)!.total
    equipTalisman('radagons-soreseal', 2)
    const after = calculateAttack(longsword, 'Standard', 0, stats.combatStats)!.total
    expect(after).toBe(calculateAttack(longsword, 'Standard', 0, { ...stats.combatStats, strength: 25 })!.total)
    expect(after).toBeGreaterThan(before)
  })

  it('최대 99를 넘지 않는다 (방어력은 원본 사이트처럼 상한 없이)', () => {
    const stats = useStatsStore()
    stats.setAttribute('strength', 97)
    equipTalisman('radagons-soreseal', 2)
    expect(stats.finalAttributes.strength).toBe(99)
    expect(stats.defenseAttributes.strength).toBe(102)
  })

  it('켠 버프(거대한 룬 등)의 능력치도 들어가고, 탈리스만을 빼면 원래대로', () => {
    const stats = useStatsStore()
    const base = stats.finalAttributes.strength
    equipTalisman('radagons-soreseal', 2)
    expect(stats.finalAttributes.strength).toBe(base + 5)
    useCharacterStore().unequip({ kind: 'talisman', equipIndex: 2 })
    expect(stats.finalAttributes.strength).toBe(base)
  })

  it('방어력도 탈리스만 능력치를 반영한다', () => {
    const stats = useStatsStore()
    const before = characterDefense(stats.defenseAttributes).physical
    equipTalisman('radagons-soreseal', 2)
    expect(characterDefense(stats.defenseAttributes).physical).toBeGreaterThan(before)
  })

  it('스탯 화면에 "+5 → 25"처럼 최종 능력치가 보인다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(StatsView, { global: { plugins: [pinia] } })
    useStatsStore().setAttribute('strength', 20)
    equipTalisman('radagons-soreseal', 2)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="final-strength"]').text().replace(/\s+/g, ' ')).toBe('+5 → 25')
    expect(wrapper.find('[data-testid="final-intelligence"]').text()).toBe('')
    expect(wrapper.find('[data-testid="bonus-note"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
