// 엘든 링 FMG(게임 문구 파일) 읽기. UXM으로 꺼내고 WitchyBND로 msgbnd를 푼 .fmg 파일을 읽는다.
//
//   0x00  u8 0, u8 빅엔디언, u8 버전(2 = 엘든 링), u8 0
//   0x04  i32 파일 크기
//   0x08  u8 1, u8 0, u8 0, u8 0
//   0x0C  i32 묶음 수, 0x10 i32 문구 수
//   0x14  i32 0xFF, 0x18 i64 문구 위치표 위치, 0x20 i64 0
//   0x28  묶음마다 16바이트: i32 위치표 번호, i32 첫 번호, i32 끝 번호, i32 0
//   위치표: 문구마다 i64 위치 (0이면 빈 문구). 문구는 0으로 끝나는 UTF-16LE.
// SoulsFormats(FMG.cs)의 형식을 따랐다.
import { readFileSync } from 'node:fs'

/** @returns {Record<string, string>} 번호 → 문구 (빈 문구는 뺀다) */
export function readFmg(path) {
  const buf = readFileSync(path)
  if (buf[0] !== 0 || buf[1] !== 0) throw new Error(`${path}: 빅엔디언 FMG는 지원하지 않습니다`)
  const version = buf[2]
  const wide = version === 1 || version === 2
  const groupCount = buf.readInt32LE(0x0c)
  let pos = 0x14
  if (wide) pos += 4 // 0xFF
  const offsetsAt = wide ? Number(buf.readBigInt64LE(pos)) : buf.readInt32LE(pos)
  pos += wide ? 16 : 8
  const out = {}
  for (let g = 0; g < groupCount; g++) {
    const offsetIndex = buf.readInt32LE(pos)
    const first = buf.readInt32LE(pos + 4)
    const last = buf.readInt32LE(pos + 8)
    pos += wide ? 16 : 12
    for (let j = 0; j <= last - first; j++) {
      const at = offsetsAt + (offsetIndex + j) * (wide ? 8 : 4)
      const strAt = wide ? Number(buf.readBigInt64LE(at)) : buf.readInt32LE(at)
      if (!strAt) continue
      let end = strAt
      while (end + 1 < buf.length && (buf[end] !== 0 || buf[end + 1] !== 0)) end += 2
      const text = buf.toString('utf16le', strAt, end).trim()
      if (text) out[first + j] = text
    }
  }
  return out
}
