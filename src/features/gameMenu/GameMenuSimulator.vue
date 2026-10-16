<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ItemTile from '@/components/ItemTile.vue'
import { calculateAttack, partTotal } from '@/data/attackPower'
import { AFFINITY_LABELS, DAMAGE_LABELS, STAT_LABELS, STATUS_LABELS, scalingGrade, scalingValue } from '@/data/labels'
import { talismanEffectText } from '@/data/talismanEffects'
import { levelFor, upgradeStats } from '@/data/upgrade'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { DAMAGE_TYPES, STAT_KEYS, STATUS_TYPES } from '@/types'
import type { AffinityName, SlotTarget } from '@/types'
import { EQUIPMENT_GRID } from './layout'
import { useGameMenu } from './useGameMenu'
import type { MenuMode } from './useGameMenu'
import { useGamepadInput } from './useGamepadInput'
import { useKeyboardInput } from './useKeyboardInput'

const props = withDefaults(defineProps<{ initialMode?: MenuMode; enabled?: boolean }>(), {
  initialMode: 'grid',
  enabled: true,
})

const store = useCharacterStore()
const menu = useGameMenu(store, { initialMode: props.initialMode })
const { mode, row, col, inventoryIndex, currentCell, slotGroup, inventory, equippedSlot, focusedSlot, notice } = menu

useKeyboardInput(menu.dispatch, () => props.enabled)
const { connectedName } = useGamepadInput(menu.dispatch, () => props.enabled)

const inventoryScroll = ref<HTMLElement | null>(null)

// 목록 커서가 화면 밖으로 나가면 따라서 스크롤한다.
watch([inventoryIndex, mode, currentCell], async () => {
  if (mode.value !== 'inventory') return
  await nextTick()
  inventoryScroll.value
    ?.querySelector(`[data-inv-idx="${inventoryIndex.value}"]`)
    ?.scrollIntoView({ block: 'nearest' })
})

const focusedItem = computed(() => (focusedSlot.value ? store.itemOf(focusedSlot.value) : null))
const focusedWeapon = computed(() => (focusedItem.value?.kind === 'weapon' ? focusedItem.value : null))
const focusedIsEquipped = computed(
  () => focusedSlot.value !== null && focusedSlot.value.uid === equippedSlot.value?.uid,
)

/**
 * 무기 상세 정보는 스탯 화면의 설정(능력치·강화·한손/양손)으로 계산한 값을 보여준다.
 * 변질은 스탯 화면에서 이 무기 칸(RH1 등)에 고른 변질을 쓰고, 그 무기가 못 하는 변질이면 일반으로 본다.
 */
const statsStore = useStatsStore()

const focusedAffinity = computed<AffinityName>(() => {
  const w = focusedWeapon.value
  const target = currentCell.value.target
  if (!w || target.kind !== 'weapon') return 'Standard'
  const affinity = statsStore.affinityFor(target.equipIndex)
  return weaponStats(w, affinity) ? affinity : 'Standard'
})

const focusedCalc = computed(() => {
  const w = focusedWeapon.value
  if (!w) return null
  const base = weaponStats(w, focusedAffinity.value)
  if (!base) return null
  const level = levelFor(base, statsStore.upgrade)
  const attack = calculateAttack(w, focusedAffinity.value, level, statsStore.combatStats, statsStore.twoHanded)
  if (!attack) return null
  return {
    attack,
    level,
    scaling: upgradeStats(base, level).scaling,
    damageTypes: DAMAGE_TYPES.filter((d) => attack.damage[d].base),
    statusTypes: STATUS_TYPES.filter((t) => partTotal(attack.status[t]) > 0),
    stats: STAT_KEYS.filter((s) => w.requirements[s] || upgradeStats(base, level).scaling[s]),
  }
})

function equippedItem(target: SlotTarget) {
  const slot = store.equippedIn(target)
  return slot ? store.itemOf(slot) : null
}

/** 화면 아래 키 안내: 키보드 키 / 게임패드 버튼 (Xbox 배치 기준). 장착 해제는 키보드 R / 게임패드 X. */
interface KeyHint {
  keys: string[]
  pad: string[] | null
  label: string
}

