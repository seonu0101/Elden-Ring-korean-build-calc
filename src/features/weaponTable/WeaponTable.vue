<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { WEAPONS } from '@/data/items'
import { itemName, nameLanguage, weaponTypeName } from '@/data/names'
import {
  AFFINITY_LABELS,
  CONTENT_LABELS,
  DAMAGE_LABELS,
  STAT_LABELS,
  STAT_SHORT_LABELS,
  scalingGrade,
  scalingValue,
} from '@/data/labels'
import { storeToRefs } from 'pinia'
import { partTotal } from '@/data/attackPower'
import type { ValuePart } from '@/data/attackPower'
import { MAX_REGULAR_LEVEL, MAX_SOMBER_LEVEL } from '@/data/upgrade'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { AFFINITIES, DAMAGE_TYPES, STAT_KEYS } from '@/types'
import type { AffinityName, WeaponItem } from '@/types'
import {
  SORT_OPTIONS,
  buildRows,
  countWithAffinity,
  defaultDirection,
  filterWeapons,
  rowsToCsv,
  sortRows,
  rowAttackTotal,
  selectedAffinities,
  statusText,
  toggleAffinity,
  weaponTypes,
} from './weaponTable'
import type { AffinityMode, ContentFilter, SortDirection, SortKey } from './weaponTable'

/** 한 번에 그리는 행 수. 모든 변질을 펼치면 3천 행이 넘어서 나눠서 보여준다. */
const PAGE_SIZE = 300

const store = useCharacterStore()

const query = ref('')
const weaponType = ref<string | null>(null)
const content = ref<ContentFilter>('all')
const sortKey = ref<SortKey>('name')
const sortDirection = ref<SortDirection>('asc')
/** 보정 열 표시 방식: 등급과 수치 함께 / 등급만 / 수치만 */
const scalingMode = ref<'both' | 'grade' | 'value'>('both')
/**
 * 변질(인퓨전). 변질 버튼은 여러 개를 함께 고를 수 있다.
 * 'all'(모든 변질 한번에 보기)은 다른 버튼과 함께 고를 수 없고, 누르면 다른 선택이 풀린다.
 */
const affinity = ref<AffinityMode>(['Standard'])
const visibleCount = ref(PAGE_SIZE)

/**
 * 능력치·한손/양손·강화 단계는 스탯 화면과 같은 설정을 쓴다.
 * 여기서 강화를 바꾸면 스탯 화면에도, 스탯 화면에서 바꾸면 여기에도 반영된다.
 */
const statsStore = useStatsStore()
const { upgradeRegular, upgradeSomber, upgradeLinked, twoHanded } = storeToRefs(statsStore)
const { setRegular, setSomber } = statsStore

