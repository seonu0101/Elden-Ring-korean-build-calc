import { describe, expect, it } from 'vitest'
import { combineEffects } from '@/data/effects'
import { BUFFS, BUFFS_BY_ID } from '@/data/items'
import { effectsBriefText } from '@/data/talismanEffects'

describe('디버프 분류', () => {
  it('효과가 모두 적에게 가면 디버프, 원래 분류는 따로 남는다', () => {
    const acid = BUFFS_BY_ID.get('item-acid-spraymist')!
    expect(acid.category).toBe('Debuff')
    expect(acid.sourceCategory).toBe('Aromatic')
    expect(BUFFS_BY_ID.get('spell-rennalas-full-moon')!.category).toBe('Debuff')
    expect(BUFFS_BY_ID.get('spell-golden-vow')!.category).toBe('Incantation')
    expect(BUFFS.filter((b) => b.category === 'Debuff')).toHaveLength(24)
  })

  it('적에게 거는 효과는 내 합계에 넣지 않고, 문구에 대상이 붙는다', () => {
    const roar = BUFFS_BY_ID.get('spell-greyolls-roar')!
    const s = combineEffects([{ id: roar.id, name: roar.name, type: roar.kind, effects: roar.effects }])
    expect(s.attack.physical.multiplier).toBe(1)
    expect(effectsBriefText(roar.effects)).toContain('주변 적: ')
    // 나에게 거는 효과와 적에게 거는 효과가 섞이면 버프로 남고, 내 효과만 합친다
    const blade = BUFFS_BY_ID.get('spell-black-flame-blade')!
    expect(blade.category).toBe('Incantation')
    expect(effectsBriefText(blade.effects)).toContain('적: ')
  })
})
