<script setup lang="ts" generic="T extends TableItem">
// 방어구 표·탈리스만 표·버프 표가 함께 쓰는 표 화면: 검색, 종류·본편/DLC 필터, 열 정렬, CSV, 인벤토리 추가
// 마지막 칸은 기본으로 "보유 / +"(인벤토리 추가)이고, action 슬롯으로 바꿀 수 있다 (버프 표는 켜기 버튼).
// 모바일에서는 표 대신 아이템마다 카드 한 장 (열의 card 설정에 따라 요약 줄·글·숫자 칸으로 나눈다).
import { computed, ref, watch } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { CONTENT_LABELS } from '@/data/labels'
import { itemName } from '@/data/names'
import { useCharacterStore } from '@/stores/character'
import { columnGroups, defaultDirection, filterItems, itemsToCsv, sortItems } from './itemTable'
import type { ContentFilter, SortDirection, TableColumn, TableItem, TypeFilter } from './itemTable'

const props = defineProps<{
  title: string
  items: readonly T[]
  columns: readonly TableColumn<T>[]
  typeFilter?: TypeFilter<T>
  /** CSV 파일 이름 (확장자 제외) */
  csvName: string
  note?: string
  /** 마지막 칸 제목 (기본 "보유") */
  actionLabel?: string
}>()

defineSlots<{ action?: (props: { item: T }) => unknown }>()

/** 한 번에 그리는 행 수 */
const PAGE_SIZE = 300

const store = useCharacterStore()
const isMobile = useIsMobile()

const query = ref('')
const type = ref<string | null>(null)
const content = ref<ContentFilter>('all')
const sortKey = ref('name')
const sortDirection = ref<SortDirection>('asc')
const visibleCount = ref(PAGE_SIZE)

const filtered = computed(() =>
  filterItems(props.items, { query: query.value, type: type.value, content: content.value }, props.typeFilter),
)
const rows = computed(() => sortItems(filtered.value, props.columns, sortKey.value, sortDirection.value))
const visibleRows = computed(() => rows.value.slice(0, visibleCount.value))
const groups = computed(() => columnGroups(props.columns))
const hasGroups = computed(() => props.columns.some((c) => c.group))

watch([query, type, content, sortKey, sortDirection], () => {
  visibleCount.value = PAGE_SIZE
})

const sortOptions = computed(() => [
  { key: 'name', label: '이름' },
  ...props.columns.map((c) => ({ key: c.key, label: c.group ? `${c.group} · ${c.label}` : c.label })),
])

function sortBy(key: string) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = defaultDirection(props.columns, key)
  }
}

function onSortSelect(key: string) {
  sortKey.value = key
  sortDirection.value = defaultDirection(props.columns, key)
}

function ariaSort(key: string) {
  if (sortKey.value !== key) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function arrow(key: string) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function cellText(column: TableColumn<T>, item: T) {
  return column.display ? column.display(item) : String(column.value(item))
}

/* ---------- 모바일 카드 ---------- */
const metaColumns = computed(() => props.columns.filter((c) => c.card === 'meta'))
const textColumns = computed(() => props.columns.filter((c) => c.card === 'text'))
/** 숫자 칸 묶음: group이 같은 열끼리 (group 없는 열은 제목 없는 묶음) */
const gridGroups = computed(() => {
  const out: { label: string; columns: TableColumn<T>[] }[] = []
  for (const c of props.columns.filter((x) => !x.card)) {
    const label = c.group ?? ''
    const last = out[out.length - 1]
    if (last && last.label === label) last.columns.push(c)
    else out.push({ label, columns: [c] })
  }
  return out
})
/** 요약 줄 한 칸: 숫자는 "무게 2.3", 글자는 값만 */
function metaText(c: TableColumn<T>, item: T) {
  return c.numeric ? `${c.label} ${cellText(c, item)}` : cellText(c, item)
}
const isBlank = (text: string) => text === '' || text === '–'
/** 값이 있는 칸만 ("–" 칸은 카드에서 뺀다) */
const filledColumns = (columns: readonly TableColumn<T>[], item: T) => columns.filter((c) => !isBlank(cellText(c, item)))

/** 인벤토리에 가진 개수 */
const ownedCounts = computed(() => {
  const counts = new Map<string, number>()
  const slots = [...store.weapons, ...Object.values(store.protectors).flat(), ...store.talismans]
  for (const slot of slots) counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + 1)
  return counts
})

