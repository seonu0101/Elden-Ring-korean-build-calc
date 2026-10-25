// 수집 분석기(Tarnished Ledger) 페이지를 Build Calc 디자인으로 바꿔 public/ledger/index.html 로 저장한다.
//
//   node scripts/restyle-ledger.mjs "C:\...\Tarnished Ledger — ELDEN RING 수집 분석기.html"
//
// 바꾸는 것은 첫 번째 <style> … </style> 블록(디자인), 아래쪽 유튜브 링크(FOOTER_LINK) 빼기, 용어(TERMS·무기군),
// 세이브 파일 이름 제한 풀기(FILE_PATCHES), Build Calc 이름표·언어 연결(BRIDGE)뿐이다. 그 밖의 HTML·스크립트는 그대로 둔다.
// 색은 속성(배경·글자·테두리)과 색 종류(어두운 면, 금색 강조, 초록, 빨강 등)에 따라 Build Calc의 색 변수로 바꾸고,
// 선택 상태·버튼·진행 막대처럼 강조가 필요한 곳은 맨 뒤의 덮어쓰기 규칙으로 Build Calc와 같게 맞춘다.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = process.argv[2]
if (!SOURCE) throw new Error('원본 HTML 경로를 주세요')
const OUTPUT = fileURLToPath(new URL('../public/ledger/index.html', import.meta.url))

/** 아래쪽 안내 줄의 유튜브 링크 (앞의 · 구분 기호와 함께 뺀다) */
const FOOTER_LINK = /<span>·<\/span><a href="https:\/\/youtube\.com\/@elden_load[^"]*"[^>]*>YouTube @elden_load<\/a>/

/**
 * 세이브 파일 이름 제한 풀기: 원본은 이름이 .sl2/.co2로 끝나야만 연다.
 * Seamless Co-op(.co2), 백업(ER0000.sl2.bak 등), 이름을 바꾼 파일도 열 수 있게 이름 검사를 빼고,
 * 파일 고르기 창에서도 모든 파일이 보이게 한다. 내용 검사(PC 세이브 BND4 / 암호화 BND4가 아니면
 * "PC용 ELDEN RING 세이브 파일로 확인되지 않습니다")는 원본 그대로라 다른 파일은 여전히 거른다.
 */
const FILE_PATCHES = [
  [`<input id="saveInput" type="file" accept=".sl2" hidden="">`, `<input id="saveInput" type="file" hidden="">`],
  [`if(!/\\.(sl2|co2)$/i.test(file.name)){toast('ER0000.sl2 파일을 선택해주세요.','warn');return}`, ``],
  [
    `<span>클릭하거나 세이브 파일을 여기에 놓으세요</span>`,
    `<span>클릭하거나 세이브 파일을 여기에 놓으세요 (.sl2 · .co2 · 백업 .bak 등)</span>`,
  ],
]

const original = await readFile(SOURCE, 'utf8')
if (!FOOTER_LINK.test(original)) throw new Error('유튜브 링크를 찾지 못했습니다')
let html = original.replace(FOOTER_LINK, '')
for (const [from, to] of FILE_PATCHES) {
  if (!html.includes(from)) throw new Error(`바꿀 곳을 찾지 못했습니다: ${from}`)
  html = html.replace(from, to)
}

/**
 * 용어를 Build Calc 표기로 (docs/glossary): 화면에 보이는 글자만 바꾸고, 비교·키로 쓰는 곳은 없다.
 * 아이템 이름은 아래 BRIDGE가 Build Calc 이름표(게임 파일에서 뽑은 공식 이름)를 먼저 쓰게 한다.
 */
const TERMS = [
  ['빛바랜 자 팩', '타니쉬드 에디션'],
  ['결정눈물', '영약'],
  ['영체 뼛가루', '소환 영체'],
]
for (const [from, to] of TERMS) {
  if (!html.includes(from)) throw new Error(`용어를 찾지 못했습니다: ${from}`)
  html = html.split(from).join(to)
}

