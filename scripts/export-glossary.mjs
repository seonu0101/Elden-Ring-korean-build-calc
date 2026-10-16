// 앱에 쓰인 번역 용어를 원문(영어)과 함께 모아 docs/glossary.md, docs/glossary.csv 로 만든다.
//
//   npm run glossary
//
// 번역 표(…_LABELS)는 소스 코드에서 직접 읽어 오므로, 번역을 고친 뒤 다시 실행하면 용어집도 바뀐다.
// 화면 문장 속에 쓰인 공통 용어(무게, 방어력 등)는 아래 COMMON_TERMS에 직접 적었다.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, 'docs')

/** 화면 곳곳의 문장·제목에 쓰인 게임 용어 [원문, 번역, 쓰는 곳] */
const COMMON_TERMS = [
  ['Weight', '무게', '요약 패널, 무기·방어구·탈리스만 표, 상세 정보'],
  ['Poise', '강인도', '요약 패널, 방어구 표'],
  ['Defense', '방어력', '요약 패널 방어력/경감률 표'],
  ['Damage Negation', '경감률 / 피해 경감률', '요약 패널, 방어구 표'],
  ['Attack Power (AR)', '공격력', '무기 표, 스탯 화면, 상세 정보, 버프 패널'],
  ['Attribute Scaling', '보정 / 능력 보정', '무기 표, 상세 정보'],
  ['Attributes Required', '요구 능력치', '무기 표, 상세 정보, 스탯 화면'],
  ['Guarded Damage Negation', '가드 경감률', '무기 표'],
  ['Guard Boost', '가드 강도', '무기 표'],
  ['Status Effect Buildup', '상태이상 축적치', '요약 패널, 무기 표, 스탯 화면'],
  ['Resistance', '상태이상 내성', '방어구 표'],
  ['Affinity', '변질', '무기 표, 스탯 화면'],
  ['Ash of War / Skill', '전회', '탈리스만 효과 설명'],
  ['Reinforcement / Upgrade', '강화', '무기 표, 스탯 화면'],
  ['Smithing Stone', '단석', '무기 표 안내 (일반 무기 강화 재료, 최대 +25)'],
  ['Somber Smithing Stone', '색 잃은 단석', '무기 표 안내 (특수 무기 강화 재료, 최대 +10)'],
  ['Regular weapon (Smithing Stone)', '일반 무기', '강화 설정'],
  ['Somber weapon (Somber Smithing Stone)', '특수 무기', '강화 설정'],
  ['Weapon Type', '무기군', '무기 표'],
  ['Armament', '무기', '장비 칸 이름, 상세 정보'],
  ['Right Hand Armament', '오른손 무기', '장비 칸 (RH1~3)'],
  ['Left Hand Armament', '왼손 무기', '장비 칸 (LH1~3)'],
  ['Armor', '방어구', '방어구 표, 상세 정보'],
  ['Talisman', '탈리스만', '탈리스만 표, 장비 칸'],
  ['Equipment', '장비', '장비 화면'],
  ['Inventory', '인벤토리', '장비 화면 안내, 초기화'],
  ['Equip / Unequip', '장착 / 장착 해제', '장비 화면'],
  ['Rune Level', '레벨', '스탯 화면'],
  ['One-Handed / Two-Handed', '한손 / 양손', '스탯 화면, 무기 표'],
  ['Incantation', '기도', '버프 패널'],
  ['Sorcery', '마술', '버프 패널'],
  ['Great Rune', '거대한 룬', '버프 패널'],
  ['Flask of Wondrous Physick', '성배병', '탈리스만 효과 설명'],
  ['Crystal Tear', '영약', '버프 패널'],
  ['Spirit Ash', '소환 영체', '탈리스만·버프 효과 설명'],
  ['Weapon buff (enchantment)', '무기 버프', '버프 중첩 규칙'],
  ['Body buff', '바디 버프', '버프 중첩 규칙'],
  ['Does not stack', '중첩 불가', '버프 패널'],
  ['Base game', '본편', '표의 구분 필터'],
  ['Shadow of the Erdtree (DLC)', 'DLC', '표의 구분 필터'],
]

