import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { WEAPONS, STARTER_WEAPON_IDS, ITEMS_BY_ID } from '@/data/items'
import { scalingGrade, scalingValue } from '@/data/labels'
import WeaponTable from '@/features/weaponTable/WeaponTable.vue'
import {
  SORT_OPTIONS,
  availableAffinities,
  buildRows,
  countWithAffinity,
  filterWeapons,
  rowsToCsv,
  sortRows,
  sortValue,
  statusText,
  toggleAffinity,
  totalAttack,
  weaponStats,
} from '@/features/weaponTable/weaponTable'
import type { SortKey } from '@/features/weaponTable/weaponTable'
import { useCharacterStore } from '@/stores/character'
import { STATS_STORAGE_KEY, useStatsStore } from '@/stores/stats'
import { calculateAttack, partTotal } from '@/data/attackPower'
import type { WeaponItem } from '@/types'

function weapon(id: string): WeaponItem {
  const w = WEAPONS.find((x) => x.id === id)
  if (!w) throw new Error(`no weapon ${id}`)
  return w
}

const NON_INFUSABLE = WEAPONS.filter((w) => !w.canChangeAffinity).length
const INFUSABLE = WEAPONS.length - NON_INFUSABLE

describe('가져온 무기 데이터', () => {
  it('무기 487개, id가 겹치지 않는다', () => {
    expect(WEAPONS).toHaveLength(487)
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length)
  })

  it('기본 인벤토리 무기가 모두 데이터에 있다', () => {
    for (const id of STARTER_WEAPON_IDS) expect(ITEMS_BY_ID.get(id)?.kind).toBe('weapon')
  })

  it('알려진 무기 수치와 맞다 (우치가타나)', () => {
    const w = weapon('uchigatana')
    expect(w.weight).toBe(5.5)
    expect(w.requirements).toEqual({ strength: 11, dexterity: 15 })
    expect(w.damage.physical).toBe(115)
    expect(w.status.bleed).toBe(45)
  })

  it('가드 경감률이 5속성 모두 들어 있다 (우치가타나: 물리 45, 나머지 30)', () => {
    const g = weapon('uchigatana').guard
    expect([g.physical, g.magic, g.fire, g.lightning, g.holy, g.boost]).toEqual([45, 30, 30, 30, 30, 30])
  })
})

describe('scalingGrade', () => {
  it('보정 계수를 등급으로 바꾼다', () => {
    expect(scalingGrade(undefined)).toBe('')
    expect(scalingGrade(0.1)).toBe('E')
    expect(scalingGrade(0.25)).toBe('D')
    expect(scalingGrade(0.55)).toBe('D')
    expect(scalingGrade(0.6)).toBe('C')
    expect(scalingGrade(0.9)).toBe('B')
    expect(scalingGrade(1.4)).toBe('A')
    expect(scalingGrade(1.75)).toBe('S')
  })

  it('보정 수치는 계수 × 100 정수', () => {
    expect(scalingValue(undefined)).toBe(0)
    expect(scalingValue(0.55)).toBe(55)
    const u = weapon('uchigatana')
    expect([scalingValue(u.scaling.strength), scalingValue(u.scaling.dexterity)]).toEqual([36, 55])
  })

  it('피의 강 +0: 근력 E, 기량 D, 신비 D', () => {
    const w = weapon('rivers-of-blood')
    expect([w.scaling.strength, w.scaling.dexterity, w.scaling.arcane].map(scalingGrade)).toEqual(['E', 'D', 'D'])
  })
})

describe('검색', () => {
  it('이름, 무기군, 구분으로 거른다', () => {
    expect(filterWeapons(WEAPONS, { query: 'uchi', weaponType: null, content: 'all' }).map((w) => w.id)).toEqual([
      'uchigatana',
    ])
    const katanas = filterWeapons(WEAPONS, { query: '', weaponType: 'Katana', content: 'all' })
    expect(katanas.every((w) => w.weaponType === 'Katana')).toBe(true)
    const base = filterWeapons(WEAPONS, { query: '', weaponType: null, content: 'base' })
    const dlc = filterWeapons(WEAPONS, { query: '', weaponType: null, content: 'dlc' })
    expect(base.length + dlc.length).toBe(WEAPONS.length)
  })

  it('상태이상 글', () => {
    expect(statusText(weapon('uchigatana'))).toBe('출혈 45')
    expect(statusText(weapon('longsword'))).toBe('')
  })
})

