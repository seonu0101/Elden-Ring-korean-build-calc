// 원본 사이트(er-build-planner.nyasu.business)의 무기 데이터를 가져와 src/data/weapons.generated.json 으로 저장한다.
//
//   npm run import:weapons
//
// 사이트의 JS 파일을 내려받아 파싱만 하고 실행하지 않는다. 숫자 데이터만 남기고 아이템 설명문은 저장하지 않는다.
// 원본 사이트 이용약관에 따라 비상업적 용도로만 사용한다.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'

const SITE = 'https://er-build-planner.nyasu.business'
const OUTPUT = fileURLToPath(new URL('../src/data/weapons.generated.json', import.meta.url))
const REINFORCEMENT_OUTPUT = fileURLToPath(new URL('../src/data/reinforcements.generated.json', import.meta.url))
const STATS = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane']
const DAMAGE_TYPES = ['physical', 'magic', 'fire', 'lightning', 'holy']
const STATUS_TYPES = ['bleed', 'frostbite', 'poison', 'scarlet_rot', 'sleep', 'madness']
/** 신비 보정을 받는 상태이상 (동상·부패는 보정 없음) */
const SCALING_STATUS_TYPES = ['bleed', 'poison', 'sleep', 'madness']
const PROTECTOR_OUTPUT = fileURLToPath(new URL('../src/data/protectors.generated.json', import.meta.url))
const BUFF_OUTPUT = fileURLToPath(new URL('../src/data/buffs.generated.json', import.meta.url))
const TALISMAN_OUTPUT =fileURLToPath(new URL('../src/data/talismans.generated.json', import.meta.url))
const STAT_GRAPH_OUTPUT =fileURLToPath(new URL('../src/data/stat-graphs.generated.json', import.meta.url))
const CORRECTION_OUTPUT =fileURLToPath(new URL('../src/data/correction.generated.json', import.meta.url))

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

/** 사이트의 JS 파일 목록 (파일 이름에 해시가 붙어 바뀌므로 매번 찾는다) */
async function findScriptUrls() {
  const html = await fetchText(`${SITE}/`)
  const names = new Set([...html.matchAll(/assets\/([\w.-]+\.js)/g)].map((m) => m[1]))
  if (names.size === 0) throw new Error('사이트에서 스크립트 파일을 찾지 못했습니다')
  return [...names].map((name) => `${SITE}/assets/${name}`)
}

/** AST의 리터럴(객체, 배열, 숫자, 문자열, !0 같은 불리언)만 값으로 바꾼다. 그 외의 식은 undefined. */
function literalValue(node) {
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? node.quasis.map((q) => q.value.cooked).join('') : undefined
    case 'ArrayExpression':
      return node.elements.map((el) => (el ? literalValue(el) : null))
    case 'ObjectExpression': {
      const obj = {}
      for (const prop of node.properties) {
        if (prop.type !== 'Property' || prop.computed) continue
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
        obj[key] = literalValue(prop.value)
      }
      return obj
    }
    case 'UnaryExpression': {
      const arg = literalValue(node.argument)
      if (node.operator === '!') return !arg
      if (node.operator === '-' && typeof arg === 'number') return -arg
      return undefined
    }
    default:
      return undefined
  }
}

function propertyNames(node) {
  return node.type === 'ObjectExpression'
    ? node.properties.filter((p) => p.type === 'Property').map((p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
    : []
}

/** 무기 데이터 덩어리: { Dagger: {...}, ... } 형태의 큰 객체 (배열이어도 받는다) */
function weaponNodes(node) {
  const items =
    node.type === 'ObjectExpression'
      ? node.properties.filter((p) => p.type === 'Property').map((p) => p.value)
      : node.type === 'ArrayExpression'
        ? node.elements
        : []
  if (items.length < 100) return null
  const keys = propertyNames(items[0] ?? {})
  const looksLikeWeapon = keys.includes('full_hex_id') && keys.includes('affinity') && keys.includes('upgrade_material')
  return looksLikeWeapon ? items : null
}

function findWeaponNodes(root) {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node.type !== 'string') continue
    const found = weaponNodes(node)
    if (found) return found
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value)
      else if (value && typeof value === 'object') stack.push(value)
    }
  }
  return null
}