const keyGuide = computed<KeyHint[]>(() => {
  switch (mode.value) {
    case 'game':
      return [{ keys: ['Esc'], pad: ['Start'], label: '메뉴' }]
    case 'menu':
      return [
        { keys: ['E'], pad: ['A'], label: '열기' },
        { keys: ['Q'], pad: ['B'], label: '닫기' },
      ]
    case 'grid':
      return [
        { keys: ['↑↓←→'], pad: ['십자키'], label: '이동' },
        { keys: ['E'], pad: ['A'], label: '열기' },
        { keys: ['R'], pad: ['X'], label: '장착 해제' },
        { keys: ['Q'], pad: ['B'], label: '뒤로' },
        { keys: ['Esc'], pad: ['Start'], label: '닫기' },
      ]
    case 'inventory':
      return [
        { keys: ['↑↓←→'], pad: ['십자키'], label: '고르기' },
        { keys: ['E'], pad: ['A'], label: '장착' },
        { keys: ['R'], pad: ['X'], label: '장착 해제' },
        { keys: ['Q'], pad: ['B'], label: '목록 닫기' },
        ...(slotGroup.value.length > 1 ? [{ keys: ['C', 'V'], pad: ['LB', 'RB'], label: '칸 전환' }] : []),
        { keys: ['PgUp', 'PgDn'], pad: ['LT', 'RT'], label: '페이지' },
      ]
  }
})

const kindLabel ={ weapon: '무기', protector: '방어구', talisman: '탈리스만' } as const
</script>

<template>
  <section class="gms" aria-label="장비">
    <header class="gms__header">
      <h2 class="gms__title">장비</h2>
      <span class="gms__input" :title="connectedName ?? ''">{{ connectedName ? '게임패드' : '키보드' }}</span>
    </header>

    <!-- 메뉴가 닫힌 상태 -->
    <div v-if="mode === 'game'" class="gms__idle">
      <kbd>Esc</kbd> / <kbd class="gms__pad">Start</kbd> 를 눌러 메뉴 열기
    </div>

    <!-- 메인 메뉴 -->
    <div v-else-if="mode === 'menu'" class="gms__menu">
      <button type="button" class="gms__menu-item" @click="mode = 'grid'">Equipment</button>
    </div>

    <!-- 장비 칸 격자 -->
    <div v-else-if="mode === 'grid'" class="gms__grid">
      <div v-for="(cells, r) in EQUIPMENT_GRID" :key="r" class="gms__row">
        <div
          v-for="(cell, c) in cells"
          :key="cell.label"
          class="gms__cell"
          :class="{ 'is-cursor': row === r && col === c }"
          data-testid="equip-cell"
          @click="menu.selectCell(r, c)"
          @dblclick="menu.openCell(r, c)"
        >
          <ItemTile :item="equippedItem(cell.target)" :placeholder="cell.label" />
        </div>
      </div>
    </div>

    <!-- 아이템 목록 -->
    <div v-else class="gms__inventory">
      <div class="gms__tabs">
        <span
          v-for="{ cell, row: r, col: c } in slotGroup"
          :key="cell.label"
          class="gms__tab"
          :class="{ 'is-active': r === row && c === col }"
          data-testid="slot-tab"
        >
          {{ cell.label }}
        </span>
        <span class="gms__tab-title">{{ currentCell.title }}</span>
      </div>
      <div ref="inventoryScroll" class="gms__inv-scroll">
        <p v-if="inventory.length === 0" class="gms__inv-empty" data-testid="inventory-empty">
          인벤토리에 아이템이 없습니다. 무기 표·방어구 표·탈리스만 표의 + 버튼으로 추가할 수 있습니다.
        </p>
        <div v-else class="gms__inv-grid">
          <div
            v-for="(slot, i) in inventory"
            :key="slot.uid"
            class="gms__cell"
            :class="{ 'is-cursor': i === inventoryIndex }"
            :data-inv-idx="i"
            data-testid="inventory-cell"
            @click="menu.selectInventory(i)"
            @dblclick="menu.equipAt(i)"
          >
            <ItemTile
              :item="store.itemOf(slot)"
              :equipped="slot.uid === equippedSlot?.uid"
              :equipped-elsewhere="slot.equipIndex != null"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 커서가 가리키는 아이템 정보 -->
    <div v-if="mode === 'grid' || mode === 'inventory'" class="gms__detail" data-testid="detail">
      <p v-if="notice" class="gms__notice" role="alert" data-testid="equip-notice">{{ notice }}</p>
      <template v-if="focusedItem">
        <div class="gms__detail-name">
          {{ focusedItem.name }}
          <span v-if="focusedIsEquipped" class="gms__badge">장착 중</span>
        </div>
        <div class="gms__detail-meta">
          <span>{{ kindLabel[focusedItem.kind] }}</span>
          <span v-if="focusedItem.kind === 'weapon'">{{ focusedItem.weaponType }}</span>
          <span>무게 {{ focusedItem.weight.toFixed(1) }}</span>
          <span v-if="focusedItem.kind === 'protector'">강인도 {{ focusedItem.poise }}</span>
        </div>
        <div v-if="focusedItem.kind === 'talisman'" class="gms__detail-meta" data-testid="detail-effect">
          {{ talismanEffectText(focusedItem) }}
        </div>
        <template v-if="focusedWeapon && focusedCalc">
          <div class="gms__detail-meta" data-testid="detail-setting">
            <span>+{{ focusedCalc.level }}</span>
            <span>{{ AFFINITY_LABELS[focusedAffinity] }}</span>
            <span>{{ focusedCalc.attack.twoHanded ? '양손' : '한손' }}</span>
            <span class="gms__detail-note">스탯 화면 설정 기준</span>
          </div>
          <div class="gms__detail-meta" data-testid="detail-attack">
            <span class="gms__detail-total">공격력 {{ focusedCalc.attack.total }}</span>
            <span v-for="d in focusedCalc.damageTypes" :key="d">
              {{ DAMAGE_LABELS[d] }} {{ partTotal(focusedCalc.attack.damage[d]) }}
            </span>
            <span v-for="t in focusedCalc.statusTypes" :key="t">
              {{ STATUS_LABELS[t] }} {{ partTotal(focusedCalc.attack.status[t]) }}
            </span>
          </div>
          <div class="gms__detail-meta" data-testid="detail-requirements">
            <span
              v-for="s in focusedCalc.stats"
              :key="s"
              :class="{ 'gms__unmet': focusedCalc.attack.unmet.includes(s) }"
              :title="focusedCalc.attack.unmet.includes(s) ? `요구 ${STAT_LABELS[s]} 부족` : undefined"
            >
              {{ STAT_LABELS[s] }} {{ focusedWeapon.requirements[s] ?? 0 }}
              <template v-if="scalingGrade(focusedCalc.scaling[s])"
                >({{ scalingGrade(focusedCalc.scaling[s]) }} {{ scalingValue(focusedCalc.scaling[s]) }})</template
              >
            </span>
          </div>
        </template>
      </template>
      <div v-else class="gms__detail-meta">{{ currentCell.title }} · 비어 있음</div>
    </div>

    <footer class="gms__controls" data-testid="key-guide">
      <span v-for="hint in keyGuide" :key="hint.label" class="gms__hint">
        <kbd v-for="k in hint.keys" :key="k">{{ k }}</kbd>
        <template v-if="hint.pad">
          <span class="gms__hint-sep">/</span>
          <kbd v-for="p in hint.pad" :key="p" class="gms__pad">{{ p }}</kbd>
        </template>
        {{ hint.label }}
      </span>
    </footer>
  </section>
