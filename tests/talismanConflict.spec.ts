import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'

describe('탈리스만 중복·충돌', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('같은 탈리스만 두 개를 동시에 장착할 수 없다', () => {
    const store = useCharacterStore()
    store.clearInventory()
    const a = store.addItem('claw-talisman')!
    const b = store.addItem('claw-talisman')!
    expect(store.equip({ kind: 'talisman', equipIndex: 0 }, a.uid)).toBe(true)
    expect(store.equip({ kind: 'talisman', equipIndex: 1 }, b.uid)).toBe(false)
    expect(store.equippedItems.filter((i) => i.id === 'claw-talisman')).toHaveLength(1)
  })

  it('함께 낄 수 없는 탈리스만(황금나무의 가호 / +1)은 막는다', () => {
    const store = useCharacterStore()
    store.clearInventory()
    const a = store.addItem('erdtrees-favor')!
    const b = store.addItem('erdtrees-favor-1')!
    expect(store.equip({ kind: 'talisman', equipIndex: 0 }, a.uid)).toBe(true)
    expect(store.equip({ kind: 'talisman', equipIndex: 1 }, b.uid)).toBe(false)
    expect(store.talismanConflict({ kind: 'talisman', equipIndex: 1 }, b.uid)).toBe("Erdtree's Favor")
  })

  it('같은 칸에서 바꾸는 것은 된다 (기존 것을 빼고 끼우므로)', () => {
    const store = useCharacterStore()
    store.clearInventory()
    const a = store.addItem('erdtrees-favor')!
    const b = store.addItem('erdtrees-favor-1')!
    store.equip({ kind: 'talisman', equipIndex: 0 }, a.uid)
    expect(store.equip({ kind: 'talisman', equipIndex: 0 }, b.uid)).toBe(true)
    expect(store.equippedItems.map((i) => i.id)).toEqual(['erdtrees-favor-1'])
  })

  it('다른 칸에 있던 같은 탈리스만을 옮기는 것은 된다', () => {
    const store = useCharacterStore()
    store.clearInventory()
    const a = store.addItem('claw-talisman')!
    store.equip({ kind: 'talisman', equipIndex: 0 }, a.uid)
    expect(store.equip({ kind: 'talisman', equipIndex: 2 }, a.uid)).toBe(true)
    expect(store.equippedIn({ kind: 'talisman', equipIndex: 2 })?.uid).toBe(a.uid)
    expect(store.equippedIn({ kind: 'talisman', equipIndex: 0 })).toBeNull()
  })
})

describe('장비 화면에서 막힌 장착', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('겹치는 탈리스만을 고르면 장착하지 않고 이유를 알려준다', async () => {
    const { useGameMenu } = await import('@/features/gameMenu/useGameMenu')
    const store = useCharacterStore()
    // 기본 장비: T1 황금나무의 가호. 같은 계열 +1을 T3에 끼우려 한다
    const plus1 = store.addItem('erdtrees-favor-1')!
    const menu = useGameMenu(store)
    menu.selectCell(3, 2)
    menu.dispatch('confirm')
    const index = menu.inventory.value.findIndex((s) => s.uid === plus1.uid)
    menu.equipAt(index)
    expect(store.equippedIn({ kind: 'talisman', equipIndex: 2 })).toBeNull()
    expect(menu.notice.value).toBe("Erdtree's Favor와(과) 함께 장착할 수 없습니다")
    // 커서를 옮기면 안내가 사라진다
    menu.dispatch('left')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r))
    expect(menu.notice.value).toBeNull()
  })
})
