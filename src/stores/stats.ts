import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { MAX_STAT } from '@/data/attackPower'
import {
  MAX_RUNE_LEVEL,
  isStartingClassKey,
  startingClass as classOf,
} from '@/data/startingClasses'
import type { StartingClassKey } from '@/data/startingClasses'
import { MAX_REGULAR_LEVEL, MAX_SOMBER_LEVEL, regularFromSomber, somberFromRegular } from '@/data/upgrade'
import { useBuffsStore } from '@/stores/buffs'
import { AFFINITIES } from '@/types'
import type { AffinityName, CharacterStats } from '@/types'

export const STATS_STORAGE_KEY = 'er-planner/stats/v1'

/** 캐릭터 능력치 8개 (게임 순서) */
export type AttributeKey =
  | 'vigor'
  | 'mind'
  | 'endurance'
  | 'strength'
  | 'dexterity'
  | 'intelligence'
  | 'faith'
  | 'arcane'

export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
  'vigor',
  'mind',
  'endurance',
  'strength',
  'dexterity',
  'intelligence',
  'faith',
  'arcane',
]

export const ATTRIBUTE_LABELS: Readonly<Record<AttributeKey, string>> = {
  vigor: '생명력',
  mind: '정신력',
  endurance: '지구력',
  strength: '근력',
  dexterity: '기량',
  intelligence: '지력',
  faith: '신앙',
  arcane: '신비',
}

export type Attributes = Record<AttributeKey, number>

/** 탈리스만·버프 효과 이름(원본 데이터) → 능력치 */
const EFFECT_ATTRIBUTE_KEYS: Readonly<Record<string, AttributeKey>> = {
  Vigor: 'vigor',
  Mind: 'mind',
  Endurance: 'endurance',
  Strength: 'strength',
  Dexterity: 'dexterity',
  Intelligence: 'intelligence',
  Faith: 'faith',
  Arcane: 'arcane',
}

const DEFAULT_ATTRIBUTES: Attributes = {
  vigor: 40,
  mind: 20,
  endurance: 25,
  strength: 20,
  dexterity: 20,
  intelligence: 10,
  faith: 10,
  arcane: 10,
}

interface StatsSnapshot {
  attributes: Attributes
  twoHanded: boolean
  upgradeRegular: number
  upgradeSomber: number
  upgradeLinked: boolean
  /** 장착 칸(무기 equipIndex)마다 고른 변질 */
  affinityBySlot: Record<string, AffinityName>
  /** 태생 (능력치 하한). null이면 고르지 않음: 능력치 1부터 */
  startingClass: StartingClassKey | null
  /** 목표 룬 레벨 (null이면 끔) */
  targetLevel: number | null
}

export function clampStat(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_STAT, Math.max(1, Math.round(value))) : 1
}

/** 목표 룬 레벨: 1 ~ 713 */
export function clampTargetLevel(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_RUNE_LEVEL, Math.max(1, Math.round(value))) : 125
}

/** 태생 능력치보다 낮은 값은 태생 값으로 올린다 */
export function raiseToFloor(attributes: Attributes, floor: Attributes): Attributes {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Math.max(attributes[k], floor[k])])) as Attributes
}

function clampLevel(value: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0
}

