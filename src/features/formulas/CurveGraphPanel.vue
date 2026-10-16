<script setup lang="ts">
// 계산식 탭 위쪽의 무기 보정 곡선 그래프.
// "내 무기": 장착한 무기가 쓰는 곡선과, 내 능력치가 그 곡선의 어디에 있는지 (순수 SVG).
// "곡선 직접 보기": 곡선 #0~#16을 골라서 능력치별 값을 비교한다.
import { computed, ref } from 'vue'
import { calculateAttack, CORRECTION_GRAPH_IDS } from '@/data/attackPower'
import { DAMAGE_LABELS, STAT_LABELS } from '@/data/labels'
import { itemName } from '@/data/names'
import { levelFor } from '@/data/upgrade'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import {
  CHART,
  MAX_X,
  SERIES_COLORS,
  SERIES_DASHES,
  X_TICKS,
  curveMarkers,
  groupMarkers,
  linePath,
  niceMax,
  sampleCurve,
  scaleX,
  scaleY,
  statFromViewX,
  uniqueGraphIds,
  yTicks,
} from './curveGraph'

const MAX_FREE_CURVES = 6

const character = useCharacterStore()
const stats = useStatsStore()

type Mode = 'weapon' | 'free'
const mode = ref<Mode>('weapon')

/** 장착한 무기: 스탯 화면의 변질·강화·한손/양손 설정을 적용한 공격력 계산 결과와 함께 */
const equipped = computed(() =>
  EQUIPMENT_GRID.flat().flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slot = character.equippedIn(cell.target)
    const item = slot ? character.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const chosen = stats.affinityFor(cell.target.equipIndex)
    const affinity = weaponStats(item, chosen) ? chosen : 'Standard'
    const level = levelFor(weaponStats(item, affinity)!, stats.upgrade)
    const attack = calculateAttack(item, affinity, level, stats.combatStats, stats.twoHanded)
    return attack ? [{ label: cell.label, title: cell.title, item, attack }] : []
  }),
)

const chosenLabel = ref<string>('')
const current = computed(() => equipped.value.find((w) => w.label === chosenLabel.value) ?? equipped.value[0] ?? null)

const groups = computed(() => (current.value ? groupMarkers(curveMarkers(current.value.attack)) : []))

const freeIds = ref<number[]>([0, 3, 5, 10])
const freeStat = ref<number>(stats.finalAttributes.strength)

function toggleFree(id: number) {
  if (freeIds.value.includes(id)) {
    if (freeIds.value.length > 1) freeIds.value = freeIds.value.filter((x) => x !== id)
  } else if (freeIds.value.length < MAX_FREE_CURVES) {
    freeIds.value = [...freeIds.value, id]
  }
}

const shownIds = computed(() => (mode.value === 'weapon' ? uniqueGraphIds(groups.value) : freeIds.value))

const samples = computed(() => Object.fromEntries(shownIds.value.map((id) => [id, sampleCurve(id)])) as Record<number, number[]>)
const yMax = computed(() => niceMax(shownIds.value.flatMap((id) => samples.value[id]!)))
const paths = computed(() => shownIds.value.map((id) => ({ id, d: linePath(samples.value[id]!, yMax.value) })))

function colorOf(id: number): string {
  return SERIES_COLORS[Math.max(0, shownIds.value.indexOf(id)) % SERIES_COLORS.length]!
}
function dashOf(id: number): string {
  return SERIES_DASHES[Math.max(0, shownIds.value.indexOf(id)) % SERIES_DASHES.length]!
}

interface Dot {
  key: string
  id: number
  x: number
  y: number
  label: string
  title: string
  value: number
  graph: number
}

const damageNames = (damages: readonly (keyof typeof DAMAGE_LABELS)[]) => damages.map((d) => DAMAGE_LABELS[d]).join('·')

/** 곡선 위의 점: 내 무기는 내 능력치 위치, 직접 보기는 고른 능력치 위치 */
const dots = computed<Dot[]>(() => {
  if (mode.value === 'weapon') {
    return groups.value.map((g) => ({
      key: `${g.graphId}-${g.stat}-${g.value}`,
      id: g.graphId,
      x: g.value,
      y: g.graph,
      label: `${STAT_LABELS[g.stat]} ${g.value}`,
      title: `${damageNames(g.damages)} · ${STAT_LABELS[g.stat]}`,
      value: g.value,
      graph: g.graph,
    }))
  }
  return freeIds.value.map((id) => ({
    key: `free-${id}`,
    id,
    x: freeStat.value,
    y: samples.value[id]![freeStat.value] ?? 0,
    label: `#${id}`,
    title: `곡선 #${id}`,
    value: freeStat.value,
    graph: samples.value[id]![freeStat.value] ?? 0,
  }))
})

/** 점 이름이 겹치지 않게 같은 능력치 위치의 점은 위아래로 조금씩 어긋나게 놓는다 */
function labelOffset(index: number): number {
  return -9 - (index % 3) * 13
}

