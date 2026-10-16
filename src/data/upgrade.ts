// 무기 강화(+0 ~ +25, 특수 무기 +0 ~ +10)에 따른 수치 계산
import { DAMAGE_TYPES, STAT_KEYS, STATUS_TYPES } from '@/types'
import type { DamageType, StatKey, WeaponStats } from '@/types'
import reinforcementData from './reinforcements.generated.json'

export interface ReinforcementRates {
  damage: Record<DamageType, number>
  scaling: Record<StatKey, number>
  guard: Record<DamageType, number> & { boost: number }
}

const REINFORCEMENTS = reinforcementData.reinforcements as Record<string, ReinforcementRates[]>

/** 일반 무기(단석) 최대 강화 */
export const MAX_REGULAR_LEVEL = 25
/** 특수 무기(색 잃은 단석) 최대 강화 */
export const MAX_SOMBER_LEVEL = 10

/** 강화 단계의 배율 (공격력·보정·가드). 표에 없으면 null */
export function reinforcementRates(reinforcement: number, level: number): ReinforcementRates | null {
  return REINFORCEMENTS[reinforcement]?.[Math.max(0, level)] ?? null
}

/** 이 수치(무기+변질)의 최대 강화 단계. 강화할 수 없는 무기는 0 */
export function maxUpgradeLevel(st: Pick<WeaponStats, 'reinforcement'>): number {
  return Math.max(0, (REINFORCEMENTS[st.reinforcement]?.length ?? 1) - 1)
}

/** 일반 강화 단계를 비슷한 특수 강화 단계로 (+25 → +10, +10 → +4) */
export function somberFromRegular(level: number): number {
  return Math.floor((level * MAX_SOMBER_LEVEL) / MAX_REGULAR_LEVEL)
}

/** 특수 강화 단계를 비슷한 일반 강화 단계로 (+10 → +25, +4 → +10) */
export function regularFromSomber(level: number): number {
  return Math.round((level * MAX_REGULAR_LEVEL) / MAX_SOMBER_LEVEL)
}

export interface UpgradeSetting {
  /** 일반 무기 강화 단계 (0~25) */
  regular: number
  /** 특수 무기 강화 단계 (0~10) */
  somber: number
}

/** 설정에서 이 무기에 적용할 강화 단계. 최대 +10까지인 무기는 특수 강화 단계를 쓴다. */
export function levelFor(st: Pick<WeaponStats, 'reinforcement'>, setting: UpgradeSetting): number {
  const max = maxUpgradeLevel(st)
  if (max === 0) return 0
  const wanted = max <= MAX_SOMBER_LEVEL ? setting.somber : setting.regular
  return Math.min(max, Math.max(0, Math.floor(wanted)))
}

/**
 * 강화 단계를 적용한 수치. 게임 화면처럼 공격력과 가드 강도는 소수점을 버린다.
 * 보정은 계수 그대로 두고(표시할 때 × 100), 가드 경감률은 소수 첫째 자리까지(최대 100).
 *
 * 데이터의 공격력은 강화 배율을 곱하기 전 값이라 +0에도 배율을 곱한다.
 * 표준 변질은 +0 배율이 1이지만, 다른 변질은 0.75~0.95라서 +0 공격력이 데이터 값보다 낮다.
 * (중후 우치가타나 +0: 110 × 0.95 = 104) 원본 사이트도 같은 방식으로 계산한다.
 */
export function upgradeStats<T extends WeaponStats>(st: T, level: number): T {
  const rates = REINFORCEMENTS[st.reinforcement]?.[Math.max(0, level)]
  if (!rates) return st

  const damage: WeaponStats['damage'] = {}
  for (const d of DAMAGE_TYPES) {
    const base = st.damage[d]
    if (base) damage[d] = Math.floor(base * rates.damage[d])
  }
  const scaling: WeaponStats['scaling'] = {}
  for (const s of STAT_KEYS) {
    const base = st.scaling[s]
    if (base) scaling[s] = base * rates.scaling[s]
  }
  const guard: WeaponStats['guard'] = { boost: Math.floor(st.guard.boost * rates.guard.boost) }
  for (const d of DAMAGE_TYPES) {
    const base = st.guard[d]
    if (base) guard[d] = Math.min(100, Math.round(base * rates.guard[d] * 10) / 10)
  }
  const status: WeaponStats['status'] = { ...st.status }
  for (const t of STATUS_TYPES) {
    const byLevel = st.statusByLevel?.[t]
    if (byLevel?.[level] !== undefined) status[t] = byLevel[level]
  }
  return { ...st, damage, scaling, guard, status }
}
