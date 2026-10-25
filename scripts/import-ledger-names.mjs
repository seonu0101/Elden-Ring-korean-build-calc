// 수집 분석기(Tarnished Ledger)가 쓰는 체크리스트 이름의 한국어 이름표를 게임 파일에서 만든다.
//
//   npm run import:ledger-names                       (Steam 기본 설치 위치)
//   npm run import:ledger-names -- "D:\...\Game\msg"  (다른 위치)
//
// 체크리스트(CyberGiant7/Elden-Ring-Automatic-Checklist)의 영어 이름은 게임 표기와 조금씩 다르다
// (예: "Rellana's Twinblade" ↔ 게임 "Rellana's Twin Blades", "Tibia Mariner (Limgrave)" 같은 장소 표시).
// 1. 아이템은 체크리스트의 번호(000F4240 = 무기 1000000 등)로 게임 이름 파일에서 바로 찾는다.
// 2. 번호가 이벤트 플래그인 항목(보스·축복·방울·제작서 등)은 영어 이름으로 찾는다 (대소문자·철자 차이 무시).
// 3. 보스의 "이름 (장소)", "A & B", "A / B"는 나눠서 각각 찾아 다시 붙인다.
// 4. 무기군·변질·방어구 부위·주문 종류(목록의 작은 글씨)는 앱 표기(무기군 이름표, 화면 용어)를 따로 meta에 둔다.
//    "Twinblade"처럼 아이템 이름(트윈 블레이드)과 무기군(쌍날검)이 같은 영어가 있어서 나눠 둔다.
// 결과: src/data/ledger-names-ko.generated.json { names: { 영어: 한국어 }, meta: { … }, missing: [...] }

import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFmg } from './fmg.mjs'

const DEFAULT_MSG = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ELDEN RING\\Game\\msg'
const MSG = process.argv[2] ?? DEFAULT_MSG
const OUTPUT = fileURLToPath(new URL('../src/data/ledger-names-ko.generated.json', import.meta.url))
const CHECKLIST = 'https://raw.githubusercontent.com/CyberGiant7/Elden-Ring-Automatic-Checklist/main/assets/json/'
const FILES = ['all_items', 'dlc_items', 'bell_bearings', 'bosses', 'cookbooks', 'crystal_tears', 'gestures', 'graces', 'tools', 'whetblades']

/* ---------- 게임 문구 ---------- */
function bundleDir(lang, bundle) {
  const langDir = readdirSync(MSG).find((d) => d.toLowerCase() === lang)
  const dir = langDir && readdirSync(join(MSG, langDir)).find((d) => d.toLowerCase() === `${bundle}-msgbnd-dcx`)
  if (!dir) throw new Error(`${MSG}\\${lang}\\${bundle}-msgbnd-dcx 폴더가 없습니다 (UXM·WitchyBND로 풀어 주세요)`)
  return join(MSG, langDir, dir)
}
function fmg(lang, bundle, prefix) {
  const dir = bundleDir(lang, bundle)
  const files = readdirSync(dir)
    .filter((f) => f === `${prefix}.fmg` || (f.startsWith(`${prefix}_dlc`) && f.endsWith('.fmg')))
    .sort()
  return Object.assign({}, ...files.map((f) => readFmg(join(dir, f))))
}
const pair = (bundle, prefix) => ({ en: fmg('engus', bundle, prefix), ko: fmg('korkr', bundle, prefix) })

const T = {
  weapon: pair('item_dlc02', 'WeaponName'),
  protector: pair('item_dlc02', 'ProtectorName'),
  accessory: pair('item_dlc02', 'AccessoryName'),
  goods: pair('item_dlc02', 'GoodsName'),
  gem: pair('item_dlc02', 'GemName'),
  npc: pair('item_dlc02', 'NpcName'),
  place: pair('item_dlc02', 'PlaceName'),
  menu: pair('menu_dlc02', 'GR_MenuText'),
}

/** 철자 차이를 무시한 비교용 글자 */
const norm = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\bparlour\b/g, 'parlor')
    .replace(/\bforbiden\b/g, 'forbidden')
    .replace(/[^a-z0-9]+/g, '')

