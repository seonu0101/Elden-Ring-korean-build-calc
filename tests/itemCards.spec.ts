import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { MOBILE_QUERY } from '@/composables/useIsMobile'
import { nameLanguage } from '@/data/names'
import ArmorTable from '@/features/itemTables/ArmorTable.vue'
import BuffTable from '@/features/itemTables/BuffTable.vue'
import TalismanTable from '@/features/itemTables/TalismanTable.vue'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'

/** matchMedia 흉내: 모바일 질의만 mobile 값을 돌려준다 */
function fakeMatchMedia(mobile: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: q === MOBILE_QUERY ? mobile : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never
}

const original = window.matchMedia

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  window.matchMedia = original
})

function mountWith(component: unknown) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(component as never, { global: { plugins: [pinia] } })
}

describe('모바일 표 카드 목록', () => {
  it('PC에서는 그대로 표, 모바일에서는 카드', async () => {
    fakeMatchMedia(false)
    const desktop = mountWith(ArmorTable)
    await nextTick()
    expect(desktop.find('.it__table').exists()).toBe(true)
    expect(desktop.find('[data-testid="item-cards"]').exists()).toBe(false)
    desktop.unmount()

    fakeMatchMedia(true)
    const mobile = mountWith(ArmorTable)
    await nextTick()
    expect(mobile.find('.it__table').exists()).toBe(false)
    expect(mobile.find('[data-testid="item-cards"]').exists()).toBe(true)
    mobile.unmount()
  })

  it('방어구 카드: 부위·무게·강인도 요약, 경감률·내성 칸, 인벤토리 추가', async () => {
    fakeMatchMedia(true)
    nameLanguage.value = 'ko'
    const wrapper = mountWith(ArmorTable)
    await nextTick()
    const card = wrapper.find('[data-testid="item-card"]')
    expect(card.find('[data-testid="card-weight"]').text()).toMatch(/^무게 \d/)
    expect(card.find('[data-testid="card-neg.physical"]').exists()).toBe(true)
    expect(card.find('[data-testid="card-res.focus"]').text()).toContain('이성')
    expect(card.text()).toContain('피해 경감률(%)')

    const store = useCharacterStore()
    const before = Object.values(store.protectors).flat().length
    await card.find('[data-testid="add-item"]').trigger('click')
    expect(Object.values(store.protectors).flat().length).toBe(before + 1)
    wrapper.unmount()
  })

  it('탈리스만 카드: 효과 글', async () => {
    fakeMatchMedia(true)
    nameLanguage.value = 'ko'
    const wrapper = mountWith(TalismanTable)
    await nextTick()
    const card = wrapper.find('[data-testid="item-card"]')
    expect(card.find('[data-testid="card-effect"]').text()).toMatch(/^효과/)
    wrapper.unmount()
  })

  it('버프 카드: 켜기 버튼이 그대로 동작한다', async () => {
    fakeMatchMedia(true)
    const wrapper = mountWith(BuffTable)
    await nextTick()
    const card = wrapper.find('[data-testid="item-card"]')
    const buffs = useBuffsStore()
    expect(buffs.selected).toHaveLength(0)
    await card.find('.bt__toggle').trigger('click')
    expect(buffs.selected).toHaveLength(1)
    wrapper.unmount()
  })
})
