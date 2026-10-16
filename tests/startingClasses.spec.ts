import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nameLanguage } from '@/data/names'
import { levelNeeded, rankClasses, startingClass, STARTING_CLASSES, wastedPoints } from '@/data/startingClasses'
import StartingClassPanel from '@/features/stats/StartingClassPanel.vue'
import { ATTRIBUTE_KEYS, parseStatsSnapshot, STATS_STORAGE_KEY, useStatsStore } from '@/stores/stats'

beforeEach(() => {
  localStorage.clear()
  nameLanguage.value = 'ko'
  setActivePinia(createPinia())
})

const ALL_10 = { vigor: 10, mind: 10, endurance: 10, strength: 10, dexterity: 10, intelligence: 10, faith: 10, arcane: 10 }

describe('태생 데이터 (게임 파일에서 읽은 값)', () => {
  it('10개이고, 모두 능력치 합 − 79 = 레벨이다', () => {
    expect(STARTING_CLASSES).toHaveLength(10)
    for (const c of STARTING_CLASSES) {
      const sum = ATTRIBUTE_KEYS.reduce((s, k) => s + c.attributes[k], 0)
      expect(sum - 79).toBe(c.level)
      expect(c.ko).not.toBe('')
    }
  })

  it('방랑 기사와 빈털터리 값', () => {
    expect(startingClass('vagabond')).toMatchObject({
      id: 3000,
      level: 9,
      attributes: { vigor: 15, mind: 10, endurance: 11, strength: 14, dexterity: 13, intelligence: 9, faith: 9, arcane: 7 },
    })
    expect(startingClass('wretch')).toMatchObject({ id: 3009, level: 1, attributes: ALL_10 })
  })
})

describe('태생 추천', () => {
  it('필요한 레벨과 버려지는 포인트', () => {
    const vagabond = startingClass('vagabond')
    expect(levelNeeded(ALL_10, vagabond)).toBe(15 + 10 + 11 + 14 + 13 + 10 + 10 + 10 - 79)
    expect(wastedPoints(ALL_10, vagabond)).toBe(5 + 1 + 4 + 3)
  })

  it('모두 10이면 빈털터리가 1등', () => {
    expect(rankClasses(ALL_10)[0]!.cls.key).toBe('wretch')
  })

  it('능력치가 모두 10 이상이면 빈털터리와 같은 레벨이라 다른 태생이 이길 수 없다', () => {
    const build = { ...ALL_10, vigor: 40, strength: 30 }
    expect(rankClasses(build)[0]!.level).toBe(levelNeeded(build, startingClass('wretch')))
  })

  it('근력 8·신앙 7처럼 10 미만으로 버리는 능력치가 있으면 점성술사가 레벨이 가장 낮다', () => {
    const caster = { vigor: 40, mind: 20, endurance: 15, strength: 8, dexterity: 12, intelligence: 60, faith: 7, arcane: 9 }
    const best = rankClasses(caster)[0]!
    expect(best.cls.key).toBe('astrologer')
    expect(best.level).toBeLessThan(levelNeeded(caster, startingClass('wretch')))
  })
})

