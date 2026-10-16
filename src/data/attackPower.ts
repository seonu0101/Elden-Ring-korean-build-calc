// 캐릭터 능력치로 무기 공격력과 상태이상 축적치를 계산한다.
// 원본 사이트(er-build-planner)의 계산식을 그대로 옮겼다.
//
//   기본값 = 데이터 값 × 강화 배율
//   보정값 = 기본값 × Σ(능력치마다: 보정 계수 × 강화 보정 배율 × 보정 곡선[능력치] × 비율 + 비율 − 1)
//   요구 능력치가 모자라면 그 속성은 보정 대신 기본값 × −0.4 (40% 감소)
//   상태이상(출혈·독·수면·발광)은 신비로만 보정된다. 동상·부패는 보정 없음.
//   양손으로 들면 근력 × 1.5 (최대 150). 주먹·손톱 등 일부 무기는 제외.
import { DAMAGE_TYPES, STAT_KEYS, STATUS_TYPES } from '@/types'
import type { AffinityName, CharacterStats, DamageType, StatKey, StatusType, WeaponItem } from '@/types'
import correctionData from './correction.generated.json'
import { reinforcementRates, upgradeStats } from './upgrade'

interface CorrectionAttack {
  /** 속성마다 보정을 받는 능력치 */
  correction: Partial<Record<DamageType, StatKey[]>>
  /** 기본값 1이 아닌 비율만 */
  ratio: Partial<Record<DamageType, Partial<Record<StatKey, number>>>>
  /** 보정 계수를 덮어쓰는 값 (일부 무기만) */
  override: Partial<Record<DamageType, Partial<Record<StatKey, number>>>>
}

const GRAPHS = correctionData.graphs as Record<string, number[]>
const CORRECTION_ATTACK = correctionData.attack as Record<string, CorrectionAttack>

/** 신비 보정을 받는 상태이상 */
const SCALING_STATUS: readonly StatusType[] = ['bleed', 'poison', 'sleep', 'madness']

/** 양손 근력 보너스를 받지 못하는 무기군과 무기 (원본 사이트 기준) */
export const NO_TWO_HAND_BONUS_TYPES: readonly string[] = ['Fist', 'Claw', 'Backhand Blade', 'Hand-to-Hand', 'Perfume Bottle', 'Beast Claw']
export const NO_TWO_HAND_BONUS_NAMES: readonly string[] = [
  'Ornamental Straight Sword',
  "Rellana's Twin Blades",
  'Greatsword of Radahn (Light)',
  'Greatsword of Radahn (Lord)',
  'Starscourge Greatsword',
  'Falx',
  'Dancing Blade of Ranah',
]

export const MAX_STAT = 99
/** 보정 곡선의 마지막 칸 (양손 근력 최대치) */
const MAX_GRAPH_STAT = 150

export function canTwoHandBonus(w: Pick<WeaponItem, 'weaponType' | 'name'>): boolean {
  return !NO_TWO_HAND_BONUS_TYPES.includes(w.weaponType) && !NO_TWO_HAND_BONUS_NAMES.includes(w.name)
}

/** 계산에 실제로 쓰는 능력치 (양손이면 근력 × 1.5) */
export function effectiveStats(stats: CharacterStats, w: Pick<WeaponItem, 'weaponType' | 'name'>, twoHanded: boolean) {
  const out = { ...stats }
  if (twoHanded && canTwoHandBonus(w)) out.strength = Math.min(Math.floor(stats.strength * 1.5), MAX_GRAPH_STAT)
  return out
}

function graphValue(graphId: number | undefined, stat: number): number {
  if (graphId === undefined) return 0
  const graph = GRAPHS[graphId]
  if (!graph) return 0
  return graph[Math.min(Math.max(0, Math.floor(stat)), graph.length - 1)] ?? 0
}

/** 보정 곡선 번호 목록 (계산식 페이지의 곡선 표) */
export const CORRECTION_GRAPH_IDS: readonly number[] = Object.keys(GRAPHS).map(Number).sort((a, b) => a - b)

/** 보정 곡선 값 (능력치는 0~150, 소수점 버림) */
export function correctionGraphValue(graphId: number, stat: number): number {
  return graphValue(graphId, stat)
}

/** 기본값과 보정값. 화면에는 소수점을 버려서 보여준다. */
export interface ValuePart {
  base: number
  scaling: number
}

export function partTotal(p: ValuePart): number {
  return Math.floor(p.base + p.scaling)
}

/** 보정 한 줄: 계수 × 강화 보정 배율 × 보정 곡선[능력치] × 비율 + 비율 − 1 */
export interface ScalingTerm {
  stat: StatKey
  /** 계산에 쓴 능력치 (양손 근력 반영) */
  value: number
  coefficient: number
  scalingRate: number
  graphId: number | undefined
  graph: number
  ratio: number
  term: number
}

/** 속성 공격력 계산 과정 */
export interface DamageDetail {
  /** 데이터 값 (강화 전) */
  raw: number
  /** 강화 배율 */
  rate: number
  /** 이 속성을 보정하는 능력치 중 요구치가 모자란 것 */
  missing: StatKey[]
  terms: ScalingTerm[]
  /** 보정 배율 (모자라면 −0.4, 음수인 줄이 있으면 그 값, 아니면 합) */
  multiplier: number
  rule: 'sum' | 'negative' | 'unmet'
}

