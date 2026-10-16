// 커서 이동 계산. 화면이나 저장소와 무관한 순수 함수만 둔다.

/** 인벤토리 목록 한 줄에 들어가는 아이템 수 */
export const INVENTORY_COLUMNS = 5
/** PgUp/PgDn(L2/R2)으로 한 번에 건너뛰는 줄 수 */
export const PAGE_ROWS = 5

export interface GridPosition {
  row: number
  col: number
}

/**
 * 장비 칸 격자에서 커서를 옮긴다. 끝에 닿으면 반대쪽 끝으로 넘어간다.
 * 칸 수가 다른 줄로 옮길 때는 열 번호를 그 줄의 마지막 칸까지로 맞춘다.
 * (원본 사이트는 이때 나머지 연산을 써서 첫 칸으로 튀었다.)
 */
export function moveGridCursor(rowLengths: readonly number[], pos: GridPosition, dRow: number, dCol: number): GridPosition {
  const rowCount = rowLengths.length
  if (rowCount === 0) return pos
  const row = (((pos.row + dRow) % rowCount) + rowCount) % rowCount
  const length = rowLengths[row] ?? 1
  const col = dCol === 0 ? Math.min(pos.col, length - 1) : (((pos.col + dCol) % length) + length) % length
  return { row, col }
}

/** 좌우 이동: 한 칸씩, 목록 끝에서 반대쪽 끝으로 넘어간다. */
export function moveInventoryHorizontal(index: number, count: number, delta: number): number {
  if (count === 0) return 0
  return (((index + delta) % count) + count) % count
}

/** 위로 한 줄. 첫 줄에서는 같은 열의 마지막 줄로 넘어간다(마지막 줄이 짧으면 마지막 아이템). */
export function moveInventoryUp(index: number, count: number): number {
  if (count === 0) return 0
  if (index >= INVENTORY_COLUMNS) return index - INVENTORY_COLUMNS
  const col = index % INVENTORY_COLUMNS
  const lastRow = Math.floor((count - 1) / INVENTORY_COLUMNS)
  return Math.min(lastRow * INVENTORY_COLUMNS + col, count - 1)
}

/** 아래로 한 줄. 더 내려갈 아이템이 없으면 같은 열의 첫 줄로 넘어간다. */
export function moveInventoryDown(index: number, count: number): number {
  if (count === 0) return 0
  const next = index + INVENTORY_COLUMNS
  return next >= count ? index % INVENTORY_COLUMNS : next
}

/** 위로 PAGE_ROWS 줄. 첫 줄에서 멈추고 넘어가지 않는다. */
export function pageInventoryUp(index: number, count: number): number {
  if (count === 0) return 0
  const col = index % INVENTORY_COLUMNS
  const row = Math.floor(index / INVENTORY_COLUMNS)
  return Math.max(0, row - PAGE_ROWS) * INVENTORY_COLUMNS + col
}

/** 아래로 PAGE_ROWS 줄. 같은 열에 아이템이 있는 마지막 줄에서 멈춘다. */
export function pageInventoryDown(index: number, count: number): number {
  if (count === 0) return 0
  const col = index % INVENTORY_COLUMNS
  const row = Math.floor(index / INVENTORY_COLUMNS)
  const lastRowInColumn = Math.floor((count - 1 - col) / INVENTORY_COLUMNS)
  if (row >= lastRowInColumn) return index
  return Math.min(lastRowInColumn, row + PAGE_ROWS) * INVENTORY_COLUMNS + col
}