/** 저장된 데이터를 검사해서 쓸 수 있는 값만 꺼낸다. */
export function parseStatsSnapshot(raw: unknown): Partial<StatsSnapshot> {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const out: Partial<StatsSnapshot> = {}
  if (typeof r.attributes === 'object' && r.attributes !== null) {
    const a = r.attributes as Record<string, unknown>
    out.attributes = { ...DEFAULT_ATTRIBUTES }
    for (const key of ATTRIBUTE_KEYS) if (typeof a[key] === 'number') out.attributes[key] = clampStat(a[key])
  }
  if (typeof r.twoHanded === 'boolean') out.twoHanded = r.twoHanded
  if (typeof r.upgradeRegular === 'number') out.upgradeRegular = clampLevel(r.upgradeRegular, MAX_REGULAR_LEVEL)
  if (typeof r.upgradeSomber === 'number') out.upgradeSomber = clampLevel(r.upgradeSomber, MAX_SOMBER_LEVEL)
  if (typeof r.upgradeLinked === 'boolean') out.upgradeLinked = r.upgradeLinked
  if (r.startingClass === null) out.startingClass = null
  else if (isStartingClassKey(r.startingClass)) out.startingClass = r.startingClass
  if (r.targetLevel === null) out.targetLevel = null
  else if (typeof r.targetLevel === 'number') out.targetLevel = clampTargetLevel(r.targetLevel)
  if (typeof r.affinityBySlot === 'object' && r.affinityBySlot !== null) {
    out.affinityBySlot = {}
    for (const [slot, affinity] of Object.entries(r.affinityBySlot)) {
      if (AFFINITIES.includes(affinity as AffinityName)) out.affinityBySlot[slot] = affinity as AffinityName
    }
  }
  return out
}

function loadSnapshot(): Partial<StatsSnapshot> {
  try {
    const text = localStorage.getItem(STATS_STORAGE_KEY)
    return text ? parseStatsSnapshot(JSON.parse(text)) : {}
  } catch {
    return {}
  }
}

