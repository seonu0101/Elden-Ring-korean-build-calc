// 능력치 곡선(CalcCorrectGraph)을 실제 숫자가 들어간 식으로 바꾼다. 계산식 화면에 쓴다.
//
//   구간 [stageᵢ, stageᵢ₊₁)에서 t = (x − stageᵢ) / (stageᵢ₊₁ − stageᵢ)
//   값 = growᵢ + (growᵢ₊₁ − growᵢ) × c,  c = t^adj (adj ≥ 0) 또는 1 − (1 − t)^(−adj) (adj < 0)
//   마지막 stage 이상이면 마지막 grow, 첫 stage 미만이면 첫 grow
//
// 무기 보정 곡선(#0~#16)은 이 값 ÷ 100이 보정 곡선 표와 같다 (오차 1e-9 이하).
import { statGraphParams, statGraphValue } from './defense'

export interface CurveSegment {
  /** 구간 시작 (포함) */
  from: number
  /** 구간 끝 (포함하지 않음) */
  to: number
  start: number
  end: number
  adj: number
}

export interface CurveShape {
  id: number
  name: string
  /** 첫 stage 미만의 값 */
  min: number
  /** 마지막 stage 이상의 값 */
  max: number
  minStat: number
  maxStat: number
  segments: CurveSegment[]
}

export function curveShape(id: number): CurveShape | null {
  const g = statGraphParams(id)
  if (!g) return null
  const segments: CurveSegment[] = []
  for (let i = 0; i < 4; i++) {
    segments.push({ from: g.stage[i]!, to: g.stage[i + 1]!, start: g.grow[i]!, end: g.grow[i + 1]!, adj: g.adj[i]! })
  }
  return { id, name: g.name, min: g.grow[0]!, max: g.grow[4]!, minStat: g.stage[0]!, maxStat: g.stage[4]!, segments }
}

/** 숫자 표시 (소수점 digits자리, 뒤의 0은 뺀다, 음수는 −) */
function n(v: number, digits = 4): string {
  const s = Number(v.toFixed(digits)).toString()
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}

/** 한 구간의 식. x 자리에 들어갈 글(변수 이름이나 숫자)을 받는다 */
function segmentExpr(seg: CurveSegment, x: string): string {
  const delta = seg.end - seg.start
  if (delta === 0) return n(seg.start)
  const t = seg.from === 0 ? `${x} / ${n(seg.to - seg.from)}` : `(${x} − ${n(seg.from)}) / ${n(seg.to - seg.from)}`
  let c: string
  if (seg.adj === 1) c = t
  else if (seg.adj === 0) c = '1'
  else if (seg.adj > 0) c = `(${t})^${n(seg.adj)}`
  else c = `(1 − (1 − ${t})^${n(-seg.adj)})`
  const scaled = seg.adj === 1 ? `${n(delta)} × ${t}` : `${n(delta)} × ${c}`
  return seg.start === 0 ? scaled : `${n(seg.start)} + ${scaled}`
}

function wrap(expr: string, divisor: number): string {
  return divisor === 1 ? expr : `(${expr}) / ${n(divisor)}`
}

/** 곡선 식을 구간별로 ("1 ≤ x < 18: 25 × ((x − 1) / 17)^1.2") */
export function curvePieces(id: number, divisor = 1, variable = 'x'): { range: string; expr: string }[] {
  const shape = curveShape(id)
  if (!shape) return []
  const pieces = shape.segments
    .filter((s) => s.to > s.from)
    .map((s) => ({ range: `${n(s.from)} ≤ ${variable} < ${n(s.to)}`, expr: wrap(segmentExpr(s, variable), divisor) }))
  pieces.push({ range: `${variable} ≥ ${n(shape.maxStat)}`, expr: wrap(n(shape.max), divisor) })
  return pieces
}

/** 능력치 x에서의 곡선 값과, 숫자를 넣은 식 ("(25 + 50 × (1 − (1 − (20 − 18) / 42)^1.2)) / 100") */
export function curveAt(id: number, x: number, divisor = 1): { expr: string; value: number } {
  const shape = curveShape(id)
  if (!shape) return { expr: '0', value: 0 }
  const value = statGraphValue(id, x) / divisor
  if (x >= shape.maxStat) return { expr: wrap(n(shape.max), divisor), value }
  if (x < shape.minStat) return { expr: wrap(n(shape.min), divisor), value }
  const seg = [...shape.segments].reverse().find((s) => x >= s.from)!
  return { expr: wrap(segmentExpr(seg, n(x)), divisor), value }
}
