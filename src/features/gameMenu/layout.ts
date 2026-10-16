import type { SlotTarget } from '@/types'

export interface EquipmentCell {
  /** 칸에 표시하는 짧은 이름 */
  label: string
  /** 상세 정보에 표시하는 이름 */
  title: string
  target: SlotTarget
}

/** 게임 장비 화면과 같은 배치: 오른손 3, 왼손 3, 방어구 4, 탈리스만 4 */
export const EQUIPMENT_GRID: readonly (readonly EquipmentCell[])[] = [
  [
    { label: 'RH1', title: '오른손 무기 1', target: { kind: 'weapon', equipIndex: 0 } },
    { label: 'RH2', title: '오른손 무기 2', target: { kind: 'weapon', equipIndex: 1 } },
    { label: 'RH3', title: '오른손 무기 3', target: { kind: 'weapon', equipIndex: 2 } },
  ],
  [
    { label: 'LH1', title: '왼손 무기 1', target: { kind: 'weapon', equipIndex: 3 } },
    { label: 'LH2', title: '왼손 무기 2', target: { kind: 'weapon', equipIndex: 4 } },
    { label: 'LH3', title: '왼손 무기 3', target: { kind: 'weapon', equipIndex: 5 } },
  ],
  [
    { label: 'Head', title: '머리', target: { kind: 'protector', protectorType: 'Head' } },
    { label: 'Body', title: '몸통', target: { kind: 'protector', protectorType: 'Body' } },
    { label: 'Arms', title: '팔', target: { kind: 'protector', protectorType: 'Arms' } },
    { label: 'Legs', title: '다리', target: { kind: 'protector', protectorType: 'Legs' } },
  ],
  [
    { label: 'T1', title: '탈리스만 1', target: { kind: 'talisman', equipIndex: 0 } },
    { label: 'T2', title: '탈리스만 2', target: { kind: 'talisman', equipIndex: 1 } },
    { label: 'T3', title: '탈리스만 3', target: { kind: 'talisman', equipIndex: 2 } },
    { label: 'T4', title: '탈리스만 4', target: { kind: 'talisman', equipIndex: 3 } },
  ],
]

export const EQUIPMENT_ROW_LENGTHS: readonly number[] = EQUIPMENT_GRID.map((row) => row.length)

/**
 * 아이템 목록에서 칸 전환(C/V, L1/R1)할 때 한 바퀴로 도는 칸 묶음.
 * 무기는 오른손·왼손 6칸이 이어진다: RH1 → RH2 → RH3 → LH1 → LH2 → LH3 → RH1
 * (RH1에서 이전은 LH3, RH3에서 다음은 LH1). 방어구·탈리스만은 각자 줄 안에서 돈다.
 */
const SLOT_CYCLE_ROWS: readonly (readonly number[])[] = [[0, 1], [2], [3]]

export interface SlotPosition {
  row: number
  col: number
  cell: EquipmentCell
}

export function slotCycleGroup(row: number): SlotPosition[] {
  const rows = SLOT_CYCLE_ROWS.find((group) => group.includes(row)) ?? [row]
  return rows.flatMap((r) => (EQUIPMENT_GRID[r] ?? []).map((cell, col) => ({ row: r, col, cell })))
}