describe('정렬', () => {
  const standardRows = buildRows(WEAPONS, 'Standard')

  /** 정렬 결과가 그 키의 값 순서대로인지 확인 */
  function expectSorted(key: SortKey, direction: 'asc' | 'desc', rows = standardRows) {
    const values = sortRows(rows, key, direction).map((r) => sortValue(r, key))
    const sorted = [...values].sort((a, b) =>
      typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)),
    )
    if (direction === 'desc') sorted.reverse()
    expect(values).toEqual(sorted)
  }

  it('정렬 목록의 모든 기준으로 양방향 정렬된다', () => {
    for (const { key } of SORT_OPTIONS) {
      expectSorted(key, 'asc')
      expectSorted(key, 'desc')
    }
  })

  it('무기군, 무게, 특정 보정, 가드 강도, 가드 경감률 정렬', () => {
    const byType = sortRows(standardRows, 'weaponType', 'asc')
    expect(byType[0]!.w.weaponType).toBe('Axe')

    const heaviest = sortRows(standardRows, 'weight', 'desc')[0]!
    expect(heaviest.w.weight).toBe(Math.max(...WEAPONS.map((w) => w.weight)))

    const bestDex = sortRows(standardRows, 'scl.dexterity', 'desc')[0]!
    expect(bestDex.st.scaling.dexterity).toBe(Math.max(...WEAPONS.map((w) => w.scaling.dexterity ?? 0)))

    const bestBoost = sortRows(standardRows, 'boost', 'desc')[0]!
    expect(bestBoost.st.guard.boost).toBe(Math.max(...WEAPONS.map((w) => w.guard.boost)))

    const bestFireGuard = sortRows(standardRows, 'gnd.fire', 'desc')[0]!
    expect(bestFireGuard.st.guard.fire).toBe(Math.max(...WEAPONS.map((w) => w.guard.fire ?? 0)))
  })

  it('같은 값이면 이름순', () => {
    const sorted = sortRows(standardRows, 'weaponType', 'asc')
    const axes = sorted.filter((r) => r.w.weaponType === 'Axe').map((r) => r.w.name)
    expect(axes).toEqual([...axes].sort((a, b) => a.localeCompare(b)))
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const before = standardRows.map((r) => r.w.id)
    sortRows(standardRows, 'name', 'desc')
    expect(standardRows.map((r) => r.w.id)).toEqual(before)
  })

  it('최고 공격력', () => {
    const strongest = sortRows(standardRows, 'attack', 'desc')[0]!
    expect(totalAttack(strongest.st)).toBe(Math.max(...WEAPONS.map(totalAttack)))
  })
})

describe('변질(인퓨전)', () => {
  it('표준은 무기 자체 수치, 다른 변질은 affinities에서 가져온다', () => {
    const u = weapon('uchigatana')
    expect(weaponStats(u, 'Standard')).toBe(u)
    const quality = weaponStats(u, 'Quality')!
    expect([scalingValue(quality.scaling.strength), scalingValue(quality.scaling.dexterity)]).toEqual([59, 59])
    const blood = weaponStats(u, 'Blood')!
    expect(blood.status.bleed).toBeGreaterThan(u.status.bleed ?? 0)
  })

  it('변질할 수 없는 무기는 표준만 있다', () => {
    const rob = weapon('rivers-of-blood')
    expect(rob.canChangeAffinity).toBe(false)
    expect(weaponStats(rob, 'Heavy')).toBeNull()
    expect(availableAffinities(rob)).toEqual(['Standard'])
    expect(availableAffinities(weapon('uchigatana'))).toHaveLength(13)
    expect(countWithAffinity(WEAPONS, 'Heavy')).toBe(INFUSABLE)
  })

  it('변질 필터는 그 변질이 가능한 무기만 남긴다', () => {
    const heavy = filterWeapons(WEAPONS, { query: '', weaponType: null, content: 'all', affinity: 'Heavy' })
    expect(heavy).toHaveLength(INFUSABLE)
    expect(heavy.map((w) => w.id)).not.toContain('rivers-of-blood')
  })

  it('특정 변질에서는 그 변질 수치로 정렬한다', () => {
    const katanas = filterWeapons(WEAPONS, { query: '', weaponType: 'Katana', content: 'all', affinity: 'Heavy' })
    const rows = sortRows(buildRows(katanas, 'Heavy'), 'scl.strength', 'desc')
    expect(rows.every((r) => r.affinity === 'Heavy')).toBe(true)
    const values = rows.map((r) => r.st.scaling.strength ?? 0)
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })
})