export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function pick(source, keys) {
  const out = {}
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'number' && value !== 0) out[key] = value
  }
  return out
}

/**
 * 강화 단계별 상태이상 수치. 피(Blood) 변질처럼 변질로 붙은 상태이상은 강화할수록 오른다.
 * 원본: [{bleed: 57}, {bleed: 58}, ...] → { bleed: [57, 58, ...] }. 강화해도 그대로면 undefined.
 */
function toStatusByLevel(overlay) {
  if (!Array.isArray(overlay) || overlay.length === 0) return undefined
  const out = {}
  for (const type of STATUS_TYPES) {
    if (overlay.some((lv) => typeof lv?.[type] === 'number')) out[type] = overlay.map((lv) => lv?.[type] ?? 0)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 변질(인퓨전) 하나의 수치: 공격력, 보정, 상태이상, 가드, 강화 종류 */
function toStats(affinity) {
  const statusByLevel = toStatusByLevel(affinity.status_effect_overlay)
  return {
    damage: pick(affinity.damage, DAMAGE_TYPES),
    scaling: pick(affinity.scaling, STATS),
    status: pick(affinity.status_effects, STATUS_TYPES),
    guard: { ...pick(affinity.guard, DAMAGE_TYPES), boost: affinity.guard?.guard_boost ?? 0 },
    reinforcement: affinity.reinforcement_id ?? 0,
    ...(statusByLevel ? { statusByLevel } : {}),
    correctionAttack: affinity.correction_attack_id ?? 0,
    correctionCalc: pickIds(affinity.correction_calc_id, [...DAMAGE_TYPES, ...SCALING_STATUS_TYPES]),
  }
}

/** 보정 곡선 번호처럼 0도 의미가 있는 숫자 값만 골라낸다. */
function pickIds(source, keys) {
  const out = {}
  for (const key of keys) if (typeof source?.[key] === 'number') out[key] = source[key]
  return out
}

/** 강화 배율 표에서 화면에 필요한 값만 남긴다. */
function toReinforcementLevel(raw) {
  const rates = (source, keys) => Object.fromEntries(keys.map((k) => [k, source?.[k] ?? 1]))
  return {
    damage: rates(raw.damage, DAMAGE_TYPES),
    scaling: rates(raw.scaling, STATS),
    guard: { ...rates(raw.guard, DAMAGE_TYPES), boost: raw.guard?.guard_boost ?? 1 },
  }
}

/** { 0: [{level, damage, scaling, guard, ...}, ...], 100: [...] } 형태의 강화 배율 표 */
function findReinforcementTable(root) {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node.type !== 'string') continue
    if (node.type === 'ObjectExpression' && node.properties.length > 10) {
      const first = node.properties[0]?.value
      const keys = first?.type === 'ArrayExpression' ? propertyNames(first.elements[0] ?? {}) : []
      if (keys.includes('level') && keys.includes('damage') && keys.includes('scaling') && keys.includes('guard')) {
        return literalValue(node)
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value)
      else if (value && typeof value === 'object') stack.push(value)
    }
  }
  return null
}

/** AST에서 조건에 맞는 첫 객체 리터럴을 값으로 돌려준다. */
function findObject(root, predicate) {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node.type !== 'string') continue
    if (node.type === 'ObjectExpression' && predicate(node)) return literalValue(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value)
      else if (value && typeof value === 'object') stack.push(value)
    }
  }
  return null
}

/** 보정 곡선: { 0: [151개 숫자], 1: [...], ... } (능력치 0~150에서의 보정 비율) */
function isGraphTable(node) {
  if (node.properties.length < 10) return false
  const first = node.properties[0]?.value
  return (
    first?.type === 'ArrayExpression' &&
    first.elements.length > 100 &&
    first.elements.every((el) => el?.type === 'Literal' && typeof el.value === 'number')
  )
}

/** 보정 비율: { 10000: { correction, override, ratio }, ... } */
function isCorrectionAttackTable(node) {
  if (node.properties.length < 50) return false
  const keys = propertyNames(node.properties[0]?.value ?? {})
  return keys.includes('correction') && keys.includes('ratio') && keys.includes('override')
}

