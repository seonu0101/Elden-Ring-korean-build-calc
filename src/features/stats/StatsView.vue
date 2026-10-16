<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_STAT, calculateAttack } from '@/data/attackPower'
import { WEAPONS } from '@/data/items'
import { MAX_REGULAR_LEVEL, MAX_SOMBER_LEVEL, levelFor } from '@/data/upgrade'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useCharacterStore } from '@/stores/character'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, useStatsStore } from '@/stores/stats'
import type { AffinityName, WeaponItem } from '@/types'
import WeaponAttackCard from './WeaponAttackCard.vue'

const stats = useStatsStore()
const character = useCharacterStore()

/** 무기 장착 칸 (오른손 1~3, 왼손 1~3) */
const WEAPON_CELLS = EQUIPMENT_GRID.flat().filter((cell) => cell.target.kind === 'weapon')

/** 그 무기에서 쓸 수 있는 변질만 (장착 무기가 바뀌어 고른 변질이 없으면 일반) */
function usableAffinity(w: WeaponItem, wanted: AffinityName): AffinityName {
  return weaponStats(w, wanted) ? wanted : 'Standard'
}

function compute(w: WeaponItem, affinity: AffinityName) {
  const raw = weaponStats(w, affinity)
  if (!raw) return null
  return calculateAttack(w, affinity, levelFor(raw, stats.upgrade), stats.combatStats, stats.twoHanded)
}

const equippedCards = computed(() =>
  WEAPON_CELLS.flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slotIndex = cell.target.equipIndex
    const slot = character.equippedIn(cell.target)
    const item = slot ? character.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const affinity = usableAffinity(item, stats.affinityFor(slotIndex))
    const result = compute(item, affinity)
    return result ? [{ key: cell.label, slotIndex, title: cell.title, weapon: item, affinity, result }] : []
  }),
)

// 장착하지 않은 무기도 골라서 계산해 볼 수 있다.
const pickQuery = ref('')
const pickedWeapon = computed(() => WEAPONS.find((w) => w.name.toLowerCase() === pickQuery.value.trim().toLowerCase()) ?? null)
const pickedAffinity = ref<AffinityName>('Standard')
const pickedCard = computed(() => {
  const w = pickedWeapon.value
  if (!w) return null
  const affinity = usableAffinity(w, pickedAffinity.value)
  const result = compute(w, affinity)
  return result ? { weapon: w, affinity, result } : null
})

