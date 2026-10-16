// 탈리스만·버프 효과 수치를 한국어 설명으로 바꾼다. (게임 설명문을 옮기지 않고 데이터로 만든다)
// 번역은 직접 옮긴 것이라 한국어판 표기와 다를 수 있다. 여기 표만 고치면 화면 전체에 반영된다.
// 표에 없는 항목은 영어 원문을 그대로 보여준다.
import type { TalismanEffect, TalismanItem } from '@/types'

export const TALISMAN_ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
  'Attack Power': '공격력',
  'Physical Attack Power': '물리 공격력',
  'Magic Attack Power': '마력 공격력',
  'Fire Attack Power': '화염 공격력',
  'Lightning Attack Power': '벼락 공격력',
  'Holy Attack Power': '신성 공격력',
  'Stamina Attack Rate': '스태미나 공격력',
  'Scale Physical Attack Power with Equip Load': '장비 중량에 따라 물리 공격력 증가',
  Absorption: '피해 경감',
  'Physical Absorption': '물리 피해 경감',
  'Elemental Absorption': '속성 피해 경감',
  'Magic Absorption': '마력 피해 경감',
  'Fire Absorption': '화염 피해 경감',
  'Lightning Absorption': '벼락 피해 경감',
  'Holy Absorption': '신성 피해 경감',
  'Maximum Health': '최대 HP',
  'Maximum Focus': '최대 FP',
  'Maximum Stamina': '최대 스태미나',
  'Maximum Equip Load': '최대 장비 중량',
  'Health Points': 'HP 회복',
  'Focus Points': 'FP 회복',
  'Stamina Recovery Speed': '스태미나 회복 속도',
  Vigor: '생명력',
  Mind: '정신력',
  Endurance: '지구력',
  Strength: '근력',
  Dexterity: '기량',
  Intelligence: '지력',
  Faith: '신앙',
  Arcane: '신비',
  Immunity: '면역',
  Robustness: '강건',
  Focus: '집중력',
  Vitality: '항사',
  Poise: '강인도',
  'Item Discovery': '아이템 발견력',
  'Rune Acquisition': '룬 획득량',
  'Memory Slots': '기억 슬롯',
  'Bow Distance': '활 사거리',
  'Casting Speed': '주문 시전 속도',
  'Spell Duration': '주문 지속 시간',
  'Spell Focus Consumption': '주문 FP 소모',
  'Skill Focus Consumption': '전회 FP 소모',
  'Extended Roll Iframes Enabled': '구르기 무적 시간 증가',
  'Backstep Iframes Enabled': '백스텝 무적 시간 증가',
  'Reduce Headshot Impact': '헤드샷 피해 감소',
  'Flask Health Restoration': '성배병 HP 회복량',
  'Flask Focus Restoration': '성배병 FP 회복량',
  'Incoming Stamina Damage': '받는 스태미나 피해',
  'Enemy Hearing': '적이 듣는 소리',
  'Invisible at Distance': '멀리서 보이지 않음',
  'Fall Damage': '낙하 피해',
  'Attract Enemy Aggression': '적의 표적이 되기 쉬움',
  'Destroy Item on Death': '죽으면 탈리스만이 깨짐',
  'Preserve Runes on Death': '죽어도 룬을 잃지 않음',
  'Appear as Host': '호스트의 모습으로 보임',
  'Appear as Cooperator': '협력자로 보임',
  // 버프(주문·소비 아이템)에만 나오는 항목
  'Bleed Buildup': '출혈 축적',
  'Poison Buildup': '독 축적',
  'Scarlet Rot Buildup': '부패 축적',
  'Frost Buildup': '동상 축적',
  'Sleep Buildup': '수면 축적',
  'Madness Buildup': '발광 축적',
  'Deathblight Buildup': '죽음 축적',
  'Death Buildup': '즉사 축적',
  Frost: '동상',
  'Physical Guard Absorption': '가드 물리 경감',
  'Magic Guard Absorption': '가드 마력 경감',
  'Fire Guard Absorption': '가드 화염 경감',
  'Lightning Guard Absorption': '가드 벼락 경감',
  'Holy Guard Absorption': '가드 신성 경감',
  Deflection: '공격 튕겨내기',
  'Ignore Damage Level': '경직 무시',
  'Change Damage Level': '경직 변화',
  'Restore HP on Attack': '공격 시 HP 회복',
  'Spirit Ash Health Points': '소환 영체 HP',
  'Spirit Ash Attack Power': '소환 영체 공격력',
  'Grant Phantom Great Rune': '침입자 거대한 룬 효과',
  'Apply Oil Effect To Nearby Enemies': '주변 적에게 기름 효과(화염 데미지 증가)',
  'Summon Donut Buddy': '소환',
  'Stamina Consumption': '스태미나 소모',
  Framerate: '프레임 레이트',
  'Physical Damage on Roll': '구르기 시 물리 피해',
  'Hide User': '모습 숨김',
  'Hide Weapon': '무기 숨김',
}

