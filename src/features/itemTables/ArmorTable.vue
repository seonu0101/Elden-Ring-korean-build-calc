<script setup lang="ts">
import { PROTECTORS } from '@/data/items'
import { NEGATION_LABELS } from '@/data/labels'
import { NEGATION_TYPES, PROTECTOR_TYPES } from '@/types'
import type { ProtectorItem, ProtectorType, ResistanceType } from '@/types'
import ItemDataTable from './ItemDataTable.vue'
import type { TableColumn, TypeFilter } from './itemTable'

const PART_LABELS: Record<ProtectorType, string> = { Head: '머리', Body: '몸통', Arms: '팔', Legs: '다리' }
const RESISTANCE_LABELS: Record<ResistanceType, string> = {
  immunity: '면역',
  robustness: '강건',
  focus: '이성',
  vitality: '항사',
}
const RESISTANCE_TYPES: ResistanceType[] = ['immunity', 'robustness', 'focus', 'vitality']

const fixed1 = (n: number) => n.toFixed(1)

const columns: TableColumn<ProtectorItem>[] = [
  {
    key: 'part',
    label: '부위',
    value: (p) => PROTECTOR_TYPES.indexOf(p.protectorType),
    display: (p) => PART_LABELS[p.protectorType],
    card: 'meta',
  },
  { key: 'weight', label: '무게', numeric: true, value: (p) => p.weight, display: (p) => fixed1(p.weight), card: 'meta' },
  {
    key: 'poise',
    label: '강인도',
    numeric: true,
    value: (p) => p.poise,
    display: (p) => fixed1(p.poise),
    faint: (p) => !p.poise,
    card: 'meta',
  },
  ...NEGATION_TYPES.map<TableColumn<ProtectorItem>>((t) => ({
    key: `neg.${t}`,
    label: NEGATION_LABELS[t],
    title: `${NEGATION_LABELS[t]} 피해 경감률(%)`,
    group: '피해 경감률(%)',
    numeric: true,
    value: (p) => p.absorptions[t],
    display: (p) => fixed1(p.absorptions[t]),
  })),
  ...RESISTANCE_TYPES.map<TableColumn<ProtectorItem>>((t) => ({
    key: `res.${t}`,
    label: RESISTANCE_LABELS[t],
    group: '상태이상 내성',
    numeric: true,
    value: (p) => p.resistances[t],
    faint: (p) => !p.resistances[t],
  })),
]

const typeFilter: TypeFilter<ProtectorItem> = {
  label: '부위',
  allLabel: '모든 부위',
  options: PROTECTOR_TYPES.map((t) => ({ value: t, label: PART_LABELS[t] })),
  values: (p) => [p.protectorType],
}
</script>

<template>
  <ItemDataTable
    title="방어구"
    :items="PROTECTORS"
    :columns="columns"
    :type-filter="typeFilter"
    csv-name="armor"
    note="경감률은 방어구 한 개의 값입니다. 여러 개를 입으면 곱해서 합칩니다 (장비 화면 요약에서 합친 값을 볼 수 있습니다). 면역은 독·부패, 강건은 출혈·동상, 이성은 수면·발광, 항사는 즉사에 대한 내성입니다."
  />
</template>