const svg = ref<SVGSVGElement | null>(null)
const probe = ref<number | null>(null)

function onMove(event: PointerEvent) {
  const el = svg.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width) return
  probe.value = statFromViewX(((event.clientX - rect.left) / rect.width) * CHART.width)
}

const probeValues = computed(() =>
  probe.value === null ? [] : shownIds.value.map((id) => ({ id, value: samples.value[id]![probe.value!] ?? 0 })),
)

const ariaLabel = computed(() =>
  mode.value === 'weapon' && current.value
    ? `${itemName(current.value.item)}의 보정 곡선 그래프. ${dots.value.map((d) => `${d.title} ${d.value}에서 곡선 값 ${d.graph.toFixed(3)}`).join(', ')}`
    : `보정 곡선 ${shownIds.value.map((id) => `#${id}`).join(', ')}의 능력치별 값`,
)

const hasWeapons = computed(() => equipped.value.length > 0)
const noScaling = computed(() => mode.value === 'weapon' && hasWeapons.value && groups.value.length === 0)

const plotRight = CHART.width - CHART.right
const plotBottom = CHART.height - CHART.bottom
</script>

<template>
  <section class="cg" aria-label="보정 곡선 그래프" data-testid="curve-panel">
    <header class="cg__head">
      <h2 class="cg__title">보정 곡선 그래프</h2>
      <div class="cg__segment" role="group" aria-label="보기 방식">
        <button
          type="button"
          :class="{ 'is-active': mode === 'weapon' }"
          :aria-pressed="mode === 'weapon'"
          data-testid="curve-mode-weapon"
          @click="mode = 'weapon'"
        >
          내 무기
        </button>
        <button
          type="button"
          :class="{ 'is-active': mode === 'free' }"
          :aria-pressed="mode === 'free'"
          data-testid="curve-mode-free"
          @click="mode = 'free'"
        >
          곡선 직접 보기
        </button>
      </div>
    </header>
    <p class="cg__lead">
      능력치가 오를수록 보정이 얼마나 붙는지를 곡선으로 보여줍니다. 공격력의 보정값은 기본 공격력 × 보정 계수 × 곡선 값입니다.
    </p>

    <template v-if="mode === 'weapon'">
      <p v-if="!hasWeapons" class="cg__empty" data-testid="curve-empty">
        장착한 무기가 없습니다. 장비 화면에서 무기를 장착하거나 "곡선 직접 보기"를 눌러 보세요.
      </p>
      <div v-else class="cg__controls">
        <label class="cg__field">
          무기
          <select :value="current?.label" data-testid="curve-weapon-select" @change="chosenLabel = ($event.target as HTMLSelectElement).value">
            <option v-for="w in equipped" :key="w.label" :value="w.label">{{ w.title }} · {{ itemName(w.item) }}</option>
          </select>
        </label>
        <span class="cg__note">
          스탯 화면의 능력치{{ stats.twoHanded ? '(양손: 근력 × 1.5)' : '' }}와 변질·강화를 적용한 값입니다.
        </span>
      </div>
      <p v-if="noScaling" class="cg__empty" data-testid="curve-noscaling">
        이 무기는 능력치 보정이 붙는 속성이 없어서 곡선 위에 표시할 점이 없습니다.
      </p>
    </template>

    <template v-else>
      <div class="cg__chips" role="group" aria-label="곡선 고르기">
        <button
          v-for="id in CORRECTION_GRAPH_IDS"
          :key="id"
          type="button"
          class="cg__chip"
          :class="{ 'is-on': freeIds.includes(id) }"
          :aria-pressed="freeIds.includes(id)"
          :data-testid="`curve-chip-${id}`"
          @click="toggleFree(id)"
        >
          <span class="cg__swatch" :style="{ background: freeIds.includes(id) ? colorOf(id) : 'transparent' }" />
          #{{ id }}
        </button>
      </div>
      <div class="cg__controls">
        <label class="cg__field cg__field--grow">
          능력치
          <input v-model.number="freeStat" type="range" min="1" :max="MAX_X" step="1" data-testid="curve-stat" />
        </label>
        <output class="cg__stat" data-testid="curve-stat-out">{{ freeStat }}</output>
        <span class="cg__note">곡선은 최대 {{ MAX_FREE_CURVES }}개까지 고를 수 있습니다.</span>
      </div>
    </template>

    <svg
      v-if="shownIds.length"
      ref="svg"
      class="cg__svg"
      :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
      role="img"
      :aria-label="ariaLabel"
      data-testid="curve-graph"
      @pointermove="onMove"
      @pointerleave="probe = null"
    >
      <title>{{ ariaLabel }}</title>
      <g v-for="t in yTicks(yMax)" :key="`y${t}`">
        <line class="cg__grid" :x1="CHART.left" :x2="plotRight" :y1="scaleY(t, yMax)" :y2="scaleY(t, yMax)" />
        <text class="cg__tick" :x="CHART.left - 8" :y="scaleY(t, yMax) + 4" text-anchor="end">{{ t }}</text>
      </g>
      <line class="cg__axis" :x1="CHART.left" :x2="plotRight" :y1="plotBottom" :y2="plotBottom" />
      <g v-for="t in X_TICKS" :key="`x${t}`">
        <text class="cg__tick" :x="scaleX(t)" :y="plotBottom + 18" text-anchor="middle">{{ t }}</text>
      </g>
      <text class="cg__tick" :x="(CHART.left + plotRight) / 2" :y="CHART.height - 4" text-anchor="middle">능력치</text>
      <line class="cg__cap" :x1="scaleX(99)" :x2="scaleX(99)" :y1="CHART.top" :y2="plotBottom" />
      <text class="cg__tick" :x="scaleX(99) + 4" :y="CHART.top + 10">99</text>

      <path
        v-for="p in paths"
        :key="p.id"
        class="cg__line"
        :d="p.d"
        :stroke="colorOf(p.id)"
        :stroke-dasharray="dashOf(p.id)"
        :data-testid="`curve-line-${p.id}`"
      />

      <line
        v-if="probe !== null"
        class="cg__probe"
        :x1="scaleX(probe)"
        :x2="scaleX(probe)"
        :y1="CHART.top"
        :y2="plotBottom"
      />

      <g v-for="(d, i) in dots" :key="d.key" data-testid="curve-dot">
        <line class="cg__drop" :x1="scaleX(d.x)" :x2="scaleX(d.x)" :y1="scaleY(d.y, yMax)" :y2="plotBottom" />
        <line class="cg__drop" :x1="CHART.left" :x2="scaleX(d.x)" :y1="scaleY(d.y, yMax)" :y2="scaleY(d.y, yMax)" />
        <circle class="cg__dot" :cx="scaleX(d.x)" :cy="scaleY(d.y, yMax)" r="5.5" :fill="colorOf(d.id)" />
        <text
          class="cg__label"
          :x="scaleX(d.x) + 9"
          :y="scaleY(d.y, yMax) + labelOffset(i)"
        >
          {{ d.label }}
        </text>
      </g>
    </svg>

    <p v-if="probe !== null" class="cg__probe-out" data-testid="curve-probe">
      능력치 {{ probe }}:
      <span v-for="p in probeValues" :key="p.id" class="cg__probe-item">
        <span class="cg__swatch" :style="{ background: colorOf(p.id) }" />#{{ p.id }} {{ p.value.toFixed(3) }}
      </span>
    </p>

    <div v-if="dots.length" class="cg__cards" data-testid="curve-readout">
      <div v-for="d in dots" :key="d.key" class="cg__card">
        <div class="cg__card-name">
          <span class="cg__swatch" :style="{ background: colorOf(d.id) }" />
          {{ d.title }}
        </div>
        <div class="cg__card-value">{{ d.graph.toFixed(3) }}</div>
        <div class="cg__card-sub">
          {{ mode === 'weapon' ? `능력치 ${d.value} · 곡선 #${d.id}` : `능력치 ${d.value}` }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cg {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 40px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border);
}
.cg__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.cg__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.cg__lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.cg__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.cg__segment button {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.cg__segment button + button {
  border-left: 1px solid var(--border);
}
.cg__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.cg__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.cg__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.cg__field--grow {
  flex: 1;
  min-width: 220px;
}
.cg__field--grow input {
  flex: 1;
  accent-color: var(--accent);
}
.cg__field select {
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.cg__stat {
  min-width: 32px;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cg__note {
  font-size: 12px;
  color: var(--text-faint);
}
.cg__empty {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--muted-surface);
  border-radius: var(--radius);
}
.cg__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cg__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}
.cg__chip.is-on {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--muted-surface);
}
.cg__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  vertical-align: -1px;
}
.cg__svg {
  width: 100%;
  height: auto;
  max-height: 340px;
  touch-action: pan-y;
}
.cg__grid {
  stroke: var(--border);
  stroke-width: 1;
}
.cg__axis {
  stroke: var(--border-strong);
  stroke-width: 1;
}
.cg__cap {
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}
.cg__tick {
  fill: var(--text-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.cg__line {
  fill: none;
  stroke-width: 2.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.cg__drop {
  stroke: var(--text-faint);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.cg__dot {
  stroke: var(--bg);
  stroke-width: 2;
}
.cg__label {
  fill: var(--text);
  font-size: 12px;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 3px;
}
.cg__probe {
  stroke: var(--text-muted);
  stroke-width: 1;
}
.cg__probe-out {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cg__probe-item {
  margin-left: 10px;
  white-space: nowrap;
}
.cg__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.cg__card {
  padding: 10px 12px;
  background: var(--muted-surface);
  border-radius: var(--radius);
}
.cg__card-name {
  font-size: 12px;
  color: var(--text-muted);
}
.cg__card-value {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cg__card-sub {
  font-size: 11px;
  color: var(--text-faint);
}
</style>
