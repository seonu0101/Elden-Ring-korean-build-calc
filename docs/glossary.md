# 번역 용어집

앱 화면에 쓰인 한국어 번역과 원문(영어)입니다. 모두 284개. 번역은 직접 옮긴 것이라 한국어판 게임 표기와 다를 수 있습니다.

- 고칠 때는 각 분류 제목 아래의 **코드 위치**에 있는 표에서 오른쪽 값(한국어)만 바꾸면 화면 전체에 반영됩니다.
- 고친 뒤 `npm run glossary`를 실행하면 이 문서도 다시 만들어집니다.
- 아이템 이름(무기·방어구·탈리스만·버프)과 무기군은 번역하지 않고 영어 원문 그대로 보여줍니다 (맨 아래 참고).

## 목차

0. 확인이 필요해 보이는 번역
1. 화면 공통 용어 (40)
2. 능력치 (8)
3. 능력치 (줄임) (5)
4. 공격 속성 (5)
5. 방어력·경감률 항목 (8)
6. 상태이상 (6)
7. 상태이상 내성 (4)
8. 변질 (Affinity) (13)
9. 방어구 부위 (4)
10. 구분 (본편/DLC) (3)
11. 버프 분류 (12)
12. 탈리스만 분류 (8)
13. 효과 항목 (85)
14. 효과 조건 (83)
15. 번역하지 않은 것: 무기군 (42)

## 0. 확인이 필요해 보이는 번역

| 번역 | 원문 | 이유 |
|---|---|---|
| 신비 | Arcane (능력치) / Occult (변질) | 같은 번역입니다. 변질 버튼에는 영어가 함께 보입니다. |
| 마력·화염·벼락·신성·독 | 변질 이름 = 공격 속성·상태이상 이름 | 변질(Magic, Fire, Lightning, Sacred, Poison)과 속성 이름이 같습니다. 냉기(Cold 변질)와 동상(Frostbite 상태이상)은 구분했습니다. |
| 전회 | Ash of War / Skill | 효과 조건의 "전회", "전회 차지" 등에 쓰입니다. |
| 효과 항목·효과 조건 | 탈리스만·버프 효과 설명 | 13·14번의 효과 이름 168개는 아직 대부분 검토하지 않았습니다. |

## 1. 화면 공통 용어

코드 위치: `여러 화면 (직접 정리)`

| 원문 | 번역 | 쓰는 곳 |
|---|---|---|
| Weight | 무게 | 요약 패널, 무기·방어구·탈리스만 표, 상세 정보 |
| Poise | 강인도 | 요약 패널, 방어구 표 |
| Defense | 방어력 | 요약 패널 방어력/경감률 표 |
| Damage Negation | 경감률 / 피해 경감률 | 요약 패널, 방어구 표 |
| Attack Power (AR) | 공격력 | 무기 표, 스탯 화면, 상세 정보, 버프 패널 |
| Attribute Scaling | 보정 / 능력 보정 | 무기 표, 상세 정보 |
| Attributes Required | 요구 능력치 | 무기 표, 상세 정보, 스탯 화면 |
| Guarded Damage Negation | 가드 경감률 | 무기 표 |
| Guard Boost | 가드 강도 | 무기 표 |
| Status Effect Buildup | 상태이상 축적치 | 요약 패널, 무기 표, 스탯 화면 |
| Resistance | 상태이상 내성 | 방어구 표 |
| Affinity | 변질 | 무기 표, 스탯 화면 |
| Ash of War / Skill | 전회 | 탈리스만 효과 설명 |
| Reinforcement / Upgrade | 강화 | 무기 표, 스탯 화면 |
| Smithing Stone | 단석 | 무기 표 안내 (일반 무기 강화 재료, 최대 +25) |
| Somber Smithing Stone | 색 잃은 단석 | 무기 표 안내 (특수 무기 강화 재료, 최대 +10) |
| Regular weapon (Smithing Stone) | 일반 무기 | 강화 설정 |
| Somber weapon (Somber Smithing Stone) | 특수 무기 | 강화 설정 |
| Weapon Type | 무기군 | 무기 표 |
| Armament | 무기 | 장비 칸 이름, 상세 정보 |
| Right Hand Armament | 오른손 무기 | 장비 칸 (RH1~3) |
| Left Hand Armament | 왼손 무기 | 장비 칸 (LH1~3) |
| Armor | 방어구 | 방어구 표, 상세 정보 |
| Talisman | 탈리스만 | 탈리스만 표, 장비 칸 |
| Equipment | 장비 | 장비 화면 |
| Inventory | 인벤토리 | 장비 화면 안내, 초기화 |
| Equip / Unequip | 장착 / 장착 해제 | 장비 화면 |
| Rune Level | 레벨 | 스탯 화면 |
| One-Handed / Two-Handed | 한손 / 양손 | 스탯 화면, 무기 표 |
| Incantation | 기도 | 버프 패널 |
| Sorcery | 마술 | 버프 패널 |
| Great Rune | 거대한 룬 | 버프 패널 |
| Flask of Wondrous Physick | 성배병 | 탈리스만 효과 설명 |
| Crystal Tear | 영약 | 버프 패널 |
| Spirit Ash | 소환 영체 | 탈리스만·버프 효과 설명 |
| Weapon buff (enchantment) | 무기 버프 | 버프 중첩 규칙 |
| Body buff | 바디 버프 | 버프 중첩 규칙 |
| Does not stack | 중첩 불가 | 버프 패널 |
| Base game | 본편 | 표의 구분 필터 |
| Shadow of the Erdtree (DLC) | DLC | 표의 구분 필터 |

