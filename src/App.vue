<script setup lang="ts">
import { ref, watch } from 'vue'
import EquipmentSummary from '@/components/EquipmentSummary.vue'
import BuffPanel from '@/features/buffs/BuffPanel.vue'
import DamageCalculator from '@/features/damage/DamageCalculator.vue'
import FormulaReference from '@/features/formulas/FormulaReference.vue'
import GameMenuSimulator from '@/features/gameMenu/GameMenuSimulator.vue'
import ArmorTable from '@/features/itemTables/ArmorTable.vue'
import TalismanTable from '@/features/itemTables/TalismanTable.vue'
import StatsView from '@/features/stats/StatsView.vue'
import WeaponTable from '@/features/weaponTable/WeaponTable.vue'

type View = 'equipment' | 'weapons' | 'armor' | 'talismans' | 'stats' | 'formulas'
const VIEWS: readonly View[] = ['equipment', 'weapons', 'armor', 'talismans', 'stats', 'formulas']
const VIEW_KEY = 'er-planner/view'

function loadView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    return VIEWS.includes(saved as View) ? (saved as View) : 'equipment'
  } catch {
    return 'equipment'
  }
}

const view = ref<View>(loadView())
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
})
</script>

<template>
  <div
    class="app"
    :class="{
      'app--wide': view === 'weapons' || view === 'armor' || view === 'talismans',
      'app--medium': view === 'stats' || view === 'formulas',
    }"
  >
    <header class="app__header">
      <h1 class="app__title">Build Calcr</h1>
      <nav class="app__nav" aria-label="화면">
        <button type="button" :class="{ 'is-active': view === 'equipment' }" @click="view = 'equipment'">장비</button>
        <button type="button" :class="{ 'is-active': view === 'weapons' }" @click="view = 'weapons'">무기 표</button>
        <button type="button" :class="{ 'is-active': view === 'armor' }" data-testid="nav-armor" @click="view = 'armor'">
          방어구 표
        </button>
        <button
          type="button"
          :class="{ 'is-active': view === 'talismans' }"
          data-testid="nav-talismans"
          @click="view = 'talismans'"
        >
          탈리스만 표
        </button>
        <button type="button" :class="{ 'is-active': view === 'stats' }" data-testid="nav-stats" @click="view = 'stats'">
          스탯
        </button>
        <button
          type="button"
          :class="{ 'is-active': view === 'formulas' }"
          data-testid="nav-formulas"
          @click="view = 'formulas'"
        >
          계산식
        </button>
      </nav>
    </header>

    <!-- 시뮬레이터는 장비 화면에서만 마운트해서, 표를 볼 때는 키 입력을 가로채지 않게 한다 -->
    <main v-if="view === 'equipment'" class="app__layout">
      <div class="app__column">
        <GameMenuSimulator />
        <BuffPanel />
        <DamageCalculator />
      </div>
      <EquipmentSummary />
    </main>
    <main v-else-if="view === 'weapons'">
      <WeaponTable />
    </main>
    <main v-else-if="view === 'armor'">
      <ArmorTable />
    </main>
    <main v-else-if="view === 'talismans'">
      <TalismanTable />
    </main>
    <main v-else-if="view === 'formulas'">
      <FormulaReference />
    </main>
    <main v-else>
      <StatsView />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 16px;
}
.app--wide {
  max-width: 1400px;
}
.app--medium {
  max-width: 1160px;
}
.app__header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}
.app__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.app__nav {
  display: flex;
  gap: 4px;
}
.app__nav button {
  padding: 4px 12px;
  font-size: 13px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.app__nav button:hover {
  color: var(--text);
}
.app__nav button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.app__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
.app__column {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
@media (max-width: 720px) {
  .app__layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
  }
}
</style>
