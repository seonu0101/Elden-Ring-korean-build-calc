<script setup lang="ts">
// 계산식 탭: 앱이 쓰는 모든 계산식을 정리한 페이지. 장비·스탯 설정과 무관하게 항상 같은 내용이다.
// 예시 숫자는 고정된 입력으로 실제 계산 함수를 불러서 만든다 (식과 결과가 어긋나지 않게).
import { calculateAttack, correctionGraphValue, CORRECTION_GRAPH_IDS } from '@/data/attackPower'
import { damageNegation, defenseBreakdown, GRAPH, statGraphParams, statGraphValue } from '@/data/defense'
import type { DefenseAttributes } from '@/data/defense'
import { curveAt, curvePieces, curveShape } from '@/data/curves'
import { calculateDamage } from '@/data/damage'
import { combineEffects } from '@/data/effects'
import { BUFFS_BY_ID, ITEMS_BY_ID } from '@/data/items'
import { itemName } from '@/data/names'
import { reinforcementRates } from '@/data/upgrade'
import { STACK_GROUPS } from '@/data/buffStacking'
import type { BuffItem, WeaponItem } from '@/types'
import { num, statGraphSteps } from './formulas'

/* ---------- 예시 입력 (고정) ---------- */
const LONGSWORD = ITEMS_BY_ID.get('longsword') as WeaponItem
const UCHIGATANA = ITEMS_BY_ID.get('uchigatana') as WeaponItem
const EX_STATS = { strength: 20, dexterity: 20, intelligence: 10, faith: 10, arcane: 10 }
const exAttack = calculateAttack(LONGSWORD, 'Standard', 25, EX_STATS)!
const exPhys = exAttack.details.physical
const exTwoHand = calculateAttack(LONGSWORD, 'Standard', 25, EX_STATS, true)!
const exUnmet = calculateAttack(LONGSWORD, 'Standard', 25, { ...EX_STATS, strength: 8 })!
const exBleed = calculateAttack(UCHIGATANA, 'Blood', 25, { ...EX_STATS, arcane: 30 })!
const exBleedDetail = exBleed.statusDetails.bleed
/** 예시에서 쓴 보정 곡선 값을 숫자 식으로 */
const exPhysCurves = exPhys.terms.map((t) => curveAt(t.graphId!, t.value, 100))
const exBleedCurve = curveAt(exBleedDetail.graphId!, 30, 100)

const EX_ATTRIBUTES: DefenseAttributes = {
  vigor: 40,
  mind: 20,
  endurance: 25,
  strength: 20,
  dexterity: 20,
  intelligence: 10,
  faith: 10,
  arcane: 10,
}
const exDefense = defenseBreakdown(EX_ATTRIBUTES)

const exGraph = statGraphSteps(GRAPH.levelDefense, exDefense.total)
const exGraphCheck = statGraphValue(GRAPH.levelDefense, exDefense.total)

const EX_PROTECTORS = [
  { absorptions: { physical: 10 } as Record<string, number> },
  { absorptions: { physical: 20 } as Record<string, number> },
] as Parameters<typeof damageNegation>[0]
const GOLDEN_VOW = BUFFS_BY_ID.get('spell-golden-vow') as BuffItem
const SHABRIRI = BUFFS_BY_ID.get('spell-howl-of-shabriri') as BuffItem
const exEffects = combineEffects([
  { id: GOLDEN_VOW.id, name: GOLDEN_VOW.name, type: 'spell', effects: GOLDEN_VOW.effects },
  { id: SHABRIRI.id, name: SHABRIRI.name, type: 'spell', effects: SHABRIRI.effects },
])
const exNegation = damageNegation(EX_PROTECTORS, { physical: 0.9 }).physical
const exNegationBuffed = damageNegation(EX_PROTECTORS, { physical: exEffects.damageTaken.physical.multiplier }).physical
const exBuffedAttack = Math.floor(
  (exAttack.damage.physical.base + exAttack.damage.physical.scaling) * exEffects.attack.physical.multiplier,
)

