// 장비 화면 "계산식" 창에 보여줄 계산 과정을 만든다.
// 숫자는 실제 계산 함수(calculateAttack, defenseBreakdown, combineEffects)가 쓴 값을 그대로 옮긴다.
import { calculateAttack, canTwoHandBonus, MAX_STAT } from '@/data/attackPower'
import type { AttackResult } from '@/data/attackPower'
import { damageNegation, defenseBreakdown, statGraphParams } from '@/data/defense'
import type { EffectSummary, MultiplierLine } from '@/data/effects'
import { percentText } from '@/data/effects'
import { AFFINITY_LABELS, DAMAGE_LABELS, NEGATION_LABELS, STAT_LABELS, STATUS_LABELS } from '@/data/labels'
import { effectText } from '@/data/talismanEffects'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '@/stores/stats'
import type { Attributes } from '@/stores/stats'
import { DAMAGE_TYPES, NEGATION_TYPES, STATUS_TYPES } from '@/types'
import type { AffinityName, CharacterStats, Item, ProtectorItem, WeaponItem } from '@/types'

export interface FormulaLine {
  /** 줄 앞 이름 (물리, 근력 …) */
  label?: string
  /** 계산식 */
  expr: string
  /** 결과 (굵게) */
  result?: string
  /** 설명 줄 (흐리게) */
  note?: boolean
  /** 들여쓰기 단계 */
  indent?: number
}

export interface FormulaGroup {
  title: string
  subtitle?: string
  lines: FormulaLine[]
}

export interface FormulaSection {
  id: string
  title: string
  /** 공식 설명 */
  rule: string
  groups: FormulaGroup[]
  /** 보여줄 것이 없을 때 */
  empty?: string
}

export interface EquippedWeapon {
  label: string
  item: WeaponItem
  affinity: AffinityName
  level: number
}

export interface FormulaInput {
  attributes: Attributes
  bonusAttributes: Attributes
  finalAttributes: Attributes
  defenseAttributes: Attributes
  combatStats: CharacterStats
  twoHanded: boolean
  /** 장착한 아이템 전부 (무게) */
  equippedItems: readonly Item[]
  /** 장착한 방어구 (경감률·강인도) */
  protectors: readonly ProtectorItem[]
  weapons: readonly EquippedWeapon[]
  summary: EffectSummary
  /** 중첩 불가로 빠진 버프: 이름 → 덮어쓴 버프 이름 */
  overridden: readonly { name: string; by: string; group: string }[]
  pvp: boolean
}

/** 숫자를 소수점 digits자리까지, 뒤의 0은 뺀다 */
export function num(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return String(n)
  const s = Number(n.toFixed(digits)).toString()
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}

function signed(n: number, digits = 4): string {
  return n >= 0 ? `+${num(n, digits)}` : num(n, digits)
}

function partsExpr(line: MultiplierLine): string {
  return line.parts.map((p) => `${num(p.value)} (${p.source})`).join(' × ')
}

const lower = (s: string) => s.toLowerCase()

function statsSection(input: FormulaInput): FormulaSection {
  const bonusSources = input.summary.others.filter(
    (o) => o.model === 'additive' && (ATTRIBUTE_KEYS as readonly string[]).includes(lower(o.attribute)),
  )
  const lines: FormulaLine[] = ATTRIBUTE_KEYS.map((k) => {
    const base = input.attributes[k]
    const bonus = input.bonusAttributes[k]
    const final = input.finalAttributes[k]
    const defense = input.defenseAttributes[k]
    if (!bonus) return { label: ATTRIBUTE_LABELS[k], expr: `${base}`, result: `${final}` }
    const capped = final !== defense ? ` (최대 ${MAX_STAT}, 방어력에는 ${defense})` : ''
    return { label: ATTRIBUTE_LABELS[k], expr: `${base} ${signed(bonus, 2)}${capped}`, result: `${final}` }
  })
  for (const o of bonusSources) {
    lines.push({
      note: true,
      expr: `${ATTRIBUTE_LABELS[lower(o.attribute) as keyof Attributes]}: ${o.parts.map((p) => `${signed(p.value, 2)} ${p.source}`).join(', ')}`,
    })
  }
  return {
    id: 'stats',
    title: '최종 능력치',
    rule: '최종 능력치 = 입력한 능력치 + 장착 탈리스만·켠 버프의 능력치 (공격력에는 최대 99, 방어력에는 상한 없이)',
    groups: [{ title: '능력치', lines }],
  }
}