describe('모든 변질 한번에 보기', () => {
  const allRows = buildRows(WEAPONS, 'all')

  it('무기마다 가능한 변질을 모두 펼친다', () => {
    expect(allRows).toHaveLength(NON_INFUSABLE + INFUSABLE * 13)
    const uchi = allRows.filter((r) => r.w.id === 'uchigatana')
    expect(uchi.map((r) => r.affinity)).toEqual(availableAffinities(weapon('uchigatana')))
    expect(allRows.filter((r) => r.w.id === 'rivers-of-blood')).toHaveLength(1)
  })

  it('이름순이면 같은 무기의 변질이 게임 순서대로 모인다', () => {
    const sorted = sortRows(allRows, 'name', 'asc')
    const i = sorted.findIndex((r) => r.w.id === 'uchigatana')
    expect(sorted.slice(i, i + 3).map((r) => r.affinity)).toEqual(['Standard', 'Heavy', 'Keen'])
  })

  it('정렬하면 무기+변질 조합끼리 비교된다', () => {
    const bestDex = sortRows(allRows, 'scl.dexterity', 'desc')[0]!
    const max = Math.max(...allRows.map((r) => r.st.scaling.dexterity ?? 0))
    expect(bestDex.st.scaling.dexterity).toBe(max)
  })
})