export const TALISMAN_CONDITION_LABELS: Readonly<Record<string, string>> = {
  'Charged Skill Attack': '전회 차지',
  'Skill Attack': '전회',
  'Charge Attack': '강공격',
  'Charged Attack': '차지 공격',
  'Successive 3 Hits': '3회 연속 공격',
  'Successive 6 Hits': '6회 연속 공격',
  'Successive 9 Hits': '9회 연속 공격',
  'Successive Hits': '연속 공격',
  'HP below 20%': 'HP 20% 이하',
  'HP above 100%': 'HP 최대',
  'Enhance Thrusting Counter Attacks': '관통 카운터',
  'Enhance Critical Attacks': '치명타',
  'Trigger during Critical Hit': '치명타',
  'Trigger after Critical Hit': '치명타 뒤',
  'Trigger on Critical Hit (HP)': '치명타 (HP)',
  'Trigger on Critical Hit (FP)': '치명타 (FP)',
  'Final Chain Attack': '연속 공격 마지막 타',
  'Horseback Attack': '말 위 공격',
  'Ammunition Attack': '화살·볼트',
  'Ammunition OnHit Attack': '화살·볼트 명중',
  'Ranged Skill Attack': '원거리 전회',
  'Trigger in Presence of Blood Loss': '주변에서 출혈 발생',
  'Trigger in Presence of Rot': '주변에서 부패 발생',
  'Trigger in Presence of Madness': '주변에서 발광 발생',
  'Trigger in Presence of Sleep': '주변에서 수면 발생',
  'Jump Attack': '점프 공격',
  'Omen Bairn': '흉조 아이',
  'Roar Attack': '포효·브레스 공격',
  'Guard Counter Attack': '가드 카운터',
  'Pot Item Attack': '항아리 투척',
  'Perfume Item Attack': '조향병',
  'Affects Sorceries': '마술',
  'Affects Incantations': '기도',
  'Spell Power Boost': '주문 위력',
  'Apply Kill Effect': '적 처치',
  'On Spirit Ash Killed': '소환 영체가 쓰러짐',
  'Trigger on Crouch': '웅크리기',
  'Kicking/Stomping Skill Attack': '발차기·밟기 전회',
  'Two-Handed': '양손',
  Guarding: '가드',
  'Weapon-Throwing Attack': '무기 투척',
  'On Poison': '독',
  'On Scarlet Rot': '부패',
  'On Frostbite': '동상',
  'On Blood Loss': '출혈',
  'On Sleep': '수면',
  'On Madness': '발광',
  'Rolling or Backstep': '구르기·백스텝',
  'Running Attack': '달리기 공격',
  'Precision Aiming': '정밀 조준',
  'Magma Incantation/Weapon Skill Attack': '용암 기도·전회',
  'Storm Attack': '폭풍 공격',
  'Using Flask': '성배병 사용',
  'Heavy Load': '무거움',
  Overloaded: '중량 초과',
  'Hold Stance': '자세 유지',
  // 원본 데이터에서도 정체를 모르는 조건
  'Unknown #497': '알 수 없는 조건',
  'Unknown #500': '알 수 없는 조건',
  // 버프에만 나오는 조건
  'Body Buff VFX': '바디 버프 연출',
  'Left-hand Buff VFX': '왼손 버프 연출',
  'Dragon Change VFX': '용 변신 연출',
  'Damage Level Change before Poise Break': '강인도가 깨지기 전 경직 변화',
  'On Hit': '피격',
  'HP below 21%': 'HP 21% 미만',
  'vs Ancient Dragon Enemies': '고룡 상대',
  'vs Dragon Enemies': '용 상대',
  'vs Undead Enemies': '언데드 상대',
  'Not a Chaos Follower': '미친불을 받지 않았을 때',
  'Damage Received': '피해를 받음',
  Invading: '침입 중',
  'Nearby Ally': '근처 아군',
  'Inside Affected Area': '효과 범위 안',
  'Damage Level 0': '경직 0단계',
  'Damage Level 1': '경직 1단계',
  'Damage Level 2': '경직 2단계',
  'Damage Level 3': '경직 3단계',
  'Damage Level 4': '경직 4단계',
  'Damage Level 5': '경직 5단계',
  'Damage Level 6': '경직 6단계',
  'Damage Level 7': '경직 7단계',
  'Damage Level 8': '경직 8단계',
  'Damage Level 9': '경직 9단계',
  'Damage Level 10': '경직 10단계',
}

