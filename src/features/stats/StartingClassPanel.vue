<script setup lang="ts">
// 스탯 화면 위쪽: 태생(능력치 하한)과 목표 레벨(PvP 메타 레벨 등).
// 태생 값은 게임 파일에서 읽은 값이다 (src/data/startingClasses.ts).
import { computed, ref } from 'vue'
import { nameLanguage } from '@/data/names'
import {
  STARTING_CLASSES,
  TARGET_LEVEL_PRESETS,
  levelNeeded,
  rankClasses,
  startingClass,
  startingClassName,
} from '@/data/startingClasses'
import type { StartingClassKey } from '@/data/startingClasses'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, useStatsStore } from '@/stores/stats'

const stats = useStatsStore()

const current = computed(() => (stats.startingClassKey === null ? null : startingClass(stats.startingClassKey)))

/** 목표 레벨 칸: 프리셋이 아닌 값을 직접 넣을 때 쓴다 */
const customLevel = ref<number>(stats.targetLevel ?? 125)
const isPreset = computed(() => stats.targetLevel !== null && TARGET_LEVEL_PRESETS.includes(stats.targetLevel))

function onCustomChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  stats.setTargetLevel(value)
  customLevel.value = stats.targetLevel ?? value
}

const progress = computed(() => {
  if (stats.targetLevel === null) return 0
  return Math.min(100, Math.max(0, (stats.runeLevel / stats.targetLevel) * 100))
})

const status = computed(() => {
  const r = stats.remainingPoints
  if (r === null) return { text: '목표 레벨 없음', tone: 'muted' as const }
  if (r > 0) return { text: `남은 포인트 ${r}`, tone: 'ok' as const }
  if (r === 0) return { text: '목표 레벨에 딱 맞습니다', tone: 'ok' as const }
  return { text: `목표보다 ${-r} 레벨 높습니다`, tone: 'over' as const }
})

/** 지금 능력치를 가장 낮은 레벨로 만들 수 있는 태생 */
const ranking = computed(() => rankClasses(stats.attributes))
const best = computed(() => ranking.value[0]!)
const bestSaves = computed(() => stats.runeLevel - best.value.level)
/** 지금 태생도 같은 레벨로 만들 수 있으면 바꾸라고 하지 않는다 */
const currentIsBest = computed(() => current.value !== null && levelNeeded(stats.attributes, current.value) <= best.value.level)

function chooseClass(key: StartingClassKey | '') {
  stats.setStartingClass(key === '' ? null : key)
}
</script>

