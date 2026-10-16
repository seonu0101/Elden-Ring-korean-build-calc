import { onBeforeUnmount, onMounted, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { MenuAction } from './useGameMenu'

/** 표준 게임패드 배치(Xbox 기준) 버튼 번호 → 메뉴 동작 */
export const GAMEPAD_BUTTON_ACTIONS: readonly (readonly [number, MenuAction])[] = [
  [0, 'confirm'], // A
  [1, 'back'], // B
  [4, 'prevSlot'], // L1 / LB
  [5, 'nextSlot'], // R1 / RB
  [6, 'pageUp'], // L2 / LT
  [7, 'pageDown'], // R2 / RT
  [9, 'toggleMenu'], // Start
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
]

const REPEATABLE: ReadonlySet<MenuAction> = new Set(['up', 'down', 'left', 'right'])

export interface RepeatTiming {
  /** 누르고 있을 때 반복 입력이 시작되기까지 걸리는 시간(ms) */
  delay: number
  /** 반복 입력 간격(ms) */
  interval: number
}

/** 게임패드 상태에서 지금 눌린 동작들을 뽑는다. 이동은 십자키로만 한다 (스틱은 쓰지 않는다). */
export function readGamepadActions(pad: Pick<Gamepad, 'buttons'>): Set<MenuAction> {
  const active = new Set<MenuAction>()
  for (const [button, action] of GAMEPAD_BUTTON_ACTIONS) {
    if (pad.buttons[button]?.pressed) active.add(action)
  }
  return active
}

/**
 * 매 프레임 눌린 동작 목록을 받아서, 새로 눌린 순간과
 * 방향 입력을 누르고 있을 때의 반복 입력만 골라낸다.
 */
export class GamepadInputTracker {
  private held = new Map<MenuAction, { since: number; lastFired: number }>()

  constructor(private timing: RepeatTiming = { delay: 350, interval: 90 }) {}

  update(active: ReadonlySet<MenuAction>, now: number): MenuAction[] {
    const fired: MenuAction[] = []
    for (const action of active) {
      const state = this.held.get(action)
      if (!state) {
        this.held.set(action, { since: now, lastFired: now })
        fired.push(action)
      } else if (
        REPEATABLE.has(action) &&
        now - state.since >= this.timing.delay &&
        now - state.lastFired >= this.timing.interval
      ) {
        state.lastFired = now
        fired.push(action)
      }
    }
    for (const action of [...this.held.keys()]) {
      if (!active.has(action)) this.held.delete(action)
    }
    return fired
  }

  reset() {
    this.held.clear()
  }
}

/** 연결된 게임패드를 매 프레임 읽어서 메뉴 동작으로 전달한다. */
export function useGamepadInput(dispatch: (action: MenuAction) => boolean, enabled: MaybeRefOrGetter<boolean> = true) {
  const connectedName = ref<string | null>(null)
  const tracker = new GamepadInputTracker()
  let frame: number | null = null

  function poll(now: number) {
    frame = requestAnimationFrame(poll)
    const pads = navigator.getGamepads()
    const pad = pads.find((p): p is Gamepad => p !== null && p.connected)
    connectedName.value = pad?.id ?? null
    if (!pad || !toValue(enabled)) {
      tracker.reset()
      return
    }
    for (const action of tracker.update(readGamepadActions(pad), now)) dispatch(action)
  }

  onMounted(() => {
    if (typeof navigator.getGamepads !== 'function' || typeof requestAnimationFrame !== 'function') return
    frame = requestAnimationFrame(poll)
  })

  onBeforeUnmount(() => {
    if (frame !== null) cancelAnimationFrame(frame)
  })

  return { connectedName }
}
