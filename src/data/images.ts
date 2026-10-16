// 아이템 이미지 주소. 이미지는 Tourney Manager에서 복사했다 (npm run copy:item-images).
import type { Item, ItemKind } from '@/types'
import { protector, talisman, weapon } from './item-images.generated.json'

const IMAGES: Record<ItemKind, Record<string, string>> = { weapon, protector, talisman }
const FOLDERS: Record<ItemKind, string> = { weapon: 'weapons', protector: 'protectors', talisman: 'talismans' }

/** 아이템 이미지 주소. 이미지가 없으면 null */
export function itemImageUrl(item: Item): string | null {
  const file = IMAGES[item.kind][item.id]
  return file ? `${import.meta.env.BASE_URL}img/${FOLDERS[item.kind]}/${file}` : null
}
