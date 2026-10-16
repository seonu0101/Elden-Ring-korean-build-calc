// 탈리스만·버프 효과를 합친다. 원본 사이트(er-build-planner)의 합산 방식을 따른다.
//
//   배율 효과(공격력 등): 모두 곱한다. 황금 맹세 ×1.15 · 샤브리리의 외침 ×1.25 → ×1.4375 (+43.75%)
//     "Attack Power"는 모든 속성, "Physical Attack Power" 등은 그 속성에만 붙는다.
//   피해 경감 효과: 받는 피해에 (2 − 값)을 곱한다. 황금 맹세 경감 1.1 → 받는 피해 ×0.9
//     물리·타격·참격은 Absorption + Physical Absorption, 관통은 여기에 Pierce Absorption,
//     마력·화염·벼락·신성은 Absorption + 그 속성 + Elemental Absorption
//   더하기 효과(능력치 +5 등): 모두 더한다.
//   조건이 붙은 효과(점프 공격 시 등)는 항상 켜져 있지 않아서 합계에서 빼고 따로 보여준다.
//   PvP를 고르면 PvP 수치가 있는 효과는 그 값을 쓴다.
//   게임의 "같은 종류 버프는 겹치지 않음" 규칙은 원본 사이트처럼 반영하지 않는다.
import { DAMAGE_TYPES, NEGATION_TYPES } from '@/types'
import type { DamageType, NegationType, TalismanEffect } from '@/types'
import { TALISMAN_ATTRIBUTE_LABELS, isEnemyEffect } from './talismanEffects'

export interface EffectSource {
  id: string
  name: string
  type: 'talisman' | 'spell' | 'item'
  effects: TalismanEffect[]
}

/** 합계에 들어간 효과 하나 */
export interface EffectPart {
  source: string
  /** 이 효과가 합계에 곱해지거나 더해진 값 (공격력 1.15, 받는 피해 0.9, 근력 5) */
  value: number
}

export interface MultiplierLine {
  multiplier: number
  parts: EffectPart[]
}

export interface OtherEffect {
  attribute: string
  label: string
  model: string
  /** 더하기면 합, 배율이면 곱 */
  total: number
  parts: EffectPart[]
}

export interface EffectSummary {
  attack: Record<DamageType, MultiplierLine>
  /** 받는 피해 배율 (1보다 작으면 덜 받는다) */
  damageTaken: Record<NegationType, MultiplierLine>
  others: OtherEffect[]
  /** 조건이 붙어 합계에서 뺀 효과 */
  conditional: { source: string; effect: TalismanEffect }[]
}

const ATTACK_ATTRIBUTE: Record<DamageType, string> = {
  physical: 'Physical Attack Power',
  magic: 'Magic Attack Power',
  fire: 'Fire Attack Power',
  lightning: 'Lightning Attack Power',
  holy: 'Holy Attack Power',
}

/** 경감률 항목마다 적용되는 경감 효과 (원본 사이트 getRelevantAbsorptionTypes와 같다) */
const ABSORPTION_ATTRIBUTES: Record<NegationType, string[]> = {
  physical: ['Absorption', 'Physical Absorption'],
  strike: ['Absorption', 'Physical Absorption'],
  slash: ['Absorption', 'Physical Absorption'],
  pierce: ['Absorption', 'Physical Absorption', 'Pierce Absorption'],
  magic: ['Absorption', 'Magic Absorption', 'Elemental Absorption'],
  fire: ['Absorption', 'Fire Absorption', 'Elemental Absorption'],
  lightning: ['Absorption', 'Lightning Absorption', 'Elemental Absorption'],
  holy: ['Absorption', 'Holy Absorption', 'Elemental Absorption'],
}

const ABSORPTION_SET = new Set(Object.values(ABSORPTION_ATTRIBUTES).flat())
const ATTACK_SET = new Set(['Attack Power', ...Object.values(ATTACK_ATTRIBUTE)])

function line(): MultiplierLine {
  return { multiplier: 1, parts: [] }
}

export function effectValue(e: TalismanEffect, pvp: boolean): number {
  return pvp && e.valuePvp !== undefined ? e.valuePvp : e.value
}

export function combineEffects(sources: readonly EffectSource[], pvp = false): EffectSummary {
  const attack = Object.fromEntries(DAMAGE_TYPES.map((d) => [d, line()])) as Record<DamageType, MultiplierLine>
  const damageTaken = Object.fromEntries(NEGATION_TYPES.map((t) => [t, line()])) as Record<NegationType, MultiplierLine>
  const others = new Map<string, OtherEffect>()
  const conditional: EffectSummary['conditional'] = []

  for (const source of sources) {
    for (const e of source.effects) {
      // 적에게 거는 효과(디버프)는 내 합계에 넣지 않는다
      if (isEnemyEffect(e)) continue
      if (e.conditions?.length) {
        conditional.push({ source: source.name, effect: e })
        continue
      }
      const v = effectValue(e, pvp)
      if (e.model === 'multiplicative' && ATTACK_SET.has(e.attribute)) {
        for (const d of DAMAGE_TYPES) {
          if (e.attribute === 'Attack Power' || e.attribute === ATTACK_ATTRIBUTE[d]) {
            attack[d].multiplier *= v
            attack[d].parts.push({ source: source.name, value: v })
          }
        }
        continue
      }
      if (e.model === 'multiplicative' && ABSORPTION_SET.has(e.attribute)) {
        for (const t of NEGATION_TYPES) {
          if (ABSORPTION_ATTRIBUTES[t].includes(e.attribute)) {
            damageTaken[t].multiplier *= 2 - v
            damageTaken[t].parts.push({ source: source.name, value: 2 - v })
          }
        }
        continue
      }
      const key = `${e.attribute}|${e.model}`
      const other =
        others.get(key) ??
        ({
          attribute: e.attribute,
          label: TALISMAN_ATTRIBUTE_LABELS[e.attribute] ?? e.attribute,
          model: e.model,
          total: e.model === 'multiplicative' ? 1 : 0,
          parts: [],
        } satisfies OtherEffect)
      other.total = e.model === 'multiplicative' ? other.total * v : other.total + v
      other.parts.push({ source: source.name, value: v })
      others.set(key, other)
    }
  }
  return { attack, damageTaken, others: [...others.values()], conditional }
}

/** 배율을 "+43.75%" / "−10%" 로 */
export function percentText(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 10000) / 100
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`
}
