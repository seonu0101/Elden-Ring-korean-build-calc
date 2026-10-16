// 무기 표의 검색·정렬·CSV 변환. 화면과 무관한 순수 함수만 둔다.
import {
  AFFINITY_LABELS,
  CONTENT_LABELS,
  DAMAGE_LABELS,
  STAT_LABELS,
  STATUS_LABELS,
  scalingGrade,
  scalingValue,
} from '@/data/labels'
import { calculateAttack, partTotal } from '@/data/attackPower'
import type { AttackResult } from '@/data/attackPower'
import { levelFor, upgradeStats } from '@/data/upgrade'
import type { UpgradeSetting } from '@/data/upgrade'
import { AFFINITIES, DAMAGE_TYPES, STAT_KEYS, STATUS_TYPES } from '@/types'
import type { AffinityName, CharacterStats, DamageType, StatKey, WeaponItem, WeaponStats } from '@/types'

export type ContentFilter = 'all' | 'base' | 'dlc'

/**
 * 고른 변질 (하나 또는 여러 개), 또는 'all'이면 무기마다 가능한 변질을 모두 펼쳐서 보여준다.
 * 여러 개를 고르면 무기마다 고른 변질 중 가능한 것만큼 행이 생긴다.
 */
export type AffinityMode = AffinityName | readonly AffinityName[] | 'all'

/** 고른 변질 목록 (게임의 변질 순서). 'all'이면 null */
export function selectedAffinities(mode: AffinityMode): AffinityName[] | null {
  if (mode === 'all') return null
  const list: readonly AffinityName[] = typeof mode === 'string' ? [mode] : mode
  return AFFINITIES.filter((a) => list.includes(a))
}

/**
 * 변질 버튼을 눌렀을 때의 새 선택.
 * 변질 버튼끼리는 여러 개를 고를 수 있고, 다시 누르면 빠진다 (마지막 하나는 빠지지 않는다).
 * "모든 변질"이 켜져 있으면 그것을 끄고 누른 변질 하나만 고른다.
 */
export function toggleAffinity(mode: AffinityMode, affinity: AffinityName): AffinityName[] {
  const list = selectedAffinities(mode)
  if (!list) return [affinity]
  if (list.includes(affinity)) return list.length > 1 ? list.filter((a) => a !== affinity) : list
  return AFFINITIES.filter((a) => a === affinity || list.includes(a))
}

export interface WeaponFilter {
  query: string
  /** null이면 모든 종류 */
  weaponType: string | null
  content: ContentFilter
  /** 고른 변질 중 하나라도 할 수 있는 무기만 남긴다. 일반과 'all'은 모든 무기가 해당된다. */
  affinity?: AffinityMode
}

/**
 * 표의 한 행: 무기 하나 × 변질 하나 (강화를 적용한 수치)
 * 캐릭터 능력치를 주면 st의 공격력·상태이상이 그 능력치로 계산한 값(소수점 버림)이 된다.
 */
export interface TableRow {
  w: WeaponItem
  affinity: AffinityName
  /** 이 행에 적용된 강화 단계 */
  level: number
  st: WeaponStats
  /** 능력치를 적용했을 때의 계산 결과 (기본값·보정값, 모자란 요구 능력치) */
  attack: AttackResult | null
}

/** 무기 표에 적용할 캐릭터 능력치 (스탯 화면 설정) */
export interface CharacterSetting {
  stats: CharacterStats
  twoHanded: boolean
}

/** 행의 공격력 합계. 능력치를 적용했으면 원본 사이트처럼 합한 뒤 소수점을 버린 값 */
export function rowAttackTotal(row: Pick<TableRow, 'st' | 'attack'>): number {
  return row.attack ? row.attack.total : totalAttack(row.st)
}

/** 능력치를 적용한 공격력·상태이상을 표의 수치 형태로 (0인 값은 뺀다) */
function applyAttack(st: WeaponStats, attack: AttackResult): WeaponStats {
  const damage: WeaponStats['damage'] = {}
  for (const d of DAMAGE_TYPES) {
    const v = partTotal(attack.damage[d])
    if (v) damage[d] = v
  }
  const status: WeaponStats['status'] = {}
  for (const t of STATUS_TYPES) {
    const v = partTotal(attack.status[t])
    if (v) status[t] = v
  }
  return { ...st, damage, status }
}

