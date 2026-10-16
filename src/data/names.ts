// 아이템·무기군 이름의 한국어/영어 전환.
//
// 한국어는 게임 파일에서 읽은 한국어판 공식 이름(names-ko.generated.json)을 쓴다.
// 한국어 이름이 없는 아이템이 생기면(데이터를 새로 가져왔을 때 등) 한국어 모드에서도 영어 이름을 보여준다.
// 계산 규칙(중첩 묶음, 양손 예외 무기 등)은 언어와 관계없이 영어 원문 이름(item.name)으로 판단한다.
import { ref, watch } from 'vue'
import namesKo from './names-ko.generated.json'

export type NameLanguage = 'ko' | 'en'

export const NAME_LANGUAGE_KEY = 'er-planner/name-language'

const KO_ITEMS = namesKo.items as Record<string, string>
const KO_WEAPON_TYPES = namesKo.weaponTypes as Record<string, string>

function loadLanguage(): NameLanguage {
  try {
    return localStorage.getItem(NAME_LANGUAGE_KEY) === 'en' ? 'en' : 'ko'
  } catch {
    return 'ko'
  }
}

/** 이름 표시 언어. 화면 어디서나 같은 값을 쓴다 */
export const nameLanguage = ref<NameLanguage>(loadLanguage())

watch(nameLanguage, (v) => {
  try {
    localStorage.setItem(NAME_LANGUAGE_KEY, v)
  } catch {
    // 저장소를 쓸 수 없으면 기억하지 않는다
  }
})

interface Named {
  id: string
  name: string
}

/** 한국어 공식 이름 (없으면 null) */
export function koreanName(item: Pick<Named, 'id'>): string | null {
  return KO_ITEMS[item.id] ?? null
}

/** 화면에 보일 아이템 이름 */
export function itemName(item: Named): string {
  return nameLanguage.value === 'ko' ? (KO_ITEMS[item.id] ?? item.name) : item.name
}

/** 화면에 보일 무기군 이름 */
export function weaponTypeName(type: string): string {
  return nameLanguage.value === 'ko' ? (KO_WEAPON_TYPES[type] ?? type) : type
}

/** 검색: 한국어·영어 이름 어느 쪽에 들어 있어도 찾는다 (query는 소문자로 다듬은 값) */
export function nameMatches(item: Named, query: string): boolean {
  if (!query) return true
  if (item.name.toLowerCase().includes(query)) return true
  const ko = KO_ITEMS[item.id]
  return ko !== undefined && ko.toLowerCase().includes(query)
}

/** 이름 정렬: 화면에 보이는 이름 기준 */
export function compareNames(a: Named, b: Named): number {
  return itemName(a).localeCompare(itemName(b), nameLanguage.value)
}
