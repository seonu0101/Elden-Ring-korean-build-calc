// 버프 중첩 규칙: 같은 묶음의 버프는 겹치지 않고, 나중에 켠 버프가 앞의 것을 덮어쓴다.
// 원본 사이트 데이터에는 중첩 정보가 없어서, 게임에서 확실히 알려진 경우만 여기에 직접 적었다.
// 규칙을 더하려면 STACK_GROUPS에 묶음을 추가하면 된다.
import type { BuffItem } from '@/types'

export interface StackGroup {
  id: string
  /** 화면에 보이는 묶음 이름 */
  label: string
  matches: (b: BuffItem) => boolean
}

export const STACK_GROUPS: readonly StackGroup[] = [
  {
    // 무기 버프(기름, 무기에 거는 주문)는 무기에 하나만 걸린다. 방패 기름(Shield Grease)은 왼손 방패용이라 따로 본다.
    id: 'weapon-enchant',
    label: '무기 버프',
    matches: (b) => b.name !== 'Shield Grease' && (b.weaponBuff || b.category === 'Grease'),
  },
  {
    // 물리 공격력을 올리는 바디 버프끼리는 겹치지 않는다
    id: 'body-physical-attack',
    label: '바디 버프 (물리 공격력)',
    matches: (b) => b.name === 'Flame, Grant Me Strength' || b.name === 'Exalted Flesh',
  },
]

/** 버프가 속한 묶음들. 같은 이름의 버프(주문판·전회판 황금 맹세 등)는 서로 같은 효과라 겹치지 않는다. */
export function stackGroupsOf(b: BuffItem): { id: string; label: string }[] {
  return [
    ...STACK_GROUPS.filter((g) => g.matches(b)).map((g) => ({ id: g.id, label: g.label })),
    { id: `same-name:${b.name}`, label: '같은 버프' },
  ]
}

export interface StackingResult {
  /** 실제로 적용되는 버프 */
  active: BuffItem[]
  /** 다른 버프에 덮여서 적용되지 않는 버프: id → 덮은 버프와 묶음 이름 */
  overridden: Map<string, { by: BuffItem; group: string }>
}

/** 켠 순서대로 보면서, 같은 묶음에 나중에 켠 버프가 있으면 앞의 것을 적용하지 않는다 (게임과 같다) */
export function resolveStacking(selected: readonly BuffItem[]): StackingResult {
  const overridden = new Map<string, { by: BuffItem; group: string }>()
  for (let i = 0; i < selected.length; i++) {
    const earlier = selected[i]!
    const groups = stackGroupsOf(earlier)
    for (let j = i + 1; j < selected.length; j++) {
      const later = selected[j]!
      const shared = stackGroupsOf(later).find((g) => groups.some((x) => x.id === g.id))
      if (shared) {
        overridden.set(earlier.id, { by: later, group: shared.label })
        break
      }
    }
  }
  return { active: selected.filter((b) => !overridden.has(b.id)), overridden }
}

/** 같은 묶음이라 함께 적용되지 않는 버프가 있는지 (고르기 목록 표시용) */
export function conflictsWith(b: BuffItem, selected: readonly BuffItem[]): BuffItem | null {
  const groups = stackGroupsOf(b)
  return selected.find((s) => s.id !== b.id && stackGroupsOf(s).some((g) => groups.some((x) => x.id === g.id))) ?? null
}
