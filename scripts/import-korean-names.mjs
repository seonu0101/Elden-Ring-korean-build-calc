// 게임 한국어판의 공식 이름을 게임 파일에서 읽어 src/data/names-ko.generated.json 으로 저장한다.
//
//   npm run import:korean-names                       (Steam 기본 설치 위치)
//   npm run import:korean-names -- "D:\...\Game\msg"  (다른 위치)
//
// 준비: UXM Selective Unpack으로 Game\msg\korKR, engUS 의 item_dlc02.msgbnd.dcx, menu_dlc02.msgbnd.dcx 를 꺼내고,
// WitchyBND로 풀어서 item_dlc02-msgbnd-dcx\ 폴더의 .fmg 파일이 있어야 한다.
// item_dlc02 묶음에는 본편 + DLC(_dlc01) + 추가 묶음(_dlc02)의 이름 파일이 모두 들어 있다.
//
// 한국어(korkr)와 영어(engus)를 읽어서 우리 아이템의 gameId로 이름을 찾고, 영어 이름이 우리 데이터와 같은지 확인한다.
// 번호로 찾은 영어 이름이 다르면 영어 이름으로 번호를 다시 찾는다.
// 무기군 이름은 메뉴 문구(GR_MenuText)에서 영어가 같은 줄을 찾는다. 설명문은 저장하지 않고 이름만 저장한다.

import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFmg } from './fmg.mjs'

const DEFAULT_MSG = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ELDEN RING\\Game\\msg'
const MSG = process.argv[2] ?? DEFAULT_MSG
const OUTPUT = fileURLToPath(new URL('../src/data/names-ko.generated.json', import.meta.url))
const data = (name) => fileURLToPath(new URL(`../src/data/${name}`, import.meta.url))

/** 아이템 종류 → 이름 파일 */
const NAME_FILES = { weapon: 'WeaponName', protector: 'ProtectorName', talisman: 'AccessoryName', buff: 'GoodsName' }

/** 언어 폴더 안의 묶음 폴더 (대소문자는 UXM·WitchyBND 버전마다 다를 수 있다) */
function bundleDir(lang, bundle) {
  const langDir = readdirSync(MSG).find((d) => d.toLowerCase() === lang)
  if (!langDir) throw new Error(`${MSG} 안에 ${lang} 폴더가 없습니다`)
  const dir = readdirSync(join(MSG, langDir)).find((d) => d.toLowerCase() === `${bundle}-msgbnd-dcx`)
  if (!dir) throw new Error(`${join(MSG, langDir)} 안에 ${bundle}-msgbnd-dcx 폴더가 없습니다. WitchyBND로 ${bundle}.msgbnd.dcx 를 풀어 주세요`)
  return join(MSG, langDir, dir)
}

/** 본편 + _dlc01 + _dlc02 … 이름 파일을 합친다 (뒤 파일이 앞을 덮는다) */
function names(lang, bundle, prefix) {
  const dir = bundleDir(lang, bundle)
  const files = readdirSync(dir)
    .filter((f) => f === `${prefix}.fmg` || (f.startsWith(`${prefix}_dlc`) && f.endsWith('.fmg')))
    .sort()
  return Object.assign({}, ...files.map((f) => readFmg(join(dir, f))))
}

const norm = (s) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/’/g, "'")
    .toLowerCase()
    .trim()

async function main() {
  if (!existsSync(MSG)) throw new Error(`게임 msg 폴더가 없습니다: ${MSG}`)
  const read = async (file, key) => JSON.parse(await readFile(data(file), 'utf8'))[key]
  const groups = {
    weapon: await read('weapons.generated.json', 'weapons'),
    protector: await read('protectors.generated.json', 'protectors'),
    talisman: await read('talismans.generated.json', 'talismans'),
    buff: await read('buffs.generated.json', 'buffs'),
  }

  const items = {}
  const missing = []
  const mismatched = []
  for (const [kind, list] of Object.entries(groups)) {
    const ko = names('korkr', 'item_dlc02', NAME_FILES[kind])
    const en = names('engus', 'item_dlc02', NAME_FILES[kind])
    const enIndex = new Map()
    for (const [id, name] of Object.entries(en)) if (!enIndex.has(norm(name))) enIndex.set(norm(name), id)
    for (const item of list) {
      let id = String(item.gameId)
      if (!en[id] || norm(en[id]) !== norm(item.name)) id = enIndex.get(norm(item.name)) ?? id
      if (en[id] && norm(en[id]) !== norm(item.name)) mismatched.push(`${item.name} ≠ ${en[id]}`)
      if (ko[id]) items[item.id] = ko[id]
      else missing.push(`${kind}: ${item.name}`)
    }
  }

  // 무기군: 메뉴 문구에서 영어가 무기군 이름과 같은 줄의 한국어
  const koMenu = names('korkr', 'menu_dlc02', 'GR_MenuText')
  const enMenu = names('engus', 'menu_dlc02', 'GR_MenuText')
  const types = [...new Set(groups.weapon.map((w) => w.weaponType))].sort()
  const weaponTypes = {}
  for (const [id, text] of Object.entries(enMenu)) {
    const type = types.find((t) => !weaponTypes[t] && norm(t) === norm(text))
    if (type && koMenu[id]) weaponTypes[type] = koMenu[id]
  }

  const header = {
    source: '게임 파일 msg/korKR, engUS (item_dlc02, menu_dlc02 — UXM으로 추출, WitchyBND로 푼 .fmg)',
    importedAt: new Date().toISOString(),
    note: '게임 한국어판 공식 이름 (본편 + DLC + 타니쉬드 에디션). 번호(gameId)로 찾고 영어 이름이 같은지 확인했다.',
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(OUTPUT, JSON.stringify({ ...header, items: sorted(items), weaponTypes: sorted(weaponTypes) }, null, 1) + '\n')
  console.log(`공식 이름 ${Object.keys(items).length}개, 무기군 ${Object.keys(weaponTypes).length}/${types.length}개 저장: ${OUTPUT}`)
  console.log(`이름 없음 ${missing.length}개${missing.length ? ':\n  ' + missing.join('\n  ') : ''}`)
  console.log(`영어 이름 다름 ${mismatched.length}개${mismatched.length ? ':\n  ' + mismatched.join('\n  ') : ''}`)
  const missingTypes = types.filter((t) => !weaponTypes[t])
  if (missingTypes.length) console.log(`무기군 이름 없음: ${missingTypes.join(', ')}`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