## 2. 능력치

코드 위치: `src/stores/stats.ts › ATTRIBUTE_LABELS` — 스탯 화면

| 원문 | 번역 |
|---|---|
| Vigor | 생명력 |
| Mind | 정신력 |
| Endurance | 지구력 |
| Strength | 근력 |
| Dexterity | 기량 |
| Intelligence | 지력 |
| Faith | 신앙 |
| Arcane | 신비 |

## 3. 능력치 (줄임)

코드 위치: `src/data/labels.ts › STAT_SHORT_LABELS` — 무기 표의 요구 능력치·보정 열 제목

| 원문 | 번역 |
|---|---|
| Strength | 근 |
| Dexterity | 기 |
| Intelligence | 지 |
| Faith | 신 |
| Arcane | 비 |

## 4. 공격 속성

코드 위치: `src/data/labels.ts › DAMAGE_LABELS` — 공격력 열, 버프 패널

| 원문 | 번역 |
|---|---|
| Physical | 물리 |
| Magic | 마력 |
| Fire | 화염 |
| Lightning | 벼락 |
| Holy | 신성 |

## 5. 방어력·경감률 항목

코드 위치: `src/data/labels.ts › NEGATION_LABELS` — 요약 패널, 방어구 표

| 원문 | 번역 |
|---|---|
| Physical | 물리 |
| Strike | 타격 |
| Slash | 참격 |
| Pierce | 관통 |
| Magic | 마력 |
| Fire | 화염 |
| Lightning | 벼락 |
| Holy | 신성 |

## 6. 상태이상

코드 위치: `src/data/labels.ts › STATUS_LABELS` — 축적치 표, 무기 표

| 원문 | 번역 |
|---|---|
| Hemorrhage (Blood Loss) | 출혈 |
| Frostbite | 동상 |
| Poison | 독 |
| Scarlet Rot | 부패 |
| Sleep | 수면 |
| Madness | 발광 |

## 7. 상태이상 내성

코드 위치: `src/features/itemTables/ArmorTable.vue › RESISTANCE_LABELS` — 방어구 표

| 원문 | 번역 |
|---|---|
| Immunity | 면역 |
| Robustness | 강건 |
| Focus | 집중력 |
| Vitality | 항사 |

## 8. 변질 (Affinity)

코드 위치: `src/data/labels.ts › AFFINITY_LABELS` — 무기 표, 스탯 화면