/** 스탯 화면의 상태: 능력치, 한손/양손, 강화 단계, 칸별 변질. 공격력 계산에 쓴다. */
export const useStatsStore = defineStore('stats', () => {
  const saved = loadSnapshot()
  const attributes = ref<Attributes>(saved.attributes ?? { ...DEFAULT_ATTRIBUTES })
  const twoHanded = ref(saved.twoHanded ?? false)
  const upgradeRegular = ref(saved.upgradeRegular ?? MAX_REGULAR_LEVEL)
  const upgradeSomber = ref(saved.upgradeSomber ?? MAX_SOMBER_LEVEL)
  const upgradeLinked = ref(saved.upgradeLinked ?? true)
  const affinityBySlot = ref<Record<string, AffinityName>>(saved.affinityBySlot ?? {})
  const startingClassKey = ref<StartingClassKey | null>(saved.startingClass ?? null)
  const targetLevel = ref<number | null>(saved.targetLevel === undefined ? 125 : saved.targetLevel)

  /** 태생 능력치 = 내릴 수 없는 하한 (태생을 고르지 않았으면 모두 1) */
  const classFloor = computed<Attributes>(() =>
    startingClassKey.value === null
      ? (Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 1])) as Attributes)
      : { ...classOf(startingClassKey.value).attributes },
  )
  // 저장된 능력치가 태생보다 낮으면(예전 데이터) 태생 값으로 맞춘다
  attributes.value = raiseToFloor(attributes.value, classFloor.value)

  watch(
    [attributes, twoHanded, upgradeRegular, upgradeSomber, upgradeLinked, affinityBySlot, startingClassKey, targetLevel],
    () => {
      const snapshot: StatsSnapshot = {
        attributes: attributes.value,
        twoHanded: twoHanded.value,
        upgradeRegular: upgradeRegular.value,
        upgradeSomber: upgradeSomber.value,
        upgradeLinked: upgradeLinked.value,
        affinityBySlot: affinityBySlot.value,
        startingClass: startingClassKey.value,
        targetLevel: targetLevel.value,
      }
      try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(snapshot))
      } catch {
        // 저장소를 쓸 수 없으면 저장만 건너뛴다.
      }
    },
    { deep: true },
  )

  /** 룬 레벨: 능력치 합 − 79 (게임 공식) */
  const runeLevel = computed(() => ATTRIBUTE_KEYS.reduce((sum, k) => sum + attributes.value[k], 0) - 79)

  /** 목표 레벨까지 남은 포인트 (음수면 초과, 목표가 없으면 null) */
  const remainingPoints = computed(() => (targetLevel.value === null ? null : targetLevel.value - runeLevel.value))
  /** 태생 위에 투자한 포인트 (능력치마다) */
  const investedAttributes = computed<Attributes>(
    () => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, attributes.value[k] - classFloor.value[k]])) as Attributes,
  )

  /**
   * 장착한 탈리스만과 켠 버프가 올려 주는 능력치 (예: 라다곤의 각인 근력·기량·생명력·지구력 +5).
   * 조건이 붙은 효과와 중첩 불가로 빠진 버프는 들어가지 않는다.
   */
  const buffs = useBuffsStore()
  const bonusAttributes = computed<Attributes>(() => {
    const out = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Attributes
    for (const o of buffs.summary.others) {
      const key = EFFECT_ATTRIBUTE_KEYS[o.attribute]
      if (key && o.model === 'additive') out[key] += o.total
    }
    return out
  })

  /** 입력한 능력치 + 탈리스만·버프 (상한 없음). 원본 사이트는 방어력 계산에 이 값을 쓴다. */
  const defenseAttributes = computed<Attributes>(
    () => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, attributes.value[k] + bonusAttributes.value[k]])) as Attributes,
  )

  /** 계산에 쓰는 최종 능력치: 입력한 능력치 + 탈리스만·버프 (최대 99, 원본 사이트와 같다) */
  const finalAttributes = computed<Attributes>(
    () =>
      Object.fromEntries(
        ATTRIBUTE_KEYS.map((k) => [k, Math.min(MAX_STAT, Math.max(1, attributes.value[k] + bonusAttributes.value[k]))]),
      ) as Attributes,
  )

  /** 공격력 계산에 쓰는 5개 능력치 (최종 능력치) */
  const combatStats = computed<CharacterStats>(() => ({
    strength: finalAttributes.value.strength,
    dexterity: finalAttributes.value.dexterity,
    intelligence: finalAttributes.value.intelligence,
    faith: finalAttributes.value.faith,
    arcane: finalAttributes.value.arcane,
  }))

  const upgrade = computed(() => ({ regular: upgradeRegular.value, somber: upgradeSomber.value }))

  function setAttribute(key: AttributeKey, value: number) {
    attributes.value[key] = Math.max(clampStat(value), classFloor.value[key])
  }

  /** 태생을 바꾼다 (null이면 고르지 않음). 새 태생보다 낮은 능력치는 태생 값으로 올린다 */
  function setStartingClass(key: StartingClassKey | null) {
    if (key !== null && !isStartingClassKey(key)) return
    startingClassKey.value = key
    attributes.value = raiseToFloor(attributes.value, classFloor.value)
  }

  /** 능력치를 태생 기본값으로 되돌린다 */
  function resetToClass() {
    attributes.value = { ...classFloor.value }
  }

  function setTargetLevel(value: number | null) {
    targetLevel.value = value === null ? null : clampTargetLevel(value)
  }

  function setRegular(value: number) {
    upgradeRegular.value = clampLevel(value, MAX_REGULAR_LEVEL)
    if (upgradeLinked.value) upgradeSomber.value = somberFromRegular(upgradeRegular.value)
  }

  function setSomber(value: number) {
    upgradeSomber.value = clampLevel(value, MAX_SOMBER_LEVEL)
    if (upgradeLinked.value) upgradeRegular.value = regularFromSomber(upgradeSomber.value)
  }

  function affinityFor(slot: number): AffinityName {
    return affinityBySlot.value[slot] ?? 'Standard'
  }

  function setAffinity(slot: number, affinity: AffinityName) {
    affinityBySlot.value[slot] = affinity
  }

  function resetAttributes() {
    attributes.value = raiseToFloor({ ...DEFAULT_ATTRIBUTES }, classFloor.value)
  }

  return {
    attributes,
    twoHanded,
    upgradeRegular,
    upgradeSomber,
    upgradeLinked,
    affinityBySlot,
    runeLevel,
    startingClassKey,
    classFloor,
    targetLevel,
    remainingPoints,
    investedAttributes,
    bonusAttributes,
    defenseAttributes,
    finalAttributes,
    combatStats,
    upgrade,
    setAttribute,
    setRegular,
    setSomber,
    affinityFor,
    setAffinity,
    resetAttributes,
    setStartingClass,
    resetToClass,
    setTargetLevel,
  }
})
