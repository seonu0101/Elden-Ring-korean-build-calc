import { defineStore } from 'pinia'
import { itemName } from '@/data/names'
import { computed, ref, watch } from 'vue'
import { ITEMS_BY_ID, LEGACY_ITEM_IDS, STARTER_PROTECTOR_IDS, STARTER_TALISMAN_IDS, STARTER_WEAPON_IDS } from '@/data/items'
import { PROTECTOR_TYPES } from '@/types'
import type { InventorySlot, Item, ProtectorItem, ProtectorType, SlotTarget } from '@/types'

export const WEAPON_SLOT_COUNT = 6
export const TALISMAN_SLOT_COUNT = 4
export const STORAGE_KEY = 'er-planner/character/v1'

type ProtectorInventories = Record<ProtectorType, InventorySlot[]>

export interface CharacterSnapshot {
  weapons: InventorySlot[]
  protectors: ProtectorInventories
  talismans: InventorySlot[]
}

let uidCounter = 0
function newUid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `slot-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`
}

function emptyProtectors(): ProtectorInventories {
  return { Head: [], Body: [], Arms: [], Legs: [] }
}

function toSlots(itemIds: string[], equipped: Record<string, number> = {}): InventorySlot[] {
  return itemIds.map((itemId, order) => {
    const slot: InventorySlot = { uid: newUid(), itemId, order }
    if (itemId in equipped) slot.equipIndex = equipped[itemId]
    return slot
  })
}

/** 처음 실행했을 때의 인벤토리: 샘플 아이템 전부 + 기본 장비 몇 개 */
export function createDefaultSnapshot(): CharacterSnapshot {
  // 같은 무기를 두 개 들고 있는 경우(쌍수)를 보여주려고 단검을 하나 더 넣는다.
  const weaponIds = [...STARTER_WEAPON_IDS, 'dagger']
  const protectors = emptyProtectors()
  for (const type of PROTECTOR_TYPES) {
    const ids = [...STARTER_PROTECTOR_IDS[type]]
    protectors[type] = toSlots(ids, ids[0] ? { [ids[0]]: 0 } : {})
  }
  return {
    weapons: toSlots(weaponIds, { longsword: 0, 'heater-shield': 3 }),
    protectors,
    talismans: toSlots([...STARTER_TALISMAN_IDS], { 'erdtrees-favor': 0, 'green-turtle-talisman': 1 }),
  }
}

function isSlot(value: unknown): value is InventorySlot {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.uid === 'string' &&
    typeof v.itemId === 'string' &&
    typeof v.order === 'number' &&
    (v.equipIndex === undefined || typeof v.equipIndex === 'number')
  )
}

/** 저장된 데이터를 검사하고, 알 수 없는 아이템이나 깨진 항목은 버린다. */
export function parseSnapshot(raw: unknown): CharacterSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  // 예전 id는 지금 id로 바꾸고, 그래도 모르는 아이템은 버린다.
  const clean = (list: unknown): InventorySlot[] =>
    Array.isArray(list)
      ? list
          .filter(isSlot)
          .map((s) => (s.itemId in LEGACY_ITEM_IDS ? { ...s, itemId: LEGACY_ITEM_IDS[s.itemId]! } : s))
          .filter((s) => ITEMS_BY_ID.has(s.itemId))
      : []
  if (!Array.isArray(r.weapons) || !Array.isArray(r.talismans)) return null
  const protectorsRaw = (typeof r.protectors === 'object' && r.protectors !== null ? r.protectors : {}) as Record<string, unknown>
  const protectors = emptyProtectors()
  for (const type of PROTECTOR_TYPES) protectors[type] = clean(protectorsRaw[type])
  return { weapons: clean(r.weapons), protectors, talismans: clean(r.talismans) }
}

function loadSnapshot(): CharacterSnapshot | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? parseSnapshot(JSON.parse(text)) : null
  } catch {
    return null
  }
}

