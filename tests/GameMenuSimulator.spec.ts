import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import GameMenuSimulator from '@/features/gameMenu/GameMenuSimulator.vue'
import EquipmentSummary from '@/components/EquipmentSummary.vue'
import { useCharacterStore } from '@/stores/character'
import { STATS_STORAGE_KEY, useStatsStore } from '@/stores/stats'

let wrappers: VueWrapper[] = []

function mountSimulator() {
  const pinia = createPinia()
  const simulator = mount(GameMenuSimulator, { global: { plugins: [pinia] }, attachTo: document.body })
  const summary = mount(EquipmentSummary, { global: { plugins: [pinia] } })
  wrappers.push(simulator, summary)
  return { simulator, summary }
}

async function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  // jsdom에는 scrollIntoView가 없다
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
})

describe('GameMenuSimulator', () => {
  it('키보드로 무기를 바꾸면 화면과 요약 패널이 함께 바뀐다', async () => {
    const { simulator, summary } = mountSimulator()
    const cells = () => simulator.findAll('[data-testid="equip-cell"]')
    expect(cells()).toHaveLength(14)
    expect(cells()[0]!.classes()).toContain('is-cursor')
    expect(summary.text()).toContain('Longsword')

    await press('ArrowRight')
    expect(cells()[1]!.classes()).toContain('is-cursor')

    await press('e')
    const inv = simulator.findAll('[data-testid="inventory-cell"]')
    expect(inv.length).toBeGreaterThan(5)
    expect(simulator.text()).toContain('RH2')

    await press('ArrowRight')
    expect(simulator.find('[data-testid="detail"]').text()).toContain('Uchigatana')

    await press('e')
    expect(summary.text()).toContain('Uchigatana')
    // 장착해도 목록이 닫히지 않는다
    expect(simulator.findAll('[data-testid="inventory-cell"]').length).toBeGreaterThan(5)
    expect(simulator.find('[data-testid="detail"]').text()).toContain('장착 중')

    // Q로 목록을 닫으면 격자로 돌아간다
    await press('q')
    expect(simulator.findAll('[data-testid="equip-cell"]')).toHaveLength(14)
  })

  it('장착 해제는 키보드 R 키로만 한다 (X·Delete 키, × 버튼, 모두 해제, 목록의 해제 칸 없음)', async () => {
    const { simulator, summary } = mountSimulator()
    await press('x')
    await press('Delete')
    expect(summary.text()).toContain('Longsword')
    expect(simulator.find('[data-testid="unequip-button"]').exists()).toBe(false)
    expect(summary.find('[data-testid="unequip-all"]').exists()).toBe(false)
    expect(summary.text()).not.toContain('모두 해제')

    await press('e')
    expect(simulator.findAll('[data-testid="inventory-cell"]')[0]!.text()).not.toContain('장착 해제')
    // 장착 중인 아이템을 다시 골라도 그대로
    await press('e')
    expect(summary.text()).toContain('Longsword')

    // R 키로 해제하고 목록은 열린 채로
    await press('r')
    expect(summary.text()).not.toContain('Longsword')
    expect(simulator.findAll('[data-testid="inventory-cell"]').length).toBeGreaterThan(0)
  })

  it('키 안내에 키보드 키와 게임패드 버튼이 함께 나온다', async () => {
    const { simulator } = mountSimulator()
    // 화면의 띄어쓰기는 CSS 간격이라 글자만 비교한다
    const guide = () => simulator.find('[data-testid="key-guide"]').text().replace(/\s+/g, '')
    expect(guide()).toContain('E/A열기')
    expect(guide()).toContain('↑↓←→/십자키이동')
    expect(guide()).toContain('R장착해제')
    expect(guide()).toContain('Esc/Start닫기')
    await press('e')
    expect(guide()).toContain('E/A장착')
    expect(guide()).toContain('Q/B목록닫기')
    expect(guide()).toContain('CV/LBRB칸전환')
    expect(guide()).toContain('PgUpPgDn/LTRT페이지')
  })

  it('무기 목록 위 탭에 오른손·왼손 6칸이 보이고 C/V로 넘어간다', async () => {
    const { simulator } = mountSimulator()
    await press('e')
    const tabs = () => simulator.findAll('[data-testid="slot-tab"]')
    expect(tabs().map((t) => t.text())).toEqual(['RH1', 'RH2', 'RH3', 'LH1', 'LH2', 'LH3'])
    expect(tabs()[0]!.classes()).toContain('is-active')
    await press('c')
    expect(tabs()[5]!.classes()).toContain('is-active')
    expect(simulator.text()).toContain('왼손 무기 3')
  })

  it('입력창에 글을 쓸 때는 키를 가로채지 않는다', async () => {
    const { simulator } = mountSimulator()
    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    expect(simulator.findAll('[data-testid="equip-cell"]')[0]!.classes()).toContain('is-cursor')
    input.remove()
  })

  it('Esc로 메뉴를 닫고 다시 열 수 있다', async () => {
    const { simulator } = mountSimulator()
    await press('Escape')
    expect(simulator.text()).toContain('메뉴 열기')
    await press('Escape')
    expect(simulator.text()).toContain('Equipment')
    await press('e')
    expect(simulator.findAll('[data-testid="equip-cell"]')).toHaveLength(14)
  })
})