/** 검토할 때 먼저 보면 좋은 번역 [번역, 원문, 이유] */
// 2026-10-16 검토 반영: 강인도·강건·집중력·항사·면역, 벼락, 화염술, 영약, 단석·색 잃은 단석, 거대한 룬,
// 무기 버프·바디 버프, 소모품·기름·조향병·유틸 아이템
const REVIEW_NOTES = [
  ['신비', 'Arcane (능력치) / Occult (변질)', '같은 번역입니다. 변질 버튼에는 영어가 함께 보입니다.'],
  ['마력·화염·벼락·신성·독', '변질 이름 = 공격 속성·상태이상 이름', '변질(Magic, Fire, Lightning, Sacred, Poison)과 속성 이름이 같습니다. 냉기(Cold 변질)와 동상(Frostbite 상태이상)은 구분했습니다.'],
  ['전회', 'Ash of War / Skill', '효과 조건의 "전회", "전회 차지" 등에 쓰입니다.'],
  ['효과 항목·효과 조건', '탈리스만·버프 효과 설명', '13·14번의 효과 이름 168개는 아직 대부분 검토하지 않았습니다.'],
]

/** 소스의 키(영어 식별자)를 게임 원문 표기로 */
const KEY_TO_ENGLISH = {
  // 능력치
  vigor: 'Vigor',
  mind: 'Mind',
  endurance: 'Endurance',
  strength: 'Strength',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
  faith: 'Faith',
  arcane: 'Arcane',
  // 공격 속성·경감 항목
  physical: 'Physical',
  strike: 'Strike',
  slash: 'Slash',
  pierce: 'Pierce',
  magic: 'Magic',
  fire: 'Fire',
  lightning: 'Lightning',
  holy: 'Holy',
  // 상태이상
  bleed: 'Hemorrhage (Blood Loss)',
  frostbite: 'Frostbite',
  poison: 'Poison',
  scarlet_rot: 'Scarlet Rot',
  sleep: 'Sleep',
  madness: 'Madness',
  // 내성
  immunity: 'Immunity',
  robustness: 'Robustness',
  focus: 'Focus',
  vitality: 'Vitality',
  // 방어구 부위
  Head: 'Head',
  Body: 'Chest (Body)',
  Arms: 'Arms',
  Legs: 'Legs',
  // 구분
  0: 'Base game',
  1: 'Shadow of the Erdtree (DLC)',
  2: 'Other',
}

/** 읽어 올 번역 표: [분류 이름, 파일, 표 이름, 설명] */
const TABLES = [
  ['능력치', 'src/stores/stats.ts', 'ATTRIBUTE_LABELS', '스탯 화면'],
  ['능력치 (줄임)', 'src/data/labels.ts', 'STAT_SHORT_LABELS', '무기 표의 요구 능력치·보정 열 제목'],
  ['공격 속성', 'src/data/labels.ts', 'DAMAGE_LABELS', '공격력 열, 버프 패널'],
  ['방어력·경감률 항목', 'src/data/labels.ts', 'NEGATION_LABELS', '요약 패널, 방어구 표'],
  ['상태이상', 'src/data/labels.ts', 'STATUS_LABELS', '축적치 표, 무기 표'],
  ['상태이상 내성', 'src/features/itemTables/ArmorTable.vue', 'RESISTANCE_LABELS', '방어구 표'],
  ['변질 (Affinity)', 'src/data/labels.ts', 'AFFINITY_LABELS', '무기 표, 스탯 화면'],
  ['방어구 부위', 'src/features/itemTables/ArmorTable.vue', 'PART_LABELS', '방어구 표'],
  ['구분 (본편/DLC)', 'src/data/labels.ts', 'CONTENT_LABELS', '표의 이름 옆 태그'],
  ['버프 분류', 'src/features/buffs/BuffPanel.vue', 'CATEGORY_LABELS', '버프 패널 고르기 목록'],
  ['탈리스만 분류', 'src/data/talismanEffects.ts', 'TALISMAN_CATEGORY_LABELS', '탈리스만 표'],
  ['효과 항목', 'src/data/talismanEffects.ts', 'TALISMAN_ATTRIBUTE_LABELS', '탈리스만·버프 효과 설명'],
  ['효과 조건', 'src/data/talismanEffects.ts', 'TALISMAN_CONDITION_LABELS', '탈리스만·버프 효과 설명 ("… 시:")'],
]

