// 모든 이름(아이템·무기군)의 영어·한국어를 docs/names.md, docs/names.csv 로 정리한다.
//
//   npm run names
//
// 한국어는 src/data/names-ko.generated.json(게임 파일에서 읽은 한국어판 공식 이름)에서 읽는다. 없으면 빈칸.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const path = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = async (file, key) => JSON.parse(await readFile(path(`src/data/${file}`), 'utf8'))[key]

const KINDS = [
  { kind: 'weapon', label: '무기', file: 'weapons.generated.json', key: 'weapons' },
  { kind: 'protector', label: '방어구', file: 'protectors.generated.json', key: 'protectors' },
  { kind: 'talisman', label: '탈리스만', file: 'talismans.generated.json', key: 'talismans' },
  { kind: 'buff', label: '버프', file: 'buffs.generated.json', key: 'buffs' },
]
const CONTENT = { 0: '본편', 1: 'DLC', 2: '타니쉬드 에디션' }

const ko = JSON.parse(await readFile(path('src/data/names-ko.generated.json'), 'utf8'))
/** 한국어 이름과 출처 구분 */
function koName(id) {
  if (ko.items[id]) return { ko: ko.items[id], status: '공식' }
  return { ko: '', status: '' }
}
const rows = []
for (const k of KINDS) {
  for (const item of await read(k.file, k.key)) {
    rows.push({ kind: k.label, id: item.id, en: item.name, ...koName(item.id), content: CONTENT[item.content ?? 0] ?? '' })
  }
}
const types = [...new Set((await read('weapons.generated.json', 'weapons')).map((w) => w.weaponType))].sort()
for (const t of types) rows.push({ kind: '무기군', id: t, en: t, ko: ko.weaponTypes[t] ?? '', status: ko.weaponTypes[t] ? '공식' : '', content: '' })

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const csv = ['종류,id,영어,한국어,구분', ...rows.map((r) => [r.kind, r.id, r.en, r.ko, r.content].map(csvCell).join(','))]
await writeFile(path('docs/names.csv'), '﻿' + csv.join('\r\n') + '\r\n')

const md = []
const missing = rows.filter((r) => !r.ko)
md.push('# 이름 목록 (영어 · 한국어)', '')
const count = (s) => rows.filter((r) => r.status === s).length
md.push(`아이템과 무기군 이름 ${rows.length}개. 공식 한국어 ${count('공식')}개, 빈칸 ${missing.length}개.`, '')
md.push('- 한국어는 게임 파일(msg/korKR)에서 읽은 한국어판 공식 이름이다. 빈칸이 있으면 화면에서는 영어 이름을 쓴다.', '')
md.push('- 공식 이름: `npm run import:korean-names` (게임 msg 폴더에서) → `src/data/names-ko.generated.json`', '- 이 문서: `npm run names` (docs/names.csv도 함께 만든다)', '')
for (const label of [...KINDS.map((k) => k.label), '무기군']) {
  const list = rows.filter((r) => r.kind === label)
  const empty = list.filter((r) => !r.ko).length
  md.push(`## ${label} (${list.length}개, 빈칸 ${empty}개)`, '', '| 영어 | 한국어 | 구분 |', '| --- | --- | --- |')
  for (const r of list) md.push(`| ${r.en} | ${r.ko || '—'} | ${r.content} |`)
  md.push('')
}
await writeFile(path('docs/names.md'), md.join('\n'))
console.log(`이름 ${rows.length}개 (한국어 없음 ${missing.length}개): docs/names.md, docs/names.csv`)
