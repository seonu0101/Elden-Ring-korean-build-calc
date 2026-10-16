import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { PROTECTORS, TALISMANS } from '@/data/items'
import ArmorTable from '@/features/itemTables/ArmorTable.vue'
import TalismanTable from '@/features/itemTables/TalismanTable.vue'
import { columnGroups, filterItems, itemsToCsv, sortItems } from '@/features/itemTables/itemTable'
import type { TableColumn } from '@/features/itemTables/itemTable'
import { useCharacterStore } from '@/stores/character'
import type { ProtectorItem } from '@/types'

const weightCol: TableColumn<ProtectorItem> = { key: 'weight', label: '무게', numeric: true, value: (p) => p.weight }
const physCol: TableColumn<ProtectorItem> = {
  key: 'neg.physical',
  label: '물리',
  group: '피해 경감률(%)',
  numeric: true,
  value: (p) => p.absorptions.physical,
}

describe('표 공통 함수', () => {
  it('이름 검색·종류·본편/DLC로 거른다', () => {
    const byType = { label: '부위', allLabel: '', options: [], values: (p: ProtectorItem) => [p.protectorType] }
    const helms = filterItems(PROTECTORS, { query: '', type: 'Head', content: 'all' }, byType)
    expect(helms.every((p) => p.protectorType === 'Head')).toBe(true)
    expect(filterItems(PROTECTORS, { query: 'vagabond knight helm', type: null, content: 'all' }).map((p) => p.id)).toEqual([
      'vagabond-knight-helm',
    ])
    const base = filterItems(PROTECTORS, { query: '', type: null, content: 'base' })
    const dlc = filterItems(PROTECTORS, { query: '', type: null, content: 'dlc' })
    expect(base.length + dlc.length).toBe(PROTECTORS.length)
  })

  it('열 값으로 정렬하고, 같으면 이름순', () => {
    const heavy = sortItems(PROTECTORS, [weightCol], 'weight', 'desc')
    expect(heavy[0]!.weight).toBe(Math.max(...PROTECTORS.map((p) => p.weight)))
    const byName = sortItems(PROTECTORS, [weightCol], 'name', 'asc').map((p) => p.name)
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)))
  })

  it('CSV 머리글에 묶음 이름이 붙는다', () => {
    const csv = itemsToCsv(PROTECTORS.slice(0, 1), [weightCol, physCol])
    expect(csv.replace('﻿', '').split('\r\n')[0]).toBe('이름,무게,피해 경감률(%) 물리')
  })

  it('같은 묶음이 이어지면 하나로 합친다', () => {
    expect(columnGroups([weightCol, physCol, physCol])).toEqual([
      { label: '', span: 1 },
      { label: '피해 경감률(%)', span: 2 },
    ])
  })
})

describe('방어구 표', () => {
  beforeEach(() => localStorage.clear())
  const mountTable = () => mount(ArmorTable, { global: { plugins: [createPinia()] } })
  const rows = (w: ReturnType<typeof mountTable>) => w.findAll('[data-testid="item-row"]')

  it('722개 중 300행을 그리고, 검색하면 줄어든다', async () => {
    const wrapper = mountTable()
    expect(wrapper.find('[data-testid="row-count"]').text()).toBe(`${PROTECTORS.length} / ${PROTECTORS.length}`)
    expect(rows(wrapper)).toHaveLength(300)
    await wrapper.find('[data-testid="search"]').setValue('Vagabond Knight Helm')
    expect(rows(wrapper)).toHaveLength(1)
    const text = rows(wrapper)[0]!.text()
    expect(text).toContain('머리')
    expect(text).toContain('4.0') // 무게
    expect(text).toContain('4.6') // 물리 경감률
    wrapper.unmount()
  })

  it('부위 필터, 강인도 정렬, 인벤토리 추가', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="type-filter"]').setValue('Body')
    await wrapper.find('[data-testid="sort-poise"]').trigger('click')
    const poise = rows(wrapper).map((r) => Number(r.find('[data-testid="cell-poise"]').text()))
    expect(poise).toEqual([...poise].sort((a, b) => b - a))
    expect(rows(wrapper).every((r) => r.find('[data-testid="cell-part"]').text() === '몸통')).toBe(true)

    const first = rows(wrapper)[0]!
    const store = useCharacterStore()
    const name = first.find('th').text().replace(/DLC$/, '').trim()
    const before = store.protectors.Body.length
    await first.find('[data-testid="add-item"]').trigger('click')
    expect(store.protectors.Body.length).toBe(before + 1)
    expect(store.itemOf(store.protectors.Body.at(-1)!)?.name).toBe(name)
    wrapper.unmount()
  })
})

describe('탈리스만 표', () => {
  beforeEach(() => localStorage.clear())
  const mountTable = () => mount(TalismanTable, { global: { plugins: [createPinia()] } })
  const rows = (w: ReturnType<typeof mountTable>) => w.findAll('[data-testid="item-row"]')

  it('154개 모두 그리고, 효과를 한국어로 보여준다', async () => {
    const wrapper = mountTable()
    expect(rows(wrapper)).toHaveLength(TALISMANS.length)
    await wrapper.find('[data-testid="search"]').setValue('Claw Talisman')
    expect(rows(wrapper)[0]!.find('[data-testid="cell-effect"]').text()).toBe('점프 공격 시: 공격력 +15% (PvP +7.5%)')
    wrapper.unmount()
  })

  it('분류 필터와 함께 낄 수 없는 탈리스만', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="type-filter"]').setValue('Absorption')
    expect(rows(wrapper).length).toBeGreaterThan(0)
    expect(rows(wrapper).every((r) => r.find('[data-testid="cell-category"]').text().includes('피해 경감'))).toBe(true)

    await wrapper.find('[data-testid="search"]').setValue('Dragoncrest Shield Talisman')
    const conflicts = rows(wrapper)[0]!.find('[data-testid="cell-conflicts"]').text()
    expect(conflicts).toContain('Dragoncrest Greatshield Talisman')
    wrapper.unmount()
  })

  it('+ 버튼으로 탈리스만 인벤토리에 추가된다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Claw Talisman')
    const store = useCharacterStore()
    const before = store.talismans.filter((s) => s.itemId === 'claw-talisman').length
    await rows(wrapper)[0]!.find('[data-testid="add-item"]').trigger('click')
    expect(store.talismans.filter((s) => s.itemId === 'claw-talisman').length).toBe(before + 1)
    wrapper.unmount()
  })
})
