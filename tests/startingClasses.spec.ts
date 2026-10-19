import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { STARTING_CLASSES } from '@/data/startingClasses'
import { nameLanguage } from '@/data/names'
import StatsView from '@/features/stats/StatsView.vue'
import { ATTRIBUTE_KEYS, parseStatsSnapshot, STATS_STORAGE_KEY, useStatsStore } from '@/stores/stats'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('태생 데이터', () => {
  it('12개, 초기 레벨 = 능력치 합 − 79', () => {
    expect(STARTING_CLASSES).toHaveLength(12)
    for (const c of STARTING_CLASSES) {
      const sum = ATTRIBUTE_KEYS.reduce((s, k) => s + c.stats[k], 0)
      expect(sum - 79, c.name).toBe(c.level)
    }
  })
})

describe('태생 선택', () => {
  it('고르면 초기 능력치보다 낮은 능력치를 올리고, 그보다 낮게 내릴 수 없다', () => {
    const stats = useStatsStore()
    stats.setAttribute('arcane', 1)
    stats.setStartingClass('bandit')
    expect(stats.attributes.arcane).toBe(14)
    expect(stats.attributes.vigor).toBe(40) // 기본값 40은 도적 초기값 10보다 높아 그대로
    stats.setAttribute('strength', 3)
    expect(stats.attributes.strength).toBe(9)
    stats.resetAttributes()
    expect(stats.runeLevel).toBe(5)
  })

  it('선택 안 함이면 최소 1', () => {
    const stats = useStatsStore()
    stats.setStartingClass('wretch')
    stats.setStartingClass(null)
    stats.setAttribute('mind', 0)
    expect(stats.attributes.mind).toBe(1)
  })

  it('저장된 값을 읽을 때 태생 초기 능력치보다 낮으면 올린다', () => {
    const snap = parseStatsSnapshot({ startingClass: 'astrologer', attributes: { intelligence: 5 } })
    expect(snap.startingClass).toBe('astrologer')
    expect(snap.attributes!.intelligence).toBe(16)
    expect(parseStatsSnapshot({ startingClass: 'nope' }).startingClass).toBeUndefined()
  })

  it('저장된다', async () => {
    const stats = useStatsStore()
    stats.setStartingClass('samurai')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(STATS_STORAGE_KEY)!).startingClass).toBe('samurai')
  })

  it('스탯 화면: 태생을 고르면 최소 능력치와 태생 레벨이 보인다', async () => {
    nameLanguage.value = 'ko'
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(StatsView, { global: { plugins: [pinia] } })
    expect(wrapper.find('[data-testid="min-vigor"]').exists()).toBe(false)
    const select = wrapper.find('[data-testid="starting-class"]')
    expect(select.text()).toContain('방랑기사 · 레벨 9')
    await select.setValue('vagabond')
    expect(wrapper.find('[data-testid="min-vigor"]').text()).toBe('최소 15')
    expect(wrapper.find('[data-testid="min-arcane"]').text()).toBe('최소 7')
    expect(wrapper.find('[data-testid="level-from-class"]').text()).toContain('태생 9')
    expect(wrapper.find('[data-testid="stat-vigor"]').attributes('min')).toBe('15')
    wrapper.unmount()
  })
})
