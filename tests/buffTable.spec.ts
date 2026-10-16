import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { BUFFS } from '@/data/items'
import BuffTable from '@/features/itemTables/BuffTable.vue'
import { useBuffsStore } from '@/stores/buffs'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function mountTable() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(BuffTable, { global: { plugins: [pinia] } })
}

const rows = (w: ReturnType<typeof mountTable>) => w.findAll('[data-testid="item-row"]')

describe('버프 표', () => {
  it('모든 버프가 한 줄씩 나온다', () => {
    const wrapper = mountTable()
    expect(wrapper.find('[data-testid="row-count"]').text()).toBe(`${BUFFS.length} / ${BUFFS.length}`)
    wrapper.unmount()
  })

  it('황금 맹세: 공격력 +15%, 받는 피해 −10%, 효과에 PvP 수치', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Golden Vow')
    const spell = rows(wrapper).find((r) => r.find('[data-testid="cell-category"]').text() === '기도')!
    expect(spell.find('[data-testid="cell-attack"]').text()).toBe('모든 속성 +15%')
    expect(spell.find('[data-testid="cell-taken"]').text()).toBe('모든 속성 −10%')
    expect(spell.find('[data-testid="cell-duration"]').text()).toBe('80')
    expect(spell.find('[data-testid="cell-effect"]').text()).toContain('PvP')
    wrapper.unmount()
  })

  it('물리만 오르는 버프는 그 속성만, 중첩 묶음도 보인다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Flame, Grant Me Strength')
    const row = rows(wrapper)[0]!
    expect(row.find('[data-testid="cell-attack"]').text()).toMatch(/^물리 \+20%/)
    expect(row.find('[data-testid="cell-stack"]').text()).toBe('바디 버프 (물리 공격력)')
    wrapper.unmount()
  })

  it('공격력 칸으로 정렬하면 큰 값부터', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="sort-attack"]').trigger('click')
    const first = rows(wrapper)[0]!.find('[data-testid="cell-attack"]').text()
    expect(first).not.toBe('–')
    wrapper.unmount()
  })

  it('켜기를 누르면 장비 화면 버프에 들어가고, 다시 누르면 꺼진다', async () => {
    const wrapper = mountTable()
    await wrapper.find('[data-testid="search"]').setValue('Golden Vow')
    const button = rows(wrapper)[0]!.find('[data-testid="toggle-buff"]')
    await button.trigger('click')
    expect(useBuffsStore().selected).toHaveLength(1)
    expect(button.text()).toBe('켬')
    await button.trigger('click')
    expect(useBuffsStore().selected).toHaveLength(0)
    // 인벤토리 + 버튼은 없다
    expect(wrapper.find('[data-testid="add-item"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('탈리스만 표와 스탯 사이에 "버프 표" 탭', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    const nav = wrapper.findAll('nav button').map((b) => b.text())
    expect(nav.indexOf('버프 표')).toBe(nav.indexOf('탈리스만 표') + 1)
    expect(nav.indexOf('스탯')).toBe(nav.indexOf('버프 표') + 1)
    await wrapper.find('[data-testid="nav-buffs"]').trigger('click')
    expect(wrapper.find('[aria-label="버프 표"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