function numberFrom(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="sv">
    <section class="sv__panel" aria-label="능력치">
      <header class="sv__header">
        <h2 class="sv__title">능력치</h2>
        <span class="sv__level" data-testid="rune-level">레벨 {{ stats.runeLevel }}</span>
      </header>

      <div class="sv__stats">
        <label v-for="key in ATTRIBUTE_KEYS" :key="key" class="sv__stat">
          <span class="sv__stat-name">{{ ATTRIBUTE_LABELS[key] }}</span>
          <input
            type="range"
            min="1"
            :max="MAX_STAT"
            :value="stats.attributes[key]"
            :aria-label="`${ATTRIBUTE_LABELS[key]} 슬라이더`"
            @input="stats.setAttribute(key, numberFrom($event))"
          />
          <input
            type="number"
            class="sv__input"
            min="1"
            :max="MAX_STAT"
            :value="stats.attributes[key]"
            :aria-label="ATTRIBUTE_LABELS[key]"
            :data-testid="`stat-${key}`"
            @change="stats.setAttribute(key, numberFrom($event))"
          />
          <span
            class="sv__final"
            :class="{ 'is-boosted': stats.bonusAttributes[key] }"
            :title="stats.bonusAttributes[key] ? '탈리스만·버프 포함 최종 능력치' : undefined"
            :data-testid="`final-${key}`"
          >
            <template v-if="stats.bonusAttributes[key]">
              {{ stats.bonusAttributes[key] > 0 ? '+' : '−' }}{{ Math.abs(stats.bonusAttributes[key]) }} →
              {{ stats.finalAttributes[key] }}
            </template>
          </span>
        </label>
      </div>
      <p v-if="Object.values(stats.bonusAttributes).some((v) => v)" class="sv__bonus-note" data-testid="bonus-note">
        → 뒤의 값은 장착한 탈리스만과 장비 화면에서 켠 버프를 더한 최종 능력치입니다(최대 99). 공격력·축적치·방어력·요구
        능력치는 이 값으로 계산합니다.
      </p>

      <div class="sv__group">
        <span class="sv__label">잡기</span>
        <div class="sv__segment" role="group" aria-label="한손 / 양손">
          <button
            type="button"
            :class="{ 'is-active': !stats.twoHanded }"
            :aria-pressed="!stats.twoHanded"
            @click="stats.twoHanded = false"
          >
            한손
          </button>
          <button
            type="button"
            :class="{ 'is-active': stats.twoHanded }"
            :aria-pressed="stats.twoHanded"
            data-testid="two-handed"
            @click="stats.twoHanded = true"
          >
            양손 (근력 ×1.5)
          </button>
        </div>
      </div>

      <div class="sv__group">
        <span class="sv__label">강화</span>
        <label class="sv__upgrade">
          일반
          <input
            type="number"
            class="sv__input"
            min="0"
            :max="MAX_REGULAR_LEVEL"
            :value="stats.upgradeRegular"
            aria-label="일반 무기 강화 단계"
            data-testid="stats-upgrade-regular"
            @change="stats.setRegular(numberFrom($event))"
          />
        </label>
        <label class="sv__upgrade">
          특수
          <input
            type="number"
            class="sv__input"
            min="0"
            :max="MAX_SOMBER_LEVEL"
            :value="stats.upgradeSomber"
            aria-label="특수 무기 강화 단계"
            data-testid="stats-upgrade-somber"
            @change="stats.setSomber(numberFrom($event))"
          />
        </label>
        <label class="sv__upgrade">
          <input v-model="stats.upgradeLinked" type="checkbox" />
          연동
        </label>
      </div>

      <button type="button" class="btn" @click="stats.resetAttributes()">능력치 초기화</button>
    </section>

    <section class="sv__results" aria-label="공격력">
      <header class="sv__header">
        <h2 class="sv__title">장착 무기 공격력</h2>
      </header>

      <div v-if="equippedCards.length" class="sv__cards">
        <WeaponAttackCard
          v-for="card in equippedCards"
          :key="card.key"
          :slot-title="card.title"
          :weapon="card.weapon"
          :affinity="card.affinity"
          :result="card.result"
          @update:affinity="stats.setAffinity(card.slotIndex, $event)"
        />
      </div>
      <p v-else class="sv__empty">장착한 무기가 없습니다. 장비 화면에서 무기를 장착하거나 아래에서 직접 골라 보세요.</p>

      <header class="sv__header sv__header--sub">
        <h3 class="sv__subtitle">다른 무기로 계산</h3>
      </header>
      <div class="sv__picker">
        <input
          v-model="pickQuery"
          class="sv__input sv__search"
          list="sv-weapon-names"
          placeholder="무기 이름 (예: Uchigatana)"
          aria-label="계산할 무기"
          data-testid="pick-weapon"
        />
        <datalist id="sv-weapon-names">
          <option v-for="w in WEAPONS" :key="w.id" :value="w.name" />
        </datalist>
      </div>
      <div v-if="pickedCard" class="sv__cards">
        <WeaponAttackCard
          :weapon="pickedCard.weapon"
          :affinity="pickedCard.affinity"
          :result="pickedCard.result"
          @update:affinity="pickedAffinity = $event"
        />
      </div>
      <p v-else-if="pickQuery.trim()" class="sv__empty">일치하는 무기가 없습니다. 목록에서 골라 주세요.</p>

      <p class="sv__note">
        요구 능력치가 모자란 속성은 공격력이 40% 줄고, 출혈·독·수면·발광
        축적치는 신비로만 오릅니다. 버프·탈리스만·적 방어력은 아직 반영하지 않습니다.
      </p>
    </section>
  </div>
</template>

<style scoped>
.sv {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
@media (max-width: 760px) {
  .sv {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
.sv__panel,
.sv__results {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sv__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.sv__header--sub {
  margin-top: 8px;
}
.sv__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.sv__subtitle {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.sv__level {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.sv__stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sv__stat {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 56px 64px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.sv__stat-name {
  color: var(--text-muted);
}
.sv__final {
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.sv__final.is-boosted {
  color: var(--text);
  font-weight: 600;
}
.sv__bonus-note {
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
}
.sv__stat input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}
.sv__input {
  height: 28px;
  padding: 0 6px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.sv__stat .sv__input,
.sv__upgrade .sv__input {
  width: 56px;
}
.sv__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sv__label {
  width: 52px;
  font-size: 12px;
  color: var(--text-muted);
}
.sv__upgrade {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.sv__segment {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.sv__segment button {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.sv__segment button + button {
  border-left: 1px solid var(--border);
}
.sv__segment button.is-active {
  color: var(--accent-text);
  background: var(--accent);
}
.sv__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.sv__picker {
  display: flex;
  gap: 8px;
}
.sv__search {
  width: 280px;
  max-width: 100%;
}
.sv__empty,
.sv__note {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.sv__note {
  color: var(--text-faint);
}
</style>
