<script setup lang="ts">
// 모바일 무기 목록: 표 대신 무기마다 카드 한 장. 위쪽에 요약, 누르면 자세한 수치가 펼쳐진다.
// 행(정렬·필터·강화·내 스탯 적용 결과)은 무기 표와 같은 것을 받는다.
import { ref } from 'vue'
import { AFFINITY_LABELS, CONTENT_LABELS, DAMAGE_LABELS, STAT_LABELS, STAT_SHORT_LABELS, scalingGrade, scalingValue } from '@/data/labels'
import { itemName, weaponTypeName } from '@/data/names'
import { DAMAGE_TYPES, STAT_KEYS } from '@/types'
import type { WeaponItem } from '@/types'
import { rowAttackTotal, statusText } from './weaponTable'
import type { TableRow } from './weaponTable'

defineProps<{
  rows: readonly (TableRow & { continued: boolean })[]
  /** 변질 이름을 카드에 보여줄지 (여러 변질을 함께 볼 때) */
  showAffinity: boolean
  ownedCounts: ReadonlyMap<string, number>
}>()

const emit = defineEmits<{ add: [weapon: WeaponItem] }>()

const open = ref(new Set<string>())
const keyOf = (row: TableRow) => `${row.w.id}:${row.affinity}`

function toggle(row: TableRow) {
  const key = keyOf(row)
  const next = new Set(open.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  open.value = next
}

/** 보정이 있는 능력치만: "근 D 54" */
function scalings(row: TableRow) {
  return STAT_KEYS.filter((s) => row.st.scaling[s]).map((s) => ({
    stat: s,
    label: STAT_SHORT_LABELS[s],
    grade: scalingGrade(row.st.scaling[s]),
    value: scalingValue(row.st.scaling[s]),
  }))
}

/** 요구 능력치가 있는 것만, 모자라면 표시 */
function requirements(row: TableRow) {
  return STAT_KEYS.filter((s) => row.w.requirements[s]).map((s) => ({
    stat: s,
    label: STAT_SHORT_LABELS[s],
    value: row.w.requirements[s]!,
    unmet: row.attack?.unmet.includes(s) ?? false,
  }))
}

</script>

<template>
  <ul class="wc" data-testid="weapon-cards">
    <li
      v-for="row in rows"
      :key="keyOf(row)"
      class="wc__card"
      :class="{ 'is-open': open.has(keyOf(row)), 'is-continued': row.continued }"
      data-testid="weapon-card"
    >
      <button type="button" class="wc__head" :aria-expanded="open.has(keyOf(row))" @click="toggle(row)">
        <span class="wc__title">
          <span class="wc__name">{{ itemName(row.w) }}</span>
          <span class="wc__level">+{{ row.level }}</span>
          <span v-if="row.w.content !== 0" class="wc__tag">{{ CONTENT_LABELS[row.w.content] }}</span>
        </span>
        <span class="wc__attack" data-testid="card-attack">
          <span class="wc__attack-label">공격력</span>
          {{ rowAttackTotal(row) }}
        </span>
        <span class="wc__meta">
          <span v-if="showAffinity" class="wc__affinity" data-testid="card-affinity">{{ AFFINITY_LABELS[row.affinity] }}</span>
          <span>{{ weaponTypeName(row.w.weaponType) }}</span>
          <span>무게 {{ row.w.weight.toFixed(1) }}</span>
          <span v-if="statusText(row.st)">{{ statusText(row.st) }}</span>
        </span>
        <span class="wc__line">
          <span class="wc__line-label">보정</span>
          <template v-if="scalings(row).length">
            <span v-for="s in scalings(row)" :key="s.stat" class="wc__chip" :title="`${STAT_LABELS[s.stat]} 보정 ${s.value}`">
              {{ s.label }} <b>{{ s.grade }}</b><small>{{ s.value }}</small>
            </span>
          </template>
          <span v-else class="wc__faint">없음</span>
        </span>
        <span class="wc__line">
          <span class="wc__line-label">요구</span>
          <template v-if="requirements(row).length">
            <span
              v-for="r in requirements(row)"
              :key="r.stat"
              class="wc__chip"
              :class="{ 'is-unmet': r.unmet }"
              :title="r.unmet ? `${STAT_LABELS[r.stat]} 부족` : undefined"
            >
              {{ r.label }} {{ r.value }}
            </span>
          </template>
          <span v-else class="wc__faint">없음</span>
        </span>
      </button>

      <div v-if="open.has(keyOf(row))" class="wc__detail" data-testid="card-detail">
        <dl class="wc__grid">
          <div v-for="d in DAMAGE_TYPES" :key="`dmg-${d}`" :class="{ faint: !row.st.damage[d] }">
            <dt>{{ DAMAGE_LABELS[d] }}</dt>
            <dd>{{ row.st.damage[d] ?? '–' }}</dd>
          </div>
        </dl>
        <div class="wc__sub">가드 경감률(%) · 강도</div>
        <dl class="wc__grid">
          <div v-for="d in DAMAGE_TYPES" :key="`gnd-${d}`" :class="{ faint: !row.st.guard[d] }">
            <dt>{{ DAMAGE_LABELS[d] }}</dt>
            <dd>{{ row.st.guard[d] ?? 0 }}</dd>
          </div>
          <div>
            <dt>강도</dt>
            <dd>{{ row.st.guard.boost }}</dd>
          </div>
        </dl>
        <div class="wc__actions">
          <span v-if="ownedCounts.get(row.w.id)" class="wc__owned">보유 {{ ownedCounts.get(row.w.id) }}</span>
          <button type="button" class="btn" data-testid="card-add" @click="emit('add', row.w)">인벤토리에 추가</button>
        </div>
      </div>
    </li>
    <li v-if="rows.length === 0" class="wc__empty">조건에 맞는 무기가 없습니다</li>
  </ul>
</template>

<style scoped>
.wc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.wc__card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.wc__card.is-continued {
  margin-top: -4px;
  border-style: dashed;
}
.wc__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  width: 100%;
  padding: 10px 12px;
  font: inherit;
  text-align: left;
  color: var(--text);
  background: transparent;
  border: none;
  cursor: pointer;
}
.wc__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  min-width: 0;
}
.wc__name {
  font-size: 14px;
  font-weight: 600;
}
.wc__level {
  font-size: 12px;
  color: var(--text-muted);
}
.wc__tag {
  padding: 0 5px;
  font-size: 10px;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
}
.wc__attack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.wc__attack-label {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-faint);
}
.wc__meta,
.wc__line {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.wc__affinity {
  color: var(--text);
  font-weight: 500;
}
.wc__line-label {
  min-width: 26px;
  font-size: 11px;
  color: var(--text-faint);
}
.wc__chip {
  padding: 1px 6px;
  font-size: 12px;
  color: var(--text);
  background: var(--muted-surface);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.wc__chip b {
  margin-left: 2px;
}
.wc__chip small {
  margin-left: 3px;
  font-size: 10px;
  color: var(--text-muted);
}
.wc__chip.is-unmet {
  color: var(--danger);
  font-weight: 600;
}
.wc__faint,
.faint {
  color: var(--text-faint);
}
.wc__detail {
  padding: 0 12px 12px;
  border-top: 1px solid var(--border);
}
.wc__sub {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-faint);
}
.wc__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 8px;
  margin: 8px 0 0;
}
.wc__grid div {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
  border-bottom: 1px dashed var(--border);
}
.wc__grid dt {
  color: var(--text-muted);
}
.wc__grid dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.wc__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.wc__owned {
  font-size: 12px;
  color: var(--text-muted);
}
.wc__empty {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}
</style>