| 원문 | 번역 |
|---|---|
| Standard | 일반 |
| Heavy | 중후 |
| Keen | 예리 |
| Quality | 상질 |
| Fire | 화염 |
| Flame Art | 화염술 |
| Lightning | 벼락 |
| Sacred | 신성 |
| Magic | 마력 |
| Cold | 냉기 |
| Poison | 독 |
| Blood | 피 |
| Occult | 신비 |

## 9. 방어구 부위

코드 위치: `src/features/itemTables/ArmorTable.vue › PART_LABELS` — 방어구 표

| 원문 | 번역 |
|---|---|
| Head | 머리 |
| Chest (Body) | 몸통 |
| Arms | 팔 |
| Legs | 다리 |

## 10. 구분 (본편/DLC)

코드 위치: `src/data/labels.ts › CONTENT_LABELS` — 표의 이름 옆 태그

| 원문 | 번역 |
|---|---|
| Base game | 본편 |
| Shadow of the Erdtree (DLC) | DLC |
| Other | 기타 |

## 11. 버프 분류

코드 위치: `src/features/buffs/BuffPanel.vue › CATEGORY_LABELS` — 버프 패널 고르기 목록

| 원문 | 번역 |
|---|---|
| Incantation | 기도 |
| Sorcery | 마술 |
| Edible | 소모품 |
| Grease | 기름 |
| Crystal Tear | 영약 |
| Aromatic | 조향병 |
| Pot | 항아리 |
| Offensive | 공격 아이템 |
| Throwable | 투척 아이템 |
| Great Rune | 거대한 룬 |
| Utility | 유틸 아이템 |
| Essential | 기본 아이템 |

## 12. 탈리스만 분류

코드 위치: `src/data/talismanEffects.ts › TALISMAN_CATEGORY_LABELS` — 탈리스만 표

| 원문 | 번역 |
|---|---|
| Stat | 능력치 |
| Attack | 공격 |
| Absorption | 피해 경감 |
| Resistances | 내성 |
| Spell | 주문 |
| Healing | 회복 |
| Utility | 유틸 |
| PvP | PvP |

## 13. 효과 항목

코드 위치: `src/data/talismanEffects.ts › TALISMAN_ATTRIBUTE_LABELS` — 탈리스만·버프 효과 설명