/** 내 능력치로 공격력·상태이상을 계산할지. 끄면 무기 자체 수치(능력 보정 전)를 보여준다. */
const APPLY_STATS_KEY = 'er-planner/weapon-table/apply-stats'
const applyStats = ref(loadApplyStats())
function loadApplyStats() {
  try {
    return localStorage.getItem(APPLY_STATS_KEY) !== 'false'
  } catch {
    return true
  }
}
watch(applyStats, (v) => {
  try {
    localStorage.setItem(APPLY_STATS_KEY, String(v))
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
})

const upgradeLabel = computed(() =>
  upgradeRegular.value === 0 && upgradeSomber.value === 0 ? '+0' : `+${upgradeRegular.value} / 특수 +${upgradeSomber.value}`,
)
/** 공격력 칸 툴팁: "기본 115 + 보정 63" */
function attackTooltip(part: ValuePart) {
  const base = Math.floor(part.base)
  const bonus = partTotal(part) - base
  return `기본 ${base} ${bonus < 0 ? '−' : '+'} 보정 ${Math.abs(bonus)}`
}

const statsLabel = computed(() =>
  STAT_KEYS.map((s) => `${STAT_SHORT_LABELS[s]} ${statsStore.combatStats[s]}`).join(' · '),
)

/** 무기군 목록: 화면에 보이는 이름 순서 */
const types = computed(() =>
  weaponTypes(WEAPONS).sort((a, b) => weaponTypeName(a).localeCompare(weaponTypeName(b), nameLanguage.value)),
)
const affinityCounts = Object.fromEntries(AFFINITIES.map((a) => [a, countWithAffinity(WEAPONS, a)])) as Record<
  AffinityName,
  number
>
const sortGroups = [...new Set(SORT_OPTIONS.map((o) => o.group))].map((group) => ({
  group,
  options: SORT_OPTIONS.filter((o) => o.group === group),
}))

const showAll = computed(() => affinity.value === 'all')
/** 고른 변질 목록 ('all'이면 빈 배열) */
const chosen = computed(() => selectedAffinities(affinity.value) ?? [])
/** 한 무기가 여러 행으로 펼쳐지는지 (모든 변질, 또는 변질을 여러 개 골랐을 때). 변질 열을 보여준다 */
const expanded = computed(() => showAll.value || chosen.value.length > 1)
/** 하나만 고른 변질 (여러 개거나 'all'이면 null) */
const single = computed(() => (chosen.value.length === 1 ? chosen.value[0]! : null))

function isAffinityActive(a: AffinityName) {
  return chosen.value.includes(a)
}

function onAffinityClick(a: AffinityName) {
  affinity.value = toggleAffinity(affinity.value, a)
}

const filteredWeapons = computed(() =>
  filterWeapons(WEAPONS, {
    query: query.value,
    weaponType: weaponType.value,
    content: content.value,
    affinity: affinity.value,
  }),
)

/** 정렬까지 끝난 행. 같은 무기가 이어지면 continued로 표시해서 이름을 흐리게 한다. */
const rows = computed(() => {
  const upgrade = { regular: upgradeRegular.value, somber: upgradeSomber.value }
  const character = applyStats.value ? { stats: statsStore.combatStats, twoHanded: twoHanded.value } : null
  const sorted = sortRows(
    buildRows(filteredWeapons.value, affinity.value, upgrade, character),
    sortKey.value,
    sortDirection.value,
  )
  return sorted.map((row, i) => ({ ...row, continued: i > 0 && sorted[i - 1]!.w.id === row.w.id }))
})
const visibleRows = computed(() => rows.value.slice(0, visibleCount.value))

// 조건이 바뀌면 다시 처음 300행부터
watch([query, weaponType, content, affinity, sortKey, sortDirection], () => {
  visibleCount.value = PAGE_SIZE
})

/** 헤더를 누르면 그 열로 정렬한다. 같은 열을 다시 누르면 방향을 바꾼다. */
function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = defaultDirection(key)
  }
}

/** 정렬 드롭다운에서 고르면 그 열의 기본 방향으로 */
function onSortSelect(key: SortKey) {
  sortKey.value = key
  sortDirection.value = defaultDirection(key)
}

function ariaSort(key: SortKey) {
  if (sortKey.value !== key) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function arrow(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

const ownedCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const slot of store.weapons) counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + 1)
  return counts
})

function addToInventory(w: WeaponItem) {
  store.addItem(w.id)
}

