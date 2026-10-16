<script setup lang="ts">
import { computed, ref } from 'vue'
import { calculateAttack, partTotal } from '@/data/attackPower'
import { characterDefense, damageNegation } from '@/data/defense'
import { NEGATION_LABELS, STATUS_LABELS } from '@/data/labels'
import { itemName } from '@/data/names'
import { levelFor } from '@/data/upgrade'
import FormulaPanel from '@/features/formulas/FormulaPanel.vue'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { NEGATION_TYPES, STATUS_TYPES } from '@/types'
import type { SlotTarget, StatusType } from '@/types'

// 같은 저장소를 읽는 별도 패널. 시뮬레이터에서 장착을 바꾸면 여기도 바로 바뀐다.
const store = useCharacterStore()
const statsStore = useStatsStore()

/** 방어력은 스탯 화면의 능력치로, 경감률은 장착한 방어구로 계산한다. */
const defense = computed(() => characterDefense(statsStore.defenseAttributes))
// 경감률에는 장착 탈리스만·켠 버프의 경감 효과도 넣는다 (예: 황금 맹세 받는 피해 ×0.9)
const buffs = useBuffsStore()
const negation = computed(() =>
  damageNegation(
    store.equippedProtectors,
    Object.fromEntries(NEGATION_TYPES.map((t) => [t, buffs.summary.damageTaken[t].multiplier])),
  ),
)

/**
 * 장착한 무기(오른손·왼손)마다 상태이상 축적치.
 * 스탯 화면 설정(능력치·강화·한손/양손, 그 칸에 고른 변질)으로 계산한다. 출혈·독·수면·발광은 신비 보정 포함.
 */
const statusRows = computed(() =>
  EQUIPMENT_GRID.flat().flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slot = store.equippedIn(cell.target)
    const item = slot ? store.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const chosen = statsStore.affinityFor(cell.target.equipIndex)
    const affinity = weaponStats(item, chosen) ? chosen : 'Standard'
    const level = levelFor(weaponStats(item, affinity)!, statsStore.upgrade)
    const attack = calculateAttack(item, affinity, level, statsStore.combatStats, statsStore.twoHanded)
    const status = Object.fromEntries(
      STATUS_TYPES.map((t) => [t, attack ? Math.max(0, partTotal(attack.status[t])) : 0]),
    ) as Record<StatusType, number>
    return [{ label: cell.label, name: itemName(item), status }]
  }),
)

function equippedName(target: SlotTarget) {
  const slot = store.equippedIn(target)
  const item = slot ? store.itemOf(slot) : null
  return slot ? (item ? itemName(item) : '?') : null
}

/**
 * 초기화: 장착한 장비와 인벤토리의 모든 아이템(무기·방어구·탈리스만)을 지운다.
 * 브라우저 확인 창(confirm)은 막혀 있는 환경이 있어서(앱 안 브라우저 등) 화면 안에서 한 번 더 묻는다.
 */
const confirmingReset = ref(false)

/** 계산식 창 */
const showFormulas = ref(false)

function confirmReset() {
  store.clearInventory()
  confirmingReset.value = false
}
</script>

