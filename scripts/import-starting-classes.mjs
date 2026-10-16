// 게임 파일(regulation.bin)에서 태생(시작 클래스) 10개의 레벨과 능력치를 읽어
// src/data/starting-classes.generated.json 으로 저장한다.
//
//   npm run import:starting-classes                                  (Steam 기본 설치 위치)
//   npm run import:starting-classes -- "H:\...\ELDEN RING\Game\regulation.bin"
//   npm run import:starting-classes -- --check "다른 regulation.bin"   (저장하지 않고 결과만 비교)
//
// 게임 파일은 읽기만 한다. 다른 도구(UXM, WitchyBND)는 필요 없다.
//
//   regulation.bin = 앞 16바이트 IV + AES-256-CBC 암호문 (키는 SoulsFormats RegulationDecryptor.cs의 Elden Ring 키)
//   복호화하면 DCX(ZSTD) → BND4 묶음 → CharaInitParam.param (PARAM, 행 3000~3009 = 태생)
//   필드 위치는 Paramdex ER/Defs/CharaInitParam.xml 을 따랐다:
//     0xC0 s16 soulLv(레벨), 0xC2~0xC9 u8 baseVit·Wil·End·Str·Dex·Mag·Fai·Luc
// 검증: 게임 공식대로 능력치 합 − 79 = 레벨 이어야 한다. 하나라도 다르면 저장하지 않는다.

import { createDecipheriv } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const DEFAULT_REGULATION = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ELDEN RING\\Game\\regulation.bin'
const OUTPUT = fileURLToPath(new URL('../src/data/starting-classes.generated.json', import.meta.url))

const ER_REGULATION_KEY = Buffer.from([
  0x99, 0xbf, 0xfc, 0x36, 0x6a, 0x6b, 0xc8, 0xc6, 0xf5, 0x82, 0x7d, 0x09, 0x36, 0x02, 0xd6, 0x76, 0xc4, 0x28, 0x92,
  0xa0, 0x1c, 0x20, 0x7f, 0xb0, 0x24, 0xd3, 0xaf, 0x4e, 0x49, 0x3f, 0xef, 0x99,
])

/** 행 번호 → 태생 (영어 이름은 Paramdex ER/Names/CharaInitParam.txt) */
export const CLASS_ROWS = [
  [3000, 'vagabond', 'Vagabond'],
  [3001, 'warrior', 'Warrior'],
  [3002, 'hero', 'Hero'],
  [3003, 'bandit', 'Bandit'],
  [3004, 'astrologer', 'Astrologer'],
  [3005, 'prophet', 'Prophet'],
  [3006, 'confessor', 'Confessor'],
  [3007, 'samurai', 'Samurai'],
  [3008, 'prisoner', 'Prisoner'],
  [3009, 'wretch', 'Wretch'],
]