function defenseSection(input: FormulaInput): FormulaSection {
  const a = input.defenseAttributes
  const b = defenseBreakdown(a)
  const sumExpr = ATTRIBUTE_KEYS.map((k) => a[k]).join(' + ')
  const lines: FormulaLine[] = [
    { label: '능력치 합', expr: sumExpr, result: `${b.total}` },
    { label: '기본 방어력', expr: `⌊곡선 #${b.graphId}(${b.total}) = ${num(b.baseRaw)}⌋`, result: `${b.base}` },
  ]
  for (const t of NEGATION_TYPES) {
    const bonus = b.bonus[t]
    lines.push(
      bonus
        ? {
            label: NEGATION_LABELS[t],
            expr: `${b.base} + ⌊곡선 #${bonus.graphId}(${ATTRIBUTE_LABELS[bonus.stat]} ${bonus.value}) = ${num(bonus.raw)}⌋ = ${b.base} + ${bonus.bonus}`,
            result: `${b.defense[t]}`,
          }
        : { label: NEGATION_LABELS[t], expr: `${b.base} (능력치 보너스 없음)`, result: `${b.defense[t]}` },
    )
  }
  return {
    id: 'defense',
    title: '방어력',
    rule: '방어력 = ⌊기본 곡선(8개 능력치 합)⌋ + ⌊속성 곡선(능력치)⌋ — 물리 계열은 근력, 마력은 지력, 화염은 생명력, 신성은 신비, 벼락은 기본만',
    groups: [{ title: '방어력', lines }],
  }
}

function negationSection(input: FormulaInput): FormulaSection {
  const lines: FormulaLine[] = []
  const negation = damageNegation(
    input.protectors,
    Object.fromEntries(NEGATION_TYPES.map((t) => [t, input.summary.damageTaken[t].multiplier])),
  )
  for (const t of NEGATION_TYPES) {
    const factors = input.protectors.map((p) => `(1 − ${num(p.absorptions[t] ?? 0, 3)}/100)`)
    const taken = input.summary.damageTaken[t]
    const all = [...factors, ...taken.parts.map((p) => `${num(p.value)}`)]
    lines.push({
      label: NEGATION_LABELS[t],
      expr: all.length ? `100 × (1 − ${all.join(' × ')})` : '방어구·경감 효과 없음',
      result: `${negation[t].toFixed(3)}%`,
    })
  }
  const groups: FormulaGroup[] = [{ title: '경감률', lines }]
  const order: FormulaLine[] = input.protectors.map((p, i) => ({ label: `${i + 1}`, expr: p.name, note: true }))
  const buffLines: FormulaLine[] = []
  for (const t of NEGATION_TYPES) {
    const taken = input.summary.damageTaken[t]
    if (!taken.parts.length) continue
    buffLines.push({
      label: NEGATION_LABELS[t],
      expr: taken.parts.map((p) => `(2 − ${num(2 - p.value)}) = ${num(p.value)} ${p.source}`).join(' × '),
      result: `×${num(taken.multiplier)}`,
    })
  }
  if (order.length) groups.push({ title: '곱하는 방어구 순서', lines: order })
  if (buffLines.length) groups.push({ title: '탈리스만·버프 받는 피해 배율', subtitle: '경감 효과 v → 받는 피해 × (2 − v)', lines: buffLines })
  return {
    id: 'negation',
    title: '경감률',
    rule: '경감률 = 100 × (1 − Π(1 − 방어구 경감률/100) × 받는 피해 배율) — 방어구끼리는 더하지 않고 곱한다',
    groups,
  }
}

