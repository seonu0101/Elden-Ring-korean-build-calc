<script setup lang="ts">
// 장비 화면: 상대의 방어력·경감률을 넣으면 장착 무기의 실제 피해를 계산한다.
import { computed, reactive, watch } from 'vue'
import { calculateAttack } from '@/data/attackPower'
import { calculateDamage, DAMAGE_CALC_STORAGE_KEY, PHYSICAL_ATTACK_LABELS, PHYSICAL_ATTACK_TYPES } from '@/data/damage'
import type { PhysicalAttackType } from '@/data/damage'
import { characterDefense, damageNegation } from '@/data/defense'
import { DAMAGE_LABELS, NEGATION_LABELS } from '@/data/labels'
import { itemName } from '@/data/names'
import { levelFor } from '@/data/upgrade'
import { EQUIPMENT_GRID } from '@/features/gameMenu/layout'
import { weaponStats } from '@/features/weaponTable/weaponTable'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'
import { useStatsStore } from '@/stores/stats'
import { DAMAGE_TYPES, NEGATION_TYPES } from '@/types'
import type { DamageType, NegationType } from '@/types'
import { num } from '@/features/formulas/formulas'


interface Settings {
  slot: string
  physicalType: PhysicalAttackType
  motionValue: number
  applyBuffs: boolean
  defense: Record<DamageType, number>
  negation: Record<NegationType, number>
}

const DEFAULTS: Settings = {
  slot: 'RH1',
  physicalType: 'Standard',
  motionValue: 100,
  applyBuffs: true,
  defense: Object.fromEntries(DAMAGE_TYPES.map((d) => [d, 100])) as Record<DamageType, number>,
  negation: Object.fromEntries(NEGATION_TYPES.map((t) => [t, 0])) as Record<NegationType, number>,
}