/**
 * 공격력·상태이상 계산에 쓰는 보정 곡선과 보정 비율을 가져온다.
 * 보정 비율은 무기가 쓰는 것만, 그리고 크기를 줄이려고 기본값(비율 1, 덮어쓰기 없음)은 뺀다.
 */
async function importCorrection(scriptUrls, weapons) {
  const sources = await Promise.all(scriptUrls.map(fetchText))
  const chunk = (prefix) => {
    for (const s of sources) {
      const name = s.match(new RegExp(`${prefix}-[\\w-]+\\.js`))?.[0]
      if (name) return `${SITE}/assets/${name}`
    }
    throw new Error(`${prefix} 파일을 찾지 못했습니다`)
  }
  const parseUrl = async (url) => parse(await fetchText(url), { ecmaVersion: 'latest', sourceType: 'module' })

  const graphUrl = chunk('correction-graph')
  const graphs = findObject(await parseUrl(graphUrl), isGraphTable)
  if (!graphs) throw new Error('보정 곡선을 찾지 못했습니다')

  const attackUrl = chunk('correction-attack')
  const attackTable = findObject(await parseUrl(attackUrl), isCorrectionAttackTable)
  if (!attackTable) throw new Error('보정 비율을 찾지 못했습니다')

  const used = new Set(
    weapons.flatMap((w) => [w.correctionAttack, ...Object.values(w.affinities ?? {}).map((a) => a.correctionAttack)]),
  )
  const attack = {}
  for (const id of [...used].sort((a, b) => a - b)) {
    const raw = attackTable[id]
    if (!raw) throw new Error(`보정 비율 ${id}가 없습니다`)
    const entry = { correction: {}, ratio: {}, override: {} }
    for (const d of DAMAGE_TYPES) {
      entry.correction[d] = STATS.filter((s) => raw.correction?.[d]?.[s])
      const ratio = Object.fromEntries(STATS.filter((s) => (raw.ratio?.[d]?.[s] ?? 1) !== 1).map((s) => [s, raw.ratio[d][s]]))
      if (Object.keys(ratio).length) entry.ratio[d] = ratio
      const override = pickIds(raw.override?.[d], STATS)
      if (Object.keys(override).length) entry.override[d] = override
    }
    attack[id] = entry
  }

  const header = JSON.stringify({ source: [graphUrl, attackUrl], importedAt: new Date().toISOString() }).slice(0, -1)
  const graphLines = Object.entries(graphs).map(([id, values]) => `  "${id}": ${JSON.stringify(values)}`)
  const attackLines = Object.entries(attack).map(([id, entry]) => `  "${id}": ${JSON.stringify(entry)}`)
  await writeFile(
    CORRECTION_OUTPUT,
    `${header},\n "graphs": {\n${graphLines.join(',\n')}\n },\n "attack": {\n${attackLines.join(',\n')}\n }\n}\n`,
  )
  console.log(`보정 곡선 ${graphLines.length}개, 보정 비율 ${attackLines.length}개 저장: ${CORRECTION_OUTPUT}`)
}

/** 무기 데이터 파일이 불러오는 강화 배율 파일(reinforcements-*.js)을 찾아 읽는다. */
async function importReinforcements(weaponSource, weapons) {
  const name = weaponSource.match(/reinforcements-[\w-]+\.js/)?.[0]
  if (!name) throw new Error('강화 배율 파일을 찾지 못했습니다')
  const url = `${SITE}/assets/${name}`
  const table = findReinforcementTable(parse(await fetchText(url), { ecmaVersion: 'latest', sourceType: 'module' }))
  if (!table) throw new Error('강화 배율 표를 찾지 못했습니다')

  // 무기가 실제로 쓰는 강화 종류만 저장한다.
  const used = new Set(
    weapons.flatMap((w) => [w.reinforcement, ...Object.values(w.affinities ?? {}).map((a) => a.reinforcement)]),
  )
  const out = {}
  for (const id of [...used].sort((a, b) => a - b)) {
    const levels = table[id]
    if (!Array.isArray(levels)) throw new Error(`강화 종류 ${id}가 배율 표에 없습니다`)
    out[id] = levels.map(toReinforcementLevel)
  }
  const lines = Object.entries(out).map(([id, levels]) => `  "${id}": ${JSON.stringify(levels)}`)
  const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
  await writeFile(REINFORCEMENT_OUTPUT, `${header},\n "reinforcements": {\n${lines.join(',\n')}\n }\n}\n`)
  console.log(`강화 종류 ${Object.keys(out).length}개 저장: ${REINFORCEMENT_OUTPUT}`)
}