/** 실제 데미지 예시: Longsword 예시 공격력으로 방어력 120 · 경감률 20%인 상대를 때린다 */
const exPhysAttack = exAttack.damage.physical.base + exAttack.damage.physical.scaling
const exDamage = calculateDamage({
  attack: { physical: exPhysAttack, magic: 0, fire: 0, lightning: 0, holy: 0 },
  motionValue: 100,
  defense: { physical: 120, magic: 0, fire: 0, lightning: 0, holy: 0 },
  negation: { physical: 20, strike: 0, slash: 0, pierce: 0, magic: 0, fire: 0, lightning: 0, holy: 0 },
  physicalType: 'Standard',
})
const exDamagePart = exDamage.parts[0]!

/* ---------- 곡선 식 ---------- */
/** 방어력 곡선: 정확한 구간 식 */
const DEFENSE_CURVES = [
  { id: GRAPH.levelDefense, title: '기본 방어력 = ⌊곡선 #102(x)⌋, x = 8개 능력치 합', variable: 'x' },
  { id: GRAPH.strength, title: '물리·타격·참격·관통 = 기본 + ⌊곡선 #130(근력)⌋', variable: '근력' },
  { id: GRAPH.intelligence, title: '마력 = 기본 + ⌊곡선 #132(지력)⌋', variable: '지력' },
  { id: GRAPH.vigor, title: '화염 = 기본 + ⌊곡선 #133(생명력)⌋', variable: '생명력' },
  { id: GRAPH.arcane, title: '신성 = 기본 + ⌊곡선 #135(신비)⌋', variable: '신비' },
].map((c) => ({ ...c, pieces: curvePieces(c.id, 1, c.variable) }))

/** 무기 보정 곡선 #0~#16: 정확한 구간 식 (÷ 100 한 값이 보정 곡선값) */
const WEAPON_CURVES = CORRECTION_GRAPH_IDS.map((id) => ({
  id,
  name: curveShape(id)?.name.trim() || '',
  pieces: curvePieces(id, 100),
}))

/* ---------- 표 ---------- */
const GRAPH_STATS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 99, 150]
const correctionRows = CORRECTION_GRAPH_IDS.map((id) => ({
  id,
  values: GRAPH_STATS.map((s) => correctionGraphValue(id, s)),
}))

const DEFENSE_GRAPH_ROWS = [
  { id: GRAPH.levelDefense, label: '기본 방어력 (8개 능력치 합)' },
  { id: GRAPH.strength, label: '근력 → 물리·타격·참격·관통' },
  { id: GRAPH.intelligence, label: '지력 → 마력' },
  { id: GRAPH.vigor, label: '생명력 → 화염' },
  { id: GRAPH.arcane, label: '신비 → 신성' },
].map((r) => ({ ...r, g: statGraphParams(r.id)! }))

const UPGRADE_LEVELS = [0, 5, 10, 15, 20, 25]
const SOMBER_LEVELS = [0, 2, 4, 6, 8, 10]
const regularRates = UPGRADE_LEVELS.map((l) => ({ level: l, r: reinforcementRates(0, l)! }))
const somberRates = SOMBER_LEVELS.map((l) => ({ level: l, r: reinforcementRates(2200, l)! }))

const SECTIONS = [
  ['stats', '능력치'],
  ['upgrade', '강화'],
  ['attack', '무기 공격력'],
  ['status', '상태이상'],
  ['defense', '방어력'],
  ['curve', '능력치 곡선'],
  ['negation', '경감률'],
  ['damage', '실제 데미지'],
  ['effects', '탈리스만·버프'],
  ['weight', '무게·강인도'],
  ['tables', '참고 표'],
] as const
</script>