describe('스탯 저장소', () => {
  it('처음에는 태생을 고르지 않아 능력치를 1까지 내릴 수 있다', () => {
    const stats = useStatsStore()
    expect(stats.startingClassKey).toBeNull()
    stats.setAttribute('strength', 5)
    expect(stats.attributes.strength).toBe(5)
  })

  it('태생을 고르면 낮은 능력치는 태생 값으로 오르고, 그 아래로 내릴 수 없다', () => {
    const stats = useStatsStore()
    stats.setAttribute('strength', 5)
    stats.setStartingClass('vagabond')
    expect(stats.attributes.strength).toBe(14)
    stats.setAttribute('vigor', 3)
    expect(stats.attributes.vigor).toBe(15)
    stats.setAttribute('vigor', 40)
    expect(stats.investedAttributes.vigor).toBe(25)
  })

  it('태생 기본값으로 되돌리면 레벨이 태생 레벨이 된다', () => {
    const stats = useStatsStore()
    stats.setStartingClass('samurai')
    stats.resetToClass()
    expect(stats.runeLevel).toBe(startingClass('samurai').level)
  })

  it('목표 레벨: 기본 125, 남은 포인트, 초과는 음수, 끄면 null', () => {
    const stats = useStatsStore()
    expect(stats.targetLevel).toBe(125)
    expect(stats.remainingPoints).toBe(125 - stats.runeLevel)
    stats.setTargetLevel(10)
    expect(stats.remainingPoints).toBeLessThan(0)
    stats.setTargetLevel(99999)
    expect(stats.targetLevel).toBe(713)
    stats.setTargetLevel(null)
    expect(stats.remainingPoints).toBeNull()
  })

  it('태생과 목표 레벨은 저장되고 다시 불러온다', async () => {
    const stats = useStatsStore()
    stats.setStartingClass('prophet')
    stats.setTargetLevel(150)
    await Promise.resolve()
    const saved = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY)!)
    expect(parseStatsSnapshot(saved)).toMatchObject({ startingClass: 'prophet', targetLevel: 150 })
    expect(parseStatsSnapshot({ startingClass: 'nope', targetLevel: 'x' })).toEqual({})
    expect(parseStatsSnapshot({ startingClass: null, targetLevel: null })).toEqual({ startingClass: null, targetLevel: null })
  })
})

describe('태생 패널', () => {
  function mountPanel() {
    const pinia = createPinia()
    setActivePinia(pinia)
    return { stats: useStatsStore(pinia), wrapper: mount(StartingClassPanel, { global: { plugins: [pinia] } }) }
  }

  it('태생을 고르면 태생·투자 표가 나온다', async () => {
    const { stats, wrapper } = mountPanel()
    expect(wrapper.find('[data-testid="class-table"]').exists()).toBe(false)
    await wrapper.find('[data-testid="class-select"]').setValue('hero')
    expect(stats.startingClassKey).toBe('hero')
    expect(wrapper.find('[data-testid="class-table"]').text()).toContain('용사')
    wrapper.unmount()
  })

  it('목표 레벨 버튼과 남은 포인트·초과 표시', async () => {
    const { stats, wrapper } = mountPanel()
    await wrapper.find('[data-testid="target-150"]').trigger('click')
    expect(stats.targetLevel).toBe(150)
    expect(wrapper.find('[data-testid="target-status"]').text()).toContain(`남은 포인트 ${150 - stats.runeLevel}`)
    const custom = wrapper.find('[data-testid="target-custom"]')
    await custom.setValue('30')
    await custom.trigger('change')
    expect(wrapper.find('[data-testid="target-status"]').text()).toContain('목표보다')
    await wrapper.find('[data-testid="target-off"]').trigger('click')
    expect(wrapper.find('[data-testid="target-status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('추천 태생으로 바꾸기', async () => {
    const { stats, wrapper } = mountPanel()
    stats.attributes = { vigor: 40, mind: 20, endurance: 15, strength: 8, dexterity: 12, intelligence: 60, faith: 7, arcane: 9 }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="class-advice"]').text()).toContain('점성술사')
    await wrapper.find('[data-testid="class-advice-apply"]').trigger('click')
    expect(stats.startingClassKey).toBe('astrologer')
    // 능력치는 그대로 (모두 점성술사 하한 이상)
    expect(stats.attributes.faith).toBe(7)
    expect(wrapper.find('[data-testid="class-advice"]').text()).toContain('가장 낮은 레벨')
    wrapper.unmount()
  })

  it('영어 모드에서는 태생 이름을 영어로 보여준다', async () => {
    const { stats, wrapper } = mountPanel()
    stats.attributes = { vigor: 40, mind: 20, endurance: 15, strength: 8, dexterity: 12, intelligence: 60, faith: 7, arcane: 9 }
    nameLanguage.value = 'en'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="class-select"]').text()).toContain('Vagabond · Lv 9')
    expect(wrapper.find('[data-testid="class-advice"]').text()).toContain('Astrologer')
    expect(wrapper.find('[data-testid="class-advice"]').text()).not.toContain('점성술사')
    await wrapper.find('[data-testid="class-select"]').setValue('hero')
    expect(wrapper.find('[data-testid="class-table"]').text()).toContain('태생 Hero')
    expect(wrapper.find('[data-testid="class-advice"]').text()).toContain('Hero')
    wrapper.unmount()
  })
})