function downloadCsv() {
  const blob = new Blob([itemsToCsv(rows.value, props.columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.csvName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function resetFilters() {
  query.value = ''
  type.value = null
  content.value = 'all'
  sortKey.value = 'name'
  sortDirection.value = 'asc'
}
</script>

<template>
  <section class="it" :aria-label="`${title} 표`">
    <header class="it__header">
      <h2 class="it__title">{{ title }}</h2>
      <span class="it__count" data-testid="row-count">{{ rows.length }} / {{ items.length }}</span>
    </header>

    <div class="it__filters">
      <input
        v-model="query"
        class="it__input it__search"
        type="search"
        placeholder="이름 검색 (한국어·영어)"
        aria-label="이름 검색"
        data-testid="search"
      />
      <select v-if="typeFilter" v-model="type" class="it__input" :aria-label="typeFilter.label" data-testid="type-filter">
        <option :value="null">{{ typeFilter.allLabel }}</option>
        <option v-for="o in typeFilter.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="it__segment" role="group" aria-label="구분">
        <button
          v-for="opt in [
            ['all', '전체'],
            ['base', '본편'],
            ['dlc', 'DLC'],
          ] as const"
          :key="opt[0]"
          type="button"
          :class="{ 'is-active': content === opt[0] }"
          :aria-pressed="content === opt[0]"
          @click="content = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
      <button type="button" class="btn" @click="resetFilters">초기화</button>
      <button type="button" class="btn it__csv" :disabled="rows.length === 0" @click="downloadCsv">CSV 내보내기</button>
    </div>

    <div class="it__filters">
      <span class="it__label">정렬</span>
      <select
        class="it__input"
        aria-label="정렬 기준"
        data-testid="sort-select"
        :value="sortKey"
        @change="onSortSelect(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="o in sortOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
      </select>
      <button
        type="button"
        class="btn"
        data-testid="sort-direction"
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
      >
        {{ sortDirection === 'asc' ? '↑ 오름차순' : '↓ 내림차순' }}
      </button>
      <span v-if="!isMobile" class="it__hint">열 제목을 눌러도 정렬됩니다</span>
    </div>

    <ul v-if="isMobile" class="ic" data-testid="item-cards">
      <li v-for="item in visibleRows" :key="item.id" class="ic__card" data-testid="item-card">
        <div class="ic__head">
          <div class="ic__title">
            <span class="ic__name">{{ itemName(item) }}</span>
            <span v-if="item.content" class="it__tag">{{ CONTENT_LABELS[item.content] }}</span>
          </div>
          <div class="ic__action">
            <slot name="action" :item="item">
              <span v-if="ownedCounts.get(item.id)" class="it__owned">보유 {{ ownedCounts.get(item.id) }}</span>
              <button
                type="button"
                class="it__add"
                :aria-label="`${itemName(item)} 인벤토리에 추가`"
                title="인벤토리에 추가"
                data-testid="add-item"
                @click="store.addItem(item.id)"
              >
                +
              </button>
            </slot>
          </div>
        </div>
        <div v-if="metaColumns.length" class="ic__meta">
          <template v-for="c in metaColumns" :key="c.key">
            <span v-if="!isBlank(cellText(c, item))" :data-testid="`card-${c.key}`">{{ metaText(c, item) }}</span>
          </template>
        </div>
        <template v-for="g in gridGroups" :key="g.label">
          <div v-if="g.label && filledColumns(g.columns, item).length" class="ic__sub">{{ g.label }}</div>
          <dl v-if="filledColumns(g.columns, item).length" class="ic__grid">
            <div v-for="c in filledColumns(g.columns, item)" :key="c.key" :class="{ faint: c.faint?.(item) }" :data-testid="`card-${c.key}`">
              <dt>{{ c.label }}</dt>
              <dd>{{ cellText(c, item) }}</dd>
            </div>
          </dl>
        </template>
        <template v-for="c in textColumns" :key="c.key">
          <p
            v-if="!isBlank(cellText(c, item))"
            class="ic__text"
            :class="{ faint: c.faint?.(item) }"
            :data-testid="`card-${c.key}`"
          >
            <span class="ic__text-label">{{ c.label }}</span>
            {{ cellText(c, item) }}
          </p>
        </template>
      </li>
      <li v-if="rows.length === 0" class="it__empty">조건에 맞는 항목이 없습니다</li>
    </ul>

    <div v-else class="it__scroll">
      <table class="it__table">
        <thead>
          <tr v-if="hasGroups" class="it__group-row">
            <th class="it__sticky"></th>
            <th v-for="(g, i) in groups" :key="i" :colspan="g.span" :class="{ it__group: g.label }">{{ g.label }}</th>
            <th></th>
          </tr>
          <tr>
            <th class="it__sticky it__name-col" :aria-sort="ariaSort('name')">
              <button type="button" class="it__sort" @click="sortBy('name')">
                이름<span class="it__arrow">{{ arrow('name') }}</span>
              </button>
            </th>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="{ num: c.numeric }"
              :title="c.title"
              :aria-sort="ariaSort(c.key)"
            >
              <button type="button" class="it__sort" :data-testid="`sort-${c.key}`" @click="sortBy(c.key)">
                {{ c.label }}<span class="it__arrow">{{ arrow(c.key) }}</span>
              </button>
            </th>
            <th class="ctr">{{ actionLabel ?? '보유' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleRows" :key="item.id" data-testid="item-row">
            <th scope="row" class="it__sticky it__name-col">
              {{ itemName(item) }}
              <span v-if="item.content" class="it__tag">{{ CONTENT_LABELS[item.content] }}</span>
            </th>
            <td
              v-for="c in columns"
              :key="c.key"
              :class="{ num: c.numeric, faint: c.faint?.(item), 'it__wide': c.wide }"
              :data-testid="`cell-${c.key}`"
            >
              {{ cellText(c, item) }}
            </td>
            <td class="ctr nowrap">
              <slot name="action" :item="item">
              <span v-if="ownedCounts.get(item.id)" class="it__owned">{{ ownedCounts.get(item.id) }}</span>
              <button
                type="button"
                class="it__add"
                :aria-label="`${itemName(item)} 인벤토리에 추가`"
                title="인벤토리에 추가"
                data-testid="add-item"
                @click="store.addItem(item.id)"
              >
                +
              </button>
              </slot>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columns.length + 2" class="it__empty">조건에 맞는 항목이 없습니다</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="rows.length > visibleRows.length" class="it__more">
      <span>{{ rows.length }}행 중 {{ visibleRows.length }}행 표시</span>
      <button type="button" class="btn" data-testid="show-more" @click="visibleCount += PAGE_SIZE">
        {{ Math.min(PAGE_SIZE, rows.length - visibleRows.length) }}행 더 보기
      </button>
      <button type="button" class="btn" @click="visibleCount = rows.length">모두 보기</button>
    </div>

    <p v-if="note" class="it__note">{{ note }}</p>
  </section>
</template>

<style scoped>
.it {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.it__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.it__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.it__count {
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.it__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.it__label {
  margin-right: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.it__hint {
  font-size: 12px;
  color: var(--text-faint);
}
.it__input {
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.it__input:focus {
  outline: none;
  border-color: var(--border-strong);
}
.it__search {
  width: 200px;
}
.it__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.it__segment button {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.it__segment button + button {
  border-left: 1px solid var(--border);
}
.it__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.it__csv {
  margin-left: auto;
}
.it__csv:disabled {
  opacity: 0.4;
  cursor: default;
}
.it__scroll {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.it__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.it__table th,
.it__table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.it__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--muted-surface);
  font-weight: 500;
  color: var(--text-muted);
}
.it__table thead tr.it__group-row + tr th {
  top: 27px;
}
.it__group-row th {
  font-size: 11px;
  border-bottom: none;
}
.it__group {
  text-align: center !important;
  border-left: 1px solid var(--border);
}
.it__sort {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.it__sort:hover {
  color: var(--text);
}
.it__arrow {
  font-size: 10px;
  opacity: 0.35;
}
.it__table thead th[aria-sort='ascending'],
.it__table thead th[aria-sort='descending'] {
  color: var(--text);
}
.it__table thead th[aria-sort='ascending'] .it__arrow,
.it__table thead th[aria-sort='descending'] .it__arrow,
.it__sort:hover .it__arrow {
  opacity: 1;
}
.it__sticky {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--bg);
}
.it__table thead .it__sticky {
  z-index: 3;
  background: var(--muted-surface);
}
.it__name-col {
  min-width: 200px;
  font-weight: 500;
  border-right: 1px solid var(--border);
}
.it__table tbody tr:hover td,
.it__table tbody tr:hover th {
  background: var(--muted-surface);
}
.it__wide {
  white-space: normal !important;
  min-width: 320px;
  color: var(--text-muted);
}
.it__tag {
  margin-left: 4px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
}
.num {
  text-align: right !important;
}
.ctr {
  text-align: center !important;
}
.faint {
  color: var(--text-faint);
}
.nowrap {
  white-space: nowrap;
}
.it__owned {
  display: inline-block;
  min-width: 16px;
  margin-right: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
.it__add {
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
}
.it__add:hover {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--accent);
}
.it__empty {
  padding: 32px !important;
  text-align: center !important;
  color: var(--text-muted);
}
.it__more {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.it__note {
  margin: 0;
  font-size: 12px;
  color: var(--text-faint);
}
/* 모바일 카드 */
.ic {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ic__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.ic__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.ic__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  min-width: 0;
}
.ic__name {
  font-size: 14px;
  font-weight: 600;
}
.ic__action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}
.ic__action .it__add {
  width: 28px;
  height: 28px;
  font-size: 16px;
}
.ic__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.ic__sub {
  font-size: 11px;
  color: var(--text-faint);
}
.ic__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px 10px;
  margin: 0;
}
.ic__grid div {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 0;
  font-size: 12px;
  border-bottom: 1px dashed var(--border);
}
.ic__grid dt {
  color: var(--text-muted);
  white-space: nowrap;
}
.ic__grid dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.ic__grid div.faint dt,
.ic__grid div.faint dd {
  color: var(--text-faint);
}
.ic__text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}
.ic__text.faint {
  color: var(--text-faint);
}
.ic__text-label {
  margin-right: 4px;
  font-size: 11px;
  color: var(--text-faint);
}
@media (max-width: 420px) {
  .ic__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
/* 모바일: 고정된 이름 칸을 좁히고 긴 이름은 줄바꿈 (PC는 그대로) */
@media (max-width: 720px) {
  .it__table .it__name-col {
    min-width: 120px;
    width: 120px;
    max-width: 120px;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  .it__search {
    width: 100%;
  }
  .it__scroll {
    max-height: 65vh;
  }
}
</style>
