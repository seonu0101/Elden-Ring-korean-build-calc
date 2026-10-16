<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import EquipmentSummary from '@/components/EquipmentSummary.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { nameLanguage } from '@/data/names'
import { useViewHotkeys } from '@/features/appNav/appNavigation'
import BuffPanel from '@/features/buffs/BuffPanel.vue'
import DamageCalculator from '@/features/damage/DamageCalculator.vue'
import CurveGraphPanel from '@/features/formulas/CurveGraphPanel.vue'
import FormulaReference from '@/features/formulas/FormulaReference.vue'
import GameMenuSimulator from '@/features/gameMenu/GameMenuSimulator.vue'
import ArmorTable from '@/features/itemTables/ArmorTable.vue'
import BuffTable from '@/features/itemTables/BuffTable.vue'
import TalismanTable from '@/features/itemTables/TalismanTable.vue'
import StatsView from '@/features/stats/StatsView.vue'
import WeaponTable from '@/features/weaponTable/WeaponTable.vue'

type View = 'equipment' | 'weapons' | 'armor' | 'talismans' | 'buffs' | 'stats' | 'formulas'
const VIEWS: readonly View[] = ['equipment', 'weapons', 'armor', 'talismans', 'buffs', 'stats', 'formulas']
const VIEW_KEY = 'er-planner/view'

const isMobile = useIsMobile()

function loadView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    return VIEWS.includes(saved as View) ? (saved as View) : 'equipment'
  } catch {
    return 'equipment'
  }
}

const view = ref<View>(loadView())
/**
 * 한 번 열어 본 화면은 그대로 두고 숨기기만 해서, 돌아왔을 때 검색어·필터·커서가 남아 있게 한다.
 * 장비 화면의 키 입력은 GameMenuSimulator의 enabled로 막는다 (다른 화면에서는 가로채지 않는다).
 */
const visited = reactive(new Set<View>([view.value]))
watch(view, (v) => {
  visited.add(v)
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
})

// 어느 화면에서든: 키보드 [ / ] 로 이전·다음 화면, 게임패드 Select(View)로 다음 화면
useViewHotkeys(VIEWS, view)

/**
 * 모바일에서는 메뉴가 옆으로 밀리는 한 줄이라, 고른 탭이 보이도록 메뉴만 옆으로 굴린다.
 * PC처럼 메뉴가 모두 보이면 아무 일도 하지 않는다.
 */
const nav = ref<HTMLElement | null>(null)
function showActiveTab() {
  const el = nav.value
  const active = el?.querySelector<HTMLElement>('.is-active')
  if (!el || !active || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
}
onMounted(showActiveTab)
watch(view, () => nextTick(showActiveTab))
</script>

<template>
  <div
    class="app"
    :class="{
      'app--wide': view === 'weapons' || view === 'armor' || view === 'talismans' || view === 'buffs',
      'app--medium': view === 'stats' || view === 'formulas',
    }"
  >
    <header class="app__header">
      <h1 class="app__title">Build Calc</h1>
      <nav ref="nav" class="app__nav" aria-label="화면">
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
        <button type="button" :class="{ 'is-active': view === 'buffs' }" data-testid="nav-buffs" @click="view = 'buffs'">
          버프 표
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
      <span v-if="!isMobile" class="app__hint" data-testid="nav-hint" title="입력창에 글을 쓰는 중에는 움직이지 않습니다">
        <kbd>[</kbd> <kbd>]</kbd> 화면 이동 · 패드 <kbd>Select</kbd> 다음 화면
      </span>
      <div class="app__lang" role="group" aria-label="아이템 이름 언어" title="아이템·무기군 이름 언어 (공식 한국어 이름이 없는 아이템은 영어로 보입니다)">
        <button
          type="button"
          :class="{ 'is-active': nameLanguage === 'ko' }"
          :aria-pressed="nameLanguage === 'ko'"
          data-testid="lang-ko"
          @click="nameLanguage = 'ko'"
        >
          한국어
        </button>
        <button
          type="button"
          :class="{ 'is-active': nameLanguage === 'en' }"
          :aria-pressed="nameLanguage === 'en'"
          data-testid="lang-en"
          @click="nameLanguage = 'en'"
        >
          English
        </button>
      </div>
    </header>

    <!-- 열어 본 화면은 숨기기만 한다(v-show). 시뮬레이터는 enabled로 장비 화면에서만 키를 받는다 -->
    <main v-if="visited.has('equipment')" v-show="view === 'equipment'" class="app__layout">
      <div class="app__column">
        <GameMenuSimulator :enabled="view === 'equipment'" />
        <BuffPanel />
        <DamageCalculator />
      </div>
      <EquipmentSummary />
    </main>
    <main v-if="visited.has('weapons')" v-show="view === 'weapons'">
      <WeaponTable />
    </main>
    <main v-if="visited.has('armor')" v-show="view === 'armor'">
      <ArmorTable />
    </main>
    <main v-if="visited.has('talismans')" v-show="view === 'talismans'">
      <TalismanTable />
    </main>
    <main v-if="visited.has('buffs')" v-show="view === 'buffs'">
      <BuffTable />
    </main>
    <main v-if="visited.has('formulas')" v-show="view === 'formulas'">
      <CurveGraphPanel />
      <FormulaReference />
    </main>
    <main v-if="visited.has('stats')" v-show="view === 'stats'">
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
.app__hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap;
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
.app__lang {
  display: inline-flex;
  margin-left: auto;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
}
.app__hint + .app__lang {
  margin-left: 0;
}
.app__lang button {
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.app__lang button + button {
  border-left: 1px solid var(--border);
}
.app__lang button.is-active {
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
  /* 모바일: 제목·언어 버튼을 첫 줄에, 메뉴는 아래 줄에서 옆으로 밀어 보기 (PC는 그대로) */
  .app {
    padding: 20px 16px 32px;
  }
  .app__header {
    flex-wrap: wrap;
    gap: 10px 12px;
    margin-bottom: 20px;
  }
  .app__nav {
    position: relative;
    order: 3;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .app__nav::-webkit-scrollbar {
    display: none;
  }
  .app__nav button {
    flex-shrink: 0;
    white-space: nowrap;
  }
}
</style>