<template>
  <section class="summary" aria-label="장착 요약">
    <header class="summary__header">
      <h2 class="summary__title">요약</h2>
      <div class="summary__actions">
        <button
          type="button"
          class="btn"
          title="경감률·방어력·공격력·상태이상·탈리스만과 버프 효과의 계산 과정 보기"
          data-testid="open-formulas"
          @click="showFormulas = true"
        >
          계산식
        </button>
        <button
          type="button"
          class="btn"
          :disabled="store.inventoryCount === 0 || confirmingReset"
          title="장착한 장비와 인벤토리의 모든 아이템 지우기"
          data-testid="reset-equipment"
          @click="confirmingReset = true"
        >
          초기화
        </button>
      </div>
    </header>

    <FormulaPanel v-if="showFormulas" @close="showFormulas = false" />

    <div v-if="confirmingReset"class="summary__confirm" role="alertdialog" aria-label="초기화 확인" data-testid="reset-confirm">
      <p class="summary__confirm-text">
        장착한 장비와 인벤토리의 모든 아이템({{ store.inventoryCount }}개)을 지울까요?
        <span class="summary__confirm-sub">지운 아이템은 무기·방어구·탈리스만 표의 + 버튼으로 다시 넣을 수 있습니다.</span>
      </p>
      <div class="summary__confirm-actions">
        <button type="button" class="btn summary__danger" data-testid="reset-confirm-yes" @click="confirmReset">
          모두 지우기
        </button>
        <button type="button" class="btn" data-testid="reset-confirm-no" @click="confirmingReset = false">취소</button>
      </div>
    </div>

    <dl class="summary__totals">
      <div>
        <dt>무게</dt>
        <dd data-testid="total-weight">{{ store.totalWeight.toFixed(1) }}</dd>
      </div>
      <div>
        <dt>강인도</dt>
        <dd data-testid="total-poise">{{ Math.floor(store.totalPoise) }}</dd>
      </div>
    </dl>

    <table class="summary__defense" data-testid="defense-table">
      <caption>방어력 / 경감률</caption>
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col" class="num" title="스탯 화면의 능력치로 계산">방어력</th>
          <th scope="col" class="num" title="장착한 방어구로 계산 (%)">경감률</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in NEGATION_TYPES" :key="t" :data-testid="`defense-${t}`">
          <th scope="row">{{ NEGATION_LABELS[t] }}</th>
          <td class="num">{{ defense[t] }}</td>
          <td class="num">{{ negation[t].toFixed(3) }}</td>
        </tr>
      </tbody>
    </table>
    <p class="summary__note">방어력은 스탯 화면의 능력치, 경감률은 장착한 방어구와 탈리스만·켠 버프의 경감 효과로 계산합니다.</p>

    <div class="summary__status-wrap">
      <table class="summary__defense summary__status" data-testid="status-table">
        <caption>상태이상 축적치</caption>
        <thead>
          <tr>
            <th scope="col"></th>
            <th v-for="t in STATUS_TYPES" :key="t" scope="col" class="num">{{ STATUS_LABELS[t] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in statusRows" :key="row.label" :data-testid="`status-${row.label}`">
            <th scope="row" :title="row.name">
              <span class="summary__status-slot">{{ row.label }}</span>
              <span class="summary__status-name">{{ row.name }}</span>
            </th>
            <td v-for="t in STATUS_TYPES" :key="t" class="num" :class="{ 'is-zero': !row.status[t] }">
              {{ row.status[t] || '–' }}
            </td>
          </tr>
          <tr v-if="statusRows.length === 0">
            <td :colspan="STATUS_TYPES.length + 1" class="summary__status-empty">장착한 무기가 없습니다</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="summary__note">장착한 무기마다 스탯 화면 설정(능력치·강화·한손/양손·변질)으로 계산합니다. 출혈·독·수면·발광은 신비 보정이 들어갑니다.</p>

    <ul class="summary__list">
      <template v-for="cells in EQUIPMENT_GRID" :key="cells[0]?.label">
        <li v-for="cell in cells" :key="cell.label" class="summary__item">
          <span class="summary__slot">{{ cell.title }}</span>
          <span class="summary__name" :class="{ 'is-empty': !equippedName(cell.target) }">
            {{ equippedName(cell.target) ?? '—' }}
          </span>
        </li>
      </template>
    </ul>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.summary__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.summary__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.summary__actions {
  display: flex;
  gap: 6px;
}
.summary__actions .btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.summary__totals {
  display: flex;
  gap: 32px;
  margin: 0;
}
.summary__totals dt {
  font-size: 12px;
  color: var(--text-muted);
}
.summary__totals dd {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.summary__item {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.summary__item:last-child {
  border-bottom: none;
}
.summary__slot {
  color: var(--text-muted);
}
.summary__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.summary__name.is-empty {
  color: var(--text-faint);
}
.summary__defense {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.summary__defense caption {
  text-align: left;
  font-size: 12px;
  color: var(--text-muted);
  padding-bottom: 6px;
}
.summary__defense th,
.summary__defense td {
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-weight: normal;
}
.summary__defense thead th {
  font-size: 12px;
  color: var(--text-muted);
}
.summary__defense tbody th {
  color: var(--text-muted);
}
.summary__defense .num {
  text-align: right;
  width: 30%;
}
.summary__confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--danger);
  border-radius: var(--radius);
}
.summary__confirm-text {
  margin: 0;
  font-size: 13px;
}
.summary__confirm-sub {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.summary__confirm-actions {
  display: flex;
  gap: 6px;
}
.summary__danger {
  color: var(--danger);
  border-color: var(--danger);
}
.summary__danger:hover {
  color: var(--accent-text);
  background: var(--danger);
  border-color: var(--danger);
}
.summary__status-wrap {
  overflow-x: auto;
}
.summary__status .num {
  width: auto;
  padding-left: 6px;
}
.summary__status tbody th {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.summary__status-slot {
  margin-right: 6px;
  font-size: 11px;
  color: var(--text-faint);
}
.summary__status-name {
  color: var(--text);
}
.summary__status td.is-zero {
  color: var(--text-faint);
}
.summary__status-empty {
  text-align: center !important;
  color: var(--text-faint);
}
.summary__note {
  margin: -8px 0 0;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