/** 상태이상 축적치 계산 과정 */
export interface StatusDetail {
  /** 신비 보정을 받는지 */
  scales: boolean
  unmet: boolean
  coefficient: number
  scalingRate: number
  graphId: number | undefined
  graph: number
  multiplier: number
}

export interface AttackResult {
  affinity: AffinityName
  level: number
  twoHanded: boolean
  /** 계산에 쓴 능력치 (양손 근력 반영) */
  stats: CharacterStats
  damage: Record<DamageType, ValuePart>
  /** 공격력 합계 (원본 사이트처럼 합한 뒤 소수점 버림) */
  total: number
  status: Record<StatusType, ValuePart>
  /** 모자란 요구 능력치 */
  unmet: StatKey[]
  /** 계산식 보기용 과정 */
  details: Record<DamageType, DamageDetail>
  statusDetails: Record<StatusType, StatusDetail>
}

export function calculateAttack(
  w: WeaponItem,
  affinity: AffinityName,
  level: number,
  stats: CharacterStats,
  twoHanded = false,
): AttackResult | null {
  const raw = affinity === 'Standard' ? w : w.affinities?.[affinity]
  if (!raw) return null
  const rates = reinforcementRates(raw.reinforcement, level)
  if (!rates) return null
  const eff = effectiveStats(stats, w, twoHanded)
  const correction = CORRECTION_ATTACK[raw.correctionAttack]
  const unmet = STAT_KEYS.filter((s) => eff[s] < (w.requirements[s] ?? 0))

  const damage = {} as Record<DamageType, ValuePart>
  const details = {} as Record<DamageType, DamageDetail>
  for (const d of DAMAGE_TYPES) {
    const rawValue = raw.damage[d] ?? 0
    const base = rawValue * rates.damage[d]
    const detail: DamageDetail = { raw: rawValue, rate: rates.damage[d], missing: [], terms: [], multiplier: 0, rule: 'sum' }
    details[d] = detail
    if (!base) {
      damage[d] = { base: 0, scaling: 0 }
      continue
    }
    const scalingStats = correction?.correction[d] ?? []
    detail.missing = scalingStats.filter((s) => eff[s] < (w.requirements[s] ?? 0))
    detail.terms = STAT_KEYS.filter((s) => scalingStats.includes(s)).map((s) => {
      const ratio = correction?.ratio[d]?.[s] ?? 1
      const coefficient = correction?.override[d]?.[s] ?? raw.scaling[s] ?? 0
      const graphId = raw.correctionCalc[d]
      const graph = graphValue(graphId, eff[s])
      const scalingRate = rates.scaling[s]
      const term = ratio - 1 + coefficient * scalingRate * graph * ratio
      return { stat: s, value: eff[s], coefficient, scalingRate, graphId, graph, ratio, term }
    })
    if (detail.missing.length) {
      detail.multiplier = -0.4
      detail.rule = 'unmet'
    } else {
      // 보정 받지 않는 능력치는 0으로 친다 (원본 사이트와 같다)
      const perStat = detail.terms.map((t) => t.term)
      const lowest = Math.min(0, ...perStat)
      detail.rule = lowest < 0 ? 'negative' : 'sum'
      detail.multiplier = lowest < 0 ? lowest : perStat.reduce((a, b) => a + b, 0)
    }
    damage[d] = { base, scaling: base * detail.multiplier }
  }

  // 상태이상 기본값은 강화 단계별 값(피 변질 등)을 쓴다.
  const upgradedStatus = upgradeStats(raw, level).status
  const status = {} as Record<StatusType, ValuePart>
  const statusDetails = {} as Record<StatusType, StatusDetail>
  for (const t of STATUS_TYPES) {
    const base = upgradedStatus[t] ?? 0
    const graphId = SCALING_STATUS.includes(t) ? raw.correctionCalc[t as 'bleed'] : undefined
    const detail: StatusDetail = {
      scales: false,
      unmet: false,
      coefficient: raw.scaling.arcane ?? 0,
      scalingRate: rates.scaling.arcane,
      graphId,
      graph: graphValue(graphId, eff.arcane),
      multiplier: 0,
    }
    statusDetails[t] = detail
    if (!base || graphId === undefined) {
      status[t] = { base, scaling: 0 }
    } else if (eff.arcane < (w.requirements.arcane ?? 0)) {
      Object.assign(detail, { scales: true, unmet: true, multiplier: -0.4 })
      status[t] = { base, scaling: base * -0.4 }
    } else {
      const arcane = detail.coefficient * detail.scalingRate
      Object.assign(detail, { scales: true, multiplier: arcane * detail.graph })
      status[t] = { base, scaling: base * arcane * detail.graph }
    }
  }

  const total = Math.floor(DAMAGE_TYPES.reduce((sum, d) => sum + damage[d].base + damage[d].scaling, 0))
  return { affinity, level, twoHanded, stats: eff, damage, total, status, unmet, details, statusDetails }
}
