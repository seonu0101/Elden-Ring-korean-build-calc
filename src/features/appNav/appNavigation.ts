import { onBeforeUnmount, onMounted } from 'vue'
import type { Ref } from 'vue'
import { isTypingTarget } from '@/features/gameMenu/useKeyboardInput'

/** 표준 게임패드 배치에서 Select / View 버튼. 장비 화면의 조작(useGamepadInput)이 쓰지 않는 버튼이다. */
export const GAMEPAD_NEXT_VIEW_BUTTON = 8

/** 화면 목록에서 delta칸 옮긴 화면. 끝에서는 반대쪽 끝으로 이어진다. */
export function stepView<T>(views: readonly T[], current: T, delta: 1 | -1): T {
  const index = views.indexOf(current)
  const from = index === -1 ? 0 : index
  return views[(from + delta + views.length) % views.length]!
}

/**
 * 키 입력이 화면 전환인지. [ 는 이전, ] 는 다음.
 * 입력창에 글을 쓰는 중, Ctrl/Alt/Meta 조합, 키를 누르고 있어서 생기는 반복 입력은 전환하지 않는다.
 */
export function keyToViewStep(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'repeat' | 'target'>,
): 1 | -1 | null {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null
  if (isTypingTarget(event.target)) return null
  if (event.key === '[') return -1
  if (event.key === ']') return 1
  return null
}

/** 버튼이 이번 프레임에 새로 눌렸는지 (누르고 있는 동안에는 한 번만) */
export function risingEdge(previouslyPressed: boolean, pressed: boolean): boolean {
  return pressed && !previouslyPressed
}

/**
 * 어느 화면에서든 쓰는 화면 이동 조작.
 * 키보드 [ / ], 게임패드 Select(View)는 다음 화면으로.
 */
export function useViewHotkeys<T>(views: readonly T[], view: Ref<T>) {
  function go(delta: 1 | -1) {
    view.value = stepView(views, view.value, delta)
  }

  function onKeyDown(event: KeyboardEvent) {
    const delta = keyToViewStep(event)
    if (delta === null) return
    event.preventDefault()
    go(delta)
  }

  let frame: number | null = null
  let wasPressed = false

  function poll() {
    frame = requestAnimationFrame(poll)
    const pad = navigator.getGamepads().find((p): p is Gamepad => p !== null && p.connected)
    const pressed = pad?.buttons[GAMEPAD_NEXT_VIEW_BUTTON]?.pressed ?? false
    if (risingEdge(wasPressed, pressed)) go(1)
    wasPressed = pressed
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    if (typeof navigator.getGamepads === 'function' && typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(poll)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    if (frame !== null) cancelAnimationFrame(frame)
  })

  return { go }
}