function finite(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function load(): Settings {
  const out: Settings = structuredClone(DEFAULTS)
  try {
    const raw = JSON.parse(localStorage.getItem(DAMAGE_CALC_STORAGE_KEY) ?? '{}') as Partial<Settings>
    if (typeof raw.slot === 'string') out.slot = raw.slot
    if (raw.physicalType && raw.physicalType in PHYSICAL_ATTACK_TYPES) out.physicalType = raw.physicalType
    out.motionValue = finite(raw.motionValue, out.motionValue)
    if (typeof raw.applyBuffs === 'boolean') out.applyBuffs = raw.applyBuffs
    for (const d of DAMAGE_TYPES) out.defense[d] = finite(raw.defense?.[d], out.defense[d])
    for (const t of NEGATION_TYPES) out.negation[t] = finite(raw.negation?.[t], out.negation[t])
  } catch {
    // 저장된 값을 못 읽으면 기본값
  }
  return out
}

const settings = reactive<Settings>(load())
watch(
  settings,
  (v) => {
    try {
      localStorage.setItem(DAMAGE_CALC_STORAGE_KEY, JSON.stringify(v))
    } catch {
      // 저장소를 쓸 수 없으면 기억하지 않는다
    }
  },
  { deep: true },
)

const character = useCharacterStore()
const stats = useStatsStore()
const buffs = useBuffsStore()

/** 장착 무기 (스탯 화면 설정의 변질·강화 적용) */
const weapons = computed(() =>
  EQUIPMENT_GRID.flat().flatMap((cell) => {
    if (cell.target.kind !== 'weapon') return []
    const slot = character.equippedIn(cell.target)
    const item = slot ? character.itemOf(slot) : null
    if (!item || item.kind !== 'weapon') return []
    const chosen = stats.affinityFor(cell.target.equipIndex)
    const affinity = weaponStats(item, chosen) ? chosen : 'Standard'
    const level = levelFor(weaponStats(item, affinity)!, stats.upgrade)
    const attack = calculateAttack(item, affinity, level, stats.combatStats, stats.twoHanded)
    return attack ? [{ label: cell.label, item, attack }] : []
  }),
)

const weapon = computed(() => weapons.value.find((w) => w.label === settings.slot) ?? weapons.value[0] ?? null)

/** 무기가 바뀌면, 그 무기에 없는 공격 종류는 무기의 첫 공격 종류로 */
const weaponAttackTypes = computed(
  () => (weapon.value?.item.attackTypes ?? []).filter((t): t is PhysicalAttackType => t in PHYSICAL_ATTACK_TYPES),
)
watch(
  weaponAttackTypes,
  (types) => {
    if (types.length && !types.includes(settings.physicalType)) settings.physicalType = types[0]!
  },
  { immediate: true },
)

const result = computed(() => {
  const w = weapon.value
  if (!w) return null
  return calculateDamage({
    attack: Object.fromEntries(
      DAMAGE_TYPES.map((d) => [d, w.attack.damage[d].base + w.attack.damage[d].scaling]),
    ) as Record<DamageType, number>,
    attackMultiplier: settings.applyBuffs
      ? Object.fromEntries(DAMAGE_TYPES.map((d) => [d, buffs.summary.attack[d].multiplier]))
      : undefined,
    motionValue: Math.max(0, settings.motionValue),
    defense: settings.defense,
    negation: settings.negation,
    physicalType: settings.physicalType,
  })
})

const hasBuff = computed(() => DAMAGE_TYPES.some((d) => buffs.summary.attack[d].multiplier !== 1))

/** 내 캐릭터의 방어력·경감률을 상대 값으로 넣기 (PvP에서 같은 캐릭터를 때릴 때) */
function fillFromMe() {
  const defense = characterDefense(stats.defenseAttributes)
  const negation = damageNegation(
    character.equippedProtectors,
    Object.fromEntries(NEGATION_TYPES.map((t) => [t, buffs.summary.damageTaken[t].multiplier])),
  )
  for (const d of DAMAGE_TYPES) settings.defense[d] = defense[d]
  for (const t of NEGATION_TYPES) settings.negation[t] = Math.round(negation[t] * 1000) / 1000
}

function resetInputs() {
  Object.assign(settings.defense, DEFAULTS.defense)
  Object.assign(settings.negation, DEFAULTS.negation)
  settings.motionValue = 100
}

function setNumber(target: Record<string, number>, key: string, event: Event) {
  const v = Number((event.target as HTMLInputElement).value)
  target[key] = Number.isFinite(v) ? v : 0
}
</script>

<template>
  <section class="dc" aria-label="실제 데미지" data-testid="damage-calc">
    <header class="dc__header">
      <h2 class="dc__title">실제 데미지</h2>
      <div class="dc__actions">
        <button type="button" class="btn" title="내 캐릭터의 방어력·경감률을 넣기" data-testid="damage-fill-me" @click="fillFromMe">
          내 값 넣기
        </button>
        <button type="button" class="btn" data-testid="damage-reset" @click="resetInputs">초기화</button>
      </div>
    </header>

    <p v-if="!weapons.length" class="dc__empty">장착한 무기가 없습니다</p>
    <template v-else>
      <div class="dc__controls">
        <label class="dc__field">
          <span>무기</span>
          <select v-model="settings.slot" class="dc__input" data-testid="damage-weapon">
            <option v-for="w in weapons" :key="w.label" :value="w.label">{{ w.label }} {{ itemName(w.item) }}</option>
          </select>
        </label>
        <label class="dc__field">
          <span>물리 공격 종류</span>
          <select v-model="settings.physicalType" class="dc__input" data-testid="damage-physical-type">
            <option v-for="(label, t) in PHYSICAL_ATTACK_LABELS" :key="t" :value="t">
              {{ label }}{{ weaponAttackTypes.includes(t) ? '' : ' (이 무기 아님)' }}
            </option>
          </select>
        </label>
        <label class="dc__field">
          <span>모션 값 %</span>
          <input
            type="number"
            class="dc__input dc__num"
            min="0"
            step="1"
            :value="settings.motionValue"
            data-testid="damage-motion"
            @change="settings.motionValue = Math.max(0, Number(($event.target as HTMLInputElement).value) || 0)"
          />
        </label>
        <label class="dc__check">
          <input v-model="settings.applyBuffs" type="checkbox" data-testid="damage-buffs" />
          버프 적용{{ hasBuff ? '' : ' (켠 버프 없음)' }}
        </label>
      </div>

      <div class="dc__inputs">
        <div class="dc__grid" role="group" aria-label="상대 방어력">
          <span class="dc__grid-title">상대 방어력</span>
          <label v-for="d in DAMAGE_TYPES" :key="d" class="dc__cell">
            <span>{{ DAMAGE_LABELS[d] }}</span>
            <input
              type="number"
              class="dc__input dc__num"
              min="0"
              :value="settings.defense[d]"
              :data-testid="`damage-defense-${d}`"
              @change="setNumber(settings.defense, d, $event)"
            />
          </label>
        </div>
        <div class="dc__grid" role="group" aria-label="상대 경감률">
          <span class="dc__grid-title">상대 경감률 %</span>
          <label v-for="t in NEGATION_TYPES" :key="t" class="dc__cell">
            <span>{{ NEGATION_LABELS[t] }}</span>
            <input
              type="number"
              class="dc__input dc__num"
              step="0.1"
              :value="settings.negation[t]"
              :data-testid="`damage-negation-${t}`"
              @change="setNumber(settings.negation, t, $event)"
            />
          </label>
        </div>
      </div>

      <table v-if="result" class="dc__table" data-testid="damage-table">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col" class="num">공격</th>
            <th scope="col" class="num">방어력</th>
            <th scope="col" class="num" title="공격 ÷ 방어력">r</th>
            <th scope="col" class="num" title="방어 배율 f(r)">배율</th>
            <th scope="col" class="num">경감</th>
            <th scope="col" class="num">피해</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="p in result.parts" :key="p.type">
            <tr :data-testid="`damage-row-${p.type}`">
              <th scope="row">
                {{ DAMAGE_LABELS[p.type] }}<span v-if="p.type === 'physical'" class="dc__sub">
                  ({{ PHYSICAL_ATTACK_LABELS[settings.physicalType] }})</span
                >
              </th>
              <td class="num">{{ num(p.attack, 2) }}</td>
              <td class="num">{{ num(p.defense, 2) }}</td>
              <td class="num">{{ Number.isFinite(p.ratio) ? num(p.ratio, 3) : '∞' }}</td>
              <td class="num">{{ num(p.multiplier, 4) }}</td>
              <td class="num">{{ num(p.negation, 3) }}%</td>
              <td class="num dc__dmg">{{ num(p.damage, 2) }}</td>
            </tr>
            <tr class="dc__formula-row">
              <td colspan="7">
                {{ p.step.range }}: f = {{ p.step.expr }} = {{ num(p.multiplier, 4) }} → {{ num(p.attack, 2) }} ×
                {{ num(p.multiplier, 4) }} × (1 − {{ num(p.negation, 3) }}/100) = {{ num(p.damage, 2) }}
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="6">합계 ⌊{{ result.parts.map((p) => num(p.damage, 2)).join(' + ') || '0' }}⌋</th>
            <td class="num dc__total" data-testid="damage-total">{{ result.total }}</td>
          </tr>
        </tfoot>
      </table>
      <p class="dc__note">
        공격 = 공격력 × 모션 값/100{{ settings.applyBuffs ? ' × 버프 배율' : '' }}, r = 공격 ÷ 방어력, 피해 = 공격 × f(r) × (1 − 경감률/100).
        속성마다 계산해서 더합니다. 물리는 고른 공격 종류의 경감률을 씁니다. 반격·약점·속성 상성 등은 넣지 않았습니다.
      </p>
    </template>
  </section>
</template>

<style scoped>
.dc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.dc__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dc__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.dc__actions {
  display: flex;
  gap: 6px;
}
.dc__empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-faint);
}
.dc__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: flex-end;
}
.dc__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted);
  min-width: 0;
}
.dc__input {
  height: 28px;
  padding: 0 6px;
  font: inherit;
  font-size: 12.5px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 0;
  max-width: 100%;
}
.dc__num {
  width: 72px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.dc__check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  font-size: 12px;
  color: var(--text-muted);
}
.dc__inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dc__grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 6px 8px;
}
.dc__grid-title {
  width: 100%;
  font-size: 12px;
  color: var(--text-muted);
}
.dc__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-faint);
}
.dc__cell .dc__num {
  width: 64px;
}
.dc__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.dc__table th,
.dc__table td {
  padding: 4px 4px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-weight: normal;
}
.dc__table thead th {
  font-size: 11px;
  color: var(--text-muted);
}
.dc__table tbody th {
  color: var(--text-muted);
  white-space: nowrap;
}
.dc__table .num {
  text-align: right;
}
.dc__sub {
  font-size: 11px;
  color: var(--text-faint);
}
.dc__dmg {
  font-weight: 600;
}
.dc__formula-row td {
  padding-top: 0;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  color: var(--text-faint);
  overflow-wrap: anywhere;
}
.dc__table tfoot th {
  font-size: 12px;
  color: var(--text-muted);
}
.dc__total {
  font-size: 16px;
  font-weight: 600;
}
.dc__note {
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