describe('CSV', () => {
  it('머리글과 행, 보정 수치와 가드 경감률 열이 들어간다', () => {
    const csv = rowsToCsv(buildRows([weapon('uchigatana'), weapon('rivers-of-blood')], 'Standard'))
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('공격력 합계')
    expect(lines[0]).toContain('가드 경감률 화염')
    expect(lines[1]).toMatch(/^Uchigatana,표준,\+0,Katana,본편,5\.5,11,15,/)
    expect(lines[1]).toContain(',D,D,,,,36,55,0,0,0,')
    expect(lines[1]).toContain(',출혈 45,45,30,30,30,30,30,')
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('특정 변질이면 변질 이름과 그 변질 수치가 들어가고, 변질 불가 무기는 빠진다', () => {
    const csv = rowsToCsv(buildRows([weapon('uchigatana'), weapon('rivers-of-blood')], 'Quality'))
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/^Uchigatana,상질,/)
    expect(lines[1]).toContain(',59,59,')
  })
})

describe('WeaponTable 화면', () => {
  // 기본 화면 테스트는 무기 자체 수치(+0, 내 스탯 끔)에서 시작한다.
  // 무기 표는 스탯 화면과 강화·능력치 설정을 함께 쓰므로, 그 저장값을 미리 넣어 둔다.
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('er-planner/weapon-table/apply-stats', 'false')
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ upgradeRegular: 0, upgradeSomber: 0 }))
  })

  function mountTable() {
    return mount(WeaponTable, { global: { plugins: [createPinia()] } })
  }
  const rowsOf = (wrapper: ReturnType<typeof mountTable>) => wrapper.findAll('[data-testid="weapon-row"]')

  it('처음에는 300행만 그리고, 더 보기로 늘린다', async () => {
    const wrapper = mountTable()
    expect(rowsOf(wrapper)).toHaveLength(300)
    await wrapper.find('[data-testid="show-more"]').trigger('click')
    expect(rowsOf(wrapper)).toHaveLength(487)
    expect(wrapper.find('[data-testid="show-more"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('검색, 보정 표시 전환, 변질 버튼, 인벤토리 추가', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    const rows = rowsOf(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('115')

    const scaling = () => rowsOf(wrapper)[0]!.findAll('[data-testid="scaling-cell"]').map((c) => c.text().replace(/\s+/g, ''))
    expect(scaling().slice(0, 2)).toEqual(['D36', 'D55'])
    await wrapper.find('[data-testid="scaling-mode-value"]').trigger('click')
    expect(scaling().slice(0, 2)).toEqual(['36', '55'])

    // 상질을 누르면 표준과 함께 고르고, 표준을 다시 누르면 상질만 남는다
    await wrapper.find('[data-testid="affinity-Quality"]').trigger('click')
    await wrapper.find('[data-testid="affinity-Standard"]').trigger('click')
    expect(scaling().slice(0, 2)).toEqual(['59', '59'])
    expect(wrapper.text()).toContain('보정 · 상질')
    await wrapper.find('[data-testid="affinity-Standard"]').trigger('click')
    await wrapper.find('[data-testid="affinity-Quality"]').trigger('click')

    const guard = rowsOf(wrapper)[0]!.findAll('[data-testid="guard-cell"]').map((c) => c.text())
    expect(guard).toEqual(['45', '30', '30', '30', '30'])

    const store = useCharacterStore()
    const before = store.weapons.filter((s) => s.itemId === 'uchigatana').length
    await wrapper.find('[data-testid="add-weapon"]').trigger('click')
    expect(store.weapons.filter((s) => s.itemId === 'uchigatana').length).toBe(before + 1)
    wrapper.unmount()
  })

  it('변질 여러 개 고르기: 고른 변질만큼 행이 생기고, 모든 변질 버튼과는 함께 고를 수 없다', async () => {
    const wrapper = mountTable()
    const pressed = () =>
      wrapper.findAll('.wt__affinities button').filter((b) => b.attributes('aria-pressed') === 'true').map((b) => b.attributes('data-testid'))
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    await wrapper.find('[data-testid="affinity-Keen"]').trigger('click')
    await wrapper.find('[data-testid="affinity-Heavy"]').trigger('click')
    expect(pressed()).toEqual(['affinity-Standard', 'affinity-Heavy', 'affinity-Keen'])
    const cells = () => rowsOf(wrapper).map((r) => r.find('[data-testid="affinity-cell"]').text())
    expect(cells()).toEqual(['표준', '중후', '예리'])
    expect(wrapper.find('[data-testid="row-count"]').text()).toContain('3행')
    expect(wrapper.find('[data-testid="affinity-multi-note"]').exists()).toBe(true)

    // 모든 변질을 누르면 다른 선택이 풀린다
    await wrapper.find('[data-testid="affinity-all"]').trigger('click')
    expect(pressed()).toEqual(['affinity-all'])
    expect(rowsOf(wrapper)).toHaveLength(13)

    // 모든 변질이 켜진 상태에서 변질 하나를 누르면 그 변질만
    await wrapper.find('[data-testid="affinity-Fire"]').trigger('click')
    expect(pressed()).toEqual(['affinity-Fire'])
    expect(rowsOf(wrapper)).toHaveLength(1)
    expect(wrapper.find('[data-testid="affinity-cell"]').exists()).toBe(false)

    // 마지막 하나는 다시 눌러도 빠지지 않는다
    await wrapper.find('[data-testid="affinity-Fire"]').trigger('click')
    expect(pressed()).toEqual(['affinity-Fire'])
    wrapper.unmount()
  })

  it('toggleAffinity / 여러 변질 필터', () => {
    expect(toggleAffinity(['Standard'], 'Heavy')).toEqual(['Standard', 'Heavy'])
    expect(toggleAffinity(['Keen', 'Standard'], 'Standard')).toEqual(['Keen'])
    expect(toggleAffinity(['Keen'], 'Keen')).toEqual(['Keen'])
    expect(toggleAffinity('all', 'Blood')).toEqual(['Blood'])
    // 중후나 마력 중 하나라도 되는 무기만, 행은 가능한 변질만큼
    const list = filterWeapons(WEAPONS, { query: '', weaponType: null, content: 'all', affinity: ['Heavy', 'Magic'] })
    expect(list.length).toBe(WEAPONS.filter((w) => weaponStats(w, 'Heavy') || weaponStats(w, 'Magic')).length)
    const rows = buildRows([weapon('uchigatana'), weapon('moonveil')], ['Heavy', 'Magic'])
    expect(rows.map((r) => `${r.w.id}:${r.affinity}`)).toEqual(['uchigatana:Heavy', 'uchigatana:Magic'])
  })

  it('모든 변질 한번에 보기: 한 무기가 변질 수만큼 행으로 펼쳐진다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    await wrapper.find('[data-testid="affinity-all"]').trigger('click')
    const rows = rowsOf(wrapper)
    expect(rows).toHaveLength(13)
    expect(rows.map((r) => r.find('[data-testid="affinity-cell"]').text()).slice(0, 3)).toEqual(['표준', '중후', '예리'])
    // + 버튼은 무기당 하나 (첫 행에만)
    expect(wrapper.findAll('[data-testid="add-weapon"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="row-count"]').text()).toContain('13행')
    wrapper.unmount()
  })

  it('강화 단계를 바꾸면 수치가 바뀌고, 연동하면 특수 무기 단계도 따라간다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    const row = () => rowsOf(wrapper)[0]!
    await wrapper.find('[data-testid="scaling-mode-value"]').trigger('click')

    await wrapper.find('[data-testid="upgrade-max"]').trigger('click')
    expect(row().find('[data-testid="level-tag"]').text()).toBe('+25')
    expect(row().text()).toContain('281')
    expect(row().findAll('[data-testid="scaling-cell"]').map((c) => c.text())[1]).toBe('82')

    // 특수 무기는 +10까지: 피의 강
    await wrapper.find('[data-testid="search"]').setValue('Rivers of Blood')
    expect(row().find('[data-testid="level-tag"]').text()).toBe('+10')
    expect(row().text()).toContain('186')

    // 연동: 일반 +10이면 특수 +4
    await wrapper.find('[data-testid="upgrade-regular"]').setValue('10')
    expect((wrapper.find('[data-testid="upgrade-somber"]').element as HTMLInputElement).value).toBe('4')
    expect(row().find('[data-testid="level-tag"]').text()).toBe('+4')

    await wrapper.find('[data-testid="upgrade-min"]').trigger('click')
    expect(row().find('[data-testid="level-tag"]').text()).toBe('+0')
    wrapper.unmount()
  })

  it('정렬 드롭다운과 열 제목으로 정렬한다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="type-filter"]').setValue('Katana')

    await wrapper.find('[data-testid="sort-select"]').setValue('weight')
    const weights = () => rowsOf(wrapper).map((r) => Number(r.findAll('td')[1]!.text()))
    expect(weights()).toEqual([...weights()].sort((a, b) => b - a))

    await wrapper.find('[data-testid="sort-direction"]').trigger('click')
    expect(weights()).toEqual([...weights()].sort((a, b) => a - b))

    await wrapper.find('[data-testid="sort-gnd-physical"]').trigger('click')
    const physGuard = () => rowsOf(wrapper).map((r) => Number(r.findAll('[data-testid="guard-cell"]')[0]!.text()))
    expect(physGuard()).toEqual([...physGuard()].sort((a, b) => b - a))
    expect((wrapper.find('[data-testid="sort-select"]').element as HTMLSelectElement).value).toBe('gnd.physical')
    wrapper.unmount()
  })
})