export type SortKey =
  | 'name'
  | 'weaponType'
  | 'weight'
  | 'affinity'
  | 'attack'
  | 'status'
  | 'boost'
  | `req.${StatKey}`
  | `dmg.${DamageType}`
  | `scl.${StatKey}`
  | `gnd.${DamageType}`

export type SortDirection = 'asc' | 'desc'

export interface SortOption {
  key: SortKey
  label: string
  group: string
}

/** 정렬 선택 목록 (화면의 정렬 드롭다운과 열 제목이 같은 키를 쓴다) */
export const SORT_OPTIONS: readonly SortOption[] = [
  { key: 'name', label: '이름', group: '기본' },
  { key: 'weaponType', label: '무기군', group: '기본' },
  { key: 'weight', label: '무게', group: '기본' },
  { key: 'affinity', label: '변질', group: '기본' },
  ...STAT_KEYS.map((s) => ({ key: `req.${s}` as SortKey, label: `요구 ${STAT_LABELS[s]}`, group: '요구 능력치' })),
  ...DAMAGE_TYPES.map((d) => ({ key: `dmg.${d}` as SortKey, label: `${DAMAGE_LABELS[d]} 공격력`, group: '공격력' })),
  { key: 'attack', label: '공격력 합계', group: '공격력' },
  ...STAT_KEYS.map((s) => ({ key: `scl.${s}` as SortKey, label: `${STAT_LABELS[s]} 보정`, group: '보정' })),
  ...DAMAGE_TYPES.map((d) => ({ key: `gnd.${d}` as SortKey, label: `${DAMAGE_LABELS[d]} 경감률`, group: '가드' })),
  { key: 'boost', label: '가드 강도', group: '가드' },
  { key: 'status', label: '상태이상 합계', group: '기타' },
]

/** 글자 열은 가나다순(오름차순), 숫자 열은 큰 값부터(내림차순)가 기본 */
export function defaultDirection(key: SortKey): SortDirection {
  return key === 'name' || key === 'weaponType' || key === 'affinity' ? 'asc' : 'desc'
}

/** 무기의 변질별 수치. 그 변질을 할 수 없는 무기면 null. */
export function weaponStats(w: WeaponItem, affinity: AffinityName = 'Standard'): WeaponStats | null {
  if (affinity === 'Standard') return w
  return w.affinities?.[affinity] ?? null
}

/** 무기가 할 수 있는 변질 목록 (일반 포함, 게임의 변질 순서) */
export function availableAffinities(w: WeaponItem): AffinityName[] {
  return AFFINITIES.filter((a) => weaponStats(w, a) !== null)
}

/** 이 변질을 할 수 있는 무기 수 */
export function countWithAffinity(list: readonly WeaponItem[], affinity: AffinityName): number {
  return list.reduce((n, w) => n + (weaponStats(w, affinity) ? 1 : 0), 0)
}

export function totalAttack(s: WeaponStats): number {
  return DAMAGE_TYPES.reduce((sum, type) => sum + (s.damage[type] ?? 0), 0)
}

export function totalStatus(s: WeaponStats): number {
  return STATUS_TYPES.reduce((sum, type) => sum + (s.status[type] ?? 0), 0)
}

/** "출혈 50" 처럼 상태이상 수치를 글로 바꾼다. */
export function statusText(s: WeaponStats): string {
  return STATUS_TYPES.filter((t) => s.status[t])
    .map((t) => `${STATUS_LABELS[t]} ${s.status[t]}`)
    .join(', ')
}

export function filterWeapons(list: readonly WeaponItem[], filter: WeaponFilter): WeaponItem[] {
  const query = filter.query.trim().toLowerCase()
  const affinities = selectedAffinities(filter.affinity ?? 'Standard')
  return list.filter((w) => {
    if (query && !w.name.toLowerCase().includes(query)) return false
    if (filter.weaponType && w.weaponType !== filter.weaponType) return false
    if (filter.content === 'base' && w.content !== 0) return false
    if (filter.content === 'dlc' && w.content === 0) return false
    if (affinities && !affinities.some((a) => weaponStats(w, a))) return false
    return true
  })
}

/**
 * 무기 목록을 표의 행으로 펼친다. 'all'이면 무기마다 가능한 변질 수만큼,
 * 여러 변질을 고르면 그중 가능한 변질 수만큼 행이 생긴다.
 * upgrade를 주면 무기마다 강화 단계(일반 무기 / 특수 무기)를 적용한다.
 * character를 주면 공격력·상태이상을 그 능력치(한손/양손 포함)로 계산한다.
 */