| 원문 | 번역 |
|---|---|
| Attack Power | 공격력 |
| Physical Attack Power | 물리 공격력 |
| Magic Attack Power | 마력 공격력 |
| Fire Attack Power | 화염 공격력 |
| Lightning Attack Power | 벼락 공격력 |
| Holy Attack Power | 신성 공격력 |
| Stamina Attack Rate | 스태미나 공격력 |
| Scale Physical Attack Power with Equip Load | 장비 중량에 따라 물리 공격력 증가 |
| Absorption | 피해 경감 |
| Physical Absorption | 물리 피해 경감 |
| Elemental Absorption | 속성 피해 경감 |
| Magic Absorption | 마력 피해 경감 |
| Fire Absorption | 화염 피해 경감 |
| Lightning Absorption | 벼락 피해 경감 |
| Holy Absorption | 신성 피해 경감 |
| Maximum Health | 최대 HP |
| Maximum Focus | 최대 FP |
| Maximum Stamina | 최대 스태미나 |
| Maximum Equip Load | 최대 장비 중량 |
| Health Points | HP 회복 |
| Focus Points | FP 회복 |
| Stamina Recovery Speed | 스태미나 회복 속도 |
| Vigor | 생명력 |
| Mind | 정신력 |
| Endurance | 지구력 |
| Strength | 근력 |
| Dexterity | 기량 |
| Intelligence | 지력 |
| Faith | 신앙 |
| Arcane | 신비 |
| Immunity | 면역 |
| Robustness | 강건 |
| Focus | 집중력 |
| Vitality | 항사 |
| Poise | 강인도 |
| Item Discovery | 아이템 발견력 |
| Rune Acquisition | 룬 획득량 |
| Memory Slots | 기억 슬롯 |
| Bow Distance | 활 사거리 |
| Casting Speed | 주문 시전 속도 |
| Spell Duration | 주문 지속 시간 |
| Spell Focus Consumption | 주문 FP 소모 |
| Skill Focus Consumption | 전회 FP 소모 |
| Extended Roll Iframes Enabled | 구르기 무적 시간 증가 |
| Backstep Iframes Enabled | 백스텝 무적 시간 증가 |
| Reduce Headshot Impact | 헤드샷 피해 감소 |
| Flask Health Restoration | 성배병 HP 회복량 |
| Flask Focus Restoration | 성배병 FP 회복량 |
| Incoming Stamina Damage | 받는 스태미나 피해 |
| Enemy Hearing | 적이 듣는 소리 |
| Invisible at Distance | 멀리서 보이지 않음 |
| Fall Damage | 낙하 피해 |
| Attract Enemy Aggression | 적의 표적이 되기 쉬움 |
| Destroy Item on Death | 죽으면 탈리스만이 깨짐 |
| Preserve Runes on Death | 죽어도 룬을 잃지 않음 |
| Appear as Host | 호스트의 모습으로 보임 |
| Appear as Cooperator | 협력자로 보임 |
| Bleed Buildup | 출혈 축적 |
| Poison Buildup | 독 축적 |
| Scarlet Rot Buildup | 부패 축적 |
| Frost Buildup | 동상 축적 |
| Sleep Buildup | 수면 축적 |
| Madness Buildup | 발광 축적 |
| Deathblight Buildup | 죽음 축적 |
| Death Buildup | 즉사 축적 |
| Frost | 동상 |
| Physical Guard Absorption | 가드 물리 경감 |
| Magic Guard Absorption | 가드 마력 경감 |
| Fire Guard Absorption | 가드 화염 경감 |
| Lightning Guard Absorption | 가드 벼락 경감 |
| Holy Guard Absorption | 가드 신성 경감 |
| Deflection | 공격 튕겨내기 |
| Ignore Damage Level | 경직 무시 |
| Change Damage Level | 경직 변화 |
| Restore HP on Attack | 공격 시 HP 회복 |
| Spirit Ash Health Points | 소환 영체 HP |
| Spirit Ash Attack Power | 소환 영체 공격력 |
| Grant Phantom Great Rune | 침입자 거대한 룬 효과 |
| Apply Oil Effect To Nearby Enemies | 주변 적에게 기름 효과(화염 데미지 증가) |
| Summon Donut Buddy | 소환 |
| Stamina Consumption | 스태미나 소모 |
| Framerate | 프레임 레이트 |
| Physical Damage on Roll | 구르기 시 물리 피해 |
| Hide User | 모습 숨김 |
| Hide Weapon | 무기 숨김 |

## 14. 효과 조건

코드 위치: `src/data/talismanEffects.ts › TALISMAN_CONDITION_LABELS` — 탈리스만·버프 효과 설명 ("… 시:")

