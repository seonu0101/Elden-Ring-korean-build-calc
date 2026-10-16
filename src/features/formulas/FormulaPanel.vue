<script setup lang="ts">
// 장비 화면 "계산식" 창: 지금 장비·스탯·버프로 나온 모든 수치의 계산 과정을 보여준다.
import { computed, nextTick, onMounted, ref } from 'vue'
import { BUFFS_BY_ID } from '@/data/items'
import { levelFor } from '@/data/upgrade'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { buildFormulas } from './formulas'
import type { EquippedWeapon } from './formulas'

const emit = defineEmits<{ close: [] }>()

const character = useCharacterStore()
const stats = useStatsStore()
const buffs = useBuffsStore()

/** 장착한 무기마다 스탯 화면 설정(변질·강화)을 적용한다. 요약 패널과 같은 방식 */
const weapons = computed<EquippedWeapon[]>(() =>
  EQUIPMENT_GRID.flat().flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slot = character.equippedIn(cell.target)
    const item = slot ? character.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const chosen = stats.affinityFor(cell.target.equipIndex)
    const affinity = weaponStats(item, chosen) ? chosen : 'Standard'
    return [{ label: cell.label, item, affinity, level: levelFor(weaponStats(item, affinity)!, stats.upgrade) }]
  }),
)

const sections = computed(() =>
  buildFormulas({
    attributes: stats.attributes,
    bonusAttributes: stats.bonusAttributes,
    finalAttributes: stats.finalAttributes,
    defenseAttributes: stats.defenseAttributes,
    combatStats: stats.combatStats,
    twoHanded: stats.twoHanded,
    equippedItems: character.equippedItems,
    protectors: character.equippedProtectors,
    weapons: weapons.value,
    summary: buffs.summary,
    overridden: [...buffs.stacking.overridden].map(([id, o]) => ({
      name: BUFFS_BY_ID.get(id)?.name ?? id,
      by: o.by.name,
      group: o.group,
    })),
    pvp: buffs.pvp,
  }),
)

// 열리면 창에 포커스를 줘서 키 입력이 장비 메뉴로 가지 않게 한다 (Esc로 닫기)
const dialog = ref<HTMLElement | null>(null)
onMounted(() => nextTick(() => dialog.value?.focus()))

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="fp-backdrop" data-testid="formula-backdrop" @click.self="emit('close')">
    <div
      ref="dialog"
      class="fp"
      role="dialog"
      aria-modal="true"
      aria-label="계산식"
      tabindex="-1"
      data-testid="formula-panel"
      @keydown.stop="onKeydown"
    >
      <header class="fp__header">
        <h2 class="fp__title">계산식</h2>
        <span class="fp__hint">지금 장비·스탯·버프 기준 · ⌊x⌋는 소수점 버림</span>
        <button type="button" class="btn fp__close" data-testid="formula-close" @click="emit('close')">닫기</button>
      </header>

      <nav class="fp__toc" aria-label="계산식 목차">
        <a v-for="s in sections" :key="s.id" :href="`#formula-${s.id}`" class="fp__toc-link">{{ s.title }}</a>
      </nav>

      <div class="fp__body">
        <section v-for="s in sections" :id="`formula-${s.id}`" :key="s.id" class="fp__section" :data-testid="`formula-${s.id}`">
          <h3 class="fp__section-title">{{ s.title }}</h3>
          <p class="fp__rule">{{ s.rule }}</p>
          <p v-if="!s.groups.length" class="fp__empty">{{ s.empty }}</p>
          <div v-for="g in s.groups" :key="g.title" class="fp__group">
            <h4 class="fp__group-title">
              {{ g.title }}<span v-if="g.subtitle" class="fp__group-sub">{{ g.subtitle }}</span>
            </h4>
            <div
              v-for="(l, i) in g.lines"
              :key="i"
              class="fp__line"
              :class="{ 'is-note': l.note, [`indent-${l.indent ?? 0}`]: true }"
            >
              <span v-if="l.label" class="fp__label">{{ l.label }}</span>
              <span class="fp__expr">{{ l.expr }}</span>
              <span v-if="l.result !== undefined" class="fp__result">= {{ l.result }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 32px 16px;
  background: rgba(0, 0, 0, 0.45);
}
.fp {
  display: flex;
  flex-direction: column;
  width: min(880px, 100%);
  max-height: calc(100vh - 64px);
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  outline: none;
}
.fp__header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
}
.fp__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.fp__hint {
  flex: 1;
  font-size: 12px;
  color: var(--text-faint);
}
.fp__toc {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.fp__toc-link {
  color: var(--text-muted);
  text-decoration: none;
}
.fp__toc-link:hover {
  color: var(--text);
  text-decoration: underline;
}
.fp__body {
  overflow-y: auto;
  padding: 4px 16px 16px;
}
.fp__section {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.fp__section:last-child {
  border-bottom: none;
}
.fp__section-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
.fp__rule {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.fp__empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-faint);
}
.fp__group + .fp__group {
  margin-top: 12px;
}
.fp__group-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
}
.fp__group-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: normal;
  color: var(--text-faint);
}
.fp__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  padding: 3px 0;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px dashed var(--border);
}
.fp__line.indent-1 {
  padding-left: 16px;
}
.fp__label {
  min-width: 84px;
  color: var(--text-muted);
}
.fp__expr {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
.fp__result {
  font-weight: 600;
  white-space: nowrap;
}
.fp__line.is-note .fp__expr {
  font-family: inherit;
  color: var(--text-faint);
}
@media (max-width: 600px) {
  .fp-backdrop {
    padding: 0;
  }
  .fp {
    max-height: 100vh;
    border-radius: 0;
  }
  .fp__label {
    min-width: 0;
  }
}
</style>