function toWeapon(raw) {
  const standard = raw.affinity?.Standard ?? Object.values(raw.affinity ?? {})[0] ?? {}
  // 일반(Standard) 수치는 무기 자체에 두고, 그 밖의 변질만 affinities에 모은다.
  const affinities = Object.fromEntries(
    Object.entries(raw.affinity ?? {})
      .filter(([name]) => name !== 'Standard')
      .map(([name, affinity]) => [name, toStats(affinity)]),
  )
  return {
    kind: 'weapon',
    id: slugify(raw.name),
    gameId: raw.id,
    name: raw.name,
    weaponType: raw.category,
    weight: raw.weight,
    // 원본 데이터의 dlc 값: [0] 본편, [1] Shadow of the Erdtree, [2] 타니쉬드 에디션(Tarnished Pack, 무기 8개·방어구 18개)
    content: Array.isArray(raw.dlc) ? (raw.dlc[0] ?? 0) : 0,
    requirements: pick(raw.requirements, STATS),
    ...toStats(standard),
    attackTypes: raw.attack_attributes ?? [],
    canChangeAffinity: Object.keys(affinities).length > 0,
    ...(Object.keys(affinities).length > 0 ? { affinities } : {}),
    buffable: Boolean(raw.is_buffable),
    upgradeMaterial: raw.upgrade_material,
  }
}

/** { 이름: {...}, ... } 형태의 큰 객체에서, 첫 값이 keys를 모두 가진 것을 찾아 값 목록으로 돌려준다. */
function findRecordValues(root, keys, minCount) {
  const found = findObject(root, (node) => {
    if (node.properties.length < minCount) return false
    const names = propertyNames(node.properties[0]?.value ?? {})
    return keys.every((k) => names.includes(k))
  })
  return found ? Object.values(found) : null
}

const NEGATION_TYPES = ['physical', 'strike', 'slash', 'pierce', 'magic', 'fire', 'lightning', 'holy']
const RESISTANCE_TYPES = ['immunity', 'robustness', 'focus', 'vitality']

/** 방어구: 부위, 무게, 강인도, 속성별 피해 경감률(%), 상태이상 내성 */
async function importProtectors(ast, url) {
  const raw = findRecordValues(ast, ['absorptions', 'resistances', 'category'], 100)
  if (!raw) throw new Error('방어구 데이터를 찾지 못했습니다')
  const protectors = raw.map((p) => ({
    kind: 'protector',
    id: slugify(p.name),
    gameId: p.id,
    name: p.name,
    protectorType: p.category,
    weight: p.weight,
    poise: p.resistances?.poise ?? 0,
    absorptions: Object.fromEntries(NEGATION_TYPES.map((t) => [t, p.absorptions?.[t] ?? 0])),
    resistances: Object.fromEntries(RESISTANCE_TYPES.map((t) => [t, p.resistances?.[t] ?? 0])),
    content: Array.isArray(p.dlc) ? (p.dlc[0] ?? 0) : 0,
  }))
  const seen = new Set()
  for (const p of protectors) {
    if (seen.has(p.id)) throw new Error(`방어구 id 중복: ${p.id}`)
    seen.add(p.id)
    if (!['Head', 'Body', 'Arms', 'Legs'].includes(p.protectorType)) throw new Error(`알 수 없는 부위: ${p.name}`)
  }
  protectors.sort((a, b) => a.gameId - b.gameId)
  const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
  const body = protectors.map((p) => '  ' + JSON.stringify(p)).join(',\n')
  await writeFile(PROTECTOR_OUTPUT, `${header},\n "protectors": [\n${body}\n ]\n}\n`)
  console.log(`방어구 ${protectors.length}개 저장: ${PROTECTOR_OUTPUT}`)
}

