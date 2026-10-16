// 버프 지속 시간. 원본 사이트(er-build-planner) 값이 우선이고, 원본에 없을 때만 위키 값을 쓴다.
//
//   1. 버프 전체 지속 시간 (원본 effectDuration, 일부 영약)
//   2. 효과 중 가장 긴 지속 시간 (원본 효과의 duration)
//   3. 위키(Fextralife Buffs and Debuffs) 값 — buff-durations.wiki.json
import type { BuffItem } from '@/types'
import wikiData from './buff-durations.wiki.json'

export const WIKI_DURATION_SOURCE: string = wikiData.source
const WIKI_DURATIONS = wikiData.durations as Record<string, number>

export interface BuffDuration {
  seconds: number
  source: 'original' | 'wiki'
}

export function buffDuration(b: Pick<BuffItem, 'id' | 'duration' | 'effects'>): BuffDuration | null {
  const original = b.duration ?? Math.max(0, ...b.effects.map((e) => e.duration ?? 0))
  if (original > 0) return { seconds: original, source: 'original' }
  const wiki = WIKI_DURATIONS[b.id]
  return wiki ? { seconds: wiki, source: 'wiki' } : null
}