/** 소스에서 `NAME ... = { ... }` 객체를 찾아 [키, 값] 목록으로 */
function extractTable(source, name, file) {
  const start = source.search(new RegExp(`\\b${name}\\b[^=]*=\\s*\\{`))
  if (start < 0) throw new Error(`${file}에서 ${name}을 찾지 못했습니다`)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = open
  for (; end < source.length; end++) {
    if (source[end] === '{') depth++
    else if (source[end] === '}' && --depth === 0) break
  }
  const body = source.slice(open + 1, end).replace(/\/\/[^\n]*/g, '')
  const entries = []
  const re = /(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w]*|\d+))\s*:\s*'([^']*)'/g
  for (const m of body.matchAll(re)) entries.push([m[1] ?? m[2] ?? m[3], m[4]])
  return entries
}

function englishOf(key) {
  return KEY_TO_ENGLISH[key] ?? key
}

const md = (s) => String(s).replace(/\|/g, '\\|')
const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s))

async function main() {
  const sections = [{ title: '화면 공통 용어', file: '여러 화면 (직접 정리)', note: '', rows: COMMON_TERMS.map(([en, ko, where]) => [en, ko, where]) }]

  for (const [title, file, name, note] of TABLES) {
    const source = await readFile(join(ROOT, file), 'utf8')
    const rows = extractTable(source, name, file).map(([key, ko]) => [englishOf(key), ko, ''])
    sections.push({ title, file: `${file} › ${name}`, note, rows })
  }

  // 번역하지 않고 영어로 둔 것: 무기군
  const { weapons } = JSON.parse(await readFile(join(ROOT, 'src/data/weapons.generated.json'), 'utf8'))
  const weaponTypes = [...new Set(weapons.map((w) => w.weaponType))].sort()

  const total = sections.reduce((n, s) => n + s.rows.length, 0)
  const lines = [
    '# 번역 용어집',
    '',
    `앱 화면에 쓰인 한국어 번역과 원문(영어)입니다. 모두 ${total}개. 번역은 직접 옮긴 것이라 한국어판 게임 표기와 다를 수 있습니다.`,
    '',
    '- 고칠 때는 각 분류 제목 아래의 **코드 위치**에 있는 표에서 오른쪽 값(한국어)만 바꾸면 화면 전체에 반영됩니다.',
    '- 고친 뒤 `npm run glossary`를 실행하면 이 문서도 다시 만들어집니다.',
    '- 아이템 이름(무기·방어구·탈리스만·버프)과 무기군은 번역하지 않고 영어 원문 그대로 보여줍니다 (맨 아래 참고).',
    '',
    '## 목차',
    '',
    '0. 확인이 필요해 보이는 번역',
    ...sections.map((s, i) => `${i + 1}. ${s.title} (${s.rows.length})`),
    `${sections.length + 1}. 번역하지 않은 것: 무기군 (${weaponTypes.length})`,
    '',
    '## 0. 확인이 필요해 보이는 번역',
    '',
    '| 번역 | 원문 | 이유 |',
    '|---|---|---|',
    ...REVIEW_NOTES.map(([ko, en, why]) => `| ${md(ko)} | ${md(en)} | ${md(why)} |`),
    '',
  ]
  sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title}`, '', `코드 위치: \`${s.file}\`${s.note ? ` — ${s.note}` : ''}`, '')
    const hasWhere = s.rows.some((r) => r[2])
    lines.push(hasWhere ? '| 원문 | 번역 | 쓰는 곳 |' : '| 원문 | 번역 |', hasWhere ? '|---|---|---|' : '|---|---|')
    for (const [en, ko, where] of s.rows) lines.push(hasWhere ? `| ${md(en)} | ${md(ko)} | ${md(where)} |` : `| ${md(en)} | ${md(ko)} |`)
    lines.push('')
  })
  lines.push(
    `## ${sections.length + 1}. 번역하지 않은 것: 무기군`,
    '',
    '무기 표의 "무기군" 열과 필터에 영어 그대로 나옵니다.',
    '',
    weaponTypes.map((t) => `\`${t}\``).join(', '),
    '',
  )

  const csv = [
    ['분류', '원문', '번역', '쓰는 곳', '코드 위치'],
    ...sections.flatMap((s) => s.rows.map(([en, ko, where]) => [s.title, en, ko, where || s.note, s.file])),
  ]

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'glossary.md'), lines.join('\n'))
  await writeFile(join(OUT_DIR, 'glossary.csv'), '﻿' + csv.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n')
  console.log(`용어 ${total}개 → docs/glossary.md, docs/glossary.csv`)
  for (const s of sections) console.log(`  ${s.title}: ${s.rows.length}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
