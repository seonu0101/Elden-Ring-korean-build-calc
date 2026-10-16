<script setup lang="ts">
// 장비 화면: 버프(주문·소비 아이템)를 골라 켜고, 장착 탈리스만과 합친 효과를 보여준다.
import { computed, ref } from 'vue'
import { calculateAttack } from '@/data/attackPower'
import { percentText } from '@/data/effects'
import type { MultiplierLine } from '@/data/effects'
import { conflictsWith } from '@/data/buffStacking'
import { BUFFS, BUFFS_BY_ID } from '@/data/items'
import { compareNames, itemName } from '@/data/names'
import { BUFF_CATEGORY_LABELS, DAMAGE_LABELS, NEGATION_LABELS } from '@/data/labels'
import { effectText } from '@/data/talismanEffects'
import { levelFor } from '@/data/upgrade'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { DAMAGE_TYPES, NEGATION_TYPES } from '@/types'
import type { BuffItem, DamageType, NegationType } from '@/types'

const buffs = useBuffsStore()
const character = useCharacterStore()
const stats = useStatsStore()

/** 버프 고르기 목록: 기도, 마술, 소비 아이템 분류별 */
const CATEGORY_LABELS = BUFF_CATEGORY_LABELS
const groups = computed(() => {
  const order = Object.keys(CATEGORY_LABELS)
  const byCategory = new Map<string, BuffItem[]>()
  for (const b of BUFFS) byCategory.set(b.category, [...(byCategory.get(b.category) ?? []), b])
  return [...byCategory.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([category, list]) => ({
      label: CATEGORY_LABELS[category] ?? category,
      buffs: list.filter((b) => !buffs.selected.includes(b.id)).sort(compareNames),
    }))
})

/** 고르기 목록: 이미 켠 버프와 겹치지 않는 버프면 표시 */
function optionLabel(b: BuffItem) {
  const other = conflictsWith(b, buffs.selectedBuffs)
  return other ? `${itemName(b)} (중첩 불가: ${itemName(other)})` : itemName(b)
}

function buffName(id: string) {
  const b = BUFFS_BY_ID.get(id)
  return b ? itemName(b) : id
}

function overriddenTitle(id: string) {
  const o = buffs.stacking.overridden.get(id)
  return o ? `중첩 불가: ${itemName(o.by)}가 덮어써서 적용되지 않습니다 (${o.group})` : undefined
}

const picked = ref('')
function onPick() {
  if (picked.value) buffs.add(picked.value)
  picked.value = ''
}

const summary = computed(() => buffs.summary)

/** 같은 배율·같은 출처인 줄은 하나로 묶는다 (예: 모든 속성 +43.75%) */
function groupLines<K extends string>(lines: Record<K, MultiplierLine>, keys: readonly K[], labels: Record<K, string>) {
  const groups = new Map<string, { labels: string[]; line: MultiplierLine }>()
  for (const k of keys) {
    const l = lines[k]
    if (l.parts.length === 0) continue
    const key = JSON.stringify(l.parts)
    const g = groups.get(key) ?? { labels: [], line: l }
    g.labels.push(labels[k])
    groups.set(key, g)
  }
  return [...groups.values()].map((g) => ({
    label: g.labels.length === keys.length ? '모든 속성' : g.labels.join('·'),
    line: g.line,
  }))
}

const attackLines = computed(() => groupLines<DamageType>(summary.value.attack, DAMAGE_TYPES, DAMAGE_LABELS))
const takenLines = computed(() =>
  groupLines<NegationType>(summary.value.damageTaken, NEGATION_TYPES, NEGATION_LABELS),
)

function partsText(line: MultiplierLine) {
  return line.parts.map((p) => `${p.source} ${percentText(p.value)}`).join(' × ')
}

function otherTotalText(model: string, total: number) {
  if (model === 'multiplicative') return percentText(total)
  if (model === 'additive') return `${total >= 0 ? '+' : '−'}${Math.round(Math.abs(total) * 100) / 100}`
  return ''
}

