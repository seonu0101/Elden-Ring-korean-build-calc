export type ProtectorType = 'Head' | 'Body' | 'Arms' | 'Legs'

export const PROTECTOR_TYPES: readonly ProtectorType[] = ['Head', 'Body', 'Arms', 'Legs']

export type StatKey = 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'
export type DamageType = 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
export type StatusType = 'bleed' | 'frostbite' | 'poison' | 'scarlet_rot' | 'sleep' | 'madness'

export const STAT_KEYS: readonly StatKey[] = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane']
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magic', 'fire', 'lightning', 'holy']
export const STATUS_TYPES: readonly StatusType[] = ['bleed', 'frostbite', 'poison', 'scarlet_rot', 'sleep', 'madness']

/** 변질(인퓨전, affinity). 원본 데이터의 이름을 그대로 쓴다. */
export type AffinityName =
  | 'Standard'
  | 'Heavy'
  | 'Keen'
  | 'Quality'
  | 'Fire'
  | 'Flame Art'
  | 'Lightning'
  | 'Sacred'
  | 'Magic'
  | 'Cold'
  | 'Poison'
  | 'Blood'
  | 'Occult'

export const AFFINITIES: readonly AffinityName[] = [
  'Standard',
  'Heavy',
  'Keen',
  'Quality',
  'Fire',
  'Flame Art',
  'Lightning',
  'Sacred',
  'Magic',
  'Cold',
  'Poison',
  'Blood',
  'Occult',
]

/** 변질에 따라 달라지는 수치 (+0 기준, 0인 값은 생략) */
export interface WeaponStats {
  damage: Partial<Record<DamageType, number>>
  /** 능력 보정 계수 (0.55 → 보정 수치 55, 등급 D) */
  scaling: Partial<Record<StatKey, number>>
  status: Partial<Record<StatusType, number>>
  /** 가드 시 피해 감소율(%)과 가드 강도 */
  guard: Partial<Record<DamageType, number>> & { boost: number }
  /** 강화 배율 표 번호 (reinforcements.generated.json의 키) */
  reinforcement: number
  /** 강화 단계별 상태이상 수치 (변질로 붙은 상태이상만). 없으면 강화해도 status 그대로 */
  statusByLevel?: Partial<Record<StatusType, number[]>>
  /** 능력치 보정 비율 표 번호 (correction.generated.json의 attack 키) */
  correctionAttack: number
  /** 공격 속성·상태이상별 보정 곡선 번호 (correction.generated.json의 graphs 키) */
  correctionCalc: Partial<Record<DamageType | 'bleed' | 'poison' | 'sleep' | 'madness', number>>
}

/** 캐릭터 능력치 (계산에 쓰는 5개) */
export type CharacterStats = Record<StatKey, number>

/** 무기 스펙. 무기 자체의 수치는 일반(Standard) 변질 +0 기준이다. */
export interface WeaponItem extends WeaponStats {
  kind: 'weapon'
  id: string
  /** 게임 내부 ID */
  gameId: number
  name: string
  weaponType: string
  weight: number
  /** 0: 본편, 1: Shadow of the Erdtree, 2: 그 밖의 추가 무기 */
  content: number
  requirements: Partial<Record<StatKey, number>>
  attackTypes: string[]
  canChangeAffinity: boolean
  /** 일반 이외의 변질별 수치. 변질할 수 없는 무기(전설 무기 등)에는 없다. */
  affinities?: Partial<Record<Exclude<AffinityName, 'Standard'>, WeaponStats>>
  buffable: boolean
  upgradeMaterial: string
}

/** 피해 경감률·방어력을 나누는 8가지 (물리는 표준/타격/참격/관통으로 나뉜다) */
export type NegationType = 'physical' | 'strike' | 'slash' | 'pierce' | 'magic' | 'fire' | 'lightning' | 'holy'

export const NEGATION_TYPES: readonly NegationType[] = [
  'physical',
  'strike',
  'slash',
  'pierce',
  'magic',
  'fire',
  'lightning',
  'holy',
]

export type ResistanceType = 'immunity' | 'robustness' | 'focus' | 'vitality'

export interface ProtectorItem {
  kind: 'protector'
  id: string
  gameId: number
  name: string
  protectorType: ProtectorType
  weight: number
  poise: number
  /** 속성별 피해 경감률(%) */
  absorptions: Record<NegationType, number>
  /** 상태이상 내성 (면역·강건·집중력·항사) */
  resistances: Record<ResistanceType, number>
  /** 0: 본편, 1: Shadow of the Erdtree */
  content: number
}

/** 탈리스만 효과 하나 (원본 사이트 데이터 그대로) */
export interface TalismanEffect {
  /** 효과가 붙는 항목 (영어 원문, 예: "Attack Power", "Physical Absorption") */
  attribute: string
  value: number
  /** multiplicative: 배율(1.1 = +10%), additive: 더하기, toggle: 켜짐, max-hp: 최대 HP 비율 */
  model: string
  /** PvP에서 다른 값일 때만 */
  valuePvp?: number
  /** 효과가 나는 조건 (영어 원문, 예: "Jump Attack") */
  conditions?: string[]
  /** 지속 시간(초) */
  duration?: number
}

/** 버프: 효과가 있는 주문(기도·마술)이나 소비 아이템. 인벤토리 아이템이 아니라 장비 화면에서 골라 켠다. */
export interface BuffItem {
  kind: 'spell' | 'item'
  /** 'spell-golden-vow'처럼 종류가 붙은 id */
  id: string
  gameId: number
  name: string
  /** 원본 분류 (Incantation, Sorcery, Edible, Grease, Crystal Tear 등) */
  category: string
  /** 무기에 거는 버프인지 (인챈트 등) */
  weaponBuff: boolean
  effects: TalismanEffect[]
  /** 아이템 전체의 지속 시간(초). 일부 영약만 효과가 아니라 여기에 있다 (원본 effectDuration) */
  duration?: number
  content: number
}

export interface TalismanItem {
  kind: 'talisman'
  id: string
  gameId: number
  name: string
  weight: number
  /** 분류 (Stat, Attack, Absorption 등) */
  categories: string[]
  effects: TalismanEffect[]
  /** 함께 낄 수 없는 탈리스만 id */
  conflicts: string[]
  /** 0: 본편, 1: Shadow of the Erdtree */
  content: number
}

export type Item = WeaponItem | ProtectorItem | TalismanItem
export type ItemKind = Item['kind']

/** 인벤토리에 들어 있는 아이템 한 개. 같은 아이템을 여러 개 가질 수 있어서 uid로 구분한다. */
export interface InventorySlot {
  uid: string
  itemId: string
  /** 인벤토리 목록에서의 정렬 순서 */
  order: number
  /** 장착 중이면 장착 칸 번호, 아니면 undefined */
  equipIndex?: number
}

/** 장비 칸 하나를 가리킨다. */
export type SlotTarget =
  | { kind: 'weapon'; equipIndex: number }
  | { kind: 'protector'; protectorType: ProtectorType }
  | { kind: 'talisman'; equipIndex: number }
