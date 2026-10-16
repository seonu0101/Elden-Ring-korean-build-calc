import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { ITEMS_BY_ID } from '@/data/items'
import { STORAGE_KEY, parseSnapshot, useCharacterStore } from '@/stores/character'
import type { ProtectorItem, SlotTarget } from '@/types'

const RH1: SlotTarget = { kind: 'weapon', equipIndex: 0 }
const RH2: SlotTarget = { kind: 'weapon', equipIndex: 1 }
const LH1: SlotTarget = { kind: 'weapon', equipIndex: 3 }
const HEAD: SlotTarget = { kind: 'protector', protectorType: 'Head' }
const T1: SlotTarget = { kind: 'talisman', equipIndex: 0 }
const T2: SlotTarget = { kind: 'talisman', equipIndex: 1 }

function setup() {
  setActivePinia(createPinia())
  return useCharacterStore()
}

function uidOf(store: ReturnType<typeof useCharacterStore>, target: SlotTarget, itemId: string) {
  const slot = store.inventoryFor(target).find((s) => s.itemId === itemId)
  if (!slot) throw new Error(`no ${itemId}`)
  return slot.uid
}

function equippedId(store: ReturnType<typeof useCharacterStore>, target: SlotTarget) {
  const slot = store.equippedIn(target)
  return slot ? slot.itemId : null
}

beforeEach(() => localStorage.clear())

describe('기본 상태', () => {
  it('기본 장비가 장착되어 있다', () => {
    const store = setup()
    expect(equippedId(store, RH1)).toBe('longsword')
    expect(equippedId(store, LH1)).toBe('heater-shield')
    expect(equippedId(store, HEAD)).toBe('vagabond-knight-helm')
    expect(equippedId(store, T1)).toBe('erdtrees-favor')
  })
})

describe('무기 장착', () => {
  it('빈 칸에 장착한다', () => {
    const store = setup()
    store.equip(RH2, uidOf(store, RH2, 'uchigatana'))
    expect(equippedId(store, RH2)).toBe('uchigatana')
  })

  it('다른 칸에 장착된 무기를 고르면 두 칸을 맞바꾼다', () => {
    const store = setup()
    store.equip(RH1, uidOf(store, RH1, 'heater-shield'))
    expect(equippedId(store, RH1)).toBe('heater-shield')
    expect(equippedId(store, LH1)).toBe('longsword')
  })

  it('장착하지 않은 무기로 바꾸면 기존 무기는 해제된다', () => {
    const store = setup()
    store.equip(RH1, uidOf(store, RH1, 'moonveil'))
    expect(equippedId(store, RH1)).toBe('moonveil')
    expect(store.inventoryFor(RH1).find((s) => s.itemId === 'longsword')?.equipIndex).toBeUndefined()
  })

  it('이미 장착된 무기를 다시 고르면 해제한다', () => {
    const store = setup()
    store.equip(RH1, uidOf(store, RH1, 'longsword'))
    expect(store.equippedIn(RH1)).toBeNull()
  })

  it('같은 무기 두 개는 따로 장착된다', () => {
    const store = setup()
    const daggers = store.inventoryFor(RH1).filter((s) => s.itemId === 'dagger')
    expect(daggers).toHaveLength(2)
    store.equip(RH1, daggers[0]!.uid)
    store.equip(LH1, daggers[1]!.uid)
    expect(store.equippedIn(RH1)?.uid).toBe(daggers[0]!.uid)
    expect(store.equippedIn(LH1)?.uid).toBe(daggers[1]!.uid)
  })
})

describe('방어구 장착', () => {
  it('부위마다 하나만 장착한다', () => {
    const store = setup()
    store.equip(HEAD, uidOf(store, HEAD, 'iron-helmet'))
    const equipped = store.inventoryFor(HEAD).filter((s) => s.equipIndex != null)
    expect(equipped.map((s) => s.itemId)).toEqual(['iron-helmet'])
  })

  it('장착 중인 방어구를 다시 고르면 해제한다', () => {
    const store = setup()
    store.equip(HEAD, uidOf(store, HEAD, 'vagabond-knight-helm'))
    expect(store.equippedIn(HEAD)).toBeNull()
  })
})

describe('탈리스만 장착', () => {
  it('다른 칸에 있던 탈리스만은 그 칸에서 빠지고 옮겨진다 (맞바꾸지 않음)', () => {
    const store = setup()
    store.equip(T2, uidOf(store, T2, 'erdtrees-favor'))
    expect(equippedId(store, T2)).toBe('erdtrees-favor')
    expect(store.equippedIn(T1)).toBeNull()
    expect(store.inventoryFor(T2).find((s) => s.itemId === 'green-turtle')?.equipIndex).toBeUndefined()
  })
})

describe('장착 해제', () => {
  it('unequip은 그 칸만 비운다', () => {
    const store = setup()
    store.unequip(RH1)
    expect(store.equippedIn(RH1)).toBeNull()
    expect(equippedId(store, LH1)).toBe('heater-shield')
  })

  it('unequipAll은 모든 칸을 비우고 합계가 0이 된다', () => {
    const store = setup()
    store.unequipAll()
    expect(store.equippedItems).toHaveLength(0)
    expect(store.totalWeight).toBe(0)
    expect(store.totalPoise).toBe(0)
    // 인벤토리 아이템은 그대로 남는다
    expect(store.inventoryFor(RH1).length).toBeGreaterThan(0)
  })
})

describe('합계', () => {
  it('장착한 아이템의 무게와 강인도를 더한다', () => {
    const store = setup()
    const before = store.totalWeight
    store.equip(RH2, uidOf(store, RH2, 'greatsword'))
    expect(store.totalWeight).toBeCloseTo(before + 23)
    // 기본 장착 방랑 기사 세트(투구·갑옷·건틀릿·각반)의 강인도 합
    const set = ['vagabond-knight-helm', 'vagabond-knight-armor', 'vagabond-knight-gauntlets', 'vagabond-knight-greaves']
    const expected = set.reduce((sum, id) => sum + (ITEMS_BY_ID.get(id) as ProtectorItem).poise, 0)
    expect(store.totalPoise).toBe(expected)
    expect(store.equippedProtectors.map((p) => p.id).sort()).toEqual([...set].sort())
  })
})

describe('저장', () => {
  it('바꾼 장비가 localStorage에 저장되고 다시 불러와진다', async () => {
    const store = setup()
    store.equip(RH1, uidOf(store, RH1, 'moonveil'))
    await nextTick()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('moonveil')

    const reloaded = setup()
    expect(equippedId(reloaded, RH1)).toBe('moonveil')
  })

  it('깨진 저장 데이터는 무시하고 기본 상태로 시작한다', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const store = setup()
    expect(equippedId(store, RH1)).toBe('longsword')
  })

  it('알 수 없는 아이템은 버린다', () => {
    const parsed = parseSnapshot({
      weapons: [
        { uid: 'a', itemId: 'longsword', order: 0 },
        { uid: 'b', itemId: 'does-not-exist', order: 1 },
        { uid: 'c', order: 2 },
      ],
      protectors: {},
      talismans: [],
    })
    expect(parsed?.weapons.map((s) => s.uid)).toEqual(['a'])
    expect(parsed?.protectors.Head).toEqual([])
  })
})