function downloadCsv() {
  const blob = new Blob([rowsToCsv(rows.value)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const name = showAll.value ? 'all' : chosen.value.join('-')
  a.download = `weapons-${name.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function resetFilters() {
  query.value = ''
  weaponType.value = null
  content.value = 'all'
  affinity.value = ['Standard']
  sortKey.value = 'name'
  sortDirection.value = 'asc'
}

const affinityTitle = computed(() =>
  showAll.value ? '모든 변질' : chosen.value.map((a) => AFFINITY_LABELS[a]).join('·'),
)
const columnCount = computed(() => 4 + (expanded.value ? 1 : 0) + STAT_KEYS.length * 2 + DAMAGE_TYPES.length * 2 + 3)
</script>

<template>
  <section class="wt" aria-label="무기 표">
    <header class="wt__header">
      <h2 class="wt__title">무기</h2>
      <span class="wt__count" data-testid="row-count">
        <template v-if="expanded">무기 {{ filteredWeapons.length }}개 · {{ rows.length }}행</template>
        <template v-else>{{ rows.length }} / {{ WEAPONS.length }}</template>
      </span>
    </header>

    <div class="wt__filters">
      <input
        v-model="query"
        class="wt__input wt__search"
        type="search"
        placeholder="이름 검색 (한국어·영어)"
        aria-label="이름 검색"
        data-testid="search"
      />
      <select v-model="weaponType" class="wt__input" aria-label="무기군" data-testid="type-filter">
        <option :value="null">모든 무기군</option>
        <option v-for="t in types" :key="t" :value="t">{{ weaponTypeName(t) }}</option>
      </select>
      <div class="wt__segment" role="group" aria-label="구분">
        <button
          v-for="opt in [
            ['all', '전체'],
            ['base', '본편'],
            ['dlc', 'DLC'],
          ] as const"
          :key="opt[0]"
          type="button"
          :class="{ 'is-active': content === opt[0] }"
          :aria-pressed="content === opt[0]"
          @click="content = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
      <div class="wt__segment" role="group" aria-label="보정 표시">
        <button
          v-for="opt in [
            ['both', '등급+수치'],
            ['grade', '등급'],
            ['value', '수치'],
          ] as const"
          :key="opt[0]"
          type="button"
          :class="{ 'is-active': scalingMode === opt[0] }"
          :aria-pressed="scalingMode === opt[0]"
          :data-testid="`scaling-mode-${opt[0]}`"
          @click="scalingMode = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
      <button type="button" class="btn" @click="resetFilters">초기화</button>
      <button type="button" class="btn wt__csv" :disabled="rows.length === 0" @click="downloadCsv">CSV 내보내기</button>
    </div>

    <div class="wt__filters">
      <span class="wt__label">정렬</span>
      <select
        class="wt__input"
        aria-label="정렬 기준"
        data-testid="sort-select"
        :value="sortKey"
        @change="onSortSelect(($event.target as HTMLSelectElement).value as SortKey)"
      >
        <optgroup v-for="g in sortGroups" :key="g.group" :label="g.group">
          <option v-for="o in g.options" :key="o.key" :value="o.key">{{ o.label }}</option>
        </optgroup>
      </select>
      <button
        type="button"
        class="btn wt__direction"
        :aria-label="sortDirection === 'asc' ? '오름차순 (누르면 내림차순)' : '내림차순 (누르면 오름차순)'"
        data-testid="sort-direction"
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
      >
        {{ sortDirection === 'asc' ? '↑ 오름차순' : '↓ 내림차순' }}
      </button>
      <span class="wt__hint">열 제목을 눌러도 정렬됩니다</span>
    </div>

    <div class="wt__filters wt__upgrade" role="group" aria-label="강화">
      <span class="wt__label">강화</span>
      <label class="wt__level">
        <span class="wt__level-name">일반 무기</span>
        <input
          type="range"
          min="0"
          :max="MAX_REGULAR_LEVEL"
          :value="upgradeRegular"
          aria-label="일반 무기 강화 단계"
          data-testid="upgrade-regular"
          @input="setRegular(Number(($event.target as HTMLInputElement).value))"
        />
        <input
          type="number"
          class="wt__input wt__level-number"
          min="0"
          :max="MAX_REGULAR_LEVEL"
          :value="upgradeRegular"
          aria-label="일반 무기 강화 단계 숫자"
          @change="setRegular(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="wt__level">
        <span class="wt__level-name">특수 무기</span>
        <input
          type="range"
          min="0"
          :max="MAX_SOMBER_LEVEL"
          :value="upgradeSomber"
          aria-label="특수 무기 강화 단계"
          data-testid="upgrade-somber"
          @input="setSomber(Number(($event.target as HTMLInputElement).value))"
        />
        <input
          type="number"
          class="wt__input wt__level-number"
          min="0"
          :max="MAX_SOMBER_LEVEL"
          :value="upgradeSomber"
          aria-label="특수 무기 강화 단계 숫자"
          @change="setSomber(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="wt__check">
        <input v-model="upgradeLinked" type="checkbox" />
        연동
      </label>
      <div class="wt__segment" role="group" aria-label="강화 빠른 선택">
        <button type="button" data-testid="upgrade-min" @click="(setRegular(0), setSomber(0))">+0</button>
        <button
          type="button"
          data-testid="upgrade-max"
          @click="(setRegular(MAX_REGULAR_LEVEL), setSomber(MAX_SOMBER_LEVEL))"
        >
          최대 (+25 / +10)
        </button>
      </div>
      <span class="wt__hint">스탯 화면과 같은 설정</span>
    </div>

    <div class="wt__filters wt__mystats" role="group" aria-label="내 스탯">
      <label class="wt__check">
        <input v-model="applyStats" type="checkbox" data-testid="apply-stats" />
        내 스탯 적용
      </label>
      <template v-if="applyStats">
        <span class="wt__stats" data-testid="stats-label">{{ statsLabel }}</span>
        <div class="wt__segment" role="group" aria-label="한손/양손">
          <button
            type="button"
            :class="{ 'is-active': !twoHanded }"
            :aria-pressed="!twoHanded"
            data-testid="one-hand"
            @click="twoHanded = false"
          >
            한손
          </button>
          <button
            type="button"
            :class="{ 'is-active': twoHanded }"
            :aria-pressed="twoHanded"
            data-testid="two-hand"
            @click="twoHanded = true"
          >
            양손
          </button>
        </div>
        <span class="wt__hint">능력치는 스탯 탭에서 바꿀 수 있습니다</span>
      </template>
      <span v-else class="wt__hint">공격력·상태이상이 능력 보정 전 무기 수치로 보입니다</span>
    </div>

    <div class="wt__affinities" role="group" aria-label="변질 (인퓨전)">
      <span class="wt__label">변질</span>
      <button
        v-for="a in AFFINITIES"
        :key="a"
        type="button"
        class="wt__affinity"
        :class="{ 'is-active': isAffinityActive(a) }"
        :aria-pressed="isAffinityActive(a)"
        :title="`${a} · 변질 가능한 무기 ${affinityCounts[a]}개 · 여러 개를 함께 고를 수 있습니다`"
        :data-testid="`affinity-${a}`"
        @click="onAffinityClick(a)"
      >
        {{ AFFINITY_LABELS[a] }}
        <span class="wt__affinity-en">{{ a }}</span>
      </button>
      <button
        type="button"
        class="wt__affinity wt__affinity--all"
        :class="{ 'is-active': showAll }"
        :aria-pressed="showAll"
        title="무기마다 가능한 변질을 모두 펼쳐서 한 번에 보기 (다른 변질 선택은 풀립니다)"
        data-testid="affinity-all"
        @click="affinity = 'all'"
      >
        모든 변질 한번에 보기
      </button>
    </div>
    <p v-if="showAll" class="wt__affinity-note">
      무기마다 가능한 변질을 모두 펼쳐서 보여줍니다. 정렬하면 변질끼리도 비교됩니다 (예: 기량 보정이 가장 높은 무기+변질 조합).
    </p>
    <p v-else-if="expanded" class="wt__affinity-note" data-testid="affinity-multi-note">
      고른 변질 {{ chosen.length }}개({{ affinityTitle }})를 무기마다 펼쳐서 보여줍니다. 변질 버튼을 다시 누르면 빠집니다.
      <template v-if="!chosen.includes('Standard')">전설 무기처럼 변질할 수 없는 무기는 일반에서만 보입니다.</template>
    </p>
    <p v-else-if="single && single !== 'Standard'" class="wt__affinity-note">
      {{ AFFINITY_LABELS[single] }}({{ single }}) 변질이 가능한 무기 {{ affinityCounts[single] }}개만 보여줍니다.
      전설 무기처럼 변질할 수 없는 무기는 일반에서만 보입니다. 다른 변질 버튼을 누르면 함께 볼 수 있습니다.
    </p>

    <div class="wt__scroll">
      <table class="wt__table">
        <thead>
          <tr class="wt__group-row">
            <th :colspan="expanded ? 4 : 3" class="wt__sticky"></th>
            <th :colspan="STAT_KEYS.length" class="wt__group">요구 능력치</th>
            <th :colspan="DAMAGE_TYPES.length + 1" class="wt__group" data-testid="attack-group">
              공격력 · {{ affinityTitle }} {{ upgradeLabel }}{{ applyStats ? ` · 내 스탯${twoHanded ? ' 양손' : ''}` : '' }}
            </th>
            <th :colspan="STAT_KEYS.length" class="wt__group">보정 · {{ affinityTitle }} {{ upgradeLabel }}</th>
            <th class="wt__group">{{ applyStats ? '내 스탯' : '' }}</th>
            <th :colspan="DAMAGE_TYPES.length + 1" class="wt__group">가드 경감률(%) · 강도</th>
            <th></th>
          </tr>
          <tr>
            <th class="wt__sticky wt__name-col" :aria-sort="ariaSort('name')">
              <button type="button" class="wt__sort" @click="sortBy('name')">
                이름<span class="wt__arrow">{{ arrow('name') }}</span>
              </button>
            </th>
            <th v-if="expanded" :aria-sort="ariaSort('affinity')">
              <button type="button" class="wt__sort" @click="sortBy('affinity')">
                변질<span class="wt__arrow">{{ arrow('affinity') }}</span>
              </button>
            </th>
            <th :aria-sort="ariaSort('weaponType')">
              <button type="button" class="wt__sort" data-testid="sort-weaponType" @click="sortBy('weaponType')">
                무기군<span class="wt__arrow">{{ arrow('weaponType') }}</span>
              </button>
            </th>
            <th class="num" :aria-sort="ariaSort('weight')">
              <button type="button" class="wt__sort" @click="sortBy('weight')">
                무게<span class="wt__arrow">{{ arrow('weight') }}</span>
              </button>
            </th>
            <th
              v-for="s in STAT_KEYS"
              :key="`req-${s}`"
              class="num"
              :title="`요구 ${STAT_LABELS[s]}`"
              :aria-sort="ariaSort(`req.${s}`)"
            >
              <button type="button" class="wt__sort" @click="sortBy(`req.${s}`)">
                {{ STAT_SHORT_LABELS[s] }}<span class="wt__arrow">{{ arrow(`req.${s}`) }}</span>
              </button>
            </th>
            <th v-for="d in DAMAGE_TYPES" :key="`dmg-${d}`" class="num" :aria-sort="ariaSort(`dmg.${d}`)">
              <button type="button" class="wt__sort" @click="sortBy(`dmg.${d}`)">
                {{ DAMAGE_LABELS[d] }}<span class="wt__arrow">{{ arrow(`dmg.${d}`) }}</span>
              </button>
            </th>
            <th class="num" :aria-sort="ariaSort('attack')">
              <button type="button" class="wt__sort" @click="sortBy('attack')">
                합계<span class="wt__arrow">{{ arrow('attack') }}</span>
              </button>
            </th>
            <th
              v-for="s in STAT_KEYS"
              :key="`scl-${s}`"
              class="ctr"
              :title="`${STAT_LABELS[s]} 보정`"
              :aria-sort="ariaSort(`scl.${s}`)"
            >
              <button type="button" class="wt__sort" :data-testid="`sort-scl-${s}`" @click="sortBy(`scl.${s}`)">
                {{ STAT_SHORT_LABELS[s] }}<span class="wt__arrow">{{ arrow(`scl.${s}`) }}</span>
              </button>
            </th>
            <th :aria-sort="ariaSort('status')">
              <button type="button" class="wt__sort" @click="sortBy('status')">
                상태이상<span class="wt__arrow">{{ arrow('status') }}</span>
              </button>
            </th>
            <th
              v-for="d in DAMAGE_TYPES"
              :key="`gnd-${d}`"
              class="num"
              :title="`가드 시 ${DAMAGE_LABELS[d]} 피해 경감률(%)`"
              :aria-sort="ariaSort(`gnd.${d}`)"
            >
              <button type="button" class="wt__sort" :data-testid="`sort-gnd-${d}`" @click="sortBy(`gnd.${d}`)">
                {{ DAMAGE_LABELS[d] }}<span class="wt__arrow">{{ arrow(`gnd.${d}`) }}</span>
              </button>
            </th>
            <th class="num" title="가드 강도" :aria-sort="ariaSort('boost')">
              <button type="button" class="wt__sort" data-testid="sort-boost" @click="sortBy('boost')">
                강도<span class="wt__arrow">{{ arrow('boost') }}</span>
              </button>
            </th>
            <th class="ctr">보유</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ w, affinity: a, level, st, attack, continued } in visibleRows"
            :key="`${w.id}:${a}`"
            :class="{ 'is-continued': continued }"
            data-testid="weapon-row"
          >
            <th scope="row" class="wt__sticky wt__name-col">
              {{ itemName(w) }}
              <span class="wt__level-tag" data-testid="level-tag">+{{ level }}</span>
              <span v-if="w.content !== 0" class="wt__tag">{{ CONTENT_LABELS[w.content] }}</span>
            </th>
            <td v-if="expanded" class="nowrap" data-testid="affinity-cell">{{ AFFINITY_LABELS[a] }}</td>
            <td class="muted">{{ weaponTypeName(w.weaponType) }}</td>
            <td class="num">{{ w.weight.toFixed(1) }}</td>
            <td
              v-for="s in STAT_KEYS"
              :key="`req-${s}`"
              class="num"
              :class="{ faint: !w.requirements[s], 'wt__unmet': attack?.unmet.includes(s) }"
              :title="attack?.unmet.includes(s) ? `${STAT_LABELS[s]} 부족 (지금 ${attack.stats[s]})` : undefined"
              data-testid="req-cell"
            >
              {{ w.requirements[s] ?? '–' }}
            </td>
            <td
              v-for="d in DAMAGE_TYPES"
              :key="`dmg-${d}`"
              class="num"
              :class="{ faint: !st.damage[d] }"
              :title="attack && st.damage[d] ? attackTooltip(attack.damage[d]) : undefined"
              data-testid="damage-cell"
            >
              {{ st.damage[d] ?? '–' }}
            </td>
            <td class="num strong" data-testid="attack-total">{{ rowAttackTotal({ st, attack }) }}</td>
            <td
              v-for="s in STAT_KEYS"
              :key="`scl-${s}`"
              class="ctr wt__scaling"
              :class="{ faint: !st.scaling[s] }"
              :title="st.scaling[s] ? `${STAT_LABELS[s]} 보정 ${scalingValue(st.scaling[s])} (${scalingGrade(st.scaling[s])})` : undefined"
              data-testid="scaling-cell"
            >
              <template v-if="!st.scaling[s]">–</template>
              <template v-else-if="scalingMode === 'grade'">{{ scalingGrade(st.scaling[s]) }}</template>
              <template v-else-if="scalingMode === 'value'">{{ scalingValue(st.scaling[s]) }}</template>
              <template v-else>
                <span class="wt__grade">{{ scalingGrade(st.scaling[s]) }}</span>
                <span class="wt__value">{{ scalingValue(st.scaling[s]) }}</span>
              </template>
            </td>
            <td class="muted nowrap">{{ statusText(st) || '–' }}</td>
            <td
              v-for="d in DAMAGE_TYPES"
              :key="`gnd-${d}`"
              class="num"
              :class="{ faint: !st.guard[d], 'wt__guard-full': st.guard[d] === 100 }"
              data-testid="guard-cell"
            >
              {{ st.guard[d] ?? 0 }}
            </td>
            <td class="num">{{ st.guard.boost }}</td>
            <td class="ctr nowrap">
              <template v-if="!continued">
                <span v-if="ownedCounts.get(w.id)" class="wt__owned">{{ ownedCounts.get(w.id) }}</span>
                <button
                  type="button"
                  class="wt__add"
                  :aria-label="`${itemName(w)} 인벤토리에 추가`"
                  title="인벤토리에 추가"
                  data-testid="add-weapon"
                  @click="addToInventory(w)"
                >
                  +
                </button>
              </template>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columnCount" class="wt__empty">조건에 맞는 무기가 없습니다</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="rows.length > visibleRows.length" class="wt__more">
      <span>{{ rows.length }}행 중 {{ visibleRows.length }}행 표시</span>
      <button type="button" class="btn" data-testid="show-more" @click="visibleCount += PAGE_SIZE">
        {{ Math.min(PAGE_SIZE, rows.length - visibleRows.length) }}행 더 보기
      </button>
      <button type="button" class="btn" @click="visibleCount = rows.length">모두 보기</button>
    </div>

    <p class="wt__note">
      강화는 일반 무기(단석, 최대 +25)와 특수 무기(색 잃은 단석, 최대 +10)를 따로 정하며, 이름 옆에 적용된
      단계가 보입니다. 공격력·가드 강도는 소수점을 버립니다. 보정 수치는 보정 계수 × 100이며, 등급은 S 175+ · A 140+ · B 90+ · C 60+ · D 25+ · E 1+
      입니다. 가드 경감률은 가드했을 때 막아 주는 피해 비율(%)이고, 100이면 그 피해를 완전히 막습니다.
    </p>
  </section>
</template>

<style scoped>
.wt {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wt__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.wt__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.wt__count {
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.wt__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.wt__label {
  margin-right: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.wt__hint {
  font-size: 12px;
  color: var(--text-faint);
}
.wt__input {
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.wt__input:focus {
  outline: none;
  border-color: var(--border-strong);
}
.wt__search {
  width: 200px;
}
.wt__direction {
  height: 30px;
}
.wt__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.wt__segment button {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.wt__segment button + button {
  border-left: 1px solid var(--border);
}
.wt__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.wt__level {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.wt__level input[type='range'] {
  width: 140px;
  accent-color: var(--accent);
}
.wt__level-number {
  width: 56px;
  padding: 0 6px;
}
.wt__check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.wt__stats {
  font-size: 12px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.wt__unmet {
  color: var(--danger) !important;
  font-weight: 600;
}
.wt__level-tag {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}
.wt__affinities {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.wt__affinity {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}
.wt__affinity:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.wt__affinity.is-active {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--accent);
}
.wt__affinity--all {
  margin-left: 6px;
  border-style: dashed;
}
.wt__affinity--all.is-active {
  border-style: solid;
}
.wt__affinity-en {
  font-size: 10px;
  opacity: 0.6;
}
.wt__affinity-note {
  margin: -8px 0 0;
  font-size: 12px;
  color: var(--text-faint);
}
.wt__csv {
  margin-left: auto;
}
.wt__csv:disabled {
  opacity: 0.4;
  cursor: default;
}
.wt__scroll {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.wt__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.wt__table th,
.wt__table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.wt__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--muted-surface);
  font-weight: 500;
  color: var(--text-muted);
}
.wt__table thead tr:nth-child(2) th {
  top: 27px;
}
.wt__sort {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.wt__sort:hover {
  color: var(--text);
}
.wt__arrow {
  font-size: 10px;
  opacity: 0.35;
}
.wt__table thead th[aria-sort='ascending'],
.wt__table thead th[aria-sort='descending'] {
  color: var(--text);
}
.wt__table thead th[aria-sort='ascending'] .wt__arrow,
.wt__table thead th[aria-sort='descending'] .wt__arrow,
.wt__sort:hover .wt__arrow {
  opacity: 1;
}
.wt__group-row th {
  font-size: 11px;
  border-bottom: none;
}
.wt__group {
  text-align: center !important;
  border-left: 1px solid var(--border);
}
.wt__sticky {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--bg);
}
.wt__table thead .wt__sticky {
  z-index: 3;
  background: var(--muted-surface);
}
.wt__name-col {
  min-width: 180px;
  font-weight: 500;
  border-right: 1px solid var(--border);
}
.wt__table tbody tr:hover td,
.wt__table tbody tr:hover th {
  background: var(--muted-surface);
}
/* 모든 변질 보기에서 같은 무기의 두 번째 행부터는 이름을 흐리게 */
.wt__table tbody tr.is-continued th {
  color: var(--text-faint);
  font-weight: 400;
}
.wt__table tbody tr.is-continued .wt__tag {
  display: none;
}
.wt__tag {
  margin-left: 4px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
}
.num {
  text-align: right !important;
}
.ctr {
  text-align: center !important;
}
.muted {
  color: var(--text-muted);
}
.faint {
  color: var(--text-faint);
}
.strong {
  font-weight: 600;
}
.nowrap {
  white-space: nowrap;
}
.wt__scaling {
  min-width: 44px;
}
.wt__grade {
  font-weight: 600;
}
.wt__value {
  margin-left: 3px;
  font-size: 11px;
  color: var(--text-muted);
}
.wt__guard-full {
  font-weight: 600;
}
.wt__owned {
  display: inline-block;
  min-width: 16px;
  margin-right: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
.wt__add {
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
}
.wt__add:hover {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--accent);
}
.wt__empty {
  padding: 32px !important;
  text-align: center !important;
  color: var(--text-muted);
}
.wt__more {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.wt__note {
  margin: 0;
  font-size: 12px;
  color: var(--text-faint);
}
/* 모바일: 고정된 이름 칸을 좁히고 긴 이름은 줄바꿈 (PC는 그대로) */
@media (max-width: 720px) {
  .wt__name-col {
    min-width: 0;
    width: 120px;
    max-width: 120px;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  .wt__search {
    width: 100%;
  }
  .wt__level input[type='range'] {
    width: 100px;
  }
  .wt__scroll {
    max-height: 65vh;
  }
}
</style>