function weightSection(input: FormulaInput): FormulaSection {
  const items = input.equippedItems.filter((i) => i.weight)
  const weight = input.equippedItems.reduce((sum, i) => sum + i.weight, 0)
  const poise = input.protectors.reduce((sum, p) => sum + p.poise, 0)
  const groups: FormulaGroup[] = [
    {
      title: '무게',
      lines: [
        ...items.map((i) => ({ label: i.name, expr: num(i.weight, 2), indent: 1 })),
        { label: '합', expr: items.map((i) => num(i.weight, 2)).join(' + ') || '0', result: weight.toFixed(1) },
      ],
    },
    {
      title: '강인도',
      lines: [
        ...input.protectors.map((p) => ({ label: p.name, expr: num(p.poise, 2), indent: 1 })),
        {
          label: '합',
          expr: `⌊${input.protectors.map((p) => num(p.poise, 2)).join(' + ') || '0'}⌋`,
          result: `${Math.floor(poise)}`,
        },
      ],
    },
  ]
  return { id: 'weight', title: '무게·강인도', rule: '장착한 아이템 무게를 더하고, 강인도는 방어구 강인도를 더한 뒤 소수점을 버린다', groups }
}

function attackGroup(w: EquippedWeapon, attack: AttackResult, input: FormulaInput): FormulaGroup {
  const lines: FormulaLine[] = []
  if (input.twoHanded) {
    lines.push(
      canTwoHandBonus(w.item)
        ? {
            note: true,
            expr: `양손: 근력 ⌊${input.combatStats.strength} × 1.5⌋ = ${attack.stats.strength} (최대 150)`,
          }
        : { note: true, expr: '양손이지만 이 무기는 근력 1.5배를 받지 않음' },
    )
  }
  let sum = 0
  let buffedSum = 0
  const buffed = DAMAGE_TYPES.some((d) => input.summary.attack[d].multiplier !== 1)
  for (const d of DAMAGE_TYPES) {
    const part = attack.damage[d]
    const detail = attack.details[d]
    if (!part.base) continue
    const value = part.base + part.scaling
    sum += value
    buffedSum += value * input.summary.attack[d].multiplier
    lines.push({
      label: DAMAGE_LABELS[d],
      expr: `기본 ${num(detail.raw)} × 강화 배율 ${num(detail.rate)}`,
      result: num(part.base),
    })
    for (const t of detail.terms) {
      const ratioText = t.ratio !== 1 ? ` × 비율 ${num(t.ratio)} + (${num(t.ratio)} − 1)` : ''
      lines.push({
        label: `${STAT_LABELS[t.stat]} ${t.value}`,
        expr: `계수 ${num(t.coefficient)} × 강화 보정 ${num(t.scalingRate)} × 곡선 #${t.graphId ?? '-'}(${t.value}) ${num(t.graph)}${ratioText}`,
        result: num(t.term),
        indent: 1,
      })
    }
    const missingText = detail.missing.map((s) => `${STAT_LABELS[s]} ${attack.stats[s]}/${w.item.requirements[s]}`).join(', ')
    const multiplierExpr =
      detail.rule === 'unmet'
        ? `요구 능력치 모자람 (${missingText}) → −0.4`
        : detail.rule === 'negative'
          ? `음수인 보정이 있어 그 값만 → ${num(detail.multiplier)}`
          : detail.terms.map((t) => num(t.term)).join(' + ') || '보정 없음'
    lines.push({ label: '보정 배율', expr: multiplierExpr, result: num(detail.multiplier), indent: 1 })
    lines.push({
      label: '보정값',
      expr: `${num(part.base)} × ${num(detail.multiplier)}`,
      result: num(part.scaling),
      indent: 1,
    })
    lines.push({
      label: `${DAMAGE_LABELS[d]} 합`,
      expr: `⌊${num(part.base)} ${part.scaling < 0 ? '−' : '+'} ${num(Math.abs(part.scaling))} = ${num(value)}⌋`,
      result: `${Math.floor(value)}`,
      indent: 1,
    })
  }
  if (sum) {
    lines.push({
      label: '공격력',
      expr: `⌊${DAMAGE_TYPES.filter((d) => attack.damage[d].base).map((d) => num(attack.damage[d].base + attack.damage[d].scaling)).join(' + ')}⌋`,
      result: `${attack.total}`,
    })
  }
  if (sum && buffed) {
    const terms = DAMAGE_TYPES.filter((d) => attack.damage[d].base).map(
      (d) => `${num(attack.damage[d].base + attack.damage[d].scaling)} × ${num(input.summary.attack[d].multiplier)}`,
    )
    lines.push({ label: '버프 후', expr: `⌊${terms.join(' + ')}⌋`, result: `${Math.floor(buffedSum)}` })
  }
  if (!sum) lines.push({ expr: '공격력이 없는 무기', note: true })
  return {
    title: `${w.label} ${w.item.name}`,
    subtitle: `${AFFINITY_LABELS[w.affinity]} +${w.level} · ${input.twoHanded ? '양손' : '한손'}`,
    lines,
  }
}