/**
 * 탈리스만: 무게, 분류, 효과(속성·수치·계산 방식·조건), 함께 낄 수 없는 탈리스만.
 * 설명문은 저장하지 않고, 효과 수치로 화면에서 한국어 설명을 만든다.
 */
/** 효과 하나 (탈리스만·버프 공통): 속성, 수치, 계산 방식, PvP 수치, 조건, 지속 시간, 대상 */
function toEffect(e) {
  const effect = { attribute: e.attribute, value: e.value, model: e.model }
  if (typeof e.value_pvp === 'number' && e.value_pvp !== e.value) effect.valuePvp = e.value_pvp
  if (e.conditions?.length) effect.conditions = [].concat(e.conditions)
  if (typeof e.duration === 'number') effect.duration = e.duration
  // 효과를 받는 대상: 적(opponent), 주변 적(aoe), 주변 아군(ally-aoe), 나와 주변 아군(self-ally-aoe). 나 자신(self)이면 적지 않는다
  if (e.target && e.target !== 'self') effect.target = e.target
  return effect
}

/**
 * 버프: 효과가 있는 주문(기도·마술)과 소비 아이템.
 * 설명문은 저장하지 않는다. 같은 이름이 주문과 아이템에 모두 있으면 id 앞에 종류를 붙여 구분한다.
 */
async function importBuffs(ast, url) {
  const spells = findRecordValues(ast, ['fp_cost', 'slots_used', 'is_weapon_buff'], 100)
  const tools = findRecordValues(ast, ['max_held', 'is_consumed', 'category'], 100)
  if (!spells || !tools) throw new Error('주문·소비 아이템 데이터를 찾지 못했습니다')
  const hasEffects = (x) => Array.isArray(x.effects) && x.effects.length > 0
  // 빌드와 관계없는 아이템 종류(룬 얻기, 추억, 온라인 아이템)는 뺀다
  const SKIP_ITEM_CATEGORIES = ['Golden Rune', 'Rememberance', 'Online']
  const isBuffItem = (t) => hasEffects(t) && !SKIP_ITEM_CATEGORIES.includes(t.category)
  const toBuff = (raw, kind) => ({
    kind,
    id: `${kind}-${slugify(raw.name)}`,
    gameId: raw.id,
    name: raw.name,
    category: raw.category ?? '',
    weaponBuff: Boolean(raw.is_weapon_buff),
    effects: raw.effects.map(toEffect),
    // 일부 영약은 효과가 아니라 아이템에 지속 시간(effectDuration)이 있다
    ...(typeof raw.effectDuration === 'number' && raw.effectDuration > 0 ? { duration: raw.effectDuration } : {}),
    content: Array.isArray(raw.dlc) ? (raw.dlc[0] ?? 0) : 0,
  })
  const buffs = [...spells.filter(hasEffects).map((s) => toBuff(s, 'spell')), ...tools.filter(isBuffItem).map((t) => toBuff(t, 'item'))]
  const seen = new Set()
  for (const b of buffs) {
    if (seen.has(b.id)) throw new Error(`버프 id 중복: ${b.id}`)
    seen.add(b.id)
  }
  buffs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
  const body = buffs.map((b) => '  ' + JSON.stringify(b)).join(',\n')
  await writeFile(BUFF_OUTPUT, `${header},\n "buffs": [\n${body}\n ]\n}\n`)
  console.log(`버프 ${buffs.length}개 (주문 ${buffs.filter((b) => b.kind === 'spell').length}, 아이템 ${buffs.filter((b) => b.kind === 'item').length}) 저장: ${BUFF_OUTPUT}`)
}

