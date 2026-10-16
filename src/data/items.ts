import type { BuffItem, Item, ProtectorItem, ProtectorType, TalismanItem, WeaponItem } from '@/types'
import buffData from './buffs.generated.json'
import protectorData from './protectors.generated.json'
import talismanData from './talismans.generated.json'
import weaponData from './weapons.generated.json'
import { isEnemyEffect } from './talismanEffects'

// 무기·방어구·탈리스만: 원본 사이트에서 가져온 실제 데이터 (npm run import:weapons 로 갱신, 비상업적 용도로만 사용)

export const WEAPONS: WeaponItem[] = weaponData.weapons as WeaponItem[]

/** 처음 실행했을 때 인벤토리에 들어 있는 무기 */
export const STARTER_WEAPON_IDS: readonly string[] = [
  'longsword',
  'uchigatana',
  'moonveil',
  'rivers-of-blood',
  'dagger',
  'claymore',
  'bloodhounds-fang',
  'zweihander',
  'greatsword',
  'meteoric-ore-blade',
  'astrologers-staff',
  'finger-seal',
  'brass-shield',
  'heater-shield',
  'longbow',
]

export const PROTECTORS: ProtectorItem[] = protectorData.protectors as ProtectorItem[]

/** 처음 실행했을 때 인벤토리에 들어 있는 방어구. 부위마다 첫 번째를 장착한다. */
export const STARTER_PROTECTOR_IDS: Readonly<Record<ProtectorType, readonly string[]>> = {
  Head: ['vagabond-knight-helm', 'black-knife-hood', 'banished-knight-helm', 'iron-helmet'],
  Body: ['vagabond-knight-armor', 'black-knife-armor', 'banished-knight-armor'],
  Arms: ['vagabond-knight-gauntlets', 'black-knife-gauntlets', 'banished-knight-gauntlets'],
  Legs: ['vagabond-knight-greaves', 'black-knife-greaves', 'banished-knight-greaves'],
}

export const TALISMANS: TalismanItem[] = talismanData.talismans as TalismanItem[]

/** 처음 실행했을 때 인벤토리에 들어 있는 탈리스만. 앞의 두 개를 장착한다. */
export const STARTER_TALISMAN_IDS: readonly string[] = [
  'erdtrees-favor',
  'green-turtle-talisman',
  'radagons-soreseal',
  'dragoncrest-shield-talisman',
  'shard-of-alexander',
  'rotten-winged-sword-insignia',
  'godfrey-icon',
  'claw-talisman',
  'longtail-cat-talisman',
  'lord-of-bloods-exultation',
  'ritual-sword-talisman',
  'crimson-amber-medallion',
]

/**
 * 예전(샘플 데이터 시절) 아이템 id → 지금 id. 저장된 인벤토리를 불러올 때 바꿔 준다.
 * 'assassins-approach'는 탈리스만이 아니라서 없앴다.
 */
export const LEGACY_ITEM_IDS: Readonly<Record<string, string>> = {
  'green-turtle': 'green-turtle-talisman',
  'dragoncrest-shield': 'dragoncrest-shield-talisman',
  'rotten-winged-sword': 'rotten-winged-sword-insignia',
  'longtail-cat': 'longtail-cat-talisman',
  'lord-of-blood': 'lord-of-bloods-exultation',
  'ritual-sword': 'ritual-sword-talisman',
  'crimson-amber': 'crimson-amber-medallion',
}

/** 디버프: 효과가 모두 적에게 가는 주문·아이템 (원본 사이트의 효과 대상이 opponent·aoe) */
export function isDebuff(b: Pick<BuffItem, 'effects'>): boolean {
  return b.effects.length > 0 && b.effects.every(isEnemyEffect)
}

/** 버프로 켤 수 있는 주문·소비 아이템 (인벤토리 아이템과 따로 관리) */
export const BUFFS: BuffItem[] = (buffData.buffs as BuffItem[]).map((b) => (isDebuff(b) ? { ...b, category: 'Debuff', sourceCategory: b.category } : b))
export const BUFFS_BY_ID: ReadonlyMap<string, BuffItem> = new Map(BUFFS.map((b) => [b.id, b]))

export const ALL_ITEMS: Item[] =[...WEAPONS, ...PROTECTORS, ...TALISMANS]

export const ITEMS_BY_ID: ReadonlyMap<string, Item> = new Map(ALL_ITEMS.map((item) => [item.id, item]))
