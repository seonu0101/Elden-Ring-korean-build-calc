import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useGameMenu } from '@/features/gameMenu/useGameMenu'
import type { MenuAction } from '@/features/gameMenu/useGameMenu'

function setup(initialMode: 'game' | 'grid' = 'grid') {
  localStorage.clear()
  setActivePinia(createPinia())
  const store = useCharacterStore()
  const menu = useGameMenu(store, { initialMode })
  const press = (...actions: MenuAction[]) => actions.map((a) => menu.dispatch(a))
  return { store, menu, press }
}

beforeEach(() => localStorage.clear())

describe('상태 전환', () => {
  it('game → menu → grid → inventory → grid → menu → game', () => {
    const { menu, press } = setup('game')
    expect(menu.mode.value).toBe('game')
    press('toggleMenu')
    expect(menu.mode.value).toBe('menu')
    press('confirm')
    expect(menu.mode.value).toBe('grid')
    press('confirm')
    expect(menu.mode.value).toBe('inventory')
    press('back')
    expect(menu.mode.value).toBe('grid')
    press('back')
    expect(menu.mode.value).toBe('menu')
    press('back')
    expect(menu.mode.value).toBe('game')
  })

  it('Esc는 어느 상태에서든 메뉴를 닫는다', () => {
    const { menu, press } = setup()
    press('confirm')
    expect(menu.mode.value).toBe('inventory')
    press('toggleMenu')
    expect(menu.mode.value).toBe('game')
  })

  it('메뉴를 다시 열면 커서가 첫 칸으로 돌아간다', () => {
    const { menu, press } = setup()
    press('down', 'right')
    press('toggleMenu', 'toggleMenu')
    expect([menu.row.value, menu.col.value]).toEqual([0, 0])
  })

  it('game 상태에서는 방향키 등을 처리하지 않는다 (페이지 스크롤 등을 막지 않음)', () => {
    const { press } = setup('game')
    expect(press('up', 'confirm')).toEqual([false, false])
  })
})

describe('장착 해제 (R 키)', () => {
  it('격자에서 커서가 있는 칸을 비운다', () => {
    const { store, menu, press } = setup()
    expect(press('unequip')).toEqual([true])
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 0 })).toBeNull()
    expect(menu.mode.value).toBe('grid')
  })

  it('목록에서는 지금 칸을 비우고 목록에 머문다', () => {
    const { store, menu, press } = setup()
    press('down', 'down', 'confirm', 'unequip')
    expect(store.equippedIn({ kind: 'protector', protectorType: 'Head' })).toBeNull()
    expect(menu.mode.value).toBe('inventory')
  })

  it('game 상태에서는 처리하지 않는다', () => {
    const { store, press } = setup('game')
    expect(press('unequip')).toEqual([false])
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 0 })?.itemId).toBe('longsword')
  })
})

describe('목록에서 고르기', () => {
  it('장착 중인 아이템을 다시 골라도 해제되지 않는다', () => {
    const { store, menu, press } = setup()
    press('confirm') // RH1 목록, 커서는 장착 중인 롱소드
    expect(menu.focusedSlot.value?.itemId).toBe('longsword')
    press('confirm')
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 0 })?.itemId).toBe('longsword')
    expect(menu.mode.value).toBe('inventory')
  })

  it('목록에 "장착 해제" 항목이 없다', () => {
    const { menu, press } = setup()
    press('confirm')
    expect(menu.inventory.value.every((s) => s !== null)).toBe(true)
    expect(menu.inventoryIndex.value).toBe(0)
    expect(menu.focusedSlot.value?.itemId).toBe('longsword')
  })
})

