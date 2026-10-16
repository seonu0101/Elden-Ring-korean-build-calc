<script setup lang="ts">
import { ITEMS_BY_ID, TALISMANS } from '@/data/items'
import { TALISMAN_CATEGORY_LABELS, talismanEffectText } from '@/data/talismanEffects'
import type { TalismanItem } from '@/types'
import ItemDataTable from './ItemDataTable.vue'
import type { TableColumn, TypeFilter } from './itemTable'

const categoryText = (t: TalismanItem) => t.categories.map((c) => TALISMAN_CATEGORY_LABELS[c] ?? c).join(', ')
const conflictText = (t: TalismanItem) => t.conflicts.map((id) => ITEMS_BY_ID.get(id)?.name ?? id).join(', ')

const columns: TableColumn<TalismanItem>[] = [
  { key: 'category', label: '분류', value: categoryText },
  { key: 'weight', label: '무게', numeric: true, value: (t) => t.weight, display: (t) => t.weight.toFixed(1) },
  { key: 'effect', label: '효과', wide: true, value: talismanEffectText },
  {
    key: 'conflicts',
    label: '함께 낄 수 없음',
    title: '이 탈리스만과 같이 장착할 수 없는 탈리스만',
    wide: true,
    value: conflictText,
    faint: () => true,
  },
]

const categories = [...new Set(TALISMANS.flatMap((t) => t.categories))]
const typeFilter: TypeFilter<TalismanItem> = {
  label: '분류',
  allLabel: '모든 분류',
  options: categories.map((c) => ({ value: c, label: TALISMAN_CATEGORY_LABELS[c] ?? c })),
  values: (t) => t.categories,
}
</script>

<template>
  <ItemDataTable
    title="탈리스만"
    :items="TALISMANS"
    :columns="columns"
    :type-filter="typeFilter"
    csv-name="talismans"
    note="효과는 원본 데이터의 수치로 만든 설명입니다(배율 1.1 → +10%). 효과·조건 이름은 직접 옮긴 것이라 한국어판 표기와 다를 수 있습니다."
  />
</template>
