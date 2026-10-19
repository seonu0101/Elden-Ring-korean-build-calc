// 장비 중량: 지구력으로 최대 장비 중량을 정하고, 장착 무게가 그 몇 %인지로 구르기 단계를 나눈다.
// 원본 사이트와 같은 계산: 최대 = 곡선 #220(지구력) × 탈리스만·버프의 "최대 장비 중량" 배율,
// 단계는 30% 미만 가벼움, 70% 미만 보통, 100% 미만 무거움, 그 이상 중량 과다.
import { statGraphValue } from './defense'

/** 능력치 곡선 #220 "Equip Load - Endurance" */
export const EQUIP_LOAD_GRAPH = 220

export type EquipLoadRoll = 'light' | 'medium' | 'heavy' | 'overloaded'

/** 게임 한국어판 표기 */
export const EQUIP_LOAD_ROLL_LABELS: Readonly<Record<EquipLoadRoll, string>> = {
  light: '가벼움',
  medium: '보통',
  heavy: '무거움',
  overloaded: '중량 과다',
}

export interface EquipLoad {
  /** 지구력만으로 정해지는 최대 장비 중량 */
  base: number
  /** 탈리스만·버프 배율을 곱한 최대 장비 중량 */
  max: number
  weight: number
  /** 무게 / 최대 × 100 */
  percent: number
  roll: EquipLoadRoll
}

export function equipLoadRoll(percent: number): EquipLoadRoll {
  if (percent < 30) return 'light'
  if (percent < 70) return 'medium'
  if (percent < 100) return 'heavy'
  return 'overloaded'
}

export function calculateEquipLoad(endurance: number, weight: number, multiplier = 1): EquipLoad {
  const base = statGraphValue(EQUIP_LOAD_GRAPH, Math.floor(endurance))
  const max = base * multiplier
  const percent = max > 0 ? (100 * weight) / max : 0
  return { base, max, weight, percent, roll: equipLoadRoll(percent) }
}
