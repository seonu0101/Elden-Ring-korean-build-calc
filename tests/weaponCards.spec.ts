import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { MOBILE_QUERY } from '@/composables/useIsMobile'
import { nameLanguage } from '@/data/names'
import WeaponTable from '@/features/weaponTable/WeaponTable.vue'
import { useCharacterStore } from '@/stores/character'

/** matchMedia 흉내: mobile이면 모바일 질의가 맞는다. change 이벤트로 바꿀 수 있다 */
function fakeMatchMedia(mobile: boolean) {
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return state.mobile
    },
    media: MOBILE_QUERY,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  const state = { mobile }
  window.matchMedia = ((q: string) => (q === MOBILE_QUERY ? list : { matches: false, addEventListener() {}, removeEventListener() {} })) as never
  return {
    set(next: boolean) {
      state.mobile = next
      listeners.forEach((fn) => fn())
    },
  }
}

const original = window.matchMedia

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  window.matchMedia = original
})

function mountTable() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(WeaponTable, { global: { plugins: [pinia] } })
}

describe('모바일 무기 카드 목록', () => {
  it('모바일이면 표 대신 카드, 아니면 표', async () => {
    fakeMatchMedia(true)
    const mobile = mountTable()
    await nextTick()
    expect(mobile.find('[data-testid="weapon-cards"]').exists()).toBe(true)
    expect(mobile.find('.wt__table').exists()).toBe(false)
    mobile.unmount()

    fakeMatchMedia(false)
    const desktop = mountTable()
    await nextTick()
    expect(desktop.find('[data-testid="weapon-cards"]').exists()).toBe(false)
    expect(desktop.find('.wt__table').exists()).toBe(true)
    desktop.unmount()
  })

  it('화면을 돌려 크기가 바뀌면 바로 바뀐다', async () => {
    const media = fakeMatchMedia(false)
    const wrapper = mountTable()
    await nextTick()
    expect(wrapper.find('.wt__table').exists()).toBe(true)
    media.set(true)
    await nextTick()
    expect(wrapper.find('[data-testid="weapon-cards"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('카드: 이름·공격력·보정·요구 능력치, 누르면 자세히, 인벤토리 추가', async () => {
    fakeMatchMedia(true)
    nameLanguage.value = 'ko'
    const wrapper = mountTable()
    await nextTick()
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    const card = wrapper.find('[data-testid="weapon-card"]')
    expect(card.text()).toContain('타도')
    expect(card.find('[data-testid="card-attack"]').text()).toMatch(/\d+/)
    expect(card.text()).toContain('보정')
    expect(card.text()).toContain('요구')
    expect(card.find('[data-testid="card-detail"]').exists()).toBe(false)

    await card.find('button').trigger('click')
    const detail = wrapper.find('[data-testid="card-detail"]')
    expect(detail.exists()).toBe(true)
    expect(detail.text()).toContain('가드 경감률')

    const store = useCharacterStore()
    const before = store.weapons.filter((s) => s.itemId === 'uchigatana').length
    await detail.find('[data-testid="card-add"]').trigger('click')
    expect(store.weapons.filter((s) => s.itemId === 'uchigatana').length).toBe(before + 1)
    wrapper.unmount()
  })

  it('여러 변질을 보면 카드에 변질 이름이 나온다', async () => {
    fakeMatchMedia(true)
    nameLanguage.value = 'ko'
    const wrapper = mountTable()
    await nextTick()
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    await wrapper.find('[data-testid="affinity-Heavy"]').trigger('click')
    const affinities = wrapper.findAll('[data-testid="card-affinity"]').map((c) => c.text())
    expect(affinities).toEqual(['일반', '중후'])
    wrapper.unmount()
  })
})
