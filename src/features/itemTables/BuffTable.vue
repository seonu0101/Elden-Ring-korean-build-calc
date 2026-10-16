<script setup lang="ts">
// 버프 표: 주문(기도·마술)과 소비 아이템 버프의 수치를 모두 보여준다.
// 공격력·받는 피해 칸은 장비 화면과 같은 합산 방식(combineEffects, PvE 수치)으로 계산한다.
import { STACK_GROUPS } from '@/data/buffStacking'
import { combineEffects, percentText } from '@/data/effects'
import type { EffectSummary, MultiplierLine } from '@/data/effects'
import { BUFFS } from '@/data/items'
import { BUFF_CATEGORY_LABELS, DAMAGE_LABELS, NEGATION_LABELS } from '@/data/labels'
import { talismanEffectText } from '@/data/talismanEffects'
import { useBuffsStore } from '@/stores/buffs'
import { DAMAGE_TYPES, NEGATION_TYPES } from '@/types'
import type { BuffItem } from '@/types'
import ItemDataTable from './ItemDataTable.vue'
import type { TableColumn, TypeFilter } from './itemTable'

const buffs = useBuffsStore()

/** 버프 하나만 켰을 때의 합산 결과 (조건 붙은 효과는 빠진다) */
const SUMMARY = new Map<string, EffectSummary>(
  BUFFS.map((b) => [b.id, combineEffects([{ id: b.id, name: b.name, type: b.kind, effects: b.effects }])]),
)

/** 속성마다 배율이 다르면 "물리 +20%, 화염 +10%", 모두 같으면 "모든 속성 +15%" */
function linesText<K extends string>(lines: Record<K, MultiplierLine>, keys: readonly K[], labels: Record<K, string>) {
  const changed = keys.filter((k) => lines[k].multiplier !== 1)
  if (!changed.length) return ''
  const first = lines[changed[0]!].multiplier
  if (changed.length === keys.length && changed.every((k) => lines[k].multiplier === first)) return `모든 속성 ${percentText(first)}`
  return changed.map((k) => `${labels[k]} ${percentText(lines[k].multiplier)}`).join(', ')
}

const attackText = (b: BuffItem) => linesText(SUMMARY.get(b.id)!.attack, DAMAGE_TYPES, DAMAGE_LABELS)
const takenText = (b: BuffItem) => linesText(SUMMARY.get(b.id)!.damageTaken, NEGATION_TYPES, NEGATION_LABELS)
/** 정렬용: 가장 크게 오르는 공격력 (%), 가장 크게 줄어드는 받는 피해 (%) */
const attackValue = (b: BuffItem) =>
  Math.round((Math.max(...DAMAGE_TYPES.map((d) => SUMMARY.get(b.id)!.attack[d].multiplier)) - 1) * 10000) / 100
const takenValue = (b: BuffItem) =>
  Math.round((1 - Math.min(...NEGATION_TYPES.map((t) => SUMMARY.get(b.id)!.damageTaken[t].multiplier))) * 10000) / 100
const duration = (b: BuffItem) => Math.max(0, ...b.effects.map((e) => e.duration ?? 0))
const stackText = (b: BuffItem) =>
  STACK_GROUPS.filter((g) => g.matches(b))
    .map((g) => g.label)
    .join(', ')

const columns: TableColumn<BuffItem>[] = [
  { key: 'category', label: '분류', value: (b) => BUFF_CATEGORY_LABELS[b.category] ?? b.category },
  {
    key: 'attack',
    label: '공격력',
    title: '이 버프만 켰을 때의 공격력 배율 (PvE, 조건 없는 효과만)',
    numeric: true,
    value: attackValue,
    display: (b) => attackText(b) || '–',
    faint: (b) => !attackText(b),
  },
  {
    key: 'taken',
    label: '받는 피해',
    title: '이 버프만 켰을 때 받는 피해 배율 (PvE). 경감 효과 v → 받는 피해 × (2 − v)',
    numeric: true,
    value: takenValue,
    display: (b) => takenText(b) || '–',
    faint: (b) => !takenText(b),
  },
  {
    key: 'duration',
    label: '지속(초)',
    numeric: true,
    value: duration,
    display: (b) => (duration(b) ? String(duration(b)) : '–'),
    faint: (b) => !duration(b),
  },
  { key: 'effect', label: '효과 (PvP 수치·조건 포함)', wide: true, value: (b) => talismanEffectText(b) || '–' },
  {
    key: 'stack',
    label: '중첩 불가 묶음',
    title: '같은 묶음의 버프는 겹치지 않고 나중에 켠 것만 적용됩니다. 같은 이름의 버프(주문판·전회판)끼리도 겹치지 않습니다.',
    value: stackText,
    display: (b) => stackText(b) || '–',
    faint: () => true,
  },
]

const categories = [...new Set(BUFFS.map((b) => b.category))].sort(
  (a, b) => Object.keys(BUFF_CATEGORY_LABELS).indexOf(a) - Object.keys(BUFF_CATEGORY_LABELS).indexOf(b),
)
const typeFilter: TypeFilter<BuffItem> = {
  label: '분류',
  allLabel: '모든 분류',
  options: categories.map((c) => ({ value: c, label: BUFF_CATEGORY_LABELS[c] ?? c })),
  values: (b) => [b.category],
}

function toggle(b: BuffItem) {
  if (buffs.selected.includes(b.id)) buffs.remove(b.id)
  else buffs.add(b.id)
}
</script>

<template>
  <ItemDataTable
    title="버프"
    :items="BUFFS"
    :columns="columns"
    :type-filter="typeFilter"
    csv-name="buffs"
    action-label="장비 화면"
    note="공격력·받는 피해는 이 버프 하나만 켰을 때의 배율입니다 (PvE, 조건이 붙은 효과는 빼고 계산). 효과 칸에는 PvP 수치와 조건, 지속 시간이 모두 들어 있습니다. 켜기를 누르면 장비 화면의 버프·탈리스만 효과에 들어갑니다."
  >
    <template #action="{ item }">
      <button
        type="button"
        class="bt__toggle"
        :class="{ 'is-on': buffs.selected.includes(item.id) }"
        :aria-pressed="buffs.selected.includes(item.id)"
        :title="buffs.selected.includes(item.id) ? '장비 화면에서 끄기' : '장비 화면에서 켜기'"
        data-testid="toggle-buff"
        @click="toggle(item)"
      >
        {{ buffs.selected.includes(item.id) ? '켬' : '켜기' }}
      </button>
    </template>
  </ItemDataTable>
</template>

<style scoped>
.bt__toggle {
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}
.bt__toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.bt__toggle.is-on {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--accent);
}
</style>