/** 영어 문구 → 한국어 (먼저 넣은 표가 이긴다: 아이템 → 인물 → 장소 → 메뉴) */
const byText = new Map()
const byNorm = new Map()
for (const t of [T.weapon, T.protector, T.accessory, T.goods, T.gem, T.npc, T.place, T.menu]) {
  for (const [id, en] of Object.entries(t.en)) {
    const ko = t.ko[id]
    if (!en || !ko || en === ko || /^\[|^%null%$/.test(en)) continue
    if (!byText.has(en)) byText.set(en, ko)
    if (!byNorm.has(norm(en))) byNorm.set(norm(en), ko)
  }
}
const textKo = (en) => byText.get(en) ?? byNorm.get(norm(en))

/** 체크리스트 번호 → 게임 이름 파일 (앞자리: 0 무기, 1 방어구, 2 탈리스만, 4 도구·주문, 8 전회) */
function idKo(hex) {
  if (!/^[0-9A-F]{8}$/i.test(hex)) return undefined
  const n = parseInt(hex, 16)
  const kind = n >>> 28
  const id = String(n & 0x0fffffff)
  const t = { 0: T.weapon, 1: T.protector, 2: T.accessory, 4: T.goods, 8: T.gem }[kind]
  return t?.ko[id]
}

/** 체크리스트 이름 → 게임 영어 표기 (철자·복수형이 다른 것). 나눠 찾기 규칙( / & (장소) )을 그대로 쓴다 */
const ALIASES = {
  'Leyendell, Capital of Ash': 'Leyndell, Capital of Ash',
  "Auzira Hero's Grave": "Auriza Hero's Grave",
  "Spiritcaller's Cave": 'Spiritcaller Cave',
  'Divine Tower of the East Altus: Gate': 'Divine Tower of East Altus: Gate',
  'Divine Tower of the East Altus': 'Divine Tower of East Altus',
  'Black Knight Edreed (Edredd)': 'Black Knight Edredd',
  'Messmer the Impaler (Messmer + Base Serpent)': 'Messmer the Impaler / Base Serpent Messmer',
  'Godfrey, First Elden Lord (Hoarah Loux)': 'Godfrey, First Elden Lord / Hoarah Loux, Warrior',
  'Knight of the Solitary Gaol (Blackgaol Knight)': 'Knight of the Solitary Gaol',
  "Fia's Champions": "Fia's Champion",
  'Abductor Virgins (Duo)': 'Abductor Virgin (Duo)',
  'Demi-Human Chiefs': 'Demi-Human Chief (Duo)',
  'Fell Twins': 'Fell Twin',
  'Mad Pumpkin Heads': 'Mad Pumpkin Head (Duo)',
  'Vyke, Knight of the Roundtable': 'Roundtable Knight Vyke',
  "Night's Cavalry (Dragonbarrow)": "Night's Cavalry (Greyoll's Dragonbarrow)",
}

/** 게임 파일에 그대로 맞는 표기가 없어 직접 옮긴 것 (방향은 게임의 "리에니에 호수 북쪽" 같은 표기를 따름) */
const MANUAL_KO = {
  'Putrid Crystalian Trio': '부패한 결정인 (3인)',
  'Erdtree Avatar (Liurnia Southwest)': '황금 나무의 화신 (리에니에 남서쪽)',
  'Erdtree Avatar (Liurnia Northeast)': '황금 나무의 화신 (리에니에 북동쪽)',
  "Night's Cavalry (Liurnia South)": '밤 기병 (리에니에 남쪽)',
  "Night's Cavalry (Liurnia North)": '밤 기병 (리에니에 북쪽)',
}

/** 보스 이름의 덧붙임 말 */
const WORDS = { Duo: '2인', Trio: '3인', Boss: '보스', Ambush: '매복', Exposed: '노출', 'Co-op': '협력' }

/** "이름 (장소)", "A & B", "A / B", "A and B"를 나눠 찾는다. 하나라도 못 찾으면 undefined */
function compositeKo(en) {
  if (MANUAL_KO[en]) return MANUAL_KO[en]
  if (ALIASES[en]) return compositeKo(ALIASES[en])
  const direct = textKo(en)
  if (direct) return direct
  const paren = en.match(/^(.*?)\s*\(([^()]+)\)\s*(\(([^()]+)\))?$/)
  if (paren) {
    const base = compositeKo(paren[1])
    const notes = [paren[2], paren[4]].filter(Boolean).map((p) =>
      p
        .split(/,\s*/)
        .map((w) => WORDS[w] ?? textKo(w) ?? compositeKo(w))
        .every(Boolean)
        ? p
            .split(/,\s*/)
            .map((w) => WORDS[w] ?? textKo(w) ?? compositeKo(w))
            .join(', ')
        : undefined,
    )
    return base && notes.every(Boolean) ? `${base} (${notes.join(') (')})` : undefined
  }
  for (const sep of [' / ', ' & ', ' and ']) {
    if (en.includes(sep)) {
      const parts = en.split(sep).map((p) => compositeKo(p.trim()))
      return parts.every(Boolean) ? parts.join(sep === ' / ' ? ' / ' : ' & ') : undefined
    }
  }
  const suffix = en.match(/^(.*)\s+(Duo|Trio)$/)
  if (suffix) {
    const base = compositeKo(suffix[1])
    return base ? `${base} (${WORDS[suffix[2]]})` : undefined
  }
  return undefined
}

/** 목록의 작은 글씨(무기군·변질·방어구 부위·주문 종류) — 앱 표기 (src/data/labels.ts, 무기군 이름표) */
async function metaTable() {
  const namesKo = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/names-ko.generated.json', import.meta.url)), 'utf8'))
  const out = { ...namesKo.weaponTypes, 'Hand-To-Hand': namesKo.weaponTypes['Hand-to-Hand'], 'Hand-to-Hand Art': namesKo.weaponTypes['Hand-to-Hand'] }
  Object.assign(out, {
    Standard: '표준', Heavy: '중후', Keen: '예리', Quality: '상질', Fire: '화염', 'Flame Art': '화염술', Lightning: '벼락',
    Sacred: '신성', Magic: '마력', Cold: '냉기', Poison: '독', Blood: '피', Occult: '신비',
    Head: '머리', Body: '몸통', Chest: '몸통', Arms: '팔', Legs: '다리', Sorcery: '마술', Incantation: '기도',
  })
  return out
}

/* ---------- 체크리스트 ---------- */
async function loadChecklist(name) {
  const res = await fetch(CHECKLIST + name + '.json')
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le').slice(1) : buf.toString('utf8').replace(/^\uFEFF/, '')
  return JSON.parse(text)
}

async function main() {
  if (!existsSync(MSG)) throw new Error(`게임 msg 폴더가 없습니다: ${MSG}`)
  const names = {}
  const missing = []
  const meta = await metaTable()
  const add = (en, ko, where) => {
    if (!en || /[가-힣]/.test(en)) return
    if (ko) names[en] ??= ko
    else if (!names[en]) missing.push(`${where}: ${en}`)
  }
  for (const file of FILES) {
    const data = await loadChecklist(file)
    for (const [group, entries] of Object.entries(data)) {
      if (group === 'not-found' || typeof entries !== 'object' || Array.isArray(entries)) continue
      for (const [key, entry] of Object.entries(entries)) {
        if (!entry || typeof entry !== 'object') continue
        add(entry.name, idKo(key) ?? compositeKo(entry.name), `${file}/${group}`)
        if (typeof entry.subcategory === 'string') add(entry.subcategory, compositeKo(entry.subcategory), `${file}/${group}.subcategory`)
        for (const field of ['class', 'category']) {
          const m = entry[field]
          if (typeof m === 'string' && !meta[m]) missing.push(`${file}/${group}.${field}: ${m}`)
        }
      }
    }
  }
  const uniqueMissing = [...new Set(missing)].filter((m) => !names[m.slice(m.indexOf(': ') + 2)] || /.(class|category):/.test(m))
  const sorted = Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)))
  const header = {
    source: `${CHECKLIST} 의 영어 이름 + 게임 파일 msg/korKR·engUS (item_dlc02, menu_dlc02)`,
    importedAt: new Date().toISOString(),
    note: '아이템은 번호로, 그 밖에는 영어 이름으로 게임 한국어 이름을 찾았다. 보스의 장소 표시는 나눠서 옮겼다.',
  }
  await writeFile(OUTPUT, JSON.stringify({ ...header, names: sorted, meta, missing: uniqueMissing }, null, 1) + '\n')
  console.log(`이름 ${Object.keys(sorted).length}개 저장: ${OUTPUT}`)
  console.log(`찾지 못함 ${uniqueMissing.length}개${uniqueMissing.length ? ':\n  ' + uniqueMissing.join('\n  ') : ''}`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