function statusGroup(w: EquippedWeapon, attack: AttackResult): FormulaGroup | null {
  const lines: FormulaLine[] = []
  for (const t of STATUS_TYPES) {
    const part = attack.status[t]
    if (!part.base) continue
    const d = attack.statusDetails[t]
    const total = Math.max(0, Math.floor(part.base + part.scaling))
    if (!d.scales) {
      lines.push({ label: STATUS_LABELS[t], expr: `${num(part.base)} (보정 없음)`, result: `${total}` })
      continue
    }
    const multiplierExpr = d.unmet
      ? `신비 ${attack.stats.arcane}/${w.item.requirements.arcane} 모자람 → −0.4`
      : `신비 ${attack.stats.arcane}: 계수 ${num(d.coefficient)} × 강화 보정 ${num(d.scalingRate)} × 곡선 #${d.graphId}(${attack.stats.arcane}) ${num(d.graph)} = ${num(d.multiplier)}`
    lines.push({ label: STATUS_LABELS[t], expr: `기본 ${num(part.base)}`, result: num(part.base) })
    lines.push({ label: '보정 배율', expr: multiplierExpr, result: num(d.multiplier), indent: 1 })
    lines.push({
      label: '합',
      expr: `⌊${num(part.base)} + ${num(part.base)} × ${num(d.multiplier)}⌋ = ⌊${num(part.base + part.scaling)}⌋`,
      result: `${total}`,
      indent: 1,
    })
  }
  return lines.length ? { title: `${w.label} ${w.item.name}`, lines } : null
}

