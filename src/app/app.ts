/**
 * Which screen is on show. Exactly one at a time, torn down on the way out, so
 * nothing left behind keeps drawing or listening.
 *
 * One まとめ書き spans two screens: the characters are chosen on one and written
 * on the next, so the session that holds the run is made here, where both can
 * be handed the same one. Leaving for the cover drops it, and a fresh one is
 * made on the way back in — nothing is remembered (ADR 0005).
 */
import type { ChoicesStore } from './choices'
import type { Screen } from './screen'
import { loadStrokeData, strokesFor, type StrokeData } from '../data/stroke-data'
import { mountChooser } from '../screens/chooser'
import { mountCover } from '../screens/cover'
import { mountWriting } from '../screens/writing'
import { createWritingSession } from '../writing/writing-session'

export function startApp(root: HTMLElement, choices: ChoicesStore): void {
  let current: Screen | null = null
  let data: StrokeData | null = null
  void loadStrokeData().then((loaded) => {
    data = loaded
  })

  const swap = (next: Screen): void => {
    current?.destroy()
    current = next
  }

  // Home means one thing everywhere: back to the cover. It costs a tap on the
  // way to the next character, and buys a learner who picked the wrong language
  // a way out of it from any screen, with no second kind of button to explain.
  const toCover = (): void => swap(mountCover(root, choices, toChooser))

  const toChooser = (): void => {
    const session = createWritingSession({
      mode: choices.get().mode ?? 'practice',
      strokesOf: (character) => (data ? strokesFor(data, character) : []),
    })
    swap(mountChooser(root, choices, session, () => toWriting(session), toCover))
  }

  const toWriting = (session: ReturnType<typeof createWritingSession>): void =>
    swap(mountWriting(root, choices, session, toCover))

  toCover()
}