export const TALISMAN_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  Stat: '능력치',
  Attack: '공격',
  Absorption: '피해 경감',
  Resistances: '내성',
  Spell: '주문',
  Healing: '회복',
  Utility: '유틸',
  PvP: 'PvP',
}

const label = (map: Readonly<Record<string, string>>, key: string) => map[key] ?? key

/** 소수점 한 자리까지, .0은 뺀다 (10.0 → 10, 7.5 → 7.5) */
function trim(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function signed(n: number, unit = ''): string {
  return `${n >= 0 ? '+' : '−'}${trim(Math.abs(n))}${unit}`
}

/** 효과 수치 부분: 배율 1.1 → "+10%", 더하기 5 → "+5" */
function valueText(model: string, value: number): string {
  switch (model) {
    case 'multiplicative':
      return signed((value - 1) * 100, '%')
    case 'additive':
      return signed(value)
    case 'max-hp':
      return `최대 HP의 ${trim((value - 1) * 100)}%`
    // 무기 버프 주문: 시전자의 신앙·지력에 따라 오르는 추가 공격력
    case 'fth-spbuff':
      return `+${trim(value)} (신앙 보정)`
    case 'int-spbuff':
      return `+${trim(value)} (지력 보정)`
    default:
      return ''
  }
}

/** 적에게 거는 효과인지 (맞은 적, 주변 적). 내 능력치·공격력 합계에는 넣지 않는다 */
export function isEnemyEffect(e: Pick<TalismanEffect, 'target'>): boolean {
  return e.target === 'opponent' || e.target === 'aoe'
}

/** 적에게 거는 효과면 앞에 붙일 말 */
function targetPrefix(e: TalismanEffect): string {
  return e.target === 'opponent' ? '적: ' : e.target === 'aoe' ? '주변 적: ' : ''
}

/** 효과 하나를 한국어로: "점프 공격 시: 공격력 +15% (PvP +7.5%)" */
export function effectText(e: TalismanEffect): string {
  const name = label(TALISMAN_ATTRIBUTE_LABELS, e.attribute)
  const amount = valueText(e.model, e.value)
  let text = amount ? `${name} ${amount}` : name
  if (e.conditions?.length) {
    text = `${e.conditions.map((c) => label(TALISMAN_CONDITION_LABELS, c)).join('·')} 시: ${text}`
  }
  if (e.duration) text += ` (${trim(e.duration)}초)`
  if (e.valuePvp !== undefined) text += ` (PvP ${valueText(e.model, e.valuePvp)})`
  return targetPrefix(e) + text
}

/** 효과 하나를 짧게: 지속 시간·PvP 수치 없이 "점프 공격 시: 공격력 +15%" */
export function effectBriefText(e: TalismanEffect): string {
  const name = label(TALISMAN_ATTRIBUTE_LABELS, e.attribute)
  const amount = valueText(e.model, e.value)
  const text = amount ? `${name} ${amount}` : name
  return targetPrefix(e) + (e.conditions?.length ? `${e.conditions.map((c) => label(TALISMAN_CONDITION_LABELS, c)).join('·')} 시: ${text}` : text)
}

/** 효과 전체를 짧게 한 줄로 (같은 문구는 한 번만) */
export function effectsBriefText(effects: readonly TalismanEffect[]): string {
  return [...new Set(effects.map(effectBriefText))].join(', ')
}

/** 탈리스만 효과 전체를 한 줄로 */
export function talismanEffectText(t: Pick<TalismanItem, 'effects'>): string {
  return t.effects.map(effectText).join(', ')
}