<template>
  <article class="fr" aria-label="계산식">
    <header class="fr__header">
      <h2 class="fr__title">계산식</h2>
      <p class="fr__lead">
        이 앱이 쓰는 계산식 전부입니다. 예시는 고정된 값으로 실제
        계산 함수를 돌린 결과라 장비나 스탯 설정에 따라 바뀌지 않습니다. ⌊x⌋는 소수점 버림입니다.
      </p>
      <nav class="fr__toc" aria-label="목차">
        <a v-for="[id, label] in SECTIONS" :key="id" :href="`#fr-${id}`">{{ label }}</a>
      </nav>
    </header>

    <!-- 능력치 -->
    <section id="fr-stats" class="fr__section" data-testid="fr-stats">
      <h3>1. 능력치</h3>
      <div class="fr__formula">룬 레벨 = (생명력 + 정신력 + 지구력 + 근력 + 기량 + 지력 + 신앙 + 신비) − 79</div>
      <div class="fr__formula">보너스 = Σ 장착 탈리스만·켠 버프의 능력치 더하기 효과 (예: 라다곤의 각인 +5)</div>
      <div class="fr__formula">공격력용 능력치 = min(99, max(1, 입력 + 보너스))</div>
      <div class="fr__formula">방어력용 능력치 = 입력 + 보너스 (상한 없음)</div>
      <div class="fr__formula">양손 근력 = min(150, ⌊근력 × 1.5⌋)</div>
      <ul class="fr__notes">
        <li>조건이 붙은 효과와 "중첩 불가"로 빠진 버프의 능력치는 더하지 않습니다.</li>
        <li>
          양손 1.5배는 주먹·갈고리·역수검·격투술·향수병·짐승 발톱과 일부 무기(Ornamental Straight Sword, Rellana's Twin Blades,
          Greatsword of Radahn, Starscourge Greatsword, Falx, Dancing Blade of Ranah)에는 적용되지 않습니다.
        </li>
      </ul>
      <div class="fr__example">
        예: 근력 20 양손 → ⌊20 × 1.5⌋ = <b>{{ exTwoHand.stats.strength }}</b>
      </div>
    </section>

    <!-- 강화 -->
    <section id="fr-upgrade" class="fr__section" data-testid="fr-upgrade">
      <h3>2. 강화</h3>
      <div class="fr__formula">강화 공격력 = 데이터 공격력 × 공격력 강화 배율[강화 표, 단계]</div>
      <div class="fr__formula">강화 보정 계수 = 데이터 보정 계수 × 보정 강화 배율[강화 표, 단계]</div>
      <div class="fr__formula">가드 경감률 = min(100, 데이터 경감률 × 가드 강화 배율) (소수 첫째 자리 반올림)</div>
      <div class="fr__formula">가드 강도 = ⌊데이터 강도 × 강도 강화 배율⌋</div>
      <div class="fr__formula">보정 수치 = ⌊보정 계수 × 100⌋, 등급 S 175+ · A 140+ · B 90+ · C 60+ · D 25+ · E 1+</div>
      <ul class="fr__notes">
        <li>배율은 +0에도 곱합니다. 일반 변질의 +0 배율은 1이지만 다른 변질은 0.75~0.95라 +0 공격력이 데이터보다 낮습니다.</li>
        <li>
          일반 무기(단석, +25)와 특수 무기(색 잃은 단석, +10)는 단계를 따로 정합니다. 연동하면 특수 = ⌊일반 × 10 / 25⌋, 일반 =
          반올림(특수 × 25 / 10).
        </li>
        <li>강화 표 번호는 무기·변질마다 데이터에 들어 있습니다 (아래 참고 표).</li>
      </ul>
    </section>

    <!-- 공격력 -->
    <section id="fr-attack" class="fr__section" data-testid="fr-attack">
      <h3>3. 무기 공격력</h3>
      <p class="fr__text">물리·마력·화염·벼락·신성 속성마다 따로 계산해서 더합니다.</p>
      <div class="fr__formula">기본값 = 데이터 공격력 × 공격력 강화 배율</div>
      <div class="fr__formula">
        능력치 한 줄 = 보정 계수 × 보정 강화 배율 × 보정 곡선값 × 비율 + (비율 − 1)
      </div>
      <div class="fr__formula">보정 곡선값 = 곡선 #번호(능력치) ÷ 100 — 곡선마다의 정확한 식은 6번</div>
      <div class="fr__formula">보정 배율 = Σ 능력치 줄 (그 속성을 보정하는 능력치만)</div>
      <div class="fr__formula">보정값 = 기본값 × 보정 배율</div>
      <div class="fr__formula">속성 공격력 = 기본값 + 보정값 (화면에는 ⌊⌋)</div>
      <div class="fr__formula">공격력 합계 = ⌊Σ 속성 (기본값 + 보정값)⌋ (속성마다 버리지 않고 더한 뒤 버림)</div>
      <ul class="fr__notes">
        <li>
          어떤 능력치가 그 속성을 보정하는지는 무기 데이터(보정 속성 표)에 정해져 있습니다. 보통 물리는 근력·기량, 마력은 지력,
          화염·신성은 신앙, 벼락은 기량입니다.
        </li>
        <li>비율은 대부분 1이라 줄이 "계수 × 강화 보정 × 곡선"이 됩니다. 일부 무기만 비율과 덮어쓰는 계수가 있습니다.</li>
        <li><b>요구 능력치 미달:</b> 그 속성을 보정하는 능력치 중 하나라도 요구치보다 낮으면 보정 배율 = −0.4 (40% 감소).</li>
        <li><b>음수 규칙:</b> 줄 중에 음수가 있으면 합 대신 가장 작은 값 하나만 보정 배율로 씁니다.</li>
        <li>곡선 번호는 무기·변질마다 데이터에 정해져 있습니다 (일반 #0, 중후 #1, 예리 #2, 상질 #8, 마력·화염·벼락·신성 #4 등). 능력치는 소수점 버림.</li>
      </ul>
      <div class="fr__example" data-testid="fr-attack-example">
        <div class="fr__example-title">예: {{ itemName(LONGSWORD) }} 일반 +25, 근력 20 · 기량 20 (물리)</div>
        <div>기본값 = {{ num(exPhys.raw) }} × {{ num(exPhys.rate) }} = {{ num(exAttack.damage.physical.base) }}</div>
        <div v-for="t in exPhys.terms" :key="t.stat">
          {{ t.stat === 'strength' ? '근력' : '기량' }} 줄 = {{ num(t.coefficient) }} × {{ num(t.scalingRate) }} × {{ num(t.graph) }} =
          {{ num(t.term) }}
          <div class="fr__example-curve">
            곡선 #{{ t.graphId }}({{ t.value }}) = {{ exPhysCurves[exPhys.terms.indexOf(t)]!.expr }} = {{ num(t.graph) }}
          </div>
        </div>
        <div>보정 배율 = {{ exPhys.terms.map((t) => num(t.term)).join(' + ') }} = {{ num(exPhys.multiplier) }}</div>
        <div>보정값 = {{ num(exAttack.damage.physical.base) }} × {{ num(exPhys.multiplier) }} = {{ num(exAttack.damage.physical.scaling) }}</div>
        <div>
          공격력 = ⌊{{ num(exAttack.damage.physical.base) }} + {{ num(exAttack.damage.physical.scaling) }}⌋ =
          <b>{{ exAttack.total }}</b>
        </div>
        <div class="fr__example-sub">
          근력이 8이면 (요구 10) 보정 배율 −0.4 → ⌊{{ num(exUnmet.damage.physical.base) }} × 0.6⌋ = <b>{{ exUnmet.total }}</b>
        </div>
      </div>
    </section>

    <!-- 상태이상 -->
    <section id="fr-status" class="fr__section" data-testid="fr-status">
      <h3>4. 상태이상 축적치</h3>
      <div class="fr__formula">기본값 = 강화 단계의 상태이상 값 (피 변질처럼 단계마다 정해진 값)</div>
      <div class="fr__formula">
        출혈·독·수면·발광 = ⌊기본값 + 기본값 × 신비 계수 × 보정 강화 배율 × 보정 곡선값(신비)⌋
      </div>
      <div class="fr__formula">동상·부패·죽음 등 = 기본값 (보정 없음)</div>
      <ul class="fr__notes">
        <li>신비가 요구치보다 낮으면 보정 배율 −0.4.</li>
        <li>신비 보정이 없는 무기는 신비 계수가 0이라 기본값 그대로입니다.</li>
      </ul>
      <div class="fr__example" data-testid="fr-status-example">
        <div class="fr__example-title">예: {{ itemName(UCHIGATANA) }} 피 +25, 신비 30 (출혈)</div>
        <div>
          보정 배율 = {{ num(exBleedDetail.coefficient) }} × {{ num(exBleedDetail.scalingRate) }} × {{ num(exBleedDetail.graph) }} =
          {{ num(exBleedDetail.multiplier) }}
          <div class="fr__example-curve">
            곡선 #{{ exBleedDetail.graphId }}(30) = {{ exBleedCurve.expr }} = {{ num(exBleedCurve.value) }}
          </div>
        </div>
        <div>
          출혈 = ⌊{{ num(exBleed.status.bleed.base) }} + {{ num(exBleed.status.bleed.base) }} × {{ num(exBleedDetail.multiplier) }}⌋ =
          <b>{{ Math.floor(exBleed.status.bleed.base + exBleed.status.bleed.scaling) }}</b>
        </div>
      </div>
    </section>

    <!-- 방어력 -->
    <section id="fr-defense" class="fr__section" data-testid="fr-defense">
      <h3>5. 방어력</h3>
      <div v-for="c in DEFENSE_CURVES" :key="c.id" class="fr__curve" :data-testid="`fr-defense-curve-${c.id}`">
        <div class="fr__formula">{{ c.title }}</div>
        <div v-for="(piece, i) in c.pieces" :key="i" class="fr__piece">
          <span class="fr__piece-range">{{ piece.range }}</span>
          <span class="fr__piece-expr">{{ piece.expr }}</span>
        </div>
      </div>
      <div class="fr__formula">벼락 = 기본</div>
      <ul class="fr__notes">
        <li>방어력용 능력치(탈리스만·버프 포함, 99 상한 없음)를 씁니다.</li>
      </ul>
      <div class="fr__example" data-testid="fr-defense-example">
        <div class="fr__example-title">예: 생명력 40 · 정신력 20 · 지구력 25 · 근력 20 · 기량 20 · 지력 10 · 신앙 10 · 신비 10</div>
        <div>
          능력치 합 = {{ exDefense.total }} → 기본 = ⌊{{ curveAt(GRAPH.levelDefense, exDefense.total).expr }} = {{
            num(exDefense.baseRaw)
          }}⌋ = {{ exDefense.base }}
        </div>
        <div>
          물리 = {{ exDefense.base }} + ⌊{{ curveAt(GRAPH.strength, 20).expr }} = {{ num(exDefense.bonus.physical!.raw) }}⌋ = <b>{{ exDefense.defense.physical }}</b> · 마력 =
          {{ exDefense.base }} + ⌊{{ num(exDefense.bonus.magic!.raw) }}⌋ = <b>{{ exDefense.defense.magic }}</b> · 화염 =
          {{ exDefense.base }} + ⌊{{ num(exDefense.bonus.fire!.raw) }}⌋ = <b>{{ exDefense.defense.fire }}</b> · 벼락 =
          <b>{{ exDefense.defense.lightning }}</b>
        </div>
      </div>
    </section>

    <!-- 곡선 -->
    <section id="fr-curve" class="fr__section" data-testid="fr-curve">
      <h3>6. 능력치 곡선</h3>
      <p class="fr__text">곡선마다 구간 경계 stage 5개, 경계에서의 값 grow 5개, 구간 곡률 adj가 있습니다.</p>
      <div class="fr__formula">x가 들어가는 구간 [stageᵢ, stageᵢ₊₁)을 찾는다 (마지막 stage 이상이면 growₘₐₓ)</div>
      <div class="fr__formula">t = (x − stageᵢ) / (stageᵢ₊₁ − stageᵢ)</div>
      <div class="fr__formula">곡률 adj ≥ 0: c = t^adj · adj &lt; 0: c = 1 − (1 − t)^(−adj)</div>
      <div class="fr__formula">값 = growᵢ + (growᵢ₊₁ − growᵢ) × c</div>
      <div class="fr__example" data-testid="fr-curve-example">
        <div class="fr__example-title">예: 곡선 #102, x = {{ exDefense.total }}</div>
        <div>
          구간 [{{ exGraph.start }}, {{ exGraph.end }}), t = ({{ exDefense.total }} − {{ exGraph.start }}) / ({{ exGraph.end }} −
          {{ exGraph.start }}) = {{ num(exGraph.t) }}
        </div>
        <div>c = {{ num(exGraph.t) }}^{{ num(exGraph.adj) }} = {{ num(exGraph.curved) }}</div>
        <div>
          값 = {{ num(exGraph.from) }} + ({{ num(exGraph.to) }} − {{ num(exGraph.from) }}) × {{ num(exGraph.curved) }} =
          <b>{{ num(exGraphCheck) }}</b>
        </div>
      </div>
      <h4 class="fr__subtitle">무기 보정 곡선 (#0~#16, 보정 곡선값 = 아래 식)</h4>
      <p class="fr__text">같은 구간 식에 곡선 데이터의 숫자를 넣은 것입니다 (보정 곡선 표와 오차 10⁻⁹ 이하). x = 능력치.</p>
      <div class="fr__curve-grid" data-testid="fr-weapon-curves">
        <div v-for="c in WEAPON_CURVES" :key="c.id" class="fr__curve">
          <div class="fr__curve-title">
            #{{ c.id }}<span v-if="c.name" class="fr__curve-name">{{ c.name }}</span>
          </div>
          <div v-for="(piece, i) in c.pieces" :key="i" class="fr__piece">
            <span class="fr__piece-range">{{ piece.range }}</span>
            <span class="fr__piece-expr">{{ piece.expr }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 경감률 -->
    <section id="fr-negation" class="fr__section" data-testid="fr-negation">
      <h3>7. 피해 경감률</h3>
      <div class="fr__formula">경감률(%) = 100 × (1 − Π(1 − 방어구 경감률 / 100) × 받는 피해 배율)</div>
      <ul class="fr__notes">
        <li>방어구끼리는 더하지 않고 "남는 피해"를 곱합니다. 같은 10%라도 많이 낄수록 효과가 줄어듭니다.</li>
        <li>받는 피해 배율은 탈리스만·버프의 경감 효과로 정해집니다 (아래 9번). 피해가 늘면 경감률이 음수가 될 수 있습니다.</li>
      </ul>
      <div class="fr__example" data-testid="fr-negation-example">
        <div class="fr__example-title">예: 물리 경감 10%와 20% 방어구, {{ itemName(GOLDEN_VOW) }}(받는 피해 ×0.9)</div>
        <div>100 × (1 − 0.9 × 0.8 × 0.9) = <b>{{ num(exNegation, 3) }}%</b></div>
        <div class="fr__example-sub">
          + {{ itemName(SHABRIRI) }}(×1.3)까지: 100 × (1 − 0.9 × 0.8 × {{ num(exEffects.damageTaken.physical.multiplier) }}) =
          <b>{{ num(exNegationBuffed, 3) }}%</b>
        </div>
      </div>
    </section>

    <!-- 실제 데미지 -->
    <section id="fr-damage" class="fr__section" data-testid="fr-damage">
      <h3>8. 실제 데미지</h3>
      <p class="fr__text">장비 화면 "실제 데미지"에서 상대 방어력·경감률을 넣어 계산합니다. 속성마다 따로 계산해서 더합니다.</p>
      <div class="fr__formula">공격 = 속성 공격력 × 모션 값 / 100 × 버프 공격력 배율</div>
      <div class="fr__formula">r = 공격 / 상대 방어력</div>
      <div class="fr__curve">
        <div class="fr__formula">방어 배율 f(r)</div>
        <div class="fr__piece"><span class="fr__piece-range">r ≥ 8</span><span class="fr__piece-expr">0.9</span></div>
        <div class="fr__piece">
          <span class="fr__piece-range">2.5 ≤ r &lt; 8</span><span class="fr__piece-expr">0.9 − 0.2 × ((8 − r) / 5.5)²</span>
        </div>
        <div class="fr__piece">
          <span class="fr__piece-range">1 ≤ r &lt; 2.5</span><span class="fr__piece-expr">0.7 − 0.3 × ((2.5 − r) / 1.5)²</span>
        </div>
        <div class="fr__piece">
          <span class="fr__piece-range">0.125 ≤ r &lt; 1</span><span class="fr__piece-expr">0.1 + 0.3 × ((r − 0.125) / 0.875)²</span>
        </div>
        <div class="fr__piece"><span class="fr__piece-range">r &lt; 0.125</span><span class="fr__piece-expr">0.1</span></div>
      </div>
      <div class="fr__formula">속성 피해 = 공격 × f(r) × (1 − 상대 경감률 / 100)</div>
      <div class="fr__formula">피해 = ⌊Σ 속성 피해⌋</div>
      <ul class="fr__notes">
        <li>물리 피해는 공격 종류(기본·타격·참격·관통)에 맞는 경감률을 씁니다. 방어력은 물리 하나입니다.</li>
        <li>모션 값은 공격 동작마다의 배율입니다 (약공격 100% 등). 반격·약점 부위·패리 치명타 배율은 넣지 않았습니다.</li>
      </ul>
      <div class="fr__example" data-testid="fr-damage-example">
        <div class="fr__example-title">예: 위 {{ itemName(LONGSWORD) }} 물리 공격 {{ num(exPhysAttack) }}, 상대 방어력 120 · 경감률 20%</div>
        <div>r = {{ num(exPhysAttack) }} / 120 = {{ num(exDamagePart.ratio) }} ({{ exDamagePart.step.range }})</div>
        <div>f = {{ exDamagePart.step.expr }} = {{ num(exDamagePart.multiplier) }}</div>
        <div>
          피해 = ⌊{{ num(exPhysAttack) }} × {{ num(exDamagePart.multiplier) }} × (1 − 20/100)⌋ = ⌊{{ num(exDamagePart.damage) }}⌋ =
          <b>{{ exDamage.total }}</b>
        </div>
      </div>
    </section>

    <!-- 효과 -->
    <section id="fr-effects" class="fr__section" data-testid="fr-effects">
      <h3>9. 탈리스만·버프 효과</h3>
      <div class="fr__formula">공격력 배율 = Π 공격력 효과 (곱연산)</div>
      <div class="fr__formula">받는 피해 배율 = Π (2 − 경감 효과)</div>
      <div class="fr__formula">더하기 효과 (능력치 등) = Σ 효과</div>
      <div class="fr__formula">버프 후 공격력 = ⌊Σ 속성 (기본값 + 보정값) × 그 속성 공격력 배율⌋</div>
      <ul class="fr__notes">
        <li>"Attack Power"는 모든 속성에, "Physical Attack Power" 등은 그 속성에만 곱합니다.</li>
        <li>
          경감 효과가 붙는 속성: 물리·타격·참격 = Absorption + Physical Absorption, 관통 = 여기에 Pierce Absorption, 마력·화염·벼락·신성 =
          Absorption + 그 속성 Absorption + Elemental Absorption.
        </li>
        <li>PvP를 고르면 PvP 수치가 있는 효과는 그 값을 씁니다.</li>
        <li>조건이 붙은 효과(점프 공격 시, HP가 낮을 때 등)는 항상 켜져 있지 않아 합계에서 뺍니다.</li>
        <li>
          중첩 불가: 같은 묶음의 버프는 나중에 켠 것만 적용합니다 —
          <template v-for="(g, i) in STACK_GROUPS" :key="g.id">{{ i ? ', ' : '' }}{{ g.label }}</template>, 같은 이름의 버프(주문판·전회판).
        </li>
      </ul>
      <div class="fr__example" data-testid="fr-effects-example">
        <div class="fr__example-title">예: {{ itemName(GOLDEN_VOW) }} + {{ itemName(SHABRIRI) }}</div>
        <div>
          공격력 = {{ exEffects.attack.physical.parts.map((p) => num(p.value)).join(' × ') }} =
          <b>×{{ num(exEffects.attack.physical.multiplier) }}</b> (+{{ num((exEffects.attack.physical.multiplier - 1) * 100, 2) }}%)
        </div>
        <div>
          받는 피해 = (2 − 1.1) × (2 − 0.7) = {{ exEffects.damageTaken.physical.parts.map((p) => num(p.value)).join(' × ') }} =
          <b>×{{ num(exEffects.damageTaken.physical.multiplier) }}</b>
        </div>
        <div class="fr__example-sub">
          {{ itemName(LONGSWORD) }} 예시(물리 {{ num(exAttack.damage.physical.base + exAttack.damage.physical.scaling) }})에 적용: ⌊{{
            num(exAttack.damage.physical.base + exAttack.damage.physical.scaling)
          }}
          × {{ num(exEffects.attack.physical.multiplier) }}⌋ = <b>{{ exBuffedAttack }}</b>
        </div>
      </div>
    </section>

    <!-- 무게 -->
    <section id="fr-weight" class="fr__section" data-testid="fr-weight">
      <h3>10. 무게·강인도</h3>
      <div class="fr__formula">무게 = Σ 장착한 무기·방어구·탈리스만 무게 (소수 첫째 자리까지 표시)</div>
      <div class="fr__formula">강인도 = ⌊Σ 장착한 방어구 강인도⌋</div>
    </section>

    <!-- 표 -->
    <section id="fr-tables" class="fr__section" data-testid="fr-tables">
      <h3>11. 참고 표</h3>

      <details class="fr__details" open>
        <summary>강화 배율 (일반 무기 강화 표 0)</summary>
        <div class="fr__scroll">
          <table class="fr__table">
            <thead>
              <tr>
                <th>단계</th>
                <th v-for="x in regularRates" :key="x.level" class="num">+{{ x.level }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>공격력 배율</th>
                <td v-for="x in regularRates" :key="x.level" class="num">{{ num(x.r.damage.physical) }}</td>
              </tr>
              <tr>
                <th>근력·기량 보정 배율</th>
                <td v-for="x in regularRates" :key="x.level" class="num">{{ num(x.r.scaling.strength) }}</td>
              </tr>
              <tr>
                <th>지력·신앙·신비 보정 배율</th>
                <td v-for="x in regularRates" :key="x.level" class="num">{{ num(x.r.scaling.intelligence) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details class="fr__details">
        <summary>강화 배율 (특수 무기 강화 표 2200)</summary>
        <div class="fr__scroll">
          <table class="fr__table">
            <thead>
              <tr>
                <th>단계</th>
                <th v-for="x in somberRates" :key="x.level" class="num">+{{ x.level }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>공격력 배율</th>
                <td v-for="x in somberRates" :key="x.level" class="num">{{ num(x.r.damage.physical) }}</td>
              </tr>
              <tr>
                <th>근력 보정 배율</th>
                <td v-for="x in somberRates" :key="x.level" class="num">{{ num(x.r.scaling.strength) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details class="fr__details">
        <summary>무기 보정 곡선 값 (능력치별)</summary>
        <div class="fr__scroll">
          <table class="fr__table" data-testid="fr-correction-table">
            <thead>
              <tr>
                <th>곡선</th>
                <th v-for="s in GRAPH_STATS" :key="s" class="num">{{ s }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in correctionRows" :key="row.id">
                <th>#{{ row.id }}</th>
                <td v-for="(v, i) in row.values" :key="i" class="num">{{ num(v, 3) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details class="fr__details">
        <summary>방어력 곡선 구간 값</summary>
        <div class="fr__scroll">
          <table class="fr__table">
            <thead>
              <tr>
                <th>곡선</th>
                <th>쓰임</th>
                <th>stage</th>
                <th>grow</th>
                <th>adj</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in DEFENSE_GRAPH_ROWS" :key="row.id">
                <th>#{{ row.id }}</th>
                <td>{{ row.label }}</td>
                <td>{{ row.g.stage.join(' · ') }}</td>
                <td>{{ row.g.grow.map((v) => num(v)).join(' · ') }}</td>
                <td>{{ row.g.adj.map((v) => num(v)).join(' · ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  </article>
</template>

<style scoped>
.fr {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fr__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.fr__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.fr__lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.fr__toc {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
}
.fr__toc a {
  color: var(--text-muted);
  text-decoration: none;
}
.fr__toc a:hover {
  color: var(--text);
  text-decoration: underline;
}
.fr__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.fr__section:last-child {
  border-bottom: none;
}
.fr__section h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
.fr__text {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.fr__formula {
  padding: 6px 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12.5px;
  background: var(--muted-surface);
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.fr__subtitle {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 600;
}
.fr__curve {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.fr__curve-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
  gap: 10px 16px;
}
.fr__curve-title {
  font-size: 12.5px;
  font-weight: 600;
}
.fr__curve-name {
  margin-left: 6px;
  font-weight: normal;
  color: var(--text-faint);
}
.fr__piece {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  padding: 1px 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}
.fr__piece-range {
  min-width: 128px;
  color: var(--text-muted);
}
.fr__piece-expr {
  overflow-wrap: anywhere;
}
.fr__example-curve {
  padding-left: 14px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11.5px;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.fr__notes {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.fr__notes li + li {
  margin-top: 2px;
}
.fr__example {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: 6px;
}
.fr__example-title {
  margin-bottom: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.fr__example-sub {
  margin-top: 4px;
  color: var(--text-muted);
}
.fr__details {
  margin-top: 6px;
  font-size: 12.5px;
}
.fr__details summary {
  cursor: pointer;
  color: var(--text-muted);
}
.fr__details summary:hover {
  color: var(--text);
}
.fr__scroll {
  margin-top: 6px;
  overflow-x: auto;
}
.fr__table {
  border-collapse: collapse;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.fr__table th,
.fr__table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}
.fr__table thead th {
  color: var(--text-muted);
}
.fr__table tbody th {
  color: var(--text-muted);
}
.fr__table .num {
  text-align: right;
}
</style>
