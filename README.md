# ER Build Calc

엘든 링 빌드 플래너. 화면은 세 가지입니다.

- **장비**: Game Menu Simulator(게임 장비 메뉴를 키보드/게임패드로 조작)와 장착 요약 패널
- **무기 표**: 무기 487개의 스펙 표. 검색, 종류·본편/DLC 필터, 열 정렬, CSV 내보내기, `+` 버튼으로 인벤토리에 추가.
  변질(인퓨전) 버튼 13개(표준·중후·예리·상질·화염·화염술·벼락·신성·마력·냉기·독·피·신비)로 변질별 공격력·보정·상태이상·가드를 볼 수 있습니다.
  **모든 변질 한번에 보기** 버튼은 무기마다 가능한 변질을 모두 행으로 펼쳐서(3,295행) 무기+변질 조합끼리 비교할 수 있게 합니다.
  변질 이름의 한국어 표기는 `src/data/labels.ts`의 `AFFINITY_LABELS`에서 고칠 수 있습니다.
  가드 경감률(물리·마력·화염·벼락·신성)과 가드 강도 열이 있습니다.
  정렬은 "정렬" 드롭다운(이름, 무기군, 무게, 변질, 요구 능력치, 공격력, 보정, 가드 경감률, 가드 강도, 상태이상)이나 열 제목 클릭으로 하고, 행이 많으면 300행씩 나눠서 그립니다.
- **스탯**: 능력치 8개(룬 레벨 자동 계산), 한손/양손, 강화 단계를 정하면 장착한 무기(오른손·왼손 1~3)의 **공격력**(속성별 기본값 + 보정값)과
  **상태이상 축적치**(출혈·독·수면·발광은 신비 보정 포함)를 계산합니다. 칸마다 변질을 고를 수 있고, 장착하지 않은 무기도 이름으로 골라 계산할 수 있습니다.
  요구 능력치가 모자라면 경고하고 그 속성 공격력은 40% 줄어듭니다. 설정은 브라우저에 저장됩니다.

## 공격력 계산 (`src/data/attackPower.ts`)

원본 사이트 계산기의 식을 그대로 옮겼고, 원본 사이트에서 직접 뽑은 15개 사례(`tests/fixtures/attackReference.json`)와 값이 정확히 같은지 테스트합니다.

- 기본값 = 데이터 공격력 × 강화 배율
- 보정값 = 기본값 × Σ(보정 계수 × 강화 보정 배율 × 보정 곡선[능력치]) — 요구 능력치 부족 시 대신 −0.4
- 양손: 근력 × 1.5(최대 150). 주먹·손톱·역수검 등 일부 무기는 제외
- 상태이상(출혈·독·수면·발광)은 신비로만 보정, 냉기·부패는 보정 없음
- 보정 곡선·보정 비율은 `src/data/correction.generated.json`(`npm run import:weapons`로 함께 갱신)
- 장착 탈리스만과 장비 화면에서 켠 버프(거대한 룬 포함)의 능력치는 최종 능력치에 반영됩니다. 적 방어력(실제 피해량)은 아직 반영하지 않습니다.

## 실행

```bash
npm install            # 처음 한 번
npm run dev            # 개발 서버 (http://localhost:5173)
npm test               # 테스트
npm run build          # 타입 검사 + 배포용 빌드 (dist/calc/)
npm run preview        # 빌드 결과 확인 (http://localhost:4173/calc/)
npm run import:weapons # 무기 데이터 다시 가져오기
```

## 배포

빌드하면 모든 경로 앞에 `/calc/`가 붙고 결과물은 `dist/calc/`에 생긴다 (`vite.config.ts`의 `base`·`outDir`).

### GitHub Pages

공개 주소: https://seonu0101.github.io/Elden-Ring-korean-build-calc/

`.github/workflows/pages.yml`은 `main`에 올리면 아래 순서로 검사하고 배포한다.

1. Node.js 24에서 `npm ci`로 잠금 파일대로 의존성을 설치한다.
2. `npm test`로 테스트를 돌린다.
3. `npm run build -- --base "/Elden-Ring-korean-build-calc/"`로 타입 검사와 빌드를 한다 (저장소 이름을 경로로 쓴다).
4. 모두 통과하면 `dist/calc/`의 내용을 GitHub Pages에 올린다.