/** 장착 무기의 공격력: 버프 전 → 버프 후 (스탯 화면 설정 기준) */
const weaponRows = computed(() =>
  EQUIPMENT_GRID.flat().flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slot = character.equippedIn(cell.target)
    const item = slot ? character.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const chosen = stats.affinityFor(cell.target.equipIndex)
    const affinity = weaponStats(item, chosen) ? chosen : 'Standard'
    const level = levelFor(weaponStats(item, affinity)!, stats.upgrade)
    const attack = calculateAttack(item, affinity, level, stats.combatStats, stats.twoHanded)
    if (!attack) return []
    const buffed = Math.floor(
      DAMAGE_TYPES.reduce(
        (sum, d) => sum + (attack.damage[d].base + attack.damage[d].scaling) * summary.value.attack[d].multiplier,
        0,
      ),
    )
    return [{ label: cell.label, name: itemName(item), before: attack.total, after: buffed }]
  }),
)

const hasAnyEffect = computed(
  () => attackLines.value.length + takenLines.value.length + summary.value.others.length + summary.value.conditional.length > 0,
)
</script>

<template>
  <section class="bp" aria-label="버프·탈리스만 효과">
    <header class="bp__header">
      <h2 class="bp__title">버프·탈리스만 효과</h2>
      <div class="bp__segment" role="group" aria-label="PvE/PvP">
        <button type="button" :class="{ 'is-active': !buffs.pvp }" data-testid="pve" @click="buffs.pvp = false">PvE</button>
        <button type="button" :class="{ 'is-active': buffs.pvp }" data-testid="pvp" @click="buffs.pvp = true">PvP</button>
      </div>
    </header>

    <div class="bp__picker">
      <select v-model="picked" class="bp__select" aria-label="버프 추가" data-testid="buff-select" @change="onPick">
        <option value="">버프 추가 (주문·소비 아이템)…</option>
        <optgroup v-for="g in groups" :key="g.label" :label="g.label">
          <option v-for="b in g.buffs" :key="b.id" :value="b.id">{{ optionLabel(b) }}</option>
        </optgroup>
      </select>
      <button v-if="buffs.selected.length" type="button" class="btn" data-testid="buff-clear" @click="buffs.clear()">
        버프 모두 끄기
      </button>
    </div>

    <ul class="bp__chips">
      <li
        v-for="t in buffs.equippedTalismans"
        :key="t.id"
        class="bp__chip bp__chip--talisman"
        title="장착한 탈리스만 (장비 칸에서 바꿉니다)"
        data-testid="talisman-chip"
      >
        <span class="bp__chip-kind">탈리스만</span>{{ itemName(t) }}
      </li>
      <li
        v-for="b in buffs.selectedBuffs"
        :key="b.id"
        class="bp__chip"
        :class="{ 'is-overridden': buffs.stacking.overridden.has(b.id) }"
        :title="overriddenTitle(b.id)"
        data-testid="buff-chip"
      >
        <span class="bp__chip-kind">{{ CATEGORY_LABELS[b.category] ?? b.category }}</span>
        <span class="bp__chip-name">{{ itemName(b) }}</span>
        <span v-if="buffs.stacking.overridden.has(b.id)" class="bp__chip-stack" data-testid="stack-badge">중첩 불가</span>
        <button type="button" class="bp__chip-remove" :aria-label="`${itemName(b)} 끄기`" @click="buffs.remove(b.id)">×</button>
      </li>
      <li v-if="!buffs.equippedTalismans.length && !buffs.selectedBuffs.length" class="bp__empty">
        장착한 탈리스만과 켠 버프가 없습니다
      </li>
    </ul>

    <ul v-if="buffs.stacking.overridden.size" class="bp__stack-notes" data-testid="stack-notes">
      <li v-for="[id, o] in buffs.stacking.overridden" :key="id">
        <strong>중첩 불가</strong> · {{ buffName(id) }} → {{ itemName(o.by) }}가 덮어씀 ({{ o.group }}). 계산에서
        뺍니다.
      </li>
    </ul>

    <div v-if="hasAnyEffect" class="bp__results" data-testid="buff-results">
      <div v-if="attackLines.length" class="bp__block">
        <h3 class="bp__block-title">공격력 (곱연산)</h3>
        <div v-for="l in attackLines" :key="l.label" class="bp__line" data-testid="attack-line">
          <span class="bp__line-label">{{ l.label }}</span>
          <span class="bp__line-total">{{ percentText(l.line.multiplier) }}</span>
          <span class="bp__line-mult">×{{ Math.round(l.line.multiplier * 10000) / 10000 }}</span>
          <span class="bp__line-parts">{{ partsText(l.line) }}</span>
        </div>
      </div>

      <div v-if="takenLines.length" class="bp__block">
        <h3 class="bp__block-title">받는 피해 (곱연산)</h3>
        <div v-for="l in takenLines" :key="l.label" class="bp__line" data-testid="taken-line">
          <span class="bp__line-label">{{ l.label }}</span>
          <span class="bp__line-total" :class="{ 'is-bad': l.line.multiplier > 1 }">{{ percentText(l.line.multiplier) }}</span>
          <span class="bp__line-mult">×{{ Math.round(l.line.multiplier * 10000) / 10000 }}</span>
          <span class="bp__line-parts">{{ partsText(l.line) }}</span>
        </div>
      </div>

      <div v-if="weaponRows.length && attackLines.length" class="bp__block">
        <h3 class="bp__block-title">장착 무기 공격력 (스탯 화면 설정 기준)</h3>
        <div v-for="w in weaponRows" :key="w.label" class="bp__line" :data-testid="`buffed-${w.label}`">
          <span class="bp__line-label">{{ w.label }}</span>
          <span class="bp__line-name">{{ w.name }}</span>
          <span class="bp__line-total">{{ w.before }} → {{ w.after }}</span>
        </div>
      </div>

      <div v-if="summary.others.length" class="bp__block">
        <h3 class="bp__block-title">그 밖의 효과</h3>
        <div v-for="o in summary.others" :key="o.attribute + o.model" class="bp__line" data-testid="other-line">
          <span class="bp__line-label">{{ o.label }}</span>
          <span class="bp__line-total">{{ otherTotalText(o.model, o.total) }}</span>
          <span class="bp__line-parts">{{ o.parts.map((p) => p.source).join(', ') }}</span>
        </div>
      </div>

      <div v-if="summary.conditional.length" class="bp__block">
        <h3 class="bp__block-title">조건부 효과 (위 합계에서 뺌)</h3>
        <div v-for="(c, i) in summary.conditional" :key="i" class="bp__line bp__line--muted" data-testid="conditional-line">
          <span class="bp__line-name">{{ c.source }}</span>
          <span class="bp__line-parts">{{ effectText(c.effect) }}</span>
        </div>
      </div>
    </div>

    <p class="bp__note">
      효과는 모두 곱해서 합칩니다. 같은 종류라 겹치지 않는 버프(무기 버프끼리, 불이여 힘을·고양된 고기, 같은 버프의
      주문판·전회판)는 "중첩 불가"로 표시하고 나중에 켠 것만 계산합니다. 그 밖의 중첩 규칙은 아직 넣지 않았습니다.
      경감 효과는 요약의 경감률 표에도 들어갑니다.
    </p>
  </section>