async function importTalismans(ast, url) {
  const raw = findRecordValues(ast, ['effects', 'conflicts', 'categories'], 100)
  if (!raw) throw new Error('탈리스만 데이터를 찾지 못했습니다')
  const talismans = raw.map((t) => ({
    kind: 'talisman',
    id: slugify(t.name),
    gameId: t.id,
    name: t.name,
    weight: t.weight,
    categories: t.categories ?? [],
    effects: (t.effects ?? []).map(toEffect),
    conflicts: (t.conflicts ?? []).map(slugify).filter((id) => id !== slugify(t.name)),
    content: Array.isArray(t.dlc) ? (t.dlc[0] ?? 0) : 0,
  }))
  const seen = new Set()
  for (const t of talismans) {
    if (seen.has(t.id)) throw new Error(`탈리스만 id 중복: ${t.id}`)
    seen.add(t.id)
  }
  talismans.sort((a, b) => a.gameId - b.gameId)
  const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
  const body = talismans.map((t) => '  ' + JSON.stringify(t)).join(',\n')
  await writeFile(TALISMAN_OUTPUT, `${header},\n "talismans": [\n${body}\n ]\n}\n`)
  console.log(`탈리스만 ${talismans.length}개 저장: ${TALISMAN_OUTPUT}`)
}

/**
 * 능력치 곡선(CalcCorrectGraph 전체 형식): 방어력·내성 계산에 쓴다.
 * 구간 경계(stageMaxVal), 구간 끝 값(stageMaxGrowVal), 구간 안 곡률(adjPt_maxGrowVal) 5개씩
 */
async function importStatGraphs(ast, url) {
  const raw = findRecordValues(ast, ['stageMaxVal0', 'stageMaxGrowVal0', 'adjPt_maxGrowVal0'], 20)
  if (!raw) throw new Error('능력치 곡선을 찾지 못했습니다')
  const graphs = {}
  for (const g of raw) {
    const id = g['Row ID']
    if (typeof id !== 'number') continue
    const five = (prefix) => [0, 1, 2, 3, 4].map((i) => g[`${prefix}${i}`] ?? 0)
    graphs[id] = { name: String(g['Row Name'] ?? ''), stage: five('stageMaxVal'), grow: five('stageMaxGrowVal'), adj: five('adjPt_maxGrowVal') }
  }
  const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
  const lines = Object.entries(graphs).map(([id, g]) => `  "${id}": ${JSON.stringify(g)}`)
  await writeFile(STAT_GRAPH_OUTPUT, `${header},\n "graphs": {\n${lines.join(',\n')}\n }\n}\n`)
  console.log(`능력치 곡선 ${lines.length}개 저장: ${STAT_GRAPH_OUTPUT}`)
}

async function main() {
  const urls = process.argv[2] ? [process.argv[2]] : await findScriptUrls()
  for (const url of urls) {
    const source = await fetchText(url)
    if (!source.includes('upgrade_material') || !source.includes('full_hex_id')) continue
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
    const nodes = findWeaponNodes(ast)
    if (!nodes) continue

    const weapons = nodes.map((el) => toWeapon(literalValue(el)))
    const seen = new Map()
    for (const w of weapons) {
      if (seen.has(w.id)) throw new Error(`id 중복: ${w.id} (${seen.get(w.id)} / ${w.name})`)
      seen.set(w.id, w.name)
      if (typeof w.weight !== 'number' || !w.name) throw new Error(`데이터 형식이 예상과 다릅니다: ${JSON.stringify(w)}`)
    }
    weapons.sort((a, b) => a.gameId - b.gameId)
    // 변질 수치까지 들어 있어 크기가 커지므로 무기 한 개를 한 줄로 쓴다.
    const header = JSON.stringify({ source: url, importedAt: new Date().toISOString() }).slice(0, -1)
    const body = weapons.map((w) => '  ' + JSON.stringify(w)).join(',\n')
    await writeFile(OUTPUT, `${header},\n "weapons": [\n${body}\n ]\n}\n`)
    console.log(`무기 ${weapons.length}개 저장: ${OUTPUT}`)
    console.log(`출처: ${url}`)
    await importReinforcements(source, weapons)
    await importCorrection(urls, weapons)
    await importProtectors(ast, url)
    await importTalismans(ast, url)
    await importBuffs(ast, url)
    await importStatGraphs(ast, url)
    return
  }
  throw new Error('무기 데이터를 찾지 못했습니다. 사이트 구조가 바뀌었을 수 있습니다.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
