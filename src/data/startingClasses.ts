// 태생(시작 클래스)별 초기 레벨과 능력치. 능력치는 이보다 낮게 내릴 수 없다.
// 수치는 원본 사이트(er-build-planner)의 태생 목록, 한국어 이름은 게임 파일(GR_MenuText)의 공식 표기.
import type { Attributes } from '@/stores/stats'

export interface StartingClass {
  id: string
  /** 영어 이름 (게임 표기) */
  name: string
  /** 한국어판 이름 */
  nameKo: string
  /** 초기 레벨 (= 능력치 합 − 79) */
  level: number
  stats: Attributes
  /** 0: 본편, 2: 타니쉬드 에디션 */
  content: number
}

const make = (
  id: string,
  name: string,
  nameKo: string,
  level: number,
  [vigor, mind, endurance, strength, dexterity, intelligence, faith, arcane]: number[],
  content = 0,
): StartingClass => ({
  id,
  name,
  nameKo,
  level,
  stats: { vigor, mind, endurance, strength, dexterity, intelligence, faith, arcane } as Attributes,
  content,
})

/** 게임 캐릭터 만들기 화면 순서. 숫자는 생명력·정신력·지구력·근력·기량·지력·신앙·신비 */
export const STARTING_CLASSES: readonly StartingClass[] = [
  make('vagabond', 'Vagabond', '방랑기사', 9, [15, 10, 11, 14, 13, 9, 9, 7]),
  make('warrior', 'Warrior', '검사', 8, [11, 12, 11, 10, 16, 10, 8, 9]),
  make('hero', 'Hero', '용사', 7, [14, 9, 12, 16, 9, 7, 8, 11]),
  make('bandit', 'Bandit', '도적', 5, [10, 11, 10, 9, 13, 9, 8, 14]),
  make('astrologer', 'Astrologer', '점성술사', 6, [9, 15, 9, 8, 12, 16, 7, 9]),
  make('prophet', 'Prophet', '예언자', 7, [10, 14, 8, 11, 10, 7, 16, 10]),
  make('samurai', 'Samurai', '무사', 9, [12, 11, 13, 12, 15, 9, 8, 8]),
  make('prisoner', 'Prisoner', '죄수', 9, [11, 12, 11, 11, 14, 14, 6, 9]),
  make('confessor', 'Confessor', '밀사', 10, [10, 13, 10, 12, 12, 9, 14, 9]),
  make('wretch', 'Wretch', '빈털터리', 1, [10, 10, 10, 10, 10, 10, 10, 10]),
  make('heavy-knight', 'Heavy Knight', '중갑 기사', 10, [14, 8, 17, 15, 11, 7, 8, 9], 2),
  make('idus-knight', 'Idus Knight', '이데스의 기사', 7, [10, 12, 11, 13, 15, 8, 11, 6], 2),
]

export const STARTING_CLASSES_BY_ID: ReadonlyMap<string, StartingClass> = new Map(STARTING_CLASSES.map((c) => [c.id, c]))
