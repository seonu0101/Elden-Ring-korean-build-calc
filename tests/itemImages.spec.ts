import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemTile from '@/components/ItemTile.vue'
import { ITEMS_BY_ID, PROTECTORS, TALISMANS, WEAPONS } from '@/data/items'
import { itemImageUrl } from '@/data/images'
import type { Item } from '@/types'

describe('아이템 이미지', () => {
  const cases: [string, readonly Item[], string][] = [
    ['무기', WEAPONS, 'weapons'],
    ['방어구', PROTECTORS, 'protectors'],
    ['탈리스만', TALISMANS, 'talismans'],
  ]

  /** Tourney Manager에 이미지가 없는 아이템 (이름 글자로 보인다) */
  const NO_IMAGE = ['gauntlets']

  it('이미지가 없는 아이템은 null', () => {
    for (const id of NO_IMAGE) expect(itemImageUrl(ITEMS_BY_ID.get(id)!)).toBeNull()
  })

  for (const [label, items, folder] of cases) {
    it(`모든 ${label}에 이미지가 있고, 파일이 public/img/${folder}에 있다`, () => {
      for (const item of items) {
        if (NO_IMAGE.includes(item.id)) continue
        const url = itemImageUrl(item)
        expect(url, item.name).toMatch(new RegExp(`^/img/${folder}/[a-z0-9-]+\\.png$`))
        expect(existsSync(join(process.cwd(), 'public', url!)), url!).toBe(true)
      }
    })
  }

  it('악센트가 있는 이름도 이미지를 찾는다', () => {
    const misericorde = WEAPONS.find((w) => w.name === 'Miséricorde')!
    expect(itemImageUrl(misericorde)).toBe('/img/weapons/misericorde.png')
  })

  it('방어구·탈리스만 주소', () => {
    expect(itemImageUrl(ITEMS_BY_ID.get('black-knife-hood')!)).toBe('/img/protectors/black-knife-hood.png')
    expect(itemImageUrl(ITEMS_BY_ID.get('erdtrees-favor')!)).toBe('/img/talismans/erdtrees-favor.png')
  })
})

describe('ItemTile', () => {
  it('무기는 이미지를 보여주고 이름은 툴팁으로', () => {
    const wrapper = mount(ItemTile, { props: { item: ITEMS_BY_ID.get('uchigatana')! } })
    const img = wrapper.find('[data-testid="item-image"]')
    expect(img.attributes('src')).toBe('/img/weapons/uchigatana.png')
    expect(img.attributes('alt')).toBe('Uchigatana')
    expect(wrapper.attributes('title')).toBe('Uchigatana')
  })

  it('이미지를 불러오지 못하면 이름 글자로 대신한다', async () => {
    const wrapper = mount(ItemTile, { props: { item: ITEMS_BY_ID.get('uchigatana')! } })
    await wrapper.find('[data-testid="item-image"]').trigger('error')
    expect(wrapper.find('[data-testid="item-image"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Uchigatana')
  })

  it('방어구·탈리스만도 이미지로 보여준다', () => {
    for (const id of ['vagabond-knight-armor', 'green-turtle-talisman']) {
      const wrapper = mount(ItemTile, { props: { item: ITEMS_BY_ID.get(id)! } })
      expect(wrapper.find('[data-testid="item-image"]').exists(), id).toBe(true)
    }
  })

  it('빈 칸은 글자로', () => {
    expect(mount(ItemTile, { props: { item: null, placeholder: 'RH1' } }).text()).toBe('RH1')
  })
})
