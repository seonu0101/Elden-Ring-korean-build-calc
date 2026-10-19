import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EquipmentSummary from '@/components/EquipmentSummary.vue'
import { calculateEquipLoad, equipLoadRoll } from '@/data/equipLoad'
import { useBuffsStore } from '@/stores/buffs'
import { useStatsStore } from '@/stores/stats'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('최대 장비 중량', () => {
  it('원본 사이트의 지구력별 표와 같다', () => {
    // 원본 사이트 표의 값 (지구력 8, 9, 25, 26, 40, 60, 61, 99)
    const expected: [number, number][] = [
      [8, 45],
      [9, 46.58823529],
      [25, 72],
      [26, 72.96109507],
      [40, 90.90021588],
      [60, 120],
      [61, 121.02564103],
      [99, 160],
    ]
    for (const [end, max] of expected) expect(calculateEquipLoad(end, 0).max, `지구력 ${end}`).toBeCloseTo(max, 6)
  })

  it('무게 %와 구르기 단계 (30 / 70 / 100% 경계)', () => {
    const load = calculateEquipLoad(25, 36)
    expect(load.percent).toBe(50)
    expect(load.roll).toBe('medium')
    expect(equipLoadRoll(29.99)).toBe('light')
    expect(equipLoadRoll(30)).toBe('medium')
    expect(equipLoadRoll(69.99)).toBe('medium')
    expect(equipLoadRoll(70)).toBe('heavy')
    expect(equipLoadRoll(100)).toBe('overloaded')
  })

  it('장비창: 무게 옆에 최대 중량과 %, 탈리스만 배율 반영', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const stats = useStatsStore()
    stats.setAttribute('endurance', 25)
    const wrapper = mount(EquipmentSummary, { global: { plugins: [pinia] } })
    // 기본 캐릭터가 낀 탈리스만의 배율까지 곱한 값
    const multiplier = () =>
      useBuffsStore()
        .summary.others.filter((o) => o.attribute === 'Maximum Equip Load')
        .reduce((m, o) => m * o.total, 1)
    expect(wrapper.find('[data-testid="max-equip-load"]').text()).toBe((72 * multiplier()).toFixed(1))
    expect(wrapper.find('[data-testid="equip-load"]').text()).toMatch(/% · (가벼움|보통|무거움|중량 과다)$/)

    // 버프·탈리스만의 "최대 장비 중량" 배율을 곱한다 (바이크의 용뇌: ×1.15)
    useBuffsStore().add('spell-vykes-dragonbolt')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="max-equip-load"]').text()).toBe((72 * multiplier()).toFixed(1))
    expect(multiplier()).toBeGreaterThan(1.15)
    wrapper.unmount()
  })
})
