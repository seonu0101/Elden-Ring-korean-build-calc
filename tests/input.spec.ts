import { describe, expect, it } from 'vitest'
import { GamepadInputTracker, readGamepadActions } from '@/features/gameMenu/useGamepadInput'
import { keyToAction } from '@/features/gameMenu/useKeyboardInput'
import type { MenuAction } from '@/features/gameMenu/useGameMenu'

function pad(pressed: number[], axes: number[] = [0, 0]) {
  return {
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: false, value: 0 })),
    axes,
  }
}

describe('keyToAction', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    keyToAction({ key: k, ctrlKey: false, altKey: false, metaKey: false, ...mods })

  it('키를 메뉴 동작으로 바꾼다', () => {
    expect(key('Escape')).toBe('toggleMenu')
    expect(key('ArrowLeft')).toBe('left')
    expect(key('E')).toBe('confirm')
    expect(key('q')).toBe('back')
    expect(key('v')).toBe('nextSlot')
    expect(key('PageDown')).toBe('pageDown')
  })

  it('장착 해제는 R 키 (X, Delete는 아무 동작 없음)', () => {
    expect(key('r')).toBe('unequip')
    expect(key('R')).toBe('unequip')
    expect(key('x')).toBeNull()
    expect(key('Delete')).toBeNull()
  })

  it('Ctrl+C 같은 단축키와 관계없는 키는 무시한다', () => {
    expect(key('c', { ctrlKey: true })).toBeNull()
    expect(key('z')).toBeNull()
  })
})

describe('readGamepadActions', () => {
  it('버튼을 동작으로 바꾼다', () => {
    expect([...readGamepadActions(pad([0, 12]))].sort()).toEqual(['confirm', 'up'])
    expect([...readGamepadActions(pad([9]))]).toEqual(['toggleMenu'])
    // X·Y 버튼은 쓰지 않는다 (장착 해제는 키보드 R만)
    expect([...readGamepadActions(pad([2]))]).toEqual([])
    expect([...readGamepadActions(pad([3]))]).toEqual([])
  })

  it('스틱을 기울여도 이동하지 않는다 (이동은 십자키만)', () => {
    expect([...readGamepadActions(pad([], [1, 0]))]).toEqual([])
    expect([...readGamepadActions(pad([], [0, -1]))]).toEqual([])
    expect([...readGamepadActions(pad([], [0.9, 0.9, 1, 1]))]).toEqual([])
  })
})

describe('GamepadInputTracker', () => {
  const set = (...a: MenuAction[]) => new Set<MenuAction>(a)

  it('누른 순간에만 한 번 보낸다', () => {
    const t = new GamepadInputTracker({ delay: 300, interval: 100 })
    expect(t.update(set('confirm'), 0)).toEqual(['confirm'])
    expect(t.update(set('confirm'), 16)).toEqual([])
    expect(t.update(set('confirm'), 1000)).toEqual([])
    expect(t.update(set(), 1016)).toEqual([])
    expect(t.update(set('confirm'), 1032)).toEqual(['confirm'])
  })

  it('방향 입력은 누르고 있으면 반복된다', () => {
    const t = new GamepadInputTracker({ delay: 300, interval: 100 })
    expect(t.update(set('down'), 0)).toEqual(['down'])
    expect(t.update(set('down'), 200)).toEqual([])
    expect(t.update(set('down'), 300)).toEqual(['down'])
    expect(t.update(set('down'), 350)).toEqual([])
    expect(t.update(set('down'), 400)).toEqual(['down'])
  })
})
