import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import StatsView from '@/features/stats/StatsView.vue'
import { useCharacterStore } from '@/stores/character'
import { STATS_STORAGE_KEY, clampStat, parseStatsSnapshot, useStatsStore } from '@/stores/stats'

beforeEach(() => localStorage.clear())

describe('스탯 저장소', () => {
  it('룬 레벨은 능력치 합 − 79', () => {
    setActivePinia(createPinia())
    const stats = useStatsStore()
    stats.attributes = {
      vigor: 10,
      mind: 10,
      endurance: 10,
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      faith: 10,
      arcane: 10,
    }
    expect(stats.runeLevel).toBe(1)
    stats.setAttribute('vigor', 60)
    expect(stats.runeLevel).toBe(51)
  })

  it('능력치는 1~99로 제한된다', () => {
    expect(clampStat(0)).toBe(1)
    expect(clampStat(150)).toBe(99)
    expect(clampStat(Number.NaN)).toBe(1)
  })

  it('강화 단계 연동: 일반 +10 → 특수 +4, 특수 +10 → 일반 +25', () => {
    setActivePinia(createPinia())
    const stats = useStatsStore()
    stats.setRegular(10)
    expect(stats.upgradeSomber).toBe(4)
    stats.setSomber(10)
    expect(stats.upgradeRegular).toBe(25)
    stats.upgradeLinked = false
    stats.setRegular(3)
    expect(stats.upgradeSomber).toBe(10)
  })

  it('저장했다가 다시 불러온다', async () => {
    setActivePinia(createPinia())
    const stats = useStatsStore()
    stats.setAttribute('arcane', 45)
    stats.twoHanded = true
    stats.setAffinity(0, 'Blood')
    await nextTick()
    expect(localStorage.getItem(STATS_STORAGE_KEY)).toContain('"arcane":45')

    setActivePinia(createPinia())
    const reloaded = useStatsStore()
    expect(reloaded.attributes.arcane).toBe(45)
    expect(reloaded.twoHanded).toBe(true)
    expect(reloaded.affinityFor(0)).toBe('Blood')
  })

  it('잘못된 저장 값은 버린다', () => {
    const parsed = parseStatsSnapshot({ attributes: { strength: 500, vigor: 'x' }, affinityBySlot: { 0: 'Nope', 1: 'Heavy' } })
    expect(parsed.attributes?.strength).toBe(99)
    expect(parsed.attributes?.vigor).toBe(40)
    expect(parsed.affinityBySlot).toEqual({ 1: 'Heavy' })
  })
})

describe('스탯 화면', () => {
  it('장착 무기 공격력을 보여주고, 능력치·양손·변질을 바꾸면 다시 계산한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const stats = useStatsStore()
    stats.attributes = { ...stats.attributes, strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 }
    stats.setRegular(25)
    const wrapper = mount(StatsView, { global: { plugins: [pinia] } })

    // 기본 장비: 오른손 1 롱소드, 왼손 1 히터 실드
    const cards = () => wrapper.findAll('[data-testid="attack-card"]')
    expect(cards()).toHaveLength(2)
    expect(cards()[0]!.text()).toContain('Longsword')

    // 우치가타나를 오른손 1에 장착 → 원본 사이트 값 498 (근30 기50 +25)
    const character = useCharacterStore()
    const uchi = character.inventoryFor({ kind: 'weapon', equipIndex: 0 }).find((s) => s.itemId === 'uchigatana')!
    character.equip({ kind: 'weapon', equipIndex: 0 }, uchi.uid)
    await nextTick()
    expect(cards()[0]!.find('[data-testid="attack-total"]').text()).toBe('498')

    // 피 변질 → 484, 출혈 82 + 9
    await cards()[0]!.find('[data-testid="card-affinity"]').setValue('Blood')
    expect(cards()[0]!.find('[data-testid="attack-total"]').text()).toBe('484')
    expect(cards()[0]!.find('[data-testid="status-row"]').text()).toContain('91')

    // 근력을 낮추면 요구 능력치 경고
    await wrapper.find('[data-testid="stat-strength"]').setValue('5')
    await wrapper.find('[data-testid="stat-strength"]').trigger('change')
    expect(cards()[0]!.find('[data-testid="unmet"]').exists()).toBe(true)

    // 양손이면 근력 5 × 1.5 = 7, 여전히 부족(11)
    await wrapper.find('[data-testid="two-handed"]').trigger('click')
    expect(cards()[0]!.text()).toContain('양손 · 근력 7')
    wrapper.unmount()
  })

  it('장착하지 않은 무기도 골라서 계산한다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const stats = useStatsStore()
    stats.attributes = { ...stats.attributes, strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 }
    stats.setSomber(10)
    const wrapper = mount(StatsView, { global: { plugins: [pinia] } })
    await wrapper.find('[data-testid="pick-weapon"]').setValue('Rivers of Blood')
    const cards = wrapper.findAll('[data-testid="attack-card"]')
    const picked = cards[cards.length - 1]!
    expect(picked.text()).toContain('Rivers of Blood')
    expect(picked.find('[data-testid="attack-total"]').text()).toBe('611')
    wrapper.unmount()
  })
})
