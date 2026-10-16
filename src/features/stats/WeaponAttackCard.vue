<script setup lang="ts">
import { computed } from 'vue'
import { partTotal } from '@/data/attackPower'
import type { AttackResult, ValuePart } from '@/data/attackPower'
import { AFFINITY_LABELS, DAMAGE_LABELS, STAT_LABELS, STATUS_LABELS, scalingGrade, scalingValue } from '@/data/labels'
import { availableAffinities, weaponStats } from '@/features/weaponTable/weaponTable'
import { DAMAGE_TYPES, STAT_KEYS, STATUS_TYPES } from '@/types'
import type { AffinityName, WeaponItem } from '@/types'
import { upgradeStats } from '@/data/upgrade'
import { itemName } from '@/data/names'

const props = defineProps<{
  /** 칸 이름 (예: 오른손 무기 1). 직접 고른 무기면 비워 둔다. */
  slotTitle?: string
  weapon: WeaponItem
  affinity: AffinityName
  result: AttackResult
}>()

const emit = defineEmits<{ 'update:affinity': [affinity: AffinityName] }>()

const affinities = computed(() => availableAffinities(props.weapon))

/** 화면에 보이는 기본값과 보정값 (둘을 더하면 합계와 맞도록 보정값은 합계 − 기본값) */
function shown(p: ValuePart) {
  const base = Math.floor(p.base)
  return { base, bonus: partTotal(p) - base, total: partTotal(p) }
}

const damageRows = computed(() =>
  DAMAGE_TYPES.filter((d) => props.result.damage[d].base).map((d) => ({ d, ...shown(props.result.damage[d]) })),
)
const statusRows = computed(() =>
  STATUS_TYPES.filter((t) => props.result.status[t].base).map((t) => ({ t, ...shown(props.result.status[t]) })),
)

/** 이 강화 단계의 보정 (등급과 수치) */
const scaling = computed(() => {
  const raw = weaponStats(props.weapon, props.affinity)
  if (!raw) return []
  const st = upgradeStats(raw, props.result.level).scaling
  return STAT_KEYS.filter((s) => st[s]).map((s) => ({ s, grade: scalingGrade(st[s]), value: scalingValue(st[s]) }))
})

const unmetText = computed(() =>
  props.result.unmet
    .map((s) => `${STAT_LABELS[s]} ${props.weapon.requirements[s]} 필요 (현재 ${props.result.stats[s]})`)
    .join(', '),
)

function signed(n: number) {
  return n < 0 ? `− ${-n}` : `+ ${n}`
}
</script>

<template>
  <article class="card" data-testid="attack-card">
    <header class="card__header">
      <div class="card__title">
        <span v-if="slotTitle" class="card__slot">{{ slotTitle }}</span>
        <span class="card__name">{{ itemName(weapon) }}</span>
        <span class="card__level">+{{ result.level }}</span>
      </div>
      <select
        class="card__affinity"
        :value="affinity"
        :disabled="affinities.length <= 1"
        aria-label="변질"
        data-testid="card-affinity"
        @change="emit('update:affinity', ($event.target as HTMLSelectElement).value as AffinityName)"
      >
        <option v-for="a in affinities" :key="a" :value="a">{{ AFFINITY_LABELS[a] }}</option>
      </select>
    </header>

    <div class="card__total">
      <span class="card__total-label">공격력</span>
      <span class="card__total-value" data-testid="attack-total">{{ result.total }}</span>
      <span v-if="result.twoHanded" class="card__note">
        양손 · 근력 {{ result.stats.strength }}
      </span>
    </div>

    <p v-if="result.unmet.length" class="card__warning" data-testid="unmet">
      요구 능력치 부족: {{ unmetText }} — 해당 속성 공격력 40% 감소
    </p>

    <table class="card__table">
      <tbody>
        <tr v-for="row in damageRows" :key="row.d">
          <th scope="row">{{ DAMAGE_LABELS[row.d] }}</th>
          <td class="num">{{ row.base }}</td>
          <td class="num" :class="row.bonus < 0 ? 'neg' : 'muted'">{{ signed(row.bonus) }}</td>
          <td class="num strong">{{ row.total }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="statusRows.length" class="card__section">
      <h4 class="card__subtitle">상태이상 축적치</h4>
      <table class="card__table">
        <tbody>
          <tr v-for="row in statusRows" :key="row.t" data-testid="status-row">
            <th scope="row">{{ STATUS_LABELS[row.t] }}</th>
            <td class="num">{{ row.base }}</td>
            <td class="num" :class="row.bonus < 0 ? 'neg' : 'muted'">{{ signed(row.bonus) }}</td>
            <td class="num strong">{{ row.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card__meta">
      <span v-for="sc in scaling" :key="sc.s">{{ STAT_LABELS[sc.s] }} {{ sc.grade }} {{ sc.value }}</span>
      <span v-if="!scaling.length">보정 없음</span>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.card__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  min-width: 0;
}
.card__slot {
  width: 100%;
  font-size: 11px;
  color: var(--text-faint);
}
.card__name {
  font-weight: 600;
}
.card__level {
  font-size: 12px;
  color: var(--text-muted);
}
.card__affinity {
  height: 26px;
  padding: 0 6px;
  font: inherit;
  font-size: 12px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.card__total {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.card__total-label {
  font-size: 12px;
  color: var(--text-muted);
}
.card__total-value {
  font-size: 26px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.card__note {
  font-size: 11px;
  color: var(--text-faint);
}
.card__warning {
  margin: 0;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 6px;
}
.card__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.card__table th,
.card__table td {
  padding: 3px 0;
  border-bottom: 1px solid var(--border);
}
.card__table tr:last-child th,
.card__table tr:last-child td {
  border-bottom: none;
}
.card__table th {
  text-align: left;
  font-weight: 400;
  color: var(--text-muted);
  width: 56px;
}
.card__subtitle {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.num {
  text-align: right;
  padding-left: 10px !important;
}
.muted {
  color: var(--text-muted);
}
.neg {
  color: var(--danger);
}
.strong {
  font-weight: 600;
  width: 56px;
}
</style>
