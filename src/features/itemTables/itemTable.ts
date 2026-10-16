// 방어구 표·탈리스만 표·버프 표가 함께 쓰는 검색·정렬·CSV. 화면과 무관한 순수 함수만 둔다.
import { compareNames, itemName, nameMatches } from '@/data/names'

/** 표에 넣을 수 있는 항목: 이름과 id, 본편/DLC 구분 */
export interface TableItem {
  id: string
  name: string
  content?: number
}

export type ContentFilter = 'all' | 'base' | 'dlc'
export type SortDirection = 'asc' | 'desc'

/** 표의 열 하나 */
export interface TableColumn<T> {
  key: string
  label: string
  /** 열 제목 툴팁 */
  title?: string
  /** 위쪽 묶음 제목 (같은 group이 이어지면 하나로 묶는다) */
  group?: string
  /** 정렬·CSV에 쓰는 값 */
  value: (item: T) => number | string
  /** 화면에 보이는 글자 (없으면 value) */
  display?: (item: T) => string
  /** 숫자 열 (오른쪽 정렬, 큰 값부터 정렬) */
  numeric?: boolean
  /** 흐리게 보일 칸 (0 등) */
  faint?: (item: T) => boolean
  /** 긴 글자 열 (줄바꿈 허용) */
  wide?: boolean
  /**
   * 모바일 카드에서 보일 자리. meta: 이름 아래 한 줄 ("무게 2.3"), text: 긴 글 한 단락,
   * 없으면 숫자 칸 묶음 (group이 같은 열끼리 함께)
   */
  card?: 'meta' | 'text'
}

/** 종류 필터 (방어구 부위, 탈리스만 분류). 아이템 하나가 여러 값을 가질 수 있다. */
export interface TypeFilter<T> {
  label: string
  allLabel: string
  options: { value: string; label: string }[]
  values: (item: T) => string[]
}

export interface ItemFilter {
  query: string
  type: string | null
  content: ContentFilter
}

export function filterItems<T extends TableItem>(items: readonly T[], filter: ItemFilter, typeFilter?: TypeFilter<T>): T[] {
  const query = filter.query.trim().toLowerCase()
  return items.filter((item) => {
    if (!nameMatches(item, query)) return false
    if (filter.type && typeFilter && !typeFilter.values(item).includes(filter.type)) return false
    const content = item.content ?? 0
    if (filter.content === 'base' && content !== 0) return false
    if (filter.content === 'dlc' && content === 0) return false
    return true
  })
}

function compare(a: number | string, b: number | string): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
}

/** 정렬한 새 배열. 'name'은 화면에 보이는 이름순, 그 밖은 열의 값으로. 값이 같으면 이름순. */
export function sortItems<T extends TableItem>(
  items: readonly T[],
  columns: readonly TableColumn<T>[],
  key: string,
  direction: SortDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  const column = columns.find((c) => c.key === key)
  const valueOf = (item: T) => (column ? column.value(item) : itemName(item))
  return [...items].sort((a, b) => compare(valueOf(a), valueOf(b)) * sign || compareNames(a, b))
}

/** 숫자 열은 큰 값부터, 글자 열은 가나다순이 기본 */
export function defaultDirection<T>(columns: readonly TableColumn<T>[], key: string): SortDirection {
  return columns.find((c) => c.key === key)?.numeric ? 'desc' : 'asc'
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 엑셀에서 바로 열 수 있는 CSV (UTF-8 BOM 포함). 화면에 보이는 글자 그대로 (이름도 지금 언어) */
export function itemsToCsv<T extends TableItem>(items: readonly T[], columns: readonly TableColumn<T>[]): string {
  const header = ['이름', ...columns.map((c) => (c.group ? `${c.group} ${c.label}` : c.label))]
  const rows = items.map((item) => [itemName(item), ...columns.map((c) => (c.display ? c.display(item) : c.value(item)))])
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** 열 묶음 제목 줄: 같은 group이 이어지면 colspan으로 합친다 */
export function columnGroups<T>(columns: readonly TableColumn<T>[]): { label: string; span: number }[] {
  const groups: { label: string; span: number }[] = []
  for (const c of columns) {
    const label = c.group ?? ''
    const last = groups.at(-1)
    if (last && last.label === label && label) last.span++
    else groups.push({ label, span: 1 })
  }
  return groups
}
