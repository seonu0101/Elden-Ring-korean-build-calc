// Tourney Manager 프로젝트의 아이템 이미지(무기·방어구·탈리스만)를 이 프로젝트로 복사한다.
//
//   npm run copy:item-images                       (기본: ../elden-ring-tourney-manager-v1.1.0/public/img)
//   npm run copy:item-images -- "다른\경로\public\img"
//
// 원본 폴더 구조: <img>/weapons, <img>/protectors, <img>/talismans (파일 이름 = 영어 아이템 이름)
// 복사 결과:      public/img/<같은 폴더>/<아이템 id>.png
// 악센트(Miséricorde → Misericorde)와 대소문자 차이는 무시하고 찾는다.
// 우리 데이터에 있는 아이템만 복사하고, 어떤 아이템에 이미지가 있는지 src/data/item-images.generated.json에 적는다.

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_SOURCE = join(ROOT, '..', 'elden-ring-tourney-manager-v1.1.0', 'public', 'img')
const MANIFEST = join(ROOT, 'src', 'data', 'item-images.generated.json')
const IMAGE_EXTS = ['.png', '.webp', '.jpg', '.jpeg']

/** 아이템 종류 → 이미지 폴더 이름 (원본과 복사본이 같은 이름을 쓴다) */
const FOLDERS = { weapon: 'weapons', protector: 'protectors', talisman: 'talismans' }

const normalize = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** 우리 데이터의 아이템 목록 (npm run import:weapons 로 가져온 JSON) */
async function loadItems() {
  const readJson = async (file) => JSON.parse(await readFile(join(ROOT, 'src', 'data', file), 'utf8'))
  const { weapons } = await readJson('weapons.generated.json')
  const { protectors } = await readJson('protectors.generated.json')
  const { talismans } = await readJson('talismans.generated.json')
  const idName = (list) => list.map((i) => ({ id: i.id, name: i.name }))
  return { weapon: idName(weapons), protector: idName(protectors), talisman: idName(talismans) }
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE
  const items = await loadItems()
  const manifest = { source: relative(ROOT, source) }

  for (const [kind, folder] of Object.entries(FOLDERS)) {
    const from = join(source, folder)
    const to = join(ROOT, 'public', 'img', folder)
    const files = (await readdir(from)).filter((f) => IMAGE_EXTS.includes(extname(f).toLowerCase()))
    const byName = new Map(files.map((f) => [normalize(f.slice(0, -extname(f).length)), f]))

    // 이전에 복사한 파일을 지우고 새로 복사한다 (아이템이 빠졌을 때 남는 파일이 없도록).
    await rm(to, { recursive: true, force: true })
    await mkdir(to, { recursive: true })

    const images = {}
    const missing = []
    for (const item of items[kind]) {
      const file = byName.get(normalize(item.name))
      if (!file) {
        missing.push(item.name)
        continue
      }
      const ext = extname(file).toLowerCase()
      await copyFile(join(from, file), join(to, `${item.id}${ext}`))
      images[item.id] = `${item.id}${ext}`
    }
    manifest[kind] = images
    console.log(`${folder}: ${Object.keys(images).length}/${items[kind].length}개 복사`)
    if (missing.length) console.log(`  이미지가 없는 아이템 ${missing.length}개: ${missing.join(', ')}`)
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
