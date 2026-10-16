import { describe, expect, it } from 'vitest'
import { characterDefense, damageNegation, statGraphValue } from '@/data/defense'
import { ITEMS_BY_ID, PROTECTORS, STARTER_PROTECTOR_IDS, TALISMANS, WEAPONS } from '@/data/items'
import { NEGATION_TYPES, PROTECTOR_TYPES } from '@/types'
import type { ProtectorItem } from '@/types'
import reference from './fixtures/defenseReference.json'

describe('방어구 데이터', () => {
  it('원본 사이트의 방어구 722개, 부위가 4가지 중 하나', () => {
    expect(PROTECTORS).toHaveLength(722)
    for (const p of PROTECTORS) expect(PROTECTOR_TYPES).toContain(p.protectorType)
  })

  it('무기·방어구·탈리스만 id가 서로 겹치지 않는다', () => {
    const ids = [...WEAPONS, ...PROTECTORS, ...TALISMANS].map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('처음 인벤토리 방어구가 모두 있고 부위가 맞다', () => {
    for (const type of PROTECTOR_TYPES) {
      for (const id of STARTER_PROTECTOR_IDS[type]) {
        const item = ITEMS_BY_ID.get(id) as ProtectorItem | undefined
        expect(item?.protectorType, id).toBe(type)
      }
    }
  })

  it('방랑 기사 투구: 무게 4, 강인도 7, 물리 경감 4.6', () => {
    const helm = ITEMS_BY_ID.get('vagabond-knight-helm') as ProtectorItem
    expect([helm.weight, helm.poise, helm.absorptions.physical]).toEqual([4, 7, 4.6])
  })
})

describe('방어력 (원본 사이트 값과 비교)', () => {
  it('곡선 시작값: 능력치 합 1이면 레벨 기본 방어력 40', () => {
    expect(statGraphValue(102, 1)).toBe(40)
  })

  for (const { stats, def } of reference.defense) {
    it(`능력치 ${Object.values(stats).join('/')}`, () => {
      expect(characterDefense(stats)).toEqual(def)
    })
  }
})

describe('피해 경감률', () => {
  it('원본 사이트 값과 같다 (방랑 기사 투구·추방 기사 갑옷·검은 칼날 손갑옷·방랑 기사 각반)', () => {
    const armor = reference.negation.armor.map((id) => ITEMS_BY_ID.get(id) as ProtectorItem)
    const result = damageNegation(armor)
    for (const t of NEGATION_TYPES) {
      expect(result[t], t).toBeCloseTo(reference.negation.values[t], 9)
    }
  })

  it('방어구가 없으면 0, 하나면 그 방어구 값 그대로', () => {
    expect(Object.values(damageNegation([]))).toEqual(NEGATION_TYPES.map(() => 0))
    const helm = ITEMS_BY_ID.get('vagabond-knight-helm') as ProtectorItem
    expect(damageNegation([helm]).physical).toBeCloseTo(4.6, 9)
  })
})
