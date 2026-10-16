<script setup lang="ts" generic="T extends ProtectorItem | TalismanItem">
// 방어구 표·탈리스만 표가 함께 쓰는 표 화면: 검색, 종류·본편/DLC 필터, 열 정렬, CSV, 인벤토리 추가
import { computed, ref, watch } from 'vue'
import { CONTENT_LABELS } from '@/data/labels'
import { useCharacterStore } from '@/stores/character'
import type { ProtectorItem, TalismanItem } from '@/types'
import { columnGroups, defaultDirection, filterItems, itemsToCsv, sortItems } from './itemTable'
import type { ContentFilter, SortDirection, TableColumn, TypeFilter } from './itemTable'

const props = defineProps<{
  title: string
  items: readonly T[]
  columns: readonly TableColumn<T>[]
  typeFilter?: TypeFilter<T>
  /** CSV 파일 이름 (확장자 제외) */
  csvName: string
  note?: string
}>()

/** 한 번에 그리는 행 수 */
const PAGE_SIZE = 300

const store = useCharacterStore()

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
        placeholder="이름 검색"
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
      <span class="it__hint">열 제목을 눌러도 정렬됩니다</span>
    </div>

    <div class="it__scroll">
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
            <th class="ctr">보유</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleRows" :key="item.id" data-testid="item-row">
            <th scope="row" class="it__sticky it__name-col">
              {{ item.name }}
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
              <span v-if="ownedCounts.get(item.id)" class="it__owned">{{ ownedCounts.get(item.id) }}</span>
              <button
                type="button"
                class="it__add"
                :aria-label="`${item.name} 인벤토리에 추가`"
                title="인벤토리에 추가"
                data-testid="add-item"
                @click="store.addItem(item.id)"
              >
                +
              </button>
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
</style>