export const useCharacterStore = defineStore('character', () => {
  const weapons = ref<InventorySlot[]>([])
  const protectors = ref<ProtectorInventories>(emptyProtectors())
  const talismans = ref<InventorySlot[]>([])

  function applySnapshot(snapshot: CharacterSnapshot) {
    weapons.value = snapshot.weapons
    protectors.value = snapshot.protectors
    talismans.value = snapshot.talismans
  }

  function toSnapshot(): CharacterSnapshot {
    return { weapons: weapons.value, protectors: protectors.value, talismans: talismans.value }
  }

  applySnapshot(loadSnapshot() ?? createDefaultSnapshot())

  watch(
    [weapons, protectors, talismans],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSnapshot()))
      } catch {
        // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 저장만 건너뛴다.
      }
    },
    { deep: true },
  )

  /** 장비 칸에 넣을 수 있는 아이템이 담긴 원본 배열 */
  function slotsFor(target: SlotTarget): InventorySlot[] {
    switch (target.kind) {
      case 'weapon':
        return weapons.value
      case 'protector':
        return protectors.value[target.protectorType]
      case 'talisman':
        return talismans.value
    }
  }

  /** 인벤토리 화면에 보여줄 순서대로 정렬한 목록 */
  function inventoryFor(target: SlotTarget): InventorySlot[] {
    return [...slotsFor(target)].sort((a, b) => a.order - b.order)
  }

  function equippedIn(target: SlotTarget): InventorySlot | null {
    const slots = slotsFor(target)
    if (target.kind === 'protector') return slots.find((s) => s.equipIndex != null) ?? null
    return slots.find((s) => s.equipIndex === target.equipIndex) ?? null
  }

  function itemOf(slot: InventorySlot): Item | null {
    return ITEMS_BY_ID.get(slot.itemId) ?? null
  }

  /**
   * 이 칸에 이 탈리스만을 끼우면 겹치는, 다른 칸에 장착된 탈리스만 이름. 문제없으면 null
   * 게임처럼 같은 탈리스만 두 개, 또는 함께 낄 수 없는 탈리스만(황금나무의 가호와 +1 등)은 동시에 장착할 수 없다.
   */
  function talismanConflict(target: SlotTarget, uid: string): string | null {
    if (target.kind !== 'talisman') return null
    const chosen = talismans.value.find((s) => s.uid === uid)
    const item = chosen ? itemOf(chosen) : null
    if (!chosen || !item || item.kind !== 'talisman') return null
    for (const slot of talismans.value) {
      // 같은 칸(바꿔 끼움)과 자기 자신(다른 칸에서 옮김)은 괜찮다
      if (slot.equipIndex == null || slot.equipIndex === target.equipIndex || slot.uid === uid) continue
      const other = itemOf(slot)
      if (!other || other.kind !== 'talisman') continue
      if (other.id === item.id || item.conflicts.includes(other.id) || other.conflicts.includes(item.id)) {
        return itemName(other)
      }
    }
    return null
  }

  /**
   * 장비 칸에 아이템을 장착한다. 장착했으면 true, 막혔으면 false
   * 이미 그 칸에 장착된 아이템을 고르면 해제한다 (장비 화면에서는 다시 골라도 해제하지 않도록 막는다).
   * - 무기: 다른 칸에 장착된 무기를 고르면 두 칸의 무기를 맞바꾼다.
   * - 방어구: 부위마다 하나만 장착한다.
   * - 탈리스만: 다른 칸에 있던 탈리스만이면 그 칸에서 빼서 옮긴다. 겹치는 탈리스만이 다른 칸에 있으면 막는다.
   */
  function equip(target: SlotTarget, uid: string): boolean {
    const slots = slotsFor(target)
    const chosen = slots.find((s) => s.uid === uid)
    if (!chosen) return false
    if (talismanConflict(target, uid)) return false
    const isSame = equippedIn(target)?.uid === uid

    if (target.kind === 'weapon') {
      const destination = target.equipIndex
      for (const slot of slots) {
        if (slot.equipIndex !== destination) continue
        if (!isSame && chosen.equipIndex != null) slot.equipIndex = chosen.equipIndex
        else delete slot.equipIndex
      }
      if (!isSame) chosen.equipIndex = destination
    } else if (target.kind === 'protector') {
      for (const slot of slots) delete slot.equipIndex
      if (!isSame) chosen.equipIndex = 0
    } else {
      const destination = target.equipIndex
      for (const slot of slots) if (slot.equipIndex === destination) delete slot.equipIndex
      if (!isSame) chosen.equipIndex = destination
    }
    return true
  }

  function unequip(target: SlotTarget) {
    const current = equippedIn(target)
    if (current) delete current.equipIndex
  }

  function unequipAll() {
    for (const list of [weapons.value, talismans.value, ...Object.values(protectors.value)]) {
      for (const slot of list) delete slot.equipIndex
    }
  }

  /** 인벤토리를 완전히 비운다 (장착한 장비 포함 모든 아이템 삭제) */
  function clearInventory() {
    applySnapshot({ weapons: [], protectors: emptyProtectors(), talismans: [] })
  }

  /** 인벤토리에 든 아이템 수 (장착 중인 것 포함) */
  const inventoryCount = computed(
    () => weapons.value.length + talismans.value.length + Object.values(protectors.value).flat().length,
  )

  function addItem(itemId: string): InventorySlot | null {
    const item = ITEMS_BY_ID.get(itemId)
    if (!item) return null
    const target: SlotTarget =
      item.kind === 'protector'
        ? { kind: 'protector', protectorType: item.protectorType }
        : { kind: item.kind, equipIndex: 0 }
    const slots = slotsFor(target)
    const slot: InventorySlot = { uid: newUid(), itemId, order: slots.reduce((max, s) => Math.max(max, s.order + 1), 0) }
    slots.push(slot)
    return slot
  }

  function removeSlot(uid: string) {
    for (const list of [weapons.value, talismans.value, ...Object.values(protectors.value)]) {
      const index = list.findIndex((s) => s.uid === uid)
      if (index >= 0) {
        list.splice(index, 1)
        return
      }
    }
  }

  function resetToDefault() {
    applySnapshot(createDefaultSnapshot())
  }

  const equippedItems = computed<Item[]>(() =>
    [
      ...weapons.value.filter((s) => s.equipIndex != null),
      ...Object.values(protectors.value).flatMap((list) => list.filter((s) => s.equipIndex != null)),
      ...talismans.value.filter((s) => s.equipIndex != null),
    ]
      .map(itemOf)
      .filter((item): item is Item => item !== null),
  )

  const totalWeight = computed(() => equippedItems.value.reduce((sum, item) => sum + item.weight, 0))
  /** 장착한 방어구 (경감률·내성 계산에 쓴다) */
  const equippedProtectors = computed<ProtectorItem[]>(() =>
    equippedItems.value.filter((item): item is ProtectorItem => item.kind === 'protector'),
  )
  const totalPoise = computed(() => equippedProtectors.value.reduce((sum, p) => sum + p.poise, 0))

  return {
    weapons,
    protectors,
    talismans,
    inventoryFor,
    equippedIn,
    itemOf,
    equip,
    talismanConflict,
    unequip,
    unequipAll,
    clearInventory,
    inventoryCount,
    addItem,
    removeSlot,
    resetToDefault,
    applySnapshot,
    toSnapshot,
    equippedItems,
    equippedProtectors,
    totalWeight,
    totalPoise,
  }
})