Pull Request에서는 검사와 빌드만 하고 공개 사이트는 바꾸지 않는다. 실패하면 직전에 성공한 배포가 그대로 남는다.
저장소 Settings → Pages → Source는 **GitHub Actions**로 둔다.

무기·방어구·탈리스만 데이터와 이미지는 저장소에 넣어 둔 것을 쓴다. CI에서 원본 사이트를 다시 가져오지 않는다.

### Netlify (er-sin.com/calc)

GitHub 저장소를 Netlify 사이트에 연결하면 `netlify.toml` 설정대로 `/calc/` 경로로 빌드된다.
er-sin.com 사이트에서는 `/calc/*`를 배포한 사이트로 프록시한다 (status 200).

## 이름 언어 (한국어 / English)

머리글 오른쪽 버튼으로 아이템·무기군 이름을 한국어(게임 한국어판 공식 이름)와 영어로 바꾼다. 기본은 한국어이고 브라우저에 기억한다.

- 이름 함수: `src/data/names.ts` (`itemName`, `weaponTypeName`). 검색은 두 언어 모두로 되고, 이름 정렬·CSV는 화면 언어를 따른다.
- 계산 규칙(중첩 묶음, 양손 예외 무기 등)은 언어와 관계없이 영어 원문 이름으로 판단한다.
- 한국어 이름은 게임 파일에서 읽는다: UXM Selective Unpack으로 `GamemsgkorKR`·`engUS`의 `item_dlc02.msgbnd.dcx`, `menu_dlc02.msgbnd.dcx`를 꺼내 WitchyBND로 푼 뒤 `npm run import:korean-names` (다른 위치면 `-- "경로Gamemsg"`). `.fmg`는 `scripts/fmg.mjs`가 읽는다.
- 한국어 이름이 없는 아이템은 한국어 모드에서도 영어로 보인다 (지금은 없음).
- 이름 목록: `docs/names.md`, `docs/names.csv` (`npm run names`)

## 출처

앱 화면에는 출처를 쓰지 않고 여기에만 모아 둔다.