</template>

<style scoped>
.bp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.bp__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bp__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.bp__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.bp__segment button {
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.bp__segment button + button {
  border-left: 1px solid var(--border);
}
.bp__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.bp__picker {
  display: flex;
  gap: 8px;
}
.bp__select {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.bp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bp__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 2px 10px;
  font-size: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
}
.bp__chip--talisman {
  padding-right: 10px;
  border-style: dashed;
}
.bp__chip-kind {
  font-size: 10px;
  color: var(--text-faint);
}
.bp__chip.is-overridden .bp__chip-name {
  color: var(--text-faint);
  text-decoration: line-through;
}
.bp__chip-stack {
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 999px;
}
.bp__stack-notes {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-muted);
}
.bp__stack-notes strong {
  color: var(--danger);
}
.bp__chip-remove {
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 13px;
  line-height: 1;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}
.bp__chip-remove:hover {
  color: var(--danger);
  background: var(--muted-surface);
}
.bp__empty {
  font-size: 12px;
  color: var(--text-faint);
}
.bp__results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bp__block-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.bp__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}
.bp__line-label {
  min-width: 64px;
  color: var(--text-muted);
}
.bp__line-name {
  color: var(--text);
}
.bp__line-total {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.bp__line-total.is-bad {
  color: var(--danger);
}
.bp__line-mult {
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.bp__line-parts {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--text-muted);
}
.bp__line--muted .bp__line-parts {
  flex-basis: auto;
}
.bp__note {
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
