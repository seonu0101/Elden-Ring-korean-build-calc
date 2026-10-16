import type { AffinityName, DamageType, NegationType, StatKey, StatusType } from '@/types'

/** 방어력·경감률 항목 (물리는 표준·타격·참격·관통으로 나뉜다) */
export const NEGATION_LABELS: Readonly<Record<NegationType, string>> = {
  physical: '물리',
  strike: '타격',
  slash: '참격',
  pierce: '관통',
  magic: '마력',
  fire: '화염',
  lightning: '벼락',
  holy: '신성',
}

/** 변질 이름. 한국어판 표기와 다를 수 있으니 필요하면 여기만 고치면 된다. */
export const AFFINITY_LABELS: Readonly<Record<AffinityName, string>> = {
  Standard: '일반',
  Heavy: '중후',
  Keen: '예리',
  Quality: '상질',
  Fire: '화염',
  'Flame Art': '화염술',
  Lightning: '벼락',
  Sacred: '신성',
  Magic: '마력',
  Cold: '냉기',
  Poison: '독',
  Blood: '피',
  Occult: '신비',
}

export const STAT_LABELS: Readonly<Record<StatKey, string>> = {
  strength: '근력',
  dexterity: '기량',
  intelligence: '지력',
  faith: '신앙',
  arcane: '신비',
}

export const STAT_SHORT_LABELS: Readonly<Record<StatKey, string>> = {
  strength: '근',
  dexterity: '기',
  intelligence: '지',
  faith: '신',
  arcane: '비',
}

export const DAMAGE_LABELS: Readonly<Record<DamageType, string>> = {
  physical: '물리',
  magic: '마력',
  fire: '화염',
  lightning: '벼락',
  holy: '신성',
}

export const STATUS_LABELS: Readonly<Record<StatusType, string>> = {
  bleed: '출혈',
  frostbite: '동상',
  poison: '독',
  scarlet_rot: '부패',
  sleep: '수면',
  madness: '발광',
}

export const CONTENT_LABELS: Readonly<Record<number, string>> = {
  0: '본편',
  1: 'DLC',
  2: '기타',
}

/**
 * 능력 보정 수치 (계수 × 100, 소수점 버림). 보정이 없으면 0
 * 강화하면 82.5처럼 소수가 생기므로 버린다. 1e-6은 0.29 × 100 = 28.999… 같은 부동소수 오차 보정
 */
export function scalingValue(value: number | undefined): number {
  return value && value > 0 ? Math.floor(value * 100 + 1e-6) : 0
}

/**
 * 능력 보정 등급. 보정 계수 × 100 기준
 * S 175+, A 140+, B 90+, C 60+, D 25+, E 1+
 */
export function scalingGrade(value: number | undefined): string {
  if (!value || value <= 0) return ''
  const v = value * 100 + 1e-6
  if (v >= 175) return 'S'
  if (v >= 140) return 'A'
  if (v >= 90) return 'B'
  if (v >= 60) return 'C'
  if (v >= 25) return 'D'
  return 'E'
}
