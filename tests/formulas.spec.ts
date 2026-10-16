import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { calculateAttack } from '@/data/attackPower'
import { characterDefense, damageNegation } from '@/data/defense'
import { ITEMS_BY_ID } from '@/data/items'
import EquipmentSummary from '@/components/EquipmentSummary.vue'
import { buildFormulas, num } from '@/features/formulas/formulas'
import type { FormulaInput, FormulaSection } from '@/features/formulas/formulas'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { DAMAGE_TYPES, NEGATION_TYPES } from '@/types'
import type { SlotTarget, WeaponItem } from '@/types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function equip(id: string, target: SlotTarget) {
  const character = useCharacterStore()
  const slot = character.addItem(id)!
  expect(character.equip(target, slot.uid)).toBe(true)
}

function setup() {
  const character = useCharacterStore()
  character.clearInventory()
  equip('longsword', { kind: 'weapon', equipIndex: 0 })
  equip('black-knife-hood', { kind: 'protector', protectorType: 'Head' })
  equip('radagons-soreseal', { kind: 'talisman', equipIndex: 0 })
  useBuffsStore().add('spell-golden-vow')
}

function input(): FormulaInput {
  const character = useCharacterStore()
  const stats = useStatsStore()
  const buffs = useBuffsStore()
  return {
    attributes: stats.attributes,
    bonusAttributes: stats.bonusAttributes,
    finalAttributes: stats.finalAttributes,
    defenseAttributes: stats.defenseAttributes,
    combatStats: stats.combatStats,
    twoHanded: stats.twoHanded,
    equippedItems: character.equippedItems,
    protectors: character.equippedProtectors,
    weapons: [{ label: 'RH1', item: ITEMS_BY_ID.get('longsword') as WeaponItem, affinity: 'Standard', level: 25 }],
    summary: buffs.summary,
    overridden: [],
    pvp: buffs.pvp,
  }
}

const section = (all: FormulaSection[], id: string) => all.find((s) => s.id === id)!
const line = (s: FormulaSection, label: string) => s.groups.flatMap((g) => g.lines).find((l) => l.label === label)

describe('계산 과정', () => {
  it('공격력 과정의 보정값 = 기본 × 보정 배율, 보정 배율 = 줄들의 합', () => {
    const attack = calculateAttack(ITEMS_BY_ID.get('longsword') as WeaponItem, 'Standard', 25, {
      strength: 30,
      dexterity: 20,
      intelligence: 10,
      faith: 10,
      arcane: 10,
    })!
    const d = attack.details.physical
    expect(d.terms.map((t) => t.stat)).toEqual(['strength', 'dexterity'])
    expect(d.multiplier).toBeCloseTo(d.terms.reduce((a, t) => a + t.term, 0), 12)
    expect(attack.damage.physical.base).toBeCloseTo(d.raw * d.rate, 12)
    expect(attack.damage.physical.scaling).toBeCloseTo(attack.damage.physical.base * d.multiplier, 12)
    expect(d.rule).toBe('sum')
  })

  it('요구 능력치가 모자라면 −0.4 규칙으로 표시', () => {
    const attack = calculateAttack(ITEMS_BY_ID.get('longsword') as WeaponItem, 'Standard', 0, {
      strength: 5,
      dexterity: 20,
      intelligence: 10,
      faith: 10,
      arcane: 10,
    })!
    expect(attack.details.physical.rule).toBe('unmet')
    expect(attack.details.physical.missing).toEqual(['strength'])
    expect(attack.details.physical.multiplier).toBe(-0.4)
  })
})

describe('계산식 창 내용은 화면 수치와 같다', () => {
  it('공격력·버프 후 공격력', () => {
    setup()
    const stats = useStatsStore()
    const buffs = useBuffsStore()
    const attack = calculateAttack(ITEMS_BY_ID.get('longsword') as WeaponItem, 'Standard', 25, stats.combatStats)!
    const s = section(buildFormulas(input()), 'attack')
    expect(line(s, '공격력')?.result).toBe(`${attack.total}`)
    const buffed = Math.floor(
      DAMAGE_TYPES.reduce(
        (sum, d) => sum + (attack.damage[d].base + attack.damage[d].scaling) * buffs.summary.attack[d].multiplier,
        0,
      ),
    )
    expect(line(s, '버프 후')?.result).toBe(`${buffed}`)
    // 라다곤의 각인 근력 +5가 들어간 능력치로 계산
    expect(line(s, '근력 25')).toBeDefined()
  })

  it('방어력·경감률', () => {
    setup()
    const stats = useStatsStore()
    const character = useCharacterStore()
    const buffs = useBuffsStore()
    const all = buildFormulas(input())
    const defense = characterDefense(stats.defenseAttributes)
    const negation = damageNegation(
      character.equippedProtectors,
      Object.fromEntries(NEGATION_TYPES.map((t) => [t, buffs.summary.damageTaken[t].multiplier])),
    )
    for (const t of NEGATION_TYPES) {
      const label = { physical: '물리', strike: '타격', slash: '참격', pierce: '관통', magic: '마력', fire: '화염', lightning: '벼락', holy: '신성' }[t]
      expect(section(all, 'defense').groups[0]!.lines.find((l) => l.label === label)?.result).toBe(`${defense[t]}`)
      expect(section(all, 'negation').groups[0]!.lines.find((l) => l.label === label)?.result).toBe(`${negation[t].toFixed(3)}%`)
    }
    // 황금 맹세 경감 1.1 → 받는 피해 × 0.9 가 식에 들어간다
    expect(section(all, 'negation').groups[0]!.lines[0]!.expr).toContain('× 0.9')
  })

  it('능력치·탈리스만 효과', () => {
    setup()
    const all = buildFormulas(input())
    expect(line(section(all, 'stats'), '근력')?.expr).toBe('20 +5')
    expect(line(section(all, 'stats'), '근력')?.result).toBe('25')
    expect(line(section(all, 'effects'), '물리')?.result).toBe('×1.15 (+15%)')
  })

  it('숫자 표시', () => {
    expect(num(0.1 + 0.2)).toBe('0.3')
    expect(num(-0.4)).toBe('−0.4')
    expect(num(275)).toBe('275')
  })
})

describe('계산식 버튼', () => {
  it('누르면 창이 열리고 Esc나 닫기로 닫힌다. 창 안의 키는 장비 메뉴로 가지 않는다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setup()
    const wrapper = mount(EquipmentSummary, { global: { plugins: [pinia] }, attachTo: document.body })
    expect(wrapper.find('[data-testid="formula-panel"]').exists()).toBe(false)
    await wrapper.find('[data-testid="open-formulas"]').trigger('click')
    const panel = wrapper.find('[data-testid="formula-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Longsword')
    expect(panel.text()).toContain('Black Knife Hood')
    expect(panel.text()).toContain('Golden Vow')

    let reached = false
    const listener = () => (reached = true)
    window.addEventListener('keydown', listener)
    await panel.trigger('keydown', { key: 'ArrowDown' })
    expect(reached).toBe(false)
    await panel.trigger('keydown', { key: 'Escape' })
    window.removeEventListener('keydown', listener)
    expect(wrapper.find('[data-testid="formula-panel"]').exists()).toBe(false)

    await wrapper.find('[data-testid="open-formulas"]').trigger('click')
    await wrapper.find('[data-testid="formula-close"]').trigger('click')
    expect(wrapper.find('[data-testid="formula-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