describe('내 스탯 적용', () => {
  // 원본 사이트 계산기 값 (tests/fixtures/attackReference.json): 우치가타나 +25, 근30 기50 지10 신10 비30 → 498
  const REF_STATS = { strength: 30, dexterity: 50, intelligence: 10, faith: 10, arcane: 30 }

  it('buildRows에 능력치를 주면 공격력·상태이상이 계산값(소수점 버림)이 된다', () => {
    const uchi = WEAPONS.find((w) => w.id === 'uchigatana')!
    const [row] = buildRows([uchi], 'Standard', { regular: 25, somber: 10 }, { stats: REF_STATS, twoHanded: false })
    const expected = calculateAttack(uchi, 'Standard', 25, REF_STATS, false)!
    expect(row!.attack).toEqual(expected)
    expect(row!.st.damage.physical).toBe(partTotal(expected.damage.physical))
    expect(sortValue(row!, 'attack')).toBe(498)
    // 보정 계수·가드처럼 능력치와 무관한 값은 그대로
    expect(row!.st.guard.physical).toBe(45)
  })

  it('능력치를 주지 않으면 지금처럼 무기 자체 수치', () => {
    const uchi = WEAPONS.find((w) => w.id === 'uchigatana')!
    const [row] = buildRows([uchi], 'Standard', { regular: 25, somber: 10 })
    expect(row!.attack).toBeNull()
    expect(row!.st.damage.physical).toBe(281)
  })

  it('지력을 올리면 마력 공격력이 오르고, 공격력 정렬도 계산값으로 한다', () => {
    const katanas = WEAPONS.filter((w) => w.weaponType === 'Katana')
    const upgrade = { regular: 25, somber: 10 }
    const rowsWith = (intelligence: number) =>
      buildRows(katanas, 'Standard', upgrade, { stats: { ...REF_STATS, intelligence }, twoHanded: false })
    const moonveil = (intelligence: number) => rowsWith(intelligence).find((r) => r.w.id === 'moonveil')!
    expect(moonveil(99).st.damage.magic!).toBeGreaterThan(moonveil(10).st.damage.magic!)

    const sorted = sortRows(rowsWith(99), 'attack', 'desc')
    const totals = sorted.map((r) => r.attack!.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))

    // 보정 계수(등급·수치) 정렬은 능력치와 무관하다
    const byScaling = (intelligence: number) =>
      sortRows(rowsWith(intelligence), 'scl.intelligence', 'desc').map((r) => r.w.id)
    expect(byScaling(10)).toEqual(byScaling(99))
  })

  describe('화면', () => {
    beforeEach(() => {
      localStorage.clear()
      localStorage.setItem(
        STATS_STORAGE_KEY,
        JSON.stringify({
          attributes: { vigor: 40, mind: 20, endurance: 25, ...REF_STATS },
          upgradeRegular: 25,
          upgradeSomber: 10,
          twoHanded: false,
        }),
      )
    })

    function mountTable() {
      return mount(WeaponTable, { global: { plugins: [createPinia()] } })
    }

    it('기본으로 내 스탯이 적용되고, 원본 사이트와 같은 공격력이 나온다', async () => {
      const wrapper = mountTable()
      expect((wrapper.find('[data-testid="apply-stats"]').element as HTMLInputElement).checked).toBe(true)
      expect(wrapper.find('[data-testid="stats-label"]').text()).toContain('근 30')
      await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
      const row = wrapper.find('[data-testid="weapon-row"]')
      expect(row.find('[data-testid="attack-total"]').text()).toBe('498')
      // 기본 281.75 → 281, 남은 0.75는 보정 쪽에 붙어서 합계 498과 맞는다
      expect(row.find('[data-testid="damage-cell"]').attributes('title')).toBe('기본 281 + 보정 217')

      // 끄면 무기 자체 수치 (+25 물리 281)
      await wrapper.find('[data-testid="apply-stats"]').setValue(false)
      expect(wrapper.find('[data-testid="weapon-row"] [data-testid="attack-total"]').text()).toBe('281')
      wrapper.unmount()
    })

    it('스탯 화면 설정을 바꾸면 표가 바로 바뀌고, 모자란 요구 능력치는 빨갛게 보인다', async () => {
      const wrapper = mountTable()
      await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
      const total = () => Number(wrapper.find('[data-testid="attack-total"]').text())
      const before = total()

      const stats = useStatsStore()
      stats.setAttribute('dexterity', 80)
      await wrapper.vm.$nextTick()
      expect(total()).toBeGreaterThan(before)

      stats.setAttribute('strength', 5) // 우치가타나 요구 근력 11
      await wrapper.vm.$nextTick()
      const reqCells = wrapper.findAll('[data-testid="req-cell"]')
      expect(reqCells[0]!.classes()).toContain('wt__unmet')
      expect(reqCells[1]!.classes()).not.toContain('wt__unmet')
      wrapper.unmount()
    })

    it('양손을 누르면 근력 1.5배로 계산되고, 강화 단계는 스탯 화면과 함께 바뀐다', async () => {
      const wrapper = mountTable()
      await wrapper.find('[data-testid="search"]').setValue('Greatsword')
      const total = () => Number(wrapper.find('[data-testid="attack-total"]').text())
      const oneHand = total()
      await wrapper.find('[data-testid="two-hand"]').trigger('click')
      expect(total()).toBeGreaterThan(oneHand)
      expect(useStatsStore().twoHanded).toBe(true)

      await wrapper.find('[data-testid="upgrade-min"]').trigger('click')
      expect(useStatsStore().upgradeRegular).toBe(0)
      wrapper.unmount()
    })
  })
})
