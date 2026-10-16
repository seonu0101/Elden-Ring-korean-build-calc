import { describe, expect, it } from 'vitest'
import { ITEMS_BY_ID, STARTER_TALISMAN_IDS, TALISMANS } from '@/data/items'
import {
  TALISMAN_ATTRIBUTE_LABELS,
  TALISMAN_CATEGORY_LABELS,
  TALISMAN_CONDITION_LABELS,
  effectText,
  talismanEffectText,
} from '@/data/talismanEffects'
import { parseSnapshot } from '@/stores/character'
import type { TalismanItem } from '@/types'

const talisman = (id: string) => ITEMS_BY_ID.get(id) as TalismanItem

describe('탈리스만 데이터', () => {
  it('원본 사이트의 탈리스만 154개', () => {
    expect(TALISMANS).toHaveLength(154)
  })

  it('처음 인벤토리 탈리스만이 모두 있다', () => {
    for (const id of STARTER_TALISMAN_IDS) expect(talisman(id)?.kind, id).toBe('talisman')
  })

  it('함께 낄 수 없는 탈리스만 id가 모두 실제 탈리스만이다', () => {
    for (const t of TALISMANS) for (const id of t.conflicts) expect(ITEMS_BY_ID.get(id)?.kind, `${t.name} → ${id}`).toBe('talisman')
  })

  it('모든 효과 항목·조건·분류에 한국어 이름이 있다', () => {
    for (const t of TALISMANS) {
      for (const c of t.categories) expect(TALISMAN_CATEGORY_LABELS[c], c).toBeDefined()
      for (const e of t.effects) {
        expect(TALISMAN_ATTRIBUTE_LABELS[e.attribute], e.attribute).toBeDefined()
        for (const c of e.conditions ?? []) expect(TALISMAN_CONDITION_LABELS[c], c).toBeDefined()
      }
    }
  })
})

describe('효과 설명', () => {
  it('배율은 %, 더하기는 수치, 조건·PvP 값을 붙인다', () => {
    expect(talismanEffectText(talisman('claw-talisman'))).toBe('점프 공격 시: 공격력 +15% (PvP +7.5%)')
    expect(talismanEffectText(talisman('dragoncrest-shield-talisman'))).toBe('물리 피해 경감 +10% (PvP +2%)')
    expect(talismanEffectText(talisman('green-turtle-talisman'))).toBe('스태미나 회복 속도 +8')
    expect(talismanEffectText(talisman('ritual-sword-talisman'))).toBe('HP 최대 시: 공격력 +10%')
  })

  it('감소 효과는 −로 보인다 (라다곤의 각인: 피해 경감 −15%)', () => {
    expect(talismanEffectText(talisman('radagons-soreseal'))).toContain('피해 경감 −15%')
    expect(talismanEffectText(talisman('radagons-soreseal'))).toContain('근력 +5')
  })

  it('지속 시간을 붙인다', () => {
    expect(effectText({ attribute: 'Attack Power', value: 1.2, model: 'multiplicative', duration: 20 })).toBe(
      '공격력 +20% (20초)',
    )
  })
})

describe('예전 탈리스만 id', () => {
  it('저장된 인벤토리의 예전 id를 지금 id로 바꾼다', () => {
    const snapshot = parseSnapshot({
      weapons: [],
      protectors: {},
      talismans: [
        { uid: 'a', itemId: 'green-turtle', order: 0, equipIndex: 1 },
        { uid: 'b', itemId: 'dragoncrest-shield', order: 1 },
        { uid: 'c', itemId: 'assassins-approach', order: 2 },
      ],
    })
    expect(snapshot?.talismans.map((s) => [s.itemId, s.equipIndex])).toEqual([
      ['green-turtle-talisman', 1],
      ['dragoncrest-shield-talisman', undefined],
    ])
  })
})
