// 공격력 → 실제 피해. 상대의 방어력과 피해 경감률로 계산한다 (엘든 링 방어 공식).
//
//   공격 = 공격력 × 모션 값 / 100
//   비율 r = 공격 / 방어력
//   방어 배율 f(r) =
//     r ≥ 8          0.9
//     2.5 ≤ r < 8    0.9 − 0.2 × ((8 − r) / 5.5)²
//     1 ≤ r < 2.5    0.7 − 0.3 × ((2.5 − r) / 1.5)²
//     0.125 ≤ r < 1  0.1 + 0.3 × ((r − 0.125) / 0.875)²
//     r < 0.125      0.1
//   피해 = 공격 × f(r) × (1 − 경감률 / 100)
//   속성마다 따로 계산해서 더한다. 물리는 공격 종류(기본·타격·참격·관통)의 경감률을 쓴다.
import { DAMAGE_TYPES } from '@/types'
import type { DamageType, NegationType } from '@/types'

/** 장비 화면 실제 데미지 입력값 저장 키 */
export const DAMAGE_CALC_STORAGE_KEY = 'er-planner/damage/v1'

/** 무기 데이터의 공격 종류 → 물리 피해에 쓰는 경감률 */
export const PHYSICAL_ATTACK_TYPES = {
  Standard: 'physical',
  Strike: 'strike',
  Slash: 'slash',
  Pierce: 'pierce',
} as const satisfies Record<string, NegationType>

export type PhysicalAttackType = keyof typeof PHYSICAL_ATTACK_TYPES

export const PHYSICAL_ATTACK_LABELS: Record<PhysicalAttackType, string> = {
  Standard: '기본',
  Strike: '타격',
  Slash: '참격',
  Pierce: '관통',
}

export interface DefenseStep {
  /** 비율 구간 설명 ("2.5 ≤ r < 8") */
  range: string
  /** 숫자를 넣은 식 */
  expr: string
}

/** 방어 배율 f(r)과 계산 과정 */
export function defenseMultiplier(attack: number, defense: number): { ratio: number; multiplier: number; step: DefenseStep } {
  if (defense <= 0) return { ratio: Infinity, multiplier: 0.9, step: { range: '방어력 0', expr: '0.9' } }
  const r = attack / defense
  const f = (v: number) => Number(v.toFixed(4)).toString()
  if (r >= 8) return { ratio: r, multiplier: 0.9, step: { range: 'r ≥ 8', expr: '0.9' } }
  if (r >= 2.5) {
    return {
      ratio: r,
      multiplier: 0.9 - 0.2 * ((8 - r) / 5.5) ** 2,
      step: { range: '2.5 ≤ r < 8', expr: `0.9 − 0.2 × ((8 − ${f(r)}) / 5.5)²` },
    }
  }
  if (r >= 1) {
    return {
      ratio: r,
      multiplier: 0.7 - 0.3 * ((2.5 - r) / 1.5) ** 2,
      step: { range: '1 ≤ r < 2.5', expr: `0.7 − 0.3 × ((2.5 − ${f(r)}) / 1.5)²` },
    }
  }
  if (r >= 0.125) {
    return {
      ratio: r,
      multiplier: 0.1 + 0.3 * ((r - 0.125) / 0.875) ** 2,
      step: { range: '0.125 ≤ r < 1', expr: `0.1 + 0.3 × ((${f(r)} − 0.125) / 0.875)²` },
    }
  }
  return { ratio: r, multiplier: 0.1, step: { range: 'r < 0.125', expr: '0.1' } }
}

export interface DamagePart {
  type: DamageType
  /** 모션 값·버프를 곱한 공격 */
  attack: number
  defense: number
  /** 쓴 경감률 (%) */
  negation: number
  negationType: NegationType
  ratio: number
  multiplier: number
  step: DefenseStep
  damage: number
}

export interface DamageInput {
  /** 속성 공격력 (버프·모션 값 곱하기 전) */
  attack: Record<DamageType, number>
  /** 속성마다 곱할 배율 (버프) */
  attackMultiplier?: Partial<Record<DamageType, number>>
  /** 모션 값 (%) */
  motionValue: number
  defense: Record<DamageType, number>
  negation: Record<NegationType, number>
  physicalType: PhysicalAttackType
}

export interface DamageResult {
  parts: DamagePart[]
  /** 피해 합 (소수점 버림) */
  total: number
}

export function calculateDamage(input: DamageInput): DamageResult {
  const parts: DamagePart[] = []
  for (const d of DAMAGE_TYPES) {
    const ar = input.attack[d]
    if (!ar) continue
    const attack = (ar * (input.attackMultiplier?.[d] ?? 1) * input.motionValue) / 100
    const defense = input.defense[d]
    const negationType: NegationType = d === 'physical' ? PHYSICAL_ATTACK_TYPES[input.physicalType] : d
    const negation = input.negation[negationType]
    const { ratio, multiplier, step } = defenseMultiplier(attack, defense)
    parts.push({ type: d, attack, defense, negation, negationType, ratio, multiplier, step, damage: attack * multiplier * (1 - negation / 100) })
  }
  return { parts, total: Math.floor(parts.reduce((sum, p) => sum + p.damage, 0)) }
}