</template>

<style scoped>
.gms {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.gms__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.gms__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.gms__input {
  font-size: 12px;
  color: var(--text-faint);
}
.gms__idle {
  padding: 64px 0;
  text-align: center;
  color: var(--text-muted);
}
.gms__menu-item {
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  background: var(--muted-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}
.gms__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
}
.gms__row {
  /* 3칸 줄과 4칸 줄의 칸 크기를 같게 하려고 모든 줄을 4열로 나눈다 */
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.gms__row:nth-child(2) {
  /* 무기 줄과 방어구 줄 사이를 띄운다 */
  margin-bottom: 8px;
}
.gms__cell {
  position: relative;
  cursor: pointer;
  border-radius: var(--radius);
}
.gms__cell.is-cursor {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.gms__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.gms__tab {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  color: var(--text-muted);
}
.gms__tab.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.gms__tab-title {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}
.gms__inv-scroll {
  max-width: 520px;
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.gms__inv-empty {
  margin: 0;
  padding: 32px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
.gms__inv-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.gms__detail {
  min-height: 56px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.gms__detail-name {
  font-weight: 600;
  margin-bottom: 2px;
}
.gms__detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.gms__notice {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--danger);
}
.gms__detail-total {
  font-weight: 600;
  color: var(--text);
}
.gms__detail-note {
  color: var(--text-faint);
}
.gms__unmet {
  color: var(--danger);
  font-weight: 600;
}
.gms__badge {
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-text);
  background: var(--accent);
  border-radius: 999px;
  vertical-align: middle;
}
.gms__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--text-faint);
}
.gms__controls kbd + kbd {
  margin-left: 2px;
}
.gms__hint {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.gms__hint-sep {
  margin: 0 2px;
}
/* 게임패드 버튼은 둥근 모양으로 키보드 키와 구분한다 */
.gms__pad {
  border-radius: 999px;
  padding: 0 6px;
}
</style>
