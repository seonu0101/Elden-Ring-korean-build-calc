// 태생(시작 클래스): 레벨과 능력치는 게임 파일(regulation.bin의 CharaInitParam)에서 읽은 값이다.
//   npm run import:starting-classes  → starting-classes.generated.json
// 게임과 같이 능력치는 태생 값 아래로 내릴 수 없고, 룬 레벨은 태생과 관계없이 능력치 합 − 79 이다.
import { nameLanguage } from './names'
import data from './starting-classes.generated.json'

export type StartingClassKey =
  | 'vagabond'
  | 'warrior'
  | 'hero'
  | 'bandit'
  | 'astrologer'
  | 'prophet'
  | 'confessor'
  | 'samurai'
  | 'prisoner'
  | 'wretch'

export interface StartingClass {
  id: number
  key: StartingClassKey
  /** 영어 이름 (Paramdex 행 이름) */
  en: string
  /** 한국어 이름 */
  ko: string
  level: number
  attributes: {
    vigor: number
    mind: number
    endurance: number
    strength: number
    dexterity: number
    intelligence: number
    faith: number
    arcane: number
  }
}

/** 한국어 이름: 게임 한국어판 메뉴 문구(msg/korKR GR_MenuText)에서 확인한 공식 표기 */
export const STARTING_CLASS_KO: Readonly<Record<StartingClassKey, string>> = {
  vagabond: '방랑기사',
  warrior: '검사',
  hero: '용사',
  bandit: '도적',
  astrologer: '점성술사',
  prophet: '예언자',
  confessor: '밀사',
  samurai: '무사',
  prisoner: '죄수',
  wretch: '빈털터리',
}

export const STARTING_CLASSES: readonly StartingClass[] = (data.classes as Omit<StartingClass, 'ko'>[]).map((c) => ({
  ...c,
  ko: STARTING_CLASS_KO[c.key] ?? c.en,
}))

export const STARTING_CLASS_KEYS: readonly StartingClassKey[] = STARTING_CLASSES.map((c) => c.key)

/** 처음 고른 태생 (모든 능력치 10이라 기존 능력치를 그대로 쓸 수 있다) */
export const DEFAULT_STARTING_CLASS: StartingClassKey = 'wretch'

export function startingClass(key: StartingClassKey): StartingClass {
  return STARTING_CLASSES.find((c) => c.key === key) ?? STARTING_CLASSES.find((c) => c.key === DEFAULT_STARTING_CLASS)!
}

/** 화면에 보일 태생 이름 (영어 모드에서는 영어 이름, 한국어 모드에서는 한국어 이름) */
export function startingClassName(cls: Pick<StartingClass, 'ko' | 'en'>): string {
  return nameLanguage.value === 'en' ? cls.en : cls.ko
}

export function isStartingClassKey(value: unknown): value is StartingClassKey {
  return typeof value === 'string' && (STARTING_CLASS_KEYS as readonly string[]).includes(value)
}

/** 자주 쓰는 목표 레벨 (PvP 메타 레벨) */
export const TARGET_LEVEL_PRESETS: readonly number[] = [125, 150, 200]
export const MAX_RUNE_LEVEL = 713

type AttributeValues = StartingClass['attributes']
const ATTRIBUTE_ORDER = ['vigor', 'mind', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const

/** 이 태생으로 지금 능력치를 만들려면 필요한 레벨 (태생보다 낮은 능력치는 태생 값으로 친다) */
export function levelNeeded(attributes: AttributeValues, cls: StartingClass): number {
  return ATTRIBUTE_ORDER.reduce((sum, k) => sum + Math.max(attributes[k], cls.attributes[k]), 0) - 79
}

/** 태생 값이 목표보다 높아서 버려지는 포인트 */
export function wastedPoints(attributes: AttributeValues, cls: StartingClass): number {
  return ATTRIBUTE_ORDER.reduce((sum, k) => sum + Math.max(0, cls.attributes[k] - attributes[k]), 0)
}

/** 지금 능력치에 맞는 태생 순위: 필요한 레벨이 낮은 순 (같으면 태생 레벨이 낮은 순) */
export function rankClasses(attributes: AttributeValues) {
  return STARTING_CLASSES.map((cls) => ({ cls, level: levelNeeded(attributes, cls), wasted: wastedPoints(attributes, cls) })).sort(
    (a, b) => a.level - b.level || a.cls.level - b.cls.level,
  )
}