// 무기군 이름(KO_META)은 Build Calc의 무기군 이름표(src/data/names-ko.generated.json)로
const NAMES_KO = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/names-ko.generated.json', import.meta.url)), 'utf8'))
const WEAPON_TYPE_ALIASES = { 'Hand-to-Hand Art': 'Hand-to-Hand' }
const metaStart = html.indexOf('const KO_META=Object.freeze({')
const metaEnd = html.indexOf('});', metaStart)
if (metaStart < 0 || metaEnd < 0) throw new Error('KO_META를 찾지 못했습니다')
const meta = html.slice(metaStart, metaEnd).replace(/'([^']+)':'([^']+)'/g, (whole, en, ko) => {
  const ours = NAMES_KO.weaponTypes[WEAPON_TYPE_ALIASES[en] ?? en]
  return ours && ours !== ko ? `'${en}':'${ours}'` : whole
})
html = html.slice(0, metaStart) + meta + html.slice(metaEnd)

/**
 * Build Calc 연결 (스크립트 맨 뒤에 따로 붙인다. 원본 함수는 감싸기만 하고 고치지 않는다).
 * - 부모 창(Build Calc)이 보내는 이름표 { 영어: 한국어 }를 게임 이름표보다 먼저 쓴다.
 * - 이름 언어가 English면 목록의 이름·지역·장소를 원래 영어로 보여 준다 (화면 문구는 한국어 그대로, 앱과 같다).
 * - 언어나 이름표가 바뀌면 이미 분석한 결과를 그 언어로 다시 그린다.
 */
const BRIDGE = `<script>
(()=>{
  const LANG_KEY='er-planner/name-language';
  let lang=(()=>{try{return localStorage.getItem(LANG_KEY)==='en'?'en':'ko'}catch(_){return'ko'}})();
  let names=new Map();
  const baseTranslate=translateKo,baseApply=applyKoreanNames;
  translateKo=function(v){return names.get(clean(v))||baseTranslate(v)};
  applyKoreanNames=function(db){
    baseApply(db);
    if(db&&lang==='en'){
      for(const x of db.list||[]){x.name=x.enName;if(x.enMeta)x.meta=x.enMeta;if(x.enRegion)x.region=x.enRegion;if(x.enPlace)x.place=x.enPlace;if(x.enSubcategory)x.subcategory=x.enSubcategory}
      for(const a of Object.values(db.byGroup||{}))a.sort((x,y)=>x.name.localeCompare(y.name,'en',{numeric:true,sensitivity:'base'}));
    }
    return db;
  };
  function refresh(){if(state.reference&&state.parsed){applyReference();renderAll()}}
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.data?.type!=='build-calc')return;
    if(e.data.names)names=new Map(Object.entries(e.data.names));
    if(e.data.lang==='en'||e.data.lang==='ko')lang=e.data.lang;
    document.documentElement.lang=lang==='en'?'en':'ko-KR';
    refresh();
  });
  if(window.parent!==window)window.parent.postMessage({type:'build-calc-ledger-ready'},location.origin);
})();
</script>
`
if (!html.includes('</body>')) throw new Error('</body>를 찾지 못했습니다')
html = html.replace('</body>', BRIDGE + '</body>')
const MARK = '<style>*[hidden]{display:none!important}'
const start = html.indexOf(MARK)
const end = html.indexOf('</style>', start)
if (start < 0 || end < 0) throw new Error('디자인 <style> 블록을 찾지 못했습니다')
const css = html.slice(start + '<style>'.length, end)

/* ---------- 색 분류 ---------- */
function parseHex(hex) {
  let h = hex.slice(1)
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 }
}
function classify(hex) {
  const { r, g, b, a } = parseHex(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (max !== min) {
    if (max === r) hue = 60 * (((g - b) / (max - min)) % 6)
    else if (max === g) hue = 60 * ((b - r) / (max - min) + 2)
    else hue = 60 * ((r - g) / (max - min) + 4)
  }
  if (hue < 0) hue += 360
  const kind =
    s > 0.25 && l > 0.08 && hue >= 25 && hue <= 60 ? 'gold'
    : s > 0.25 && hue > 90 && hue < 180 ? 'green'
    : s > 0.25 && (hue < 15 || hue > 340) ? 'red'
    : 'neutral'
  return { kind, l, a }
}

/** 속성과 색 종류로 Build Calc 색 변수를 고른다 */
function mapColor(prop, hex) {
  const { kind, l, a } = classify(hex)
  if (r(prop, 'background')) {
    if (a < 0.9 && l < 0.1) return 'rgba(0,0,0,.45)' // 모달 뒤 어두운 막
    if (kind === 'green' || kind === 'red' || kind === 'gold') return 'var(--muted-surface)'
    return l < 0.065 ? 'var(--surface)' : 'var(--muted-surface)'
  }
  if (prop === 'color') {
    if (kind === 'green') return 'var(--success)'
    if (kind === 'red') return 'var(--danger)'
    if (kind === 'gold') return 'var(--text)'
    if (l > 0.62) return 'var(--text)'
    if (l > 0.42) return 'var(--text-muted)'
    return 'var(--text-faint)'
  }
  if (r(prop, 'border') || prop === 'box-shadow' || prop === 'outline') {
    if (kind === 'green') return 'var(--success)'
    if (kind === 'red') return 'var(--danger)'
    if (kind === 'gold') return 'var(--border-strong)'
    return l > 0.27 ? 'var(--border-strong)' : 'var(--border)'
  }
  return hex
}
const r = (prop, prefix) => prop === prefix || prop.startsWith(prefix + '-')

/* ---------- 선언 바꾸기 ---------- */
const FONT = "system-ui,-apple-system,'Segoe UI','Malgun Gothic',sans-serif"
const fontSize = (px) => (px <= 10 ? px + 2 : px <= 12 ? px + 1 : px)
const radius = (px) => (px >= 999 ? px : px >= 9 ? 8 : px >= 6 ? 6 : px)

function mapDeclaration(prop, value) {
  if (prop === 'color-scheme') return null // 밝은/어두운 화면은 아래 변수가 정한다
  if (prop === 'font-family') return value.includes('monospace') ? value : FONT
  if (prop === 'font-size') return value.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${fontSize(Number(n))}px`)
  if (prop === 'font' ) return value.replace(/(\d+)px/, (_, n) => `${fontSize(Number(n))}px`)
  if (prop === 'border-radius') return value.replace(/(\d+)px/g, (_, n) => `${radius(Number(n))}px`)
  if (prop === 'letter-spacing') return /^-/.test(value) ? (parseFloat(value) < -0.5 ? '-.4px' : value) : value
  if (prop === 'box-shadow' && !value.includes('inset')) return 'none'
  if (r(prop, 'background') && /gradient\(/.test(value)) return 'var(--surface)'
  return value.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => mapColor(prop, hex))
}

function restyle(text) {
  // 규칙 몸통 { … } 안의 선언만 바꾼다 (@media·@keyframes 머리는 그대로)
  return text.replace(/\{([^{}]*)\}/g, (whole, body) => {
    if (!body.includes(':')) return whole
    const decls = body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':')
        if (i < 0) return d
        const prop = d.slice(0, i).trim()
        const mapped = mapDeclaration(prop, d.slice(i + 1).trim())
        return mapped === null ? null : `${prop}:${mapped}`
      })
      .filter((d) => d !== null)
    return `{${decls.join(';')}}`
  })
}

// 원본의 :root 색 변수는 Build Calc 변수로 다시 정의한다
const body = restyle(css.replace(/:root\{[^}]*\}/, ''))

const TOKENS = `:root{--bg:#ffffff;--surface:#ffffff;--muted-surface:#f6f6f7;--border:#e6e6e8;--border-strong:#d0d0d4;--text:#18181b;--text-muted:#71717a;--text-faint:#a1a1aa;--accent:#18181b;--accent-text:#ffffff;--danger:#dc2626;--success:#15803d;--warning:#b45309;--radius:8px;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--bg:#0f0f10;--surface:#0f0f10;--muted-surface:#18181b;--border:#27272a;--border-strong:#3f3f46;--text:#f4f4f5;--text-muted:#a1a1aa;--text-faint:#52525b;--accent:#f4f4f5;--accent-text:#18181b;--danger:#f87171;--success:#4ade80;--warning:#fbbf24;color-scheme:dark}}
:root{--panel:var(--surface);--panel2:var(--muted-surface);--line:var(--border);--line2:var(--border-strong);--muted:var(--text-muted);--gold:var(--text);--gold2:var(--text);--green:var(--success);--red:var(--danger);--blue:var(--text-muted)}
`

/** 강조가 필요한 곳: Build Calc의 선택 버튼(검은 바탕·흰 글자)과 같은 모양 */
const OVERRIDES = `
/* ---- Build Calc 디자인 맞춤 ---- */
body{background:var(--bg);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.topbar{height:56px;background:var(--bg);padding:0 24px}
.activity{top:56px;background:var(--muted-surface);border-bottom-color:var(--border);color:var(--text-muted)}
.mini-spinner,.detail-loading i{border-color:var(--border-strong);border-top-color:var(--text)}
.sidebar{top:80px}
.mark{background:var(--accent);border-color:var(--accent);color:var(--accent-text);border-radius:6px;width:32px;height:32px;font-size:12px}
.brand strong{font-size:15px;font-weight:600;letter-spacing:0}
.soft-pill,.pill{background:transparent;color:var(--text-muted);border-color:var(--border)}
.soft-pill.good,.soft-pill.secure,.pill.good,.status.done,.toast.ok{color:var(--success);border-color:color-mix(in srgb,var(--success) 45%,transparent);background:color-mix(in srgb,var(--success) 8%,transparent)}
.soft-pill.warn,.status,.toast.warn,.detail-warning span,.detail-error{color:var(--warning)!important;border-color:color-mix(in srgb,var(--warning) 45%,transparent);background:color-mix(in srgb,var(--warning) 8%,transparent)}
.detail-warning span,.detail-error{background:none}
.toast.bad{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,transparent)}
.pill.gold,.hero-kicker,.detail-badge,.section-title em,.cat-card.extra .cat-top em{color:var(--text-muted);border-color:var(--border-strong);background:transparent}
.dropzone{background:var(--surface);border-style:dashed;border-color:var(--border-strong);box-shadow:none}
.dropzone:hover,.dropzone.drag{background:var(--muted-surface);border-color:var(--text-muted)}
.drop-icon{background:var(--accent);border-color:var(--accent);color:var(--accent-text);border-radius:8px}
.empty-state h1{font-weight:700;letter-spacing:-.6px}
.baseline span,.metric,.category-wrap,.cat-card,.progress-panel,.save-help,.fallback-card,.detail-box,.detail-original,.analysis-notice{background:var(--surface)}
.baseline b{color:var(--text)}
.metric.primary{border-color:var(--border-strong);background:var(--muted-surface)}
.metric strong{font-weight:600;letter-spacing:-.4px}
.progress,.cat-progress{background:var(--muted-surface);border-color:var(--border)}
.progress i,.cat-progress i{background:var(--text)}
.cat-card.pending .cat-progress i{background:var(--border-strong)}
.cat-card:hover,.slot:hover,.item-row:hover,.boss-row:hover,.item-row.detail-openable:hover{background:var(--muted-surface);border-color:var(--border-strong)}
.slot.active{background:var(--muted-surface);border-color:var(--border-strong);box-shadow:inset 3px 0 0 var(--text)}
.slot.active strong{color:var(--text)}
.tab{background:transparent;color:var(--text-muted);border-color:var(--border);border-radius:6px;padding:6px 12px}
.tab b{color:var(--text-faint)}
.tab:hover{color:var(--text)}
.tab.active,.chip.active{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
.tab.active b{color:inherit;opacity:.7}
.chip{background:transparent;color:var(--text-muted);border-color:var(--border)}
.chip:hover{color:var(--text);border-color:var(--border-strong)}
.panel{background:var(--surface);box-shadow:none}
.btn{background:var(--accent);border-color:var(--accent);color:var(--accent-text);border-radius:6px;padding:5px 10px}
.btn:hover{opacity:.88}
.btn.ghost{background:transparent;border-color:var(--border);color:var(--text-muted)}
.btn.ghost:hover{color:var(--text);border-color:var(--border-strong);opacity:1}
.toolbar input{background:var(--surface);border-radius:6px;padding:6px 10px;font-size:13px}
.toolbar input:focus{border-color:var(--border-strong)}
.save-path,.path-card code{color:var(--text);font-weight:600}
.path-card code{background:var(--muted-surface)}
.yt-footer a,.inline-btn{color:var(--text);border-bottom-color:var(--border-strong)}
.yt-footer a:hover{color:var(--text-muted)}
.item-row.detail-openable .item-name small::after{color:var(--text-muted)}
.path-card,.detail-card,.toast{background:var(--surface);box-shadow:0 20px 60px rgba(0,0,0,.25)}
.detail-close{background:transparent;color:var(--text-muted);border-radius:6px}
.detail-close:hover{color:var(--text);border-color:var(--border-strong)}
.detail-warning{border-color:color-mix(in srgb,var(--warning) 45%,transparent)!important;background:color-mix(in srgb,var(--warning) 6%,transparent)!important}
.detail-main{color:var(--text)!important}
.analysis-notice{border-color:color-mix(in srgb,var(--warning) 45%,transparent)}
footer{color:var(--text-faint)}
`

const out = html.slice(0, start) + '<style>' + TOKENS + body + OVERRIDES + html.slice(end)
// 디자인 블록 밖(HTML·스크립트)은 그대로인지 확인
if (out.slice(out.indexOf('</style>', out.indexOf(TOKENS))) !== html.slice(end)) throw new Error('스타일 밖이 바뀌었습니다')
if (out.slice(0, start) !== html.slice(0, start)) throw new Error('스타일 앞이 바뀌었습니다')
await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, out)
console.log(`저장: ${OUTPUT} (스타일 ${css.length} → ${TOKENS.length + body.length + OVERRIDES.length}자, 나머지는 그대로)`)
