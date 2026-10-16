import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { calculateAttack, CORRECTION_GRAPH_IDS, correctionGraphValue } from '@/data/attackPower'
import { ITEMS_BY_ID } from '@/data/items'
import { nameLanguage } from '@/data/names'
import CurveGraphPanel from '@/features/formulas/CurveGraphPanel.vue'
import {
  CHART,
  MAX_X,
  curveMarkers,
  groupMarkers,
  linePath,
  niceMax,
  sampleCurve,
  scaleX,
  scaleY,
  statFromViewX,
  uniqueGraphIds,
  yTicks,
} from '@/features/formulas/curveGraph'
import { useCharacterStore } from '@/stores/character'
import type { WeaponItem } from '@/types'

beforeEach(() => {
  localStorage.clear()
  nameLanguage.value = 'ko'
  setActivePinia(createPinia())
})

const STATS = { strength: 20, dexterity: 20, intelligence: 10, faith: 10, arcane: 10 }

describe('곡선 그래프 계산', () => {
  it('곡선을 0~150에서 앱 계산과 같은 값으로 읽는다', () => {
    for (const id of CORRECTION_GRAPH_IDS) {
      const values = sampleCurve(id)
      expect(values).toHaveLength(MAX_X + 1)
      for (const x of [0, 1, 40, 99, 150]) expect(values[x]).toBe(correctionGraphValue(id, x))
    }
  })

  it('y축 위쪽 끝은 0.1 단위 올림이고 최소 1이다', () => {
    expect(niceMax([0.2, 0.5])).toBe(1)
    expect(niceMax([1.1])).toBe(1.1)
    expect(niceMax([2.34, 3])).toBe(3)
    expect(yTicks(2)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(yTicks(1.1)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(yTicks(3)).toEqual([0, 1, 2, 3])
  })

  it('좌표 변환: 왼쪽 끝/오른쪽 끝, 위/아래, 범위 밖은 끝으로', () => {
    expect(scaleX(0)).toBe(CHART.left)
    expect(scaleX(MAX_X)).toBe(CHART.width - CHART.right)
    expect(scaleX(999)).toBe(scaleX(MAX_X))
    expect(scaleY(0, 1)).toBe(CHART.height - CHART.bottom)
    expect(scaleY(1, 1)).toBe(CHART.top)
    expect(scaleY(5, 1)).toBe(CHART.top)
    expect(statFromViewX(CHART.left)).toBe(0)
    expect(statFromViewX(CHART.width - CHART.right)).toBe(MAX_X)
    expect(statFromViewX(-50)).toBe(0)
    expect(statFromViewX(9999)).toBe(MAX_X)
  })

  it('경로 문자열은 점 151개를 M으로 시작해 L로 잇는다', () => {
    const d = linePath(sampleCurve(0), 1.1)
    expect(d.startsWith('M')).toBe(true)
    expect(d.split('L')).toHaveLength(MAX_X + 1)
  })

  it('장착 무기의 점은 공격력 계산이 쓴 곡선 값과 같다', () => {
    const w = ITEMS_BY_ID.get('longsword') as WeaponItem
    const attack = calculateAttack(w, 'Standard', 25, STATS)!
    const markers = curveMarkers(attack)
    expect(markers.length).toBeGreaterThan(0)
    for (const m of markers) {
      expect(m.graph).toBe(correctionGraphValue(m.graphId, m.value))
      expect(m.value).toBe(attack.details[m.damage].terms.find((t) => t.stat === m.stat)!.value)
    }
    const groups = groupMarkers(markers)
    expect(groups.length).toBeLessThanOrEqual(markers.length)
    expect(uniqueGraphIds(groups).every((id) => CORRECTION_GRAPH_IDS.includes(id))).toBe(true)
  })

  it('같은 곡선·능력치·위치의 점은 하나로 합친다', () => {
    const base = { stat: 'strength' as const, value: 40, graphId: 0, graph: 0.5, coefficient: 1 }
    const groups = groupMarkers([
      { ...base, damage: 'physical' },
      { ...base, damage: 'magic' },
      { ...base, damage: 'fire', stat: 'dexterity' },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]!.damages).toEqual(['physical', 'magic'])
  })
})

describe('곡선 그래프 패널', () => {
  function mountPanel() {
    const pinia = createPinia()
    setActivePinia(pinia)
    return { pinia, wrapper: mount(CurveGraphPanel, { global: { plugins: [pinia] } }) }
  }

  it('처음에는 장착한 무기의 곡선과 내 능력치 위치를 보여준다', async () => {
    const { wrapper } = mountPanel()
    expect(wrapper.find('[data-testid="curve-graph"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="curve-dot"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="curve-readout"]').text()).toContain('능력치')
    expect(wrapper.find('[data-testid="curve-graph"]').attributes('aria-label')).toContain('롱 소드')
    expect(wrapper.find('[data-testid="curve-weapon-select"]').text()).toContain('롱 소드')
    nameLanguage.value = 'en'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="curve-graph"]').attributes('aria-label')).toContain('Longsword')
    expect(wrapper.find('[data-testid="curve-weapon-select"]').text()).toContain('Longsword')
    wrapper.unmount()
  })

  it('곡선 직접 보기: 칩으로 고르고 해제하며 하나는 남긴다', async () => {
    const { wrapper } = mountPanel()
    await wrapper.find('[data-testid="curve-mode-free"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="curve-chip-"]')).toHaveLength(CORRECTION_GRAPH_IDS.length)
    expect(wrapper.findAll('[data-testid^="curve-line-"]')).toHaveLength(4)

    await wrapper.find('[data-testid="curve-chip-1"]').trigger('click')
    expect(wrapper.find('[data-testid="curve-line-1"]').exists()).toBe(true)

    for (const id of [0, 3, 5, 10, 1]) await wrapper.find(`[data-testid="curve-chip-${id}"]`).trigger('click')
    // 마지막 하나는 해제되지 않는다
    expect(wrapper.findAll('[data-testid^="curve-line-"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('곡선은 최대 6개까지 고를 수 있다', async () => {
    const { wrapper } = mountPanel()
    await wrapper.find('[data-testid="curve-mode-free"]').trigger('click')
    for (const id of [1, 2, 4, 6, 7, 8]) await wrapper.find(`[data-testid="curve-chip-${id}"]`).trigger('click')
    expect(wrapper.findAll('[data-testid^="curve-line-"]')).toHaveLength(6)
    wrapper.unmount()
  })

  it('능력치 슬라이더를 옮기면 값이 바뀐다', async () => {
    const { wrapper } = mountPanel()
    await wrapper.find('[data-testid="curve-mode-free"]').trigger('click')
    const slider = wrapper.find<HTMLInputElement>('[data-testid="curve-stat"]')
    await slider.setValue('60')
    expect(wrapper.find('[data-testid="curve-stat-out"]').text()).toBe('60')
    const expected = correctionGraphValue(0, 60).toFixed(3)
    expect(wrapper.find('[data-testid="curve-readout"]').text()).toContain(expected)
    wrapper.unmount()
  })

  it('장착한 무기가 없으면 안내를 보여준다', async () => {
    const { pinia, wrapper } = mountPanel()
    useCharacterStore(pinia).unequipAll()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="curve-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="curve-graph"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('계산식 탭', () => {
  it('계산식 탭 맨 위에 곡선 그래프가 있다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.find('[data-testid="nav-formulas"]').trigger('click')
    expect(wrapper.find('[data-testid="curve-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fr-attack"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