describe('무기 상세 정보: 스탯 화면 설정으로 계산', () => {
  // 원본 사이트 계산기 값 (tests/fixtures/attackReference.json)
  //   우치가타나 일반 +25, 근30 기50 지10 신10 비30 → 공격력 498, 출혈 45
  //   우치가타나 피 +25, 같은 능력치 → 공격력 484, 출혈 82 + 9.36 = 91
  function setStats(extra: Record<string, unknown> = {}) {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        attributes: { vigor: 40, mind: 20, endurance: 25, strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 },
        upgradeRegular: 25,
        upgradeSomber: 10,
        twoHanded: false,
        ...extra,
      }),
    )
  }

  /** RH2 목록을 열고 우치가타나(롱소드 다음 칸)에 커서를 둔다 */
  async function focusUchigatanaInRh2() {
    const { simulator } = mountSimulator()
    await press('ArrowRight')
    await press('e')
    await press('ArrowRight')
    const detail = () => simulator.find('[data-testid="detail"]').text().replace(/\s+/g, ' ')
    expect(detail()).toContain('Uchigatana')
    return { simulator, detail }
  }

  it('강화·능력치를 적용한 공격력이 원본 사이트와 같다', async () => {
    setStats()
    const { detail } = await focusUchigatanaInRh2()
    expect(detail()).toContain('+25')
    expect(detail()).toContain('한손')
    expect(detail()).toContain('공격력 498')
    expect(detail()).toContain('출혈 45')
    // 보정은 +25 기준 (근력 D 54, 기량 C 82)
    expect(detail()).toContain('근력 11 (D 54)')
    expect(detail()).toContain('기량 15 (C 82)')
  })

  it('스탯 화면에서 그 칸에 고른 변질로 계산한다', async () => {
    setStats({ affinityBySlot: { 1: 'Blood' } })
    const { detail } = await focusUchigatanaInRh2()
    expect(detail()).toContain('피')
    expect(detail()).toContain('공격력 484')
    expect(detail()).toContain('출혈 91')
  })

  it('양손이면 근력 1.5배로 계산된다', async () => {
    setStats()
    const { detail: oneHand } = await focusUchigatanaInRh2()
    const total1 = Number(oneHand().match(/공격력 (\d+)/)![1])
    useStatsStore().twoHanded = true
    await nextTick()
    expect(oneHand()).toContain('양손')
    expect(Number(oneHand().match(/공격력 (\d+)/)![1])).toBeGreaterThan(total1)
  })

  it('모자란 요구 능력치는 빨갛게 표시되고 공격력이 줄어든다', async () => {
    setStats()
    const { simulator, detail } = await focusUchigatanaInRh2()
    const before = Number(detail().match(/공격력 (\d+)/)![1])
    useStatsStore().setAttribute('strength', 5)
    await nextTick()
    const unmet = simulator.findAll('[data-testid="detail-requirements"] .gms__unmet')
    expect(unmet.map((u) => u.text())).toEqual([expect.stringContaining('근력 11')])
    expect(Number(detail().match(/공격력 (\d+)/)![1])).toBeLessThan(before)
  })
})

describe('요약 패널: 방어력과 경감률', () => {
  it('스탯 화면 능력치로 방어력을, 장착 방어구로 경감률을 보여준다 (원본 사이트 값)', async () => {
    // 원본 사이트: 생40 정20 지구20 근30 기50 지10 신10 비30 → 물리 138, 마력 148, 화염 168, 번개 128, 신성 174
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        attributes: { vigor: 40, mind: 20, endurance: 20, strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 },
      }),
    )
    const { summary } = mountSimulator()
    const row = (t: string) => summary.find(`[data-testid="defense-${t}"]`).findAll('td').map((c) => c.text())
    expect(row('physical')[0]).toBe('138')
    expect(row('magic')[0]).toBe('148')
    expect(row('fire')[0]).toBe('168')
    expect(row('lightning')[0]).toBe('128')
    expect(row('holy')[0]).toBe('174')

    // 기본 장비(방랑 기사 세트) 경감률은 0보다 크고, 방어구를 벗으면 줄어든다
    const before = Number(row('physical')[1])
    expect(before).toBeGreaterThan(0)
    await press('ArrowDown')
    await press('ArrowDown') // 머리 칸
    await press('r')
    expect(Number(row('physical')[1])).toBeLessThan(before)

    // 능력치를 바꾸면 방어력도 바뀐다
    useStatsStore().setAttribute('strength', 80)
    await nextTick()
    expect(Number(row('physical')[0])).toBeGreaterThan(138)
  })
})