function effectsSection(input: FormulaInput): FormulaSection {
  const s = input.summary
  const groups: FormulaGroup[] = []
  const attack = DAMAGE_TYPES.filter((d) => s.attack[d].parts.length).map((d) => ({
    label: DAMAGE_LABELS[d],
    expr: partsExpr(s.attack[d]),
    result: `×${num(s.attack[d].multiplier)} (${percentText(s.attack[d].multiplier)})`,
  }))
  if (attack.length) groups.push({ title: '공격력 배율 (곱연산)', lines: attack })
  const taken = NEGATION_TYPES.filter((t) => s.damageTaken[t].parts.length).map((t) => ({
    label: NEGATION_LABELS[t],
    expr: partsExpr(s.damageTaken[t]),
    result: `×${num(s.damageTaken[t].multiplier)} (${percentText(s.damageTaken[t].multiplier)})`,
  }))
  if (taken.length) groups.push({ title: '받는 피해 배율 (곱연산, 경감 v → 2 − v)', lines: taken })
  if (s.others.length) {
    groups.push({
      title: '그 밖의 효과',
      lines: s.others.map((o) => ({
        label: o.label,
        expr:
          o.model === 'multiplicative'
            ? o.parts.map((p) => `${num(p.value)} (${p.source})`).join(' × ')
            : o.parts.map((p) => `${signed(p.value)} (${p.source})`).join(' '),
        result: o.model === 'multiplicative' ? `×${num(o.total)}` : o.model === 'additive' ? signed(o.total) : num(o.total),
      })),
    })
  }
  if (s.conditional.length) {
    groups.push({
      title: '조건부 효과 (합계에서 뺌)',
      lines: s.conditional.map((c) => ({ label: c.source, expr: effectText(c.effect), note: true })),
    })
  }
  if (input.overridden.length) {
    groups.push({
      title: '중첩 불가 (계산에서 뺌)',
      lines: input.overridden.map((o) => ({ label: o.name, expr: `${o.by}가 덮어씀 (${o.group})`, note: true })),
    })
  }
  return {
    id: 'effects',
    title: '탈리스만·버프 효과',
    rule: `배율 효과는 모두 곱하고, 더하기 효과는 모두 더한다. ${input.pvp ? 'PvP 수치' : 'PvE 수치'}를 쓴다.`,
    groups,
    empty: '장착한 탈리스만과 켠 버프가 없습니다',
  }
}

export function buildFormulas(input: FormulaInput): FormulaSection[] {
  const attacks = input.weapons.map((w) => ({
    w,
    attack: calculateAttack(w.item, w.affinity, w.level, input.combatStats, input.twoHanded),
  }))
  return [
    statsSection(input),
    effectsSection(input),
    defenseSection(input),
    negationSection(input),
    {
      id: 'attack',
      title: '무기 공격력',
      rule: '속성마다 기본 = 데이터 × 강화 배율, 보정값 = 기본 × 보정 배율. 보정 배율 = Σ(계수 × 강화 보정 × 곡선(능력치)). 요구 능력치가 모자라면 −0.4',
      groups: attacks.flatMap(({ w, attack }) => (attack ? [attackGroup(w, attack, input)] : [])),
      empty: '장착한 무기가 없습니다',
    },
    {
      id: 'status',
      title: '상태이상 축적치',
      rule: '출혈·독·수면·발광은 기본 × (1 + 신비 계수 × 강화 보정 × 곡선(신비)). 동상·부패 등은 보정 없음',
      groups: attacks.flatMap(({ w, attack }) => {
        const g = attack ? statusGroup(w, attack) : null
        return g ? [g] : []
      }),
      empty: '상태이상이 있는 무기를 장착하지 않았습니다',
    },
    weightSection(input),
  ]
}

/** 능력치 곡선 계산 과정 (statGraphValue와 같은 식을 단계별로). 계산식 페이지의 예시에 쓴다 */
export function statGraphSteps(id: number, x: number) {
  const g = statGraphParams(id)!
  let i = g.stage.length - 2
  while (i > 0 && x < g.stage[i]!) i--
  if (x >= g.stage[g.stage.length - 1]!) {
    return { start: g.stage[4]!, end: g.stage[4]!, from: g.grow[4]!, to: g.grow[4]!, adj: 0, t: 0, curved: 0, value: g.grow[4]! }
  }
  if (x < g.stage[0]!) {
    return { start: g.stage[0]!, end: g.stage[1]!, from: g.grow[0]!, to: g.grow[0]!, adj: 0, t: 0, curved: 0, value: g.grow[0]! }
  }
  const start = g.stage[i]!
  const end = g.stage[i + 1]!
  const from = g.grow[i]!
  const to = g.grow[i + 1]!
  const adj = g.adj[i]!
  const t = (x - start) / (end - start)
  const curved = adj < 0 ? 1 - (1 - t) ** -adj : t ** adj
  return { start, end, from, to, adj, t, curved, value: from + (to - from) * curved }
}
