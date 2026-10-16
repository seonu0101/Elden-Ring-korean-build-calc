import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import App from '@/App.vue'
import { ITEMS_BY_ID, PROTECTORS, TALISMANS, WEAPONS, BUFFS } from '@/data/items'
import { itemName, koreanName, NAME_LANGUAGE_KEY, nameLanguage, nameMatches, weaponTypeName } from '@/data/names'
import namesKo from '@/data/names-ko.generated.json'
import BuffTable from '@/features/itemTables/BuffTable.vue'
import WeaponTable from '@/features/weaponTable/WeaponTable.vue'
import { buildRows, filterWeapons, rowsToCsv, sortRows } from '@/features/weaponTable/weaponTable'
import { useBuffsStore } from '@/stores/buffs'
import { useCharacterStore } from '@/stores/character'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

const item = (id: string) => ITEMS_BY_ID.get(id)!

describe('한국어 이름 데이터', () => {
  it('모든 아이템(본편·DLC·타니쉬드 에디션)에 공식 한국어 이름이 있다', () => {
    const all = [...WEAPONS, ...PROTECTORS, ...TALISMANS, ...BUFFS]
    expect(all.filter((i) => !koreanName(i)).map((i) => i.name)).toEqual([])
    expect(koreanName({ id: 'leontiels-greatsword' })).toBe('레오티엘의 대검')
  })

  it('무기군 42개 모두 한국어 이름이 있다', () => {
    const types = new Set(WEAPONS.map((w) => w.weaponType))
    expect(types.size).toBe(42)
    for (const t of types) expect(namesKo.weaponTypes).toHaveProperty(t)
  })
})

describe('이름 전환', () => {
  it('언어에 따라 이름이 바뀌고, 한국어가 없으면 영어', () => {
    nameLanguage.value = 'ko'
    expect(itemName(item('longsword'))).toBe('롱 소드')
    expect(weaponTypeName('Katana')).toBe('도')
    // 한국어 이름이 없으면 영어 (데이터에 없는 id)
    expect(itemName({ id: 'no-such-item', name: 'No Such Item' })).toBe('No Such Item')
    nameLanguage.value = 'en'
    expect(itemName(item('longsword'))).toBe('Longsword')
    expect(weaponTypeName('Katana')).toBe('Katana')
  })

  it('검색은 한국어·영어 어느 쪽으로도 된다', () => {
    nameLanguage.value = 'ko'
    expect(nameMatches(item('uchigatana'), '타도')).toBe(true)
    expect(nameMatches(item('uchigatana'), 'uchiga')).toBe(true)
    const found = filterWeapons(WEAPONS, { query: '롱 소드', weaponType: null, content: 'all' })
    expect(found.map((w) => w.id)).toContain('longsword')
  })

  it('이름 정렬과 CSV는 화면 언어를 따른다', () => {
    nameLanguage.value = 'ko'
    const rows = sortRows(buildRows(WEAPONS.slice(0, 30), 'Standard'), 'name', 'asc')
    const names = rows.map((r) => itemName(r.w))
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ko')))
    expect(rowsToCsv(rows.slice(0, 1))).toContain(names[0])
  })

  it('설정은 기억된다', async () => {
    nameLanguage.value = 'ko'
    await nextTick()
    expect(localStorage.getItem(NAME_LANGUAGE_KEY)).toBe('ko')
    nameLanguage.value = 'en'
    await nextTick()
    expect(localStorage.getItem(NAME_LANGUAGE_KEY)).toBe('en')
  })

  it('머리글 버튼으로 바꾸면 무기 표 이름·무기군이 바뀐다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = mount(App, { global: { plugins: [pinia] } })
    await app.find('[data-testid="lang-ko"]').trigger('click')
    expect(nameLanguage.value).toBe('ko')
    app.unmount()

    const wrapper = mount(WeaponTable, { global: { plugins: [pinia] } })
    await wrapper.find('[data-testid="search"]').setValue('Uchigatana')
    const row = wrapper.find('[data-testid="weapon-row"]')
    expect(row.text()).toContain('타도')
    expect(row.text()).toContain('도')
    nameLanguage.value = 'en'
    await nextTick()
    expect(wrapper.find('[data-testid="weapon-row"]').text()).toContain('Uchigatana')
    wrapper.unmount()
  })

  it('버프 표·효과 합계의 출처 이름도 바뀐다', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    nameLanguage.value = 'ko'
    const wrapper = mount(BuffTable, { global: { plugins: [pinia] } })
    await wrapper.find('[data-testid="search"]').setValue('Golden Vow')
    const goldenVow = koreanName({ id: 'spell-golden-vow' })!
    expect(goldenVow).toBeTruthy()
    expect(wrapper.findAll('[data-testid="item-row"]').some((r) => r.text().includes(goldenVow))).toBe(true)
    wrapper.unmount()

    useBuffsStore().add('spell-golden-vow')
    const source = useBuffsStore().summary.attack.physical.parts[0]!.source
    expect(source).toBe(koreanName({ id: 'spell-golden-vow' }))
  })

  it('탈리스만 충돌 안내도 한국어 이름', () => {
    nameLanguage.value = 'ko'
    const character = useCharacterStore()
    character.clearInventory()
    const a = character.addItem('radagons-soreseal')!
    const b = character.addItem('radagons-soreseal')!
    expect(character.equip({ kind: 'talisman', equipIndex: 0 }, a.uid)).toBe(true)
    expect(character.talismanConflict({ kind: 'talisman', equipIndex: 1 }, b.uid)).toBe(koreanName({ id: 'radagons-soreseal' }))
  })
})