<template>
  <section class="sc" aria-label="태생과 목표 레벨" data-testid="starting-class-panel">
    <div class="sc__row">
      <label class="sc__field">
        <span class="sc__label">태생</span>
        <select
          :value="stats.startingClassKey ?? ''"
          data-testid="class-select"
          @change="chooseClass(($event.target as HTMLSelectElement).value as StartingClassKey | '')"
        >
          <option value="">고르지 않음 (능력치 1부터)</option>
          <option v-for="c in STARTING_CLASSES" :key="c.key" :value="c.key">
            {{ nameLanguage === 'en' ? c.en : `${c.ko} (${c.en})` }} · Lv {{ c.level }}
          </option>
        </select>
      </label>
      <template v-if="current">
        <button type="button" class="btn" data-testid="class-reset" @click="stats.resetToClass()">태생 기본값으로</button>
        <span class="sc__hint">능력치는 태생 값 아래로 내릴 수 없습니다.</span>
      </template>
      <span v-else class="sc__hint">태생을 고르면 그 태생의 능력치가 하한이 됩니다 (게임과 같이).</span>
    </div>

    <table v-if="current" class="sc__table" data-testid="class-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th v-for="k in ATTRIBUTE_KEYS" :key="k" scope="col">{{ ATTRIBUTE_LABELS[k] }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">태생 {{ startingClassName(current) }}</th>
          <td v-for="k in ATTRIBUTE_KEYS" :key="k">{{ stats.classFloor[k] }}</td>
        </tr>
        <tr class="sc__invested">
          <th scope="row">투자</th>
          <td v-for="k in ATTRIBUTE_KEYS" :key="k" :class="{ 'is-zero': stats.investedAttributes[k] === 0 }">
            {{ stats.investedAttributes[k] > 0 ? `+${stats.investedAttributes[k]}` : '–' }}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="sc__row">
      <span class="sc__label">목표 레벨</span>
      <div class="sc__segment" role="group" aria-label="목표 레벨">
        <button
          type="button"
          :class="{ 'is-active': stats.targetLevel === null }"
          :aria-pressed="stats.targetLevel === null"
          data-testid="target-off"
          @click="stats.setTargetLevel(null)"
        >
          끄기
        </button>
        <button
          v-for="lv in TARGET_LEVEL_PRESETS"
          :key="lv"
          type="button"
          :class="{ 'is-active': stats.targetLevel === lv }"
          :aria-pressed="stats.targetLevel === lv"
          :data-testid="`target-${lv}`"
          @click="stats.setTargetLevel(lv)"
        >
          {{ lv }}
        </button>
      </div>
      <label class="sc__field">
        <span class="sc__hint">직접</span>
        <input
          type="number"
          class="sc__number"
          :class="{ 'is-active': stats.targetLevel !== null && !isPreset }"
          min="1"
          max="713"
          :value="stats.targetLevel !== null && !isPreset ? stats.targetLevel : customLevel"
          aria-label="목표 레벨 직접 입력"
          data-testid="target-custom"
          @change="onCustomChange"
        />
      </label>
    </div>

    <div v-if="stats.targetLevel !== null" class="sc__meter-wrap">
      <div
        class="sc__meter"
        role="meter"
        :aria-valuenow="stats.runeLevel"
        aria-valuemin="1"
        :aria-valuemax="stats.targetLevel"
        :aria-label="`레벨 ${stats.runeLevel} / 목표 ${stats.targetLevel}`"
      >
        <div class="sc__meter-fill" :class="`is-${status.tone}`" :style="{ width: `${progress}%` }" />
      </div>
      <p class="sc__status" data-testid="target-status">
        레벨 <b>{{ stats.runeLevel }}</b> / {{ stats.targetLevel }} ·
        <span :class="`is-${status.tone}`">{{ status.text }}</span>
      </p>
    </div>

    <p class="sc__advice" data-testid="class-advice">
      <template v-if="currentIsBest">
        지금 능력치에는 <b>{{ startingClassName(current!) }}</b>이(가) 가장 낮은 레벨로 만들 수 있는 태생입니다.
      </template>
      <template v-else>
        이 능력치는 <b>{{ startingClassName(best.cls) }}</b
        ><template v-if="nameLanguage === 'ko'">({{ best.cls.en }})</template>로 시작하면 레벨 <b>{{ best.level }}</b>에 만들 수 있습니다<template
          v-if="bestSaves > 0"
        >
          ({{ bestSaves }} 레벨 절약)</template
        >.
        <button type="button" class="sc__link" data-testid="class-advice-apply" @click="chooseClass(best.cls.key)">
          {{ startingClassName(best.cls) }}로 바꾸기
        </button>
      </template>
    </p>
  </section>
</template>

<style scoped>
.sc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.sc__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.sc__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.sc__label {
  font-size: 13px;
  font-weight: 600;
}
.sc__hint {
  font-size: 12px;
  color: var(--text-faint);
}
.sc__field select,
.sc__number {
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.sc__number {
  width: 72px;
}
.sc__number.is-active {
  border-color: var(--accent);
}
.sc__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.sc__segment button {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.sc__segment button + button {
  border-left: 1px solid var(--border);
}
.sc__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.sc__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.sc__table th,
.sc__table td {
  padding: 5px 6px;
  text-align: center;
  border-bottom: 1px solid var(--border);
}
.sc__table thead th {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.sc__table tbody th {
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}
.sc__invested td {
  font-weight: 600;
}
.sc__invested td.is-zero {
  font-weight: 400;
  color: var(--text-faint);
}
.sc__meter-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sc__meter {
  height: 8px;
  background: var(--muted-surface);
  border-radius: 999px;
  overflow: hidden;
}
.sc__meter-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
}
.sc__meter-fill.is-over {
  background: var(--danger);
}
.sc__status {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.sc__status b {
  color: var(--text);
}
.is-over {
  color: var(--danger);
  font-weight: 600;
}
.sc__advice {
  margin: 0;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--muted-surface);
  border-radius: var(--radius);
}
.sc__advice b {
  color: var(--text);
}
.sc__link {
  margin-left: 6px;
  padding: 0;
  font-size: 13px;
  color: var(--text);
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
}
</style>
