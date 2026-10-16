import { onBeforeUnmount, onMounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { MenuAction } from './useGameMenu'

const KEY_ACTIONS: Readonly<Record<string, MenuAction>> = {
  Escape: 'toggleMenu',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  e: 'confirm',
  E: 'confirm',
  Enter: 'confirm',
  q: 'back',
  Q: 'back',
  r: 'unequip',
  R: 'unequip',
  c: 'prevSlot',
  C: 'prevSlot',
  v: 'nextSlot',
  V: 'nextSlot',
  PageUp: 'pageUp',
  PageDown: 'pageDown',
}

export function keyToAction(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>): MenuAction | null {
  // Ctrl+C 같은 단축키는 건드리지 않는다.
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  return KEY_ACTIONS[event.key] ?? null
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

/**
 * 페이지 전체의 키 입력을 메뉴 동작으로 바꿔 전달한다.
 * 입력창에 글을 쓰는 중에는 무시한다.
 */
export function useKeyboardInput(dispatch: (action: MenuAction) => boolean, enabled: MaybeRefOrGetter<boolean> = true) {
  function onKeyDown(event: KeyboardEvent) {
    if (!toValue(enabled) || isTypingTarget(event.target)) return
    const action = keyToAction(event)
    if (action && dispatch(action)) event.preventDefault()
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
