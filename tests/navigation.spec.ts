import { describe, expect, it } from 'vitest'
import {
  moveGridCursor,
  moveInventoryDown,
  moveInventoryHorizontal,
  moveInventoryUp,
  pageInventoryDown,
  pageInventoryUp,
} from '@/features/gameMenu/navigation'

const ROWS = [3, 3, 4, 4]

describe('moveGridCursor', () => {
  it('좌우 끝에서 반대쪽 끝으로 넘어간다', () => {
    expect(moveGridCursor(ROWS, { row: 0, col: 0 }, 0, -1)).toEqual({ row: 0, col: 2 })
    expect(moveGridCursor(ROWS, { row: 2, col: 3 }, 0, 1)).toEqual({ row: 2, col: 0 })
  })

  it('위아래 끝에서 반대쪽 끝으로 넘어간다', () => {
    expect(moveGridCursor(ROWS, { row: 0, col: 1 }, -1, 0)).toEqual({ row: 3, col: 1 })
    expect(moveGridCursor(ROWS, { row: 3, col: 1 }, 1, 0)).toEqual({ row: 0, col: 1 })
  })

  it('짧은 줄로 옮기면 열을 그 줄의 마지막 칸으로 맞춘다', () => {
    expect(moveGridCursor(ROWS, { row: 2, col: 3 }, -1, 0)).toEqual({ row: 1, col: 2 })
    expect(moveGridCursor(ROWS, { row: 3, col: 3 }, 1, 0)).toEqual({ row: 0, col: 2 })
  })

  it('긴 줄로 옮기면 열을 그대로 둔다', () => {
    expect(moveGridCursor(ROWS, { row: 1, col: 2 }, 1, 0)).toEqual({ row: 2, col: 2 })
  })
})

describe('인벤토리 커서 (한 줄 5칸)', () => {
  it('좌우로 넘어간다', () => {
    expect(moveInventoryHorizontal(0, 12, -1)).toBe(11)
    expect(moveInventoryHorizontal(11, 12, 1)).toBe(0)
  })

  it('위: 첫 줄에서 같은 열의 마지막 줄로, 마지막 줄이 짧으면 마지막 아이템으로', () => {
    expect(moveInventoryUp(7, 12)).toBe(2)
    expect(moveInventoryUp(1, 12)).toBe(11)
    expect(moveInventoryUp(4, 12)).toBe(11)
    expect(moveInventoryUp(4, 15)).toBe(14)
  })

  it('아래: 아래에 아이템이 없으면 같은 열의 첫 줄로', () => {
    expect(moveInventoryDown(2, 12)).toBe(7)
    expect(moveInventoryDown(8, 12)).toBe(3)
    expect(moveInventoryDown(11, 12)).toBe(1)
  })

  it('페이지 이동은 5줄씩, 끝에서 멈춘다', () => {
    expect(pageInventoryDown(1, 100)).toBe(26)
    expect(pageInventoryDown(91, 100)).toBe(96)
    expect(pageInventoryDown(96, 100)).toBe(96)
    expect(pageInventoryDown(1, 12)).toBe(11)
    expect(pageInventoryDown(4, 12)).toBe(9)
    expect(pageInventoryUp(53, 100)).toBe(28)
    expect(pageInventoryUp(13, 100)).toBe(3)
    expect(pageInventoryUp(3, 100)).toBe(3)
  })

  it('빈 목록에서는 0을 돌려준다', () => {
    for (const fn of [moveInventoryUp, moveInventoryDown, pageInventoryUp, pageInventoryDown]) {
      expect(fn(0, 0)).toBe(0)
    }
    expect(moveInventoryHorizontal(0, 0, 1)).toBe(0)
  })
})