| 원문 | 번역 |
|---|---|
| Charged Skill Attack | 전회 차지 |
| Skill Attack | 전회 |
| Charge Attack | 강공격 |
| Charged Attack | 차지 공격 |
| Successive 3 Hits | 3회 연속 공격 |
| Successive 6 Hits | 6회 연속 공격 |
| Successive 9 Hits | 9회 연속 공격 |
| Successive Hits | 연속 공격 |
| HP below 20% | HP 20% 이하 |
| HP above 100% | HP 최대 |
| Enhance Thrusting Counter Attacks | 관통 카운터 |
| Enhance Critical Attacks | 치명타 |
| Trigger during Critical Hit | 치명타 |
| Trigger after Critical Hit | 치명타 뒤 |
| Trigger on Critical Hit (HP) | 치명타 (HP) |
| Trigger on Critical Hit (FP) | 치명타 (FP) |
| Final Chain Attack | 연속 공격 마지막 타 |
| Horseback Attack | 말 위 공격 |
| Ammunition Attack | 화살·볼트 |
| Ammunition OnHit Attack | 화살·볼트 명중 |
| Ranged Skill Attack | 원거리 전회 |
| Trigger in Presence of Blood Loss | 주변에서 출혈 발생 |
| Trigger in Presence of Rot | 주변에서 부패 발생 |
| Trigger in Presence of Madness | 주변에서 발광 발생 |
| Trigger in Presence of Sleep | 주변에서 수면 발생 |
| Jump Attack | 점프 공격 |
| Omen Bairn | 흉조 아이 |
| Roar Attack | 포효·브레스 공격 |
| Guard Counter Attack | 가드 카운터 |
| Pot Item Attack | 항아리 투척 |
| Perfume Item Attack | 조향병 |
| Affects Sorceries | 마술 |
| Affects Incantations | 기도 |
| Spell Power Boost | 주문 위력 |
| Apply Kill Effect | 적 처치 |
| On Spirit Ash Killed | 소환 영체가 쓰러짐 |
| Trigger on Crouch | 웅크리기 |
| Kicking/Stomping Skill Attack | 발차기·밟기 전회 |
| Two-Handed | 양손 |
| Guarding | 가드 |
| Weapon-Throwing Attack | 무기 투척 |
| On Poison | 독 |
| On Scarlet Rot | 부패 |
| On Frostbite | 동상 |
| On Blood Loss | 출혈 |
| On Sleep | 수면 |
| On Madness | 발광 |
| Rolling or Backstep | 구르기·백스텝 |
| Running Attack | 달리기 공격 |
| Precision Aiming | 정밀 조준 |
| Magma Incantation/Weapon Skill Attack | 용암 기도·전회 |
| Storm Attack | 폭풍 공격 |
| Using Flask | 성배병 사용 |
| Heavy Load | 무거움 |
| Overloaded | 중량 초과 |
| Hold Stance | 자세 유지 |
| Unknown #497 | 알 수 없는 조건 |
| Unknown #500 | 알 수 없는 조건 |
| Body Buff VFX | 바디 버프 연출 |
| Left-hand Buff VFX | 왼손 버프 연출 |
| Dragon Change VFX | 용 변신 연출 |
| Damage Level Change before Poise Break | 강인도가 깨지기 전 경직 변화 |
| On Hit | 피격 |
| HP below 21% | HP 21% 미만 |
| vs Ancient Dragon Enemies | 고룡 상대 |
| vs Dragon Enemies | 용 상대 |
| vs Undead Enemies | 언데드 상대 |
| Not a Chaos Follower | 미친불을 받지 않았을 때 |
| Damage Received | 피해를 받음 |
| Invading | 침입 중 |
| Nearby Ally | 근처 아군 |
| Inside Affected Area | 효과 범위 안 |
| Damage Level 0 | 경직 0단계 |
| Damage Level 1 | 경직 1단계 |
| Damage Level 2 | 경직 2단계 |
| Damage Level 3 | 경직 3단계 |
| Damage Level 4 | 경직 4단계 |
| Damage Level 5 | 경직 5단계 |
| Damage Level 6 | 경직 6단계 |
| Damage Level 7 | 경직 7단계 |
| Damage Level 8 | 경직 8단계 |
| Damage Level 9 | 경직 9단계 |
| Damage Level 10 | 경직 10단계 |

## 15. 번역하지 않은 것: 무기군

무기 표의 "무기군" 열과 필터에 영어 그대로 나옵니다.

`Axe`, `Backhand Blade`, `Ballista`, `Beast Claw`, `Bow`, `Claw`, `Colossal Sword`, `Colossal Weapon`, `Crossbow`, `Curved Greatsword`, `Curved Sword`, `Dagger`, `Fist`, `Flail`, `Glintstone Staff`, `Great Hammer`, `Great Katana`, `Great Spear`, `Greataxe`, `Greatbow`, `Greatshield`, `Greatsword`, `Halberd`, `Hammer`, `Hand-to-Hand`, `Heavy Thrusting Sword`, `Katana`, `Light Bow`, `Light Greatsword`, `Medium Shield`, `Perfume Bottle`, `Reaper`, `Sacred Seal`, `Small Shield`, `Spear`, `Straight Sword`, `Throwing Blade`, `Thrusting Shield`, `Thrusting Sword`, `Torch`, `Twinblade`, `Whip`
