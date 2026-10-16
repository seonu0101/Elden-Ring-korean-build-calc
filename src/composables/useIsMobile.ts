// 모바일인지 알아본다: 화면 폭 720px 이하, 또는 터치 화면이면서 950px 이하(가로로 돌린 휴대폰).
// 화면을 돌리거나 창 크기를 바꾸면 바로 바뀐다. 모바일 전용 화면(카드 목록 등)을 고를 때 쓴다.
import { onBeforeUnmount, onMounted, ref } from 'vue'

export const MOBILE_QUERY = '(max-width: 720px), (pointer: coarse) and (max-width: 950px)'

function matches(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches
}

export function useIsMobile() {
  const isMobile = ref(matches())
  let query: MediaQueryList | null = null
  const update = () => {
    isMobile.value = query?.matches ?? false
  }
  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    query = window.matchMedia(MOBILE_QUERY)
    update()
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))
  return isMobile
}