const ATTRIBUTE_KEYS = ['vigor', 'mind', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith', 'arcane']
const SOUL_LV_OFFSET = 0xc0
const BASE_STATS_OFFSET = 0xc2

export function decryptRegulation(buf) {
  const iv = buf.subarray(0, 16)
  let body = buf.subarray(16)
  if (body.length % 16) body = Buffer.concat([body, Buffer.alloc(16 - (body.length % 16))])
  const d = createDecipheriv('aes-256-cbc', ER_REGULATION_KEY, iv)
  d.setAutoPadding(false)
  return Buffer.concat([d.update(body), d.final()])
}

/** DCX 껍데기를 벗긴다 (ZSTD만 지원) */
export function readDcx(buf) {
  if (buf.toString('latin1', 0, 4) !== 'DCX\0') throw new Error('DCX 파일이 아닙니다 (키가 틀렸거나 다른 게임의 파일)')
  const type = buf.toString('latin1', 0x28, 0x2c)
  if (type !== 'ZSTD') throw new Error(`지원하지 않는 DCX 압축: ${type}`)
  const uncompressed = buf.readUInt32BE(0x1c)
  const compressed = buf.readUInt32BE(0x20)
  const dcaAt = buf.indexOf('DCA\0', 0x2c, 'latin1')
  const dataAt = dcaAt + buf.readUInt32BE(dcaAt + 4)
  const out = zstdDecompressSync(buf.subarray(dataAt, dataAt + compressed))
  if (out.length !== uncompressed) throw new Error(`압축 해제 크기가 다릅니다: ${out.length} ≠ ${uncompressed}`)
  return out
}

function reverseBits(b) {
  let r = 0
  for (let i = 0; i < 8; i++) r |= ((b >> i) & 1) << (7 - i)
  return r
}

/** BND4 묶음에서 파일 이름 → 내용 (SoulsFormats BND4.cs, BinderFileHeader.cs) */
export function readBnd4(buf) {
  if (buf.toString('latin1', 0, 4) !== 'BND4') throw new Error('BND4 묶음이 아닙니다')
  const bitBigEndian = buf[0x0a] === 0
  const fileCount = buf.readInt32LE(0x0c)
  const fileHeaderSize = Number(buf.readBigInt64LE(0x20))
  const unicode = buf[0x30] === 1
  const raw = buf[0x31]
  const reverse = bitBigEndian || ((raw & 1) !== 0 && (raw & 0x80) === 0)
  const format = reverse ? raw : reverseBits(raw)
  const has = { ids: format & 0x02, names: format & 0x0c, long: format & 0x10, compression: format & 0x20 }
  const files = new Map()
  for (let i = 0; i < fileCount; i++) {
    let p = 0x40 + i * fileHeaderSize + 8 // 플래그 1 + 0 3 + -1 4
    const size = Number(buf.readBigInt64LE(p))
    p += 8
    if (has.compression) p += 8
    const offset = has.long ? Number(buf.readBigInt64LE(p)) : buf.readUInt32LE(p)
    p += has.long ? 8 : 4
    if (has.ids) p += 4
    if (!has.names) continue
    const nameAt = buf.readUInt32LE(p)
    let end = nameAt
    if (unicode) {
      while (buf[end] || buf[end + 1]) end += 2
    } else {
      while (buf[end]) end += 1
    }
    const name = unicode ? buf.toString('utf16le', nameAt, end) : buf.toString('latin1', nameAt, end)
    files.set(name, buf.subarray(offset, offset + size))
  }
  return files
}

/** 엘든 링 PARAM: 행 번호 → 행 데이터 (긴 오프셋 형식, SoulsFormats PARAM.cs / Row.cs) */
export function readParamRows(buf) {
  const flags = buf[0x2d]
  if (!(flags & 0x04)) throw new Error('긴 오프셋 형식이 아닌 PARAM 입니다')
  const rowCount = buf.readUInt16LE(0x0a)
  const rows = new Map()
  for (let i = 0; i < rowCount; i++) {
    const at = 0x40 + i * 24
    rows.set(buf.readInt32LE(at), Number(buf.readBigInt64LE(at + 8)))
  }
  return { buf, rows }
}

export function readStartingClasses(regulationBuf) {
  const files = readBnd4(readDcx(decryptRegulation(regulationBuf)))
  const name = [...files.keys()].find((n) => /(^|[\\/])CharaInitParam\.param$/i.test(n))
  if (!name) throw new Error('CharaInitParam.param 을 찾지 못했습니다')
  const { buf, rows } = readParamRows(files.get(name))
  return CLASS_ROWS.map(([id, key, en]) => {
    const at = rows.get(id)
    if (at === undefined) throw new Error(`CharaInitParam 행 ${id} 이 없습니다`)
    const level = buf.readInt16LE(at + SOUL_LV_OFFSET)
    const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((k, i) => [k, buf[at + BASE_STATS_OFFSET + i]]))
    const sum = ATTRIBUTE_KEYS.reduce((s, k) => s + attributes[k], 0)
    if (sum - 79 !== level) throw new Error(`${en}: 능력치 합 ${sum} − 79 ≠ 레벨 ${level} (필드 위치가 바뀌었을 수 있습니다)`)
    return { id, key, en, level, attributes }
  })
}

async function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const path = args.find((a) => a !== '--check') ?? DEFAULT_REGULATION
  const classes = readStartingClasses(readFileSync(path))
  for (const c of classes) {
    console.log(`${String(c.id)} ${c.en.padEnd(10)} Lv ${String(c.level).padStart(2)}  ${ATTRIBUTE_KEYS.map((k) => c.attributes[k]).join(' ')}`)
  }
  if (check) {
    const saved = JSON.parse(readFileSync(OUTPUT, 'utf8')).classes
    const same = JSON.stringify(saved) === JSON.stringify(classes)
    console.log(same ? '저장된 데이터와 같습니다.' : '저장된 데이터와 다릅니다!')
    process.exitCode = same ? 0 : 1
    return
  }
  const out = { source: 'regulation.bin CharaInitParam (rows 3000-3009)', importedAt: new Date().toISOString(), classes }
  await writeFile(OUTPUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`썼습니다: ${OUTPUT}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