describe('요약 패널: 상태이상 축적치', () => {
  it('장착한 무기마다 스탯 화면 설정으로 계산한 축적치를 보여준다 (원본 사이트 값)', async () => {
    // 원본 사이트: 피 변질 우치가타나 +25, 신비 30 → 출혈 82 + 9.36 = 91
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        attributes: { vigor: 40, mind: 20, endurance: 25, strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 },
        upgradeRegular: 25,
        upgradeSomber: 10,
        affinityBySlot: { 1: 'Blood' },
      }),
    )
    const { summary } = mountSimulator()
    const cells = (label: string) =>
      summary.find(`[data-testid="status-${label}"]`).findAll('td').map((c) => c.text())

    // 기본 장비 롱소드(RH1)는 상태이상이 없다
    expect(cells('RH1')).toEqual(['–', '–', '–', '–', '–', '–'])

    // RH2에 우치가타나 장착 → 피 변질로 출혈 91 (출혈은 첫 번째 열)
    await press('ArrowRight')
    await press('e')
    await press('ArrowRight')
    await press('e')
    expect(summary.find('[data-testid="status-RH2"]').text()).toContain('Uchigatana')
    expect(cells('RH2')[0]).toBe('91')

    // 신비를 올리면 출혈 축적치도 오른다
    useStatsStore().setAttribute('arcane', 60)
    await nextTick()
    expect(Number(cells('RH2')[0])).toBeGreaterThan(91)
  })

  it('무기를 하나도 안 들면 안내 문구', async () => {
    const { summary } = mountSimulator()
    useCharacterStore().unequipAll()
    await nextTick()
    expect(summary.find('[data-testid="status-table"]').text()).toContain('장착한 무기가 없습니다')
  })
})

describe('요약 패널: 초기화', () => {
  it('확인하면 장착한 장비와 인벤토리의 모든 아이템을 지운다', async () => {
    const { simulator, summary } = mountSimulator()
    const store = useCharacterStore()
    const before = store.inventoryCount
    expect(before).toBeGreaterThan(0)
    expect(store.equippedItems.length).toBeGreaterThan(0)

    // 브라우저 확인 창(confirm)은 쓰지 않는다: 막혀 있는 환경에서는 바로 false가 돌아와 버튼이 안 먹었다
    window.confirm = () => false

    // 초기화를 누르면 화면 안에 확인이 뜬다. 취소하면 그대로
    await summary.find('[data-testid="reset-equipment"]').trigger('click')
    expect(summary.find('[data-testid="reset-confirm"]').text()).toContain(`모든 아이템(${before}개)`)
    await summary.find('[data-testid="reset-confirm-no"]').trigger('click')
    expect(summary.find('[data-testid="reset-confirm"]').exists()).toBe(false)
    expect(store.inventoryCount).toBe(before)
    expect(store.equippedItems.length).toBeGreaterThan(0)

    // 모두 지우기
    await summary.find('[data-testid="reset-equipment"]').trigger('click')
    await summary.find('[data-testid="reset-confirm-yes"]').trigger('click')
    expect(summary.find('[data-testid="reset-confirm"]').exists()).toBe(false)
    expect(store.inventoryCount).toBe(0)
    expect(store.equippedItems).toHaveLength(0)
    expect(summary.find('[data-testid="total-weight"]').text()).toBe('0.0')
    expect(simulator.findAll('[data-testid="item-image"]')).toHaveLength(0)
    // 지울 아이템이 없으면 버튼이 꺼진다
    expect(summary.find('[data-testid="reset-equipment"]').attributes('disabled')).toBeDefined()

    // 아이템 목록을 열면 빈 인벤토리 안내가 나온다
    await press('e')
    expect(simulator.find('[data-testid="inventory-empty"]').exists()).toBe(true)
    expect(simulator.findAll('[data-testid="inventory-cell"]')).toHaveLength(0)

    // 새로 불러와도 빈 상태가 유지된다 (저장됨)
    await nextTick()
    const saved = JSON.parse(localStorage.getItem('er-planner/character/v1')!)
    expect(saved.weapons).toEqual([])
    expect(saved.talismans).toEqual([])
    expect(Object.values(saved.protectors).flat()).toEqual([])
  })
})
