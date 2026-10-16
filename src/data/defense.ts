// 캐릭터 방어력과 장착 방어구의 피해 경감률. 원본 사이트(er-build-planner)의 계산식을 그대로 옮겼다.
//
//   방어력: 레벨 기본값(모든 능력치 합) + 속성별 능력치 보너스
//     물리·타격·참격·관통 = 기본 + 근력 보너스, 마력 = 기본 + 지력, 화염 = 기본 + 생명력,
//     신성 = 기본 + 신비, 벼락 = 기본만 (각 곡선 값은 소수점 버림)
//   경감률: 100 × (1 − Π(1 − 방어구 경감률 / 100))  (방어구끼리는 곱해서 합친다)
//   damageTaken을 주면 탈리스만·버프의 경감 효과도 곱한다.
import { NEGATION_TYPES } from '@/types'
import type { NegationType, ProtectorItem } from '@/types'
import statGraphData from './stat-graphs.generated.json'

interface StatGraph {
  name: string
  /** 구간 경계 능력치 5개 */
  stage: number[]
  /** 구간 끝에서의 값 5개 */
  grow: number[]
  /** 구간 안 곡률 5개 (양수면 x^adj, 음수면 1 − (1 − x)^−adj) */
  adj: number[]
}

const STAT_GRAPHS = statGraphData.graphs as Record<string, StatGraph>

/** 방어력 계산에 쓰는 곡선 번호 */
const GRAPH = {
  levelDefense: 102,
  strength: 130,
  intelligence: 132,
  vigor: 133,
  arcane: 135,
} as const

/** 방어력 계산에 쓰는 능력치 (스탯 화면의 8개 능력치) */
export interface DefenseAttributes {
  vigor: number
  mind: number
  endurance: number
  strength: number
  dexterity: number
  intelligence: number
  faith: number
  arcane: number
}

/** 능력치 곡선 값. 원본 사이트의 getCorrectionGraphValueAt과 같다. */
export function statGraphValue(id: number, x: number): number {
  const g = STAT_GRAPHS[id]
  if (!g) return 0
  const [s0, s1, s2, s3, s4] = g.stage as [number, number, number, number, number]
  const [g0, g1, g2, g3, g4] = g.grow as [number, number, number, number, number]
  const [a0, a1, a2, a3] = g.adj as [number, number, number, number, number]
  // [구간 시작, 구간 끝, 끝 값, 시작 값, 곡률] — 높은 구간부터 본다
  const ranges: [number, number, number, number, number][] = [
    [s4, s4 + 1, g4, g4, 0],
    [s3, s4, g4, g3, a3],
    [s2, s3, g3, g2, a2],
    [s1, s2, g2, g1, a1],
    [s0, s1, g1, g0, a0],
  ]
  for (const [start, end, endValue, startValue, adj] of ranges) {
    if (x >= start) {
      const t = (x - start) / (end - start)
      const curved = adj < 0 ? 1 - (1 - t) ** -adj : t ** adj
      return startValue + (endValue - startValue) * curved
    }
  }
  return g0
}

function graphInt(id: number, x: number): number {
  return Math.floor(statGraphValue(id, x))
}

/** 캐릭터 방어력 (능력치만으로 정해진다) */
export function characterDefense(a: DefenseAttributes): Record<NegationType, number> {
  const total = a.vigor + a.mind + a.endurance + a.strength + a.dexterity + a.intelligence + a.faith + a.arcane
  const base = graphInt(GRAPH.levelDefense, total)
  const physical = base + graphInt(GRAPH.strength, a.strength)
  return {
    physical,
    strike: physical,
    slash: physical,
    pierce: physical,
    magic: base + graphInt(GRAPH.intelligence, a.intelligence),
    fire: base + graphInt(GRAPH.vigor, a.vigor),
    lightning: base,
    holy: base + graphInt(GRAPH.arcane, a.arcane),
  }
}

/**
 * 장착 방어구의 피해 경감률(%). 방어구가 없으면 0
 * damageTaken을 주면 탈리스만·버프의 경감 효과(받는 피해 배율)까지 넣는다:
 *   100 × (1 − Π(1 − 방어구 경감률/100) × 받는 피해 배율)   (원본 사이트 getTotalAbsorption과 같다)
 * 버프로 받는 피해가 늘면 음수가 될 수 있다.
 */
export function damageNegation(
  protectors: readonly Pick<ProtectorItem, 'absorptions'>[],
  damageTaken?: Partial<Record<NegationType, number>>,
): Record<NegationType, number> {
  const out = {} as Record<NegationType, number>
  for (const t of NEGATION_TYPES) {
    const kept = protectors.reduce((product, p) => product * (1 - (p.absorptions[t] ?? 0) / 100), 1)
    out[t] = 100 * (1 - kept * (damageTaken?.[t] ?? 1))
  }
  return out
}