describe('장비 칸 → 목록', () => {
  it('목록을 열면 장착 중인 아이템에 커서가 놓인다', () => {
    const { menu, press } = setup()
    press('confirm')
    expect(menu.focusedSlot.value?.itemId).toBe('longsword')
  })

  it('빈 칸의 목록을 열면 첫 아이템에 커서가 놓인다', () => {
    const { menu, press } = setup()
    press('right', 'confirm')
    expect(menu.currentCell.value.label).toBe('RH2')
    expect(menu.inventoryIndex.value).toBe(0)
    expect(menu.focusedSlot.value?.itemId).toBe('longsword')
  })

  it('목록에서 고른 아이템을 장착해도 목록이 닫히지 않는다', () => {
    const { store, menu, press } = setup()
    press('right', 'confirm', 'right', 'confirm')
    expect(menu.mode.value).toBe('inventory')
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 1 })?.itemId).toBe('uchigatana')

    // 이어서 다른 아이템으로 바로 바꿀 수 있다
    press('right', 'confirm')
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 1 })?.itemId).toBe('moonveil')
    expect(menu.mode.value).toBe('inventory')

    // 닫기는 Q/B
    press('back')
    expect(menu.mode.value).toBe('grid')
  })

  it('방어구도 장착 후 목록이 열린 채로 남는다', () => {
    const { store, menu, press } = setup()
    press('down', 'down', 'confirm', 'right', 'confirm')
    expect(menu.mode.value).toBe('inventory')
    expect(store.equippedIn({ kind: 'protector', protectorType: 'Head' })?.itemId).toBe('black-knife-hood')
  })

  it('마우스 더블클릭으로 장착해도 목록이 열린 채로 남고 커서가 따라간다', () => {
    const { store, menu, press } = setup()
    press('confirm')
    menu.equipAt(2)
    expect(menu.mode.value).toBe('inventory')
    expect(menu.inventoryIndex.value).toBe(2)
    expect(store.equippedIn({ kind: 'weapon', equipIndex: 0 })?.itemId).toBe(menu.inventory.value[2]!.itemId)
  })

  it('C/V로 다른 칸으로 바꾸고, 커서를 그 칸의 장착 아이템에 맞춘다', () => {
    const { menu, press } = setup()
    press('down', 'confirm')
    expect(menu.currentCell.value.label).toBe('LH1')
    expect(menu.focusedSlot.value?.itemId).toBe('heater-shield')
    press('nextSlot')
    expect(menu.currentCell.value.label).toBe('LH2')
    expect(menu.inventoryIndex.value).toBe(0)
    press('prevSlot')
    expect(menu.currentCell.value.label).toBe('LH1')
    expect(menu.focusedSlot.value?.itemId).toBe('heater-shield')
  })

  it('무기 칸 전환은 오른손·왼손 6칸이 한 바퀴로 이어진다', () => {
    const { menu, press } = setup()
    press('confirm') // RH1 목록
    const labels = () => menu.currentCell.value.label

    // RH1에서 이전 → LH3, LH3에서 다음 → RH1
    press('prevSlot')
    expect(labels()).toBe('LH3')
    press('nextSlot')
    expect(labels()).toBe('RH1')

    // RH3에서 다음 → LH1, LH1에서 이전 → RH3
    press('nextSlot', 'nextSlot')
    expect(labels()).toBe('RH3')
    press('nextSlot')
    expect(labels()).toBe('LH1')
    press('prevSlot')
    expect(labels()).toBe('RH3')

    // 다음으로 한 바퀴 돌면 제자리
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      press('nextSlot')
      seen.push(labels())
    }
    expect(seen).toEqual(['LH1', 'LH2', 'LH3', 'RH1', 'RH2', 'RH3'])
    expect(menu.slotGroup.value.map((p) => p.cell.label)).toEqual(['RH1', 'RH2', 'RH3', 'LH1', 'LH2', 'LH3'])
  })

  it('방어구와 탈리스만은 각자 줄 안에서만 돈다', () => {
    const { menu, press } = setup()
    press('down', 'down', 'confirm') // Head
    press('prevSlot')
    expect(menu.currentCell.value.label).toBe('Legs')
    press('nextSlot')
    expect(menu.currentCell.value.label).toBe('Head')
    press('back', 'down', 'confirm') // T1
    press('prevSlot')
    expect(menu.currentCell.value.label).toBe('T4')
    expect(menu.slotGroup.value).toHaveLength(4)
  })

  it('방어구 칸에서는 해당 부위 아이템만 보여준다', () => {
    const { store, menu, press } = setup()
    press('down', 'down', 'right', 'confirm')
    expect(menu.currentCell.value.label).toBe('Body')
    expect(menu.inventory.value.every((s) => store.itemOf(s)?.kind === 'protector')).toBe(true)
    expect(menu.inventory.value.map((s) => s.itemId)).toContain('banished-knight-armor')
    expect(menu.inventory.value.map((s) => s.itemId)).not.toContain('iron-helmet')
  })
})
