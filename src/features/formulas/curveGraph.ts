// 무기 보정 곡선 그래프용 순수 계산 (그리기 좌표, 장착 무기의 곡선 위 위치).
// 곡선 값은 앱이 실제로 쓰는 correctionGraphValue를 그대로 불러서 쓴다 (그래프와 계산이 어긋나지 않게).
import { correctionGraphValue } from '@/data/attackPower'
import type { AttackResult } from '@/data/attackPower'
import { DAMAGE_TYPES } from '@/types'
import type { DamageType, StatKey } from '@/types'

/** 곡선이 정의된 능력치 범위 (양손 근력 최대치까지) */
export const MAX_X = 150

export const CHART = { width: 640, height: 280, left: 46, right: 16, top: 14, bottom: 36 } as const

/** 곡선마다 다른 색 (고정 순서, 색에만 의존하지 않도록 선 모양도 함께 바꾼다) */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#e34948', '#008300'] as const
export const SERIES_DASHES = ['', '7 4', '2 3', '9 3 2 3', '', '7 4', '2 3', '9 3 2 3'] as const

/** 곡선 하나를 능력치 0~150에서 한 칸씩 읽은 값 */
export function sampleCurve(id: number): number[] {
  return Array.from({ length: MAX_X + 1 }, (_, x) => correctionGraphValue(id, x))
}

/** y축 위쪽 끝: 가장 큰 값을 0.1 단위로 올림 (최소 1) */
export function niceMax(values: readonly number[]): number {
  const m = Math.max(1, ...values)
  return Math.ceil(m * 10 - 1e-9) / 10
}

/** y축 눈금: 0부터 둥근 간격(0.1·0.2·0.25·0.5·1)으로, 눈금이 5칸 이하가 되는 가장 촘촘한 간격 */
export function yTicks(max: number): number[] {
  const step = [0.1, 0.2, 0.25, 0.5, 1].find((s) => max / s <= 5) ?? 1
  const count = Math.floor(max / step + 1e-9)
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100) / 100)
}

export const X_TICKS: readonly number[] = [0, 30, 60, 90, 120, 150]

const plotWidth = CHART.width - CHART.left - CHART.right
const plotHeight = CHART.height - CHART.top - CHART.bottom

export function scaleX(x: number): number {
  return CHART.left + (Math.min(Math.max(x, 0), MAX_X) / MAX_X) * plotWidth
}

export function scaleY(value: number, max: number): number {
  return CHART.top + (1 - Math.min(Math.max(value, 0), max) / max) * plotHeight
}

/** SVG path 문자열 (M … L …) */
export function linePath(values: readonly number[], max: number): string {
  return values.map((v, x) => `${x === 0 ? 'M' : 'L'}${scaleX(x).toFixed(1)} ${scaleY(v, max).toFixed(1)}`).join(' ')
}

/** 그래프 위의 클릭·움직임 위치(0~CHART.width)를 능력치 정수(0~150)로 */
export function statFromViewX(viewX: number): number {
  const stat = Math.round(((viewX - CHART.left) / plotWidth) * MAX_X)
  return Math.min(Math.max(stat, 0), MAX_X)
}

/** 장착 무기가 곡선 위 어디에 있는지: 속성·능력치마다 한 점 */
export interface CurveMarker {
  damage: DamageType
  stat: StatKey
  /** 계산에 쓴 능력치 (양손 근력 반영) */
  value: number
  graphId: number
  /** 곡선 값 (보정 곡선 표와 같은 값) */
  graph: number
  coefficient: number
}

export function curveMarkers(attack: AttackResult): CurveMarker[] {
  const out: CurveMarker[] = []
  for (const damage of DAMAGE_TYPES) {
    for (const t of attack.details[damage].terms) {
      if (t.graphId === undefined) continue
      out.push({ damage, stat: t.stat, value: t.value, graphId: t.graphId, graph: t.graph, coefficient: t.coefficient })
    }
  }
  return out
}

/** 같은 곡선·능력치·위치인 점은 하나로 합친다 (예: 물리와 마력이 같은 근력 곡선을 쓸 때) */
export interface MarkerGroup {
  graphId: number
  stat: StatKey
  value: number
  graph: number
  damages: DamageType[]
}

export function groupMarkers(markers: readonly CurveMarker[]): MarkerGroup[] {
  const map = new Map<string, MarkerGroup>()
  for (const m of markers) {
    const key = `${m.graphId}:${m.stat}:${m.value}`
    const found = map.get(key)
    if (found) found.damages.push(m.damage)
    else map.set(key, { graphId: m.graphId, stat: m.stat, value: m.value, graph: m.graph, damages: [m.damage] })
  }
  return [...map.values()]
}

/** 그려야 할 곡선 번호 (중복 없이, 처음 나온 순서) */
export function uniqueGraphIds(groups: readonly MarkerGroup[]): number[] {
  return [...new Set(groups.map((g) => g.graphId))]
}
