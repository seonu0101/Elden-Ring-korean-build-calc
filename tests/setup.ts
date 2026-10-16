// 모든 테스트 공통: 기존 테스트는 영어 이름 기준이라 테스트마다 이름 언어를 영어로 되돌린다.
// 한국어 이름 테스트는 각 테스트 안에서 nameLanguage.value = 'ko'로 바꾼다.
import { beforeEach } from 'vitest'
import { nameLanguage } from '@/data/names'

beforeEach(() => {
  nameLanguage.value = 'en'
})
