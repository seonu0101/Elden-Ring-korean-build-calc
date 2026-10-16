import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { keyToViewStep, risingEdge, stepView } from '@/features/appNav/appNavigation'

const VIEWS = ['equipment', 'weapons', 'armor', 'talismans', 'buffs', 'stats', 'formulas'] as const

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function key(init: Partial<KeyboardEventInit> & { key: string }, target?: Element) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  ;(target ?? window).dispatchEvent(event)
  return event
}

function activeNav(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('nav button.is-active').text()
}

describe('stepView', () => {
  it('다음·이전으로 옮기고 끝에서는 반대쪽으로 이어진다', () => {
    expect(stepView(VIEWS, 'equipment', 1)).toBe('weapons')
    expect(stepView(VIEWS, 'formulas', 1)).toBe('equipment')
    expect(stepView(VIEWS, 'equipment', -1)).toBe('formulas')
    expect(stepView(VIEWS, 'stats', -1)).toBe('buffs')
    expect(stepView(VIEWS, 'buffs', -1)).toBe('talismans')
  })
})

describe('keyToViewStep', () => {
  const base = { ctrlKey: false, altKey: false, metaKey: false, repeat: false, target: null }
  it('[ 는 이전, ] 는 다음', () => {
    expect(keyToViewStep({ ...base, key: '[' })).toBe(-1)
    expect(keyToViewStep({ ...base, key: ']' })).toBe(1)
    expect(keyToViewStep({ ...base, key: 'a' })).toBeNull()
  })
  it('조합키나 키를 누르고 있는 반복 입력은 무시한다', () => {
    expect(keyToViewStep({ ...base, key: ']', ctrlKey: true })).toBeNull()
    expect(keyToViewStep({ ...base, key: ']', altKey: true })).toBeNull()
    expect(keyToViewStep({ ...base, key: ']', metaKey: true })).toBeNull()
    expect(keyToViewStep({ ...base, key: ']', repeat: true })).toBeNull()
  })
  it('입력창에 글을 쓰는 중에는 무시한다', () => {
    const input = document.createElement('input')
    expect(keyToViewStep({ ...base, key: ']', target: input })).toBeNull()
    const select = document.createElement('select')
    expect(keyToViewStep({ ...base, key: ']', target: select })).toBeNull()
  })
})

describe('risingEdge', () => {
  it('새로 눌린 순간에만 true', () => {
    expect(risingEdge(false, true)).toBe(true)
    expect(risingEdge(true, true)).toBe(false)
    expect(risingEdge(true, false)).toBe(false)
    expect(risingEdge(false, false)).toBe(false)
  })
})

describe('앱 화면 이동', () => {
  function mountApp() {
    const pinia = createPinia()
    setActivePinia(pinia)
    return mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  }

  it('] 와 [ 로 모든 화면을 돈다', async () => {
    const wrapper = mountApp()
    const order = ['장비', '무기 표', '방어구 표', '탈리스만 표', '버프 표', '스탯', '계산식', '장비']
    expect(activeNav(wrapper)).toBe(order[0])
    for (const label of order.slice(1)) {
      key({ key: ']' })
      await wrapper.vm.$nextTick()
      expect(activeNav(wrapper)).toBe(label)
    }
    key({ key: '[' })
    await wrapper.vm.$nextTick()
    expect(activeNav(wrapper)).toBe('계산식')
    wrapper.unmount()
  })

  it('입력창에 글을 쓰는 중에는 화면이 바뀌지 않는다', async () => {
    const wrapper = mountApp()
    key({ key: ']' })
    await wrapper.vm.$nextTick()
    expect(activeNav(wrapper)).toBe('무기 표')
    const search = wrapper.find('[data-testid="search"]')
    key({ key: ']' }, search.element)
    await wrapper.vm.$nextTick()
    expect(activeNav(wrapper)).toBe('무기 표')
    wrapper.unmount()
  })

  it('길게 눌러서 생기는 반복 입력으로는 계속 넘어가지 않는다', async () => {
    const wrapper = mountApp()
    key({ key: ']' })
    key({ key: ']', repeat: true })
    key({ key: ']', repeat: true })
    await wrapper.vm.$nextTick()
    expect(activeNav(wrapper)).toBe('무기 표')
    wrapper.unmount()
  })

  it('돌아오면 검색어가 남아 있다', async () => {
    const wrapper = mountApp()
    key({ key: ']' })
    await wrapper.vm.$nextTick()
    const search = wrapper.find<HTMLInputElement>('[data-testid="search"]')
    await search.setValue('moon')
    key({ key: ']' })
    await wrapper.vm.$nextTick()
    key({ key: '[' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find<HTMLInputElement>('[data-testid="search"]').element.value).toBe('moon')
    wrapper.unmount()
  })

  it('다른 화면에 있을 때 장비 화면의 키는 가로채지 않는다', async () => {
    const wrapper = mountApp()
    key({ key: ']' })
    await wrapper.vm.$nextTick()
    const event = key({ key: 'ArrowDown' })
    expect(event.defaultPrevented).toBe(false)
    const escape = key({ key: 'Escape' })
    expect(escape.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('상단에 키 안내가 보인다', () => {
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="nav-hint"]').text()).toContain('화면 이동')
    wrapper.unmount()
  })
})
