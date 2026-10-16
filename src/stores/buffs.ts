import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { resolveStacking } from '@/data/buffStacking'
import { combineEffects } from '@/data/effects'
import type { EffectSource } from '@/data/effects'
import { BUFFS_BY_ID } from '@/data/items'
import { itemName } from '@/data/names'
import { useCharacterStore } from '@/stores/character'
import type { BuffItem, TalismanItem } from '@/types'

export const BUFFS_STORAGE_KEY = 'er-planner/buffs/v1'

interface BuffsSnapshot {
  selected: string[]
  pvp: boolean
}

function loadSnapshot(): Partial<BuffsSnapshot> {
  try {
    const raw = JSON.parse(localStorage.getItem(BUFFS_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const out: Partial<BuffsSnapshot> = {}
    if (Array.isArray(raw.selected)) out.selected = raw.selected.filter((id): id is string => BUFFS_BY_ID.has(id as string))
    if (typeof raw.pvp === 'boolean') out.pvp = raw.pvp
    return out
  } catch {
    return {}
  }
}

/**
 * 장비 화면에서 켠 버프(주문·소비 아이템)와 PvE/PvP 설정.
 * 효과 합계에는 장착한 탈리스만도 함께 들어간다.
 */
export const useBuffsStore = defineStore('buffs', () => {
  const saved = loadSnapshot()
  const selected = ref<string[]>(saved.selected ?? [])
  const pvp = ref(saved.pvp ?? false)

  watch(
    [selected, pvp],
    () => {
      try {
        localStorage.setItem(BUFFS_STORAGE_KEY, JSON.stringify({ selected: selected.value, pvp: pvp.value }))
      } catch {
        // 저장소를 쓸 수 없으면 저장만 건너뛴다.
      }
    },
    { deep: true },
  )

  const character = useCharacterStore()

  const selectedBuffs = computed<BuffItem[]>(() =>
    selected.value.map((id) => BUFFS_BY_ID.get(id)).filter((b): b is BuffItem => b !== undefined),
  )
  const equippedTalismans = computed<TalismanItem[]>(() =>
    character.equippedItems.filter((i): i is TalismanItem => i.kind === 'talisman'),
  )

  /** 중첩 규칙: 같은 묶음 버프는 나중에 켠 것만 적용된다 */
  const stacking = computed(() => resolveStacking(selectedBuffs.value))

  /** 합칠 효과: 장착한 탈리스만 + 켠 버프 중 실제로 적용되는 것 */
  const sources = computed<EffectSource[]>(() => [
    ...equippedTalismans.value.map((t) => ({ id: t.id, name: itemName(t), type: 'talisman' as const, effects: t.effects })),
    ...stacking.value.active.map((b) => ({ id: b.id, name: itemName(b), type: b.kind, effects: b.effects })),
  ])

  const summary = computed(() => combineEffects(sources.value, pvp.value))

  function add(id: string) {
    if (BUFFS_BY_ID.has(id) && !selected.value.includes(id)) selected.value.push(id)
  }

  function remove(id: string) {
    selected.value = selected.value.filter((x) => x !== id)
  }

  function clear() {
    selected.value = []
  }

  return { selected, pvp, selectedBuffs, equippedTalismans, stacking, sources, summary, add, remove, clear }
})