export function buildRows(
  list: readonly WeaponItem[],
  mode: AffinityMode,
  upgrade: UpgradeSetting = { regular: 0, somber: 0 },
  character: CharacterSetting | null = null,
): TableRow[] {
  const selected = selectedAffinities(mode)
  return list.flatMap((w) => {
    const affinities = selected ?? availableAffinities(w)
    return affinities.flatMap((affinity) => {
      const base = weaponStats(w, affinity)
      if (!base) return []
      const level = levelFor(base, upgrade)
      const upgraded = upgradeStats(base, level)
      const attack = character ? calculateAttack(w, affinity, level, character.stats, character.twoHanded) : null
      return [{ w, affinity, level, st: attack ? applyAttack(upgraded, attack) : upgraded, attack }]
    })
  })
}

export function sortValue(row: TableRow, key: SortKey): number | string {
  const { w, st } = row
  switch (key) {
    case 'name':
      return w.name
    case 'weaponType':
      return w.weaponType
    case 'weight':
      return w.weight
    case 'affinity':
      return AFFINITIES.indexOf(row.affinity)
    case 'attack':
      return rowAttackTotal(row)
    case 'status':
      return totalStatus(st)
    case 'boost':
      return st.guard.boost
  }
  const [group, field] = key.split('.') as ['req' | 'dmg' | 'scl' | 'gnd', string]
  switch (group) {
    case 'req':
      return w.requirements[field as StatKey] ?? 0
    case 'dmg':
      return st.damage[field as DamageType] ?? 0
    case 'scl':
      return st.scaling[field as StatKey] ?? 0
    case 'gnd':
      return st.guard[field as DamageType] ?? 0
  }
}

function compare(a: number | string, b: number | string): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
}

/** 정렬한 새 배열을 돌려준다. 값이 같으면 이름순, 그다음 변질 순서. */
export function sortRows(rows: readonly TableRow[], key: SortKey, direction: SortDirection): TableRow[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort(
    (a, b) =>
      compare(sortValue(a, key), sortValue(b, key)) * sign ||
      a.w.name.localeCompare(b.w.name) ||
      AFFINITIES.indexOf(a.affinity) - AFFINITIES.indexOf(b.affinity),
  )
}

export function weaponTypes(list: readonly WeaponItem[]): string[] {
  return [...new Set(list.map((w) => w.weaponType))].sort((a, b) => a.localeCompare(b))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 엑셀에서 바로 열 수 있는 CSV (UTF-8 BOM 포함). 표에 보이는 행 그대로 내보낸다. */
export function rowsToCsv(rows: readonly TableRow[]): string {
  const header = [
    '이름',
    '변질',
    '강화',
    '무기군',
    '구분',
    '무게',
    ...STAT_KEYS.map((s) => `요구 ${STAT_LABELS[s]}`),
    ...DAMAGE_TYPES.map((d) => `공격력 ${DAMAGE_LABELS[d]}`),
    '공격력 합계',
    ...STAT_KEYS.map((s) => `보정 ${STAT_LABELS[s]}`),
    ...STAT_KEYS.map((s) => `보정 수치 ${STAT_LABELS[s]}`),
    '상태이상',
    ...DAMAGE_TYPES.map((d) => `가드 경감률 ${DAMAGE_LABELS[d]}`),
    '가드 강도',
    '공격 속성',
    '변질 가능',
  ]
  const lines = rows.map(({ w, affinity, level, st, attack }) => [
    w.name,
    AFFINITY_LABELS[affinity],
    `+${level}`,
    w.weaponType,
    CONTENT_LABELS[w.content] ?? '',
    w.weight,
    ...STAT_KEYS.map((k) => w.requirements[k] ?? 0),
    ...DAMAGE_TYPES.map((d) => st.damage[d] ?? 0),
    rowAttackTotal({ st, attack }),
    ...STAT_KEYS.map((k) => scalingGrade(st.scaling[k])),
    ...STAT_KEYS.map((k) => scalingValue(st.scaling[k])),
    statusText(st),
    ...DAMAGE_TYPES.map((d) => st.guard[d] ?? 0),
    st.guard.boost,
    w.attackTypes.join('/'),
    w.canChangeAffinity ? '가능' : '불가',
  ])
  return '﻿' + [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