| 자료 | 출처 | 파일 |
| --- | --- | --- |
| 무기·방어구·탈리스만·버프 수치, 강화 배율, 보정·능력치 곡선, 공격력·방어력 계산식 | [ER Build Planner](https://er-build-planner.nyasu.business/) (이용약관에 따라 **비상업적 용도로만**) | `src/data/*.generated.json`, `scripts/import-weapons.mjs` |
| 아이템 이미지 | Elden Ring Tourney Manager v1.1.0 (`public/img`) | `public/img/` |
| 한국어 이름 (게임 한국어판 공식, 아이템 1,557개·무기군 42개, 본편·DLC·타니쉬드 에디션) | 게임 파일 `GamemsgkorKR`, `engUS` (UXM Selective Unpack으로 추출, WitchyBND로 푼 `.fmg`) | `src/data/names-ko.generated.json`, `scripts/import-korean-names.mjs`, `scripts/fmg.mjs`, `docs/names.md` |
| 버프 지속 시간 26개 (원본에 값이 없는 것만) | Fextralife Elden Ring Wiki — [Buffs and Debuffs](https://eldenring.wiki.fextralife.com/Buffs_and_Debuffs) 18개, [Crystal Tears](https://eldenring.wiki.fextralife.com/Crystal_Tears) 영약 8개 (2026-10-16 확인) | `src/data/buff-durations.wiki.json` |
| 수집 분석기 탭 (세이브 파일로 수집 현황 분석) | Tarnished Ledger v2.5.0 — [ngj7730-bit.github.io](https://ngj7730-bit.github.io/) (만든 사람의 허락을 받아 사용, 디자인과 파일 이름 제한만 바꿈). 실행 중에 [CyberGiant7/Elden-Ring-Automatic-Checklist](https://github.com/CyberGiant7/Elden-Ring-Automatic-Checklist)의 체크리스트 데이터와 [ELDEN RING Wiki (wiki.gg)](https://eldenring.wiki.gg/)를 불러온다 | `public/ledger/index.html`, `scripts/restyle-ledger.mjs` |
| 게임 이름·아이콘 | ELDEN RING © Bandai Namco Entertainment Inc. / © FromSoftware, Inc. | — |

버프 지속 시간은 원본 사이트 값이 우선이다. 원본에 없을 때만 위키 값을 쓴다 (`src/data/buffDurations.ts`).
원본과 위키가 다른 18개는 원본 값을 쓴다: 경화 고기류(원본 120초, 위키 35초), 흰 경화 고기류(120 / 105),
상태이상 당김줄 기름 4종(10 / 15), 금·은 절인 새발(120 / 180), 고양의 향(45 / 40), 검은 불꽃 칼날(60 / 7),
불의 대죄(30 / 40), 기름 적신 영약(60 / 30).

## 수집 분석기

상단 "계산식" 오른쪽 탭. Tarnished Ledger 페이지를 iframe으로 띄운다 (`src/features/ledger/LedgerView.vue`).
세이브 파일(ER0000.sl2)은 브라우저 안에서만 읽고 어디에도 올리지 않는다.

원본 페이지에서 바꾼 것은 디자인(CSS), 아래쪽 유튜브 링크, 세이브 파일 이름 제한뿐이다.
원본은 이름이 .sl2/.co2로 끝나는 파일만 열지만, 백업(.bak)이나 이름을 바꾼 파일도 열 수 있게 이름 검사를 뺐다.
파일 내용이 PC 세이브(BND4)인지 보는 검사는 그대로라, 세이브가 아닌 파일은 여전히 거른다.
용어는 앱 표기로 바꿨다(빛바랜 자 팩 → 타니쉬드 에디션, 결정눈물 → 영약, 영체 뼛가루 → 소환 영체, 무기군 이름).
아이템 이름은 앱의 이름표(무기·방어구·탈리스만·버프)를 먼저 쓰고, 상단 한국어/English 버튼을 누르면 분석 결과의 이름·지역도 그 언어로 바뀐다
(화면 문구는 앱과 같이 한국어 그대로). 이 연결은 페이지 맨 뒤에 붙인 작은 스크립트가 하고, 그 밖의 기능 스크립트는 그대로다.
원본 HTML을 받아 다시 만들 때:

```bash
node scripts/restyle-ledger.mjs "원본 HTML 경로"
```

## 아이템 이미지

장비 화면의 장비 칸과 아이템 목록은 무기·방어구·탈리스만을 이미지로 보여줍니다(이름은 마우스를 올리거나 아래 상세 정보에서). 무기 표에는 이미지가 없습니다.

- 이미지는 `../elden-ring-tourney-manager-v1.1.0/public/img/{weapons,protectors,talismans}`에서 `public/img/<같은 폴더>/<아이템 id>.png`로 복사한 것입니다. 무기 487개, 방어구 13개, 탈리스만 12개 모두 있습니다.
- 아이템 데이터를 바꿨거나 이미지 폴더가 바뀌면 `npm run copy:item-images`(다른 폴더면 `-- "경로\public\img"`)를 실행합니다. 이름의 악센트·대소문자 차이는 무시하고 찾습니다.
- 이미지를 불러오지 못하면 아이템 이름 글자로 대신 보여줍니다.

## 무기 데이터

`src/data/weapons.generated.json`은 [ER Build Planner](https://er-build-planner.nyasu.business/)에서 한 번 추출해 저장한 파일입니다. 앱은 실행 중에 사이트에 접속하지 않습니다.

- 사이트 데이터가 갱신되면 `npm run import:weapons`로 파일을 다시 만듭니다. 스크립트는 사이트의 JS 파일을 내려받아 **파싱만 하고 실행하지 않으며**, 아이템 설명문은 저장하지 않습니다.
- 원본 사이트 이용약관에 따라 **비상업적 용도로만** 사용해야 합니다.
- 강화 단계(일반 무기 +0~25, 특수 무기 +0~10)를 정하면 공격력·보정·가드·상태이상이 강화 수치로 바뀝니다. 강화 배율은 `src/data/reinforcements.generated.json`(같은 명령으로 함께 갱신)에서 읽습니다.
- 데이터의 공격력은 강화 배율을 곱하기 전 값이라 +0에도 배율을 곱합니다(표준 이외 변질은 +0 배율이 0.75~0.95). 원본 사이트와 같은 계산입니다.
- 무기 표는 "내 스탯 적용"이 켜져 있으면 스탯 화면의 능력치·한손/양손으로 공격력과 상태이상 축적치를 계산해서 보여주고, 그 값으로 정렬합니다. 공격력 칸에 마우스를 올리면 "기본 + 보정"이 보이고, 모자란 요구 능력치는 빨갛게 표시됩니다. 끄면 능력 보정 전 무기 수치를 보여줍니다.
- 장비 화면에서 무기에 커서를 두면 상세 정보도 스탯 화면 설정(능력치·강화·한손/양손, 그 무기 칸에 고른 변질)으로 계산한 공격력·상태이상·보정을 보여주고, 모자란 요구 능력치는 빨갛게 표시합니다.
- 강화 단계와 한손/양손은 무기 표와 스탯 화면이 같은 설정을 씁니다. 보정 등급·가드 수치는 능력치와 무관합니다.
- **방어구 표**(722개: 부위·무게·강인도·경감률 8종·내성 4종)와 **탈리스만 표**(154개: 분류·무게·효과·함께 낄 수 없는 탈리스만)가 무기 표 오른쪽 탭에 있습니다. 검색, 부위/분류·본편/DLC 필터, 열 정렬, CSV, `+`로 인벤토리 추가가 됩니다. 탈리스만 효과는 데이터 수치로 만든 한국어 설명이고 번역은 `src/data/talismanEffects.ts`에서 고칠 수 있습니다.
- 방어구 722개도 같은 명령으로 `src/data/protectors.generated.json`(무게·강인도·속성별 경감률·상태이상 내성)에 가져옵니다. 탈리스만은 아직 샘플 데이터입니다.
- 장비 화면 왼쪽 아래 **버프·탈리스만 효과** 패널: 버프(주문 69개·소비 아이템 125개, `src/data/buffs.generated.json`)를 골라 켜면, 장착 탈리스만과 합친 효과를 곱연산으로 보여줍니다(예: 황금 맹세 +15% × 샤브리리의 외침 +25% = +43.75%). 받는 피해 배율, 장착 무기의 버프 전→후 공격력, 그 밖의 효과(능력치 등), 조건부 효과(합계에서 뺌)도 나옵니다. PvE/PvP를 고를 수 있고, 경감 효과는 요약의 경감률 표에도 들어갑니다.
  같은 종류라 겹치지 않는 버프는 **중첩 불가**로 표시하고 나중에 켠 것만 계산합니다(무기 버프끼리, 불이여 힘을·고양된 고기, 같은 버프의 기도판·전회판). 규칙은 `src/data/buffStacking.ts`에 직접 적은 것이라 다른 조합은 아직 없습니다.
- 탈리스만·켠 버프가 올려 주는 **능력치**(예: 라다곤의 각인 +5)는 최종 능력치에 더해져(최대 99) 공격력·상태이상 축적치·방어력·요구 능력치 판정에 모두 반영됩니다. 스탯 화면에 "+5 → 25"처럼 보입니다.
- 장비 화면 요약 패널에 **상태이상 축적치** 표(장착한 무기마다 출혈·냉기·독·부패·수면·발광)가 있습니다. 스탯 화면 설정(능력치·강화·한손/양손·칸별 변질)으로 계산하고, 출혈·독·수면·발광은 신비 보정이 들어갑니다.
- 장비 화면 요약 패널에 **방어력 / 경감률**(물리·타격·참격·관통·마력·화염·번개·신성)이 나옵니다. 방어력은 스탯 화면 능력치와 `src/data/stat-graphs.generated.json`의 능력치 곡선으로, 경감률은 장착 방어구로 계산합니다(원본 사이트와 같은 계산, 탈리스만·버프 효과는 아직 없음).

## 조작

| 키보드 | 게임패드 | 동작 |
|---|---|---|
| Esc | Start | 메뉴 열기/닫기 |
| 방향키 | 십자키 | 이동 (누르고 있으면 반복). 스틱으로는 이동하지 않음 |
| E, Enter | A | 열기 / 장착 (장착해도 목록은 열린 채로 남음) |
| Q | B | 뒤로 (목록 닫기) |
| R | (없음) | 지금 칸 장착 해제 (목록은 열린 채로) |
| C / V | L1 / R1 | 목록을 연 채로 이전/다음 칸. 무기는 RH1~3·LH1~3 6칸이 한 바퀴로 이어짐 (RH1 ← LH3, RH3 → LH1), 방어구·탈리스만은 각 줄 안에서 |
| PgUp / PgDn | L2 / R2 | 목록 5줄씩 이동 |

마우스: 클릭으로 선택, 더블클릭으로 열기·장착.

게임처럼 같은 탈리스만 두 개, 또는 함께 낄 수 없는 탈리스만(황금나무의 가호와 +1 등)은 동시에 장착할 수 없고, 고르면 이유가 표시됩니다. 같은 칸에서 바꿔 끼우는 것은 됩니다.

한 칸씩 장착 해제는 키보드 **R** 키로 합니다(화면의 × 버튼·"장착 해제" 칸은 없음). 장착 중인 아이템을 다시 골라도 해제되지 않습니다. 요약 패널의 **초기화**를 누르면(확인 후) 장착한 장비와 인벤토리의 모든 아이템(무기·방어구·탈리스만)이 지워집니다. 아이템은 무기 표·방어구 표·탈리스만 표의 `+` 버튼으로 다시 넣을 수 있습니다. 화면 아래 키 안내에는 키보드 키와 게임패드 버튼(Xbox 배치, 둥근 표시)이 함께 나옵니다.

## 구조

```
src/
  types.ts                      아이템·인벤토리 타입
  data/items.ts                 아이템 목록, 처음 인벤토리에 들어 있는 무기
  data/weapons.generated.json   가져온 무기 데이터 (직접 고치지 말고 import:weapons로 갱신)
  data/labels.ts                한국어 이름표, 보정 등급 계산
  stores/character.ts           캐릭터 저장소 (Pinia): 인벤토리, 장착 규칙, 합계, localStorage 저장
  components/                   여러 기능이 같이 쓰는 컴포넌트
  features/gameMenu/
    layout.ts                   장비 칸 배치 (오른손 3, 왼손 3, 방어구 4, 탈리스만 4)
    navigation.ts               커서 이동 계산 (순수 함수)
    useGameMenu.ts              메뉴 상태 전환 (game → menu → grid → inventory)
    useKeyboardInput.ts         키 → 메뉴 동작
    useGamepadInput.ts          게임패드 → 메뉴 동작 (Gamepad API)
    GameMenuSimulator.vue       화면
  features/weaponTable/
    weaponTable.ts              검색·정렬·CSV (순수 함수)
    WeaponTable.vue             표 화면
scripts/import-weapons.mjs      무기 데이터 가져오기
tests/                          Vitest 테스트
```

## 새 기능 추가하기

1. `src/features/<기능이름>/` 폴더를 만들고 컴포넌트를 넣습니다.
2. 캐릭터 데이터가 필요하면 `useCharacterStore()`를 씁니다. 장비가 바뀌면 자동으로 다시 계산됩니다.
3. 여러 기능이 같이 쓰는 값(예: 스탯, 총 방어력)은 `stores/character.ts`에 `computed`로 추가합니다.
4. `App.vue`에 컴포넌트를 배치하고 `tests/`에 테스트를 추가합니다.

## 원본과 다른 점

- 칸 수가 다른 줄로 옮길 때 원본은 커서가 첫 칸으로 튀었지만, 여기서는 그 줄의 마지막 칸으로 맞춥니다.
- Ctrl+C 같은 단축키, 입력창에 글을 쓰는 중의 키 입력은 가로채지 않습니다.
- 게임패드 왼쪽 스틱과 방향 입력 길게 누르기(반복)를 지원합니다.
- 다른 칸에 장착된 아이템도 목록에서 속이 빈 점으로 표시합니다 (지금 칸에 장착된 아이템은 꽉 찬 점).

TypeScript는 `vue-tsc`가 아직 TypeScript 7을 지원하지 않아서 5.9로 고정했습니다.
