import { computed, ref, watch } from 'vue'
import { useCharacterStore } from '@/stores/character'
import type { InventorySlot } from '@/types'
import { EQUIPMENT_GRID, EQUIPMENT_ROW_LENGTHS, slotCycleGroup } from './layout'
import type { EquipmentCell, SlotPosition } from './layout'
import {
  moveGridCursor,
  moveInventoryDown,
  moveInventoryHorizontal,
  moveInventoryUp,
  pageInventoryDown,
  pageInventoryUp,
} from './navigation'

/**
 * game: 메뉴가 닫힌 상태
 * menu: 메인 메뉴 (Equipment 항목)
 * grid: 장비 칸 격자
 * inventory: 선택한 칸에 넣을 아이템 목록
 */
export type MenuMode = 'game' | 'menu' | 'grid' | 'inventory'

/** 키보드와 게임패드 입력을 모두 이 동작으로 바꿔서 전달한다. */
export type MenuAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'back'
  /** 지금 칸 장착 해제 (키보드 R만) */
  | 'unequip'
  | 'toggleMenu'
  | 'prevSlot'
  | 'nextSlot'
  | 'pageUp'
  | 'pageDown'

export interface UseGameMenuOptions {
  initialMode?: MenuMode
}

export function useGameMenu(store = useCharacterStore(), options: UseGameMenuOptions = {}) {
  const mode = ref<MenuMode>(options.initialMode ?? 'grid')
  const row = ref(0)
  const col = ref(0)
  const inventoryIndex = ref(0)
  /** 장착이 막혔을 때 보여줄 안내 (커서를 옮기면 사라진다) */
  const notice = ref<string | null>(null)
  watch([inventoryIndex, row, col, mode], () => {
    notice.value = null
  })

  const currentCell = computed<EquipmentCell>(() => EQUIPMENT_GRID[row.value]![col.value]!)
  /** 칸 전환으로 오가는 칸 묶음 (목록 위 탭으로도 보여준다) */
  const slotGroup = computed<SlotPosition[]>(() => slotCycleGroup(row.value))
  /** 목록 화면에 보이는 아이템 */
  const inventory = computed<InventorySlot[]>(() => store.inventoryFor(currentCell.value.target))
  const equippedSlot = computed<InventorySlot | null>(() => store.equippedIn(currentCell.value.target))
  /** 지금 커서가 가리키는 아이템. 상세 정보 표시에 쓴다. */
  const focusedSlot = computed<InventorySlot | null>(() =>
    mode.value === 'inventory' ? (inventory.value[inventoryIndex.value] ?? null) : equippedSlot.value,
  )

  /** 목록을 열 때 커서 위치: 장착 중인 아이템, 빈 칸이면 첫 아이템 */
  function syncInventoryCursor() {
    const equipped = equippedSlot.value
    const index = equipped ? inventory.value.findIndex((s) => s.uid === equipped.uid) : -1
    inventoryIndex.value = Math.max(0, index)
  }

  function moveGrid(dRow: number, dCol: number) {
    const next = moveGridCursor(EQUIPMENT_ROW_LENGTHS, { row: row.value, col: col.value }, dRow, dCol)
    row.value = next.row
    col.value = next.col
  }

  function openInventory() {
    mode.value = 'inventory'
    syncInventoryCursor()
  }

  /**
   * 목록을 연 채로 이전/다음 칸으로 바꾼다 (RH1 → RH2 등).
   * 무기는 오른손·왼손 6칸이 한 바퀴로 이어져서 RH1의 이전은 LH3, RH3의 다음은 LH1이다.
   */
  function cycleSlot(delta: number) {
    const group = slotGroup.value
    if (group.length <= 1) return
    const index = group.findIndex((p) => p.row === row.value && p.col === col.value)
    const next = group[(((index + delta) % group.length) + group.length) % group.length]!
    row.value = next.row
    col.value = next.col
    syncInventoryCursor()
  }

  /**
   * 목록의 아이템을 지금 칸에 장착한다. 목록은 닫지 않아서 다른 아이템으로 바로 바꿔 볼 수 있다 (닫기는 Q/B).
   * 이미 장착된 아이템을 다시 골라도 해제하지 않는다.
   */
  function equipAt(index: number) {
    const slot = inventory.value[index]
    if (!slot) return
    inventoryIndex.value = index
    if (slot.uid === equippedSlot.value?.uid) return
    // 같은 탈리스만·함께 낄 수 없는 탈리스만이 다른 칸에 있으면 게임처럼 막고 이유를 보여준다
    const conflict = store.talismanConflict(currentCell.value.target, slot.uid)
    if (conflict) {
      notice.value = `${conflict}와(과) 함께 장착할 수 없습니다`
      return
    }
    store.equip(currentCell.value.target, slot.uid)
  }

  function setInventoryIndex(update: (index: number, count: number) => number) {
    inventoryIndex.value = update(inventoryIndex.value, inventory.value.length)
  }

  /** 입력 하나를 처리한다. 이 메뉴가 처리한 입력이면 true를 돌려준다. */
  function dispatch(action: MenuAction): boolean {
    if (action === 'toggleMenu') {
      if (mode.value === 'game') {
        mode.value = 'menu'
        row.value = 0
        col.value = 0
      } else {
        mode.value = 'game'
      }
      return true
    }

    switch (mode.value) {
      case 'game':
        return false

      case 'menu':
        if (action === 'confirm') mode.value = 'grid'
        else if (action === 'back') mode.value = 'game'
        else return false
        return true

      case 'grid':
        switch (action) {
          case 'up': moveGrid(-1, 0); return true
          case 'down': moveGrid(1, 0); return true
          case 'left': moveGrid(0, -1); return true
          case 'right': moveGrid(0, 1); return true
          case 'confirm': openInventory(); return true
          case 'unequip': store.unequip(currentCell.value.target); return true
          case 'back': mode.value = 'menu'; return true
          default: return false
        }

      case 'inventory':
        switch (action) {
          case 'left': setInventoryIndex((i, n) => moveInventoryHorizontal(i, n, -1)); return true
          case 'right': setInventoryIndex((i, n) => moveInventoryHorizontal(i, n, 1)); return true
          case 'up': setInventoryIndex(moveInventoryUp); return true
          case 'down': setInventoryIndex(moveInventoryDown); return true
          case 'pageUp': setInventoryIndex(pageInventoryUp); return true
          case 'pageDown': setInventoryIndex(pageInventoryDown); return true
          case 'prevSlot': cycleSlot(-1); return true
          case 'nextSlot': cycleSlot(1); return true
          case 'confirm': equipAt(inventoryIndex.value); return true
          case 'unequip': store.unequip(currentCell.value.target); return true
          case 'back': mode.value = 'grid'; return true
          default: return false
        }
    }
  }

  // 마우스 조작
  function selectCell(r: number, c: number) {
    if (!EQUIPMENT_GRID[r]?.[c]) return
    row.value = r
    col.value = c
  }

  function openCell(r: number, c: number) {
    selectCell(r, c)
    openInventory()
  }

  function selectInventory(index: number) {
    if (index >= 0 && index < inventory.value.length) inventoryIndex.value = index
  }

  return {
    mode,
    row,
    col,
    inventoryIndex,
    currentCell,
    slotGroup,
    inventory,
    equippedSlot,
    focusedSlot,
    notice,
    dispatch,
    selectCell,
    openCell,
    selectInventory,
    equipAt,
  }
}

export type GameMenu = ReturnType<typeof useGameMenu>
