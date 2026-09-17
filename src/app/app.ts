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
import { mountTuning } from '../screens/tuning'
import { DEFAULT_THRESHOLDS, type MatchThresholds } from '../writing/stroke-matcher'
import type { Screen } from './screen'
import { loadStrokeData, strokeDataIfLoaded, strokesFor } from '../data/stroke-data'
import { mountChooser } from '../screens/chooser'
import { mountCover } from '../screens/cover'
import { mountWriting } from '../screens/writing'
import { createWritingSession, type WritingSession } from '../writing/writing-session'

declare const __TUNING__: boolean

export function startApp(root: HTMLElement, choices: ChoicesStore): void {
  let current: Screen | null = null
  /*
   * The numbers the marking judges by. Fixed in the build the school hands out;
   * in the tuning build the panel moves them between attempts, which is the
   * only way anyone can tell whether they are the right numbers.
   */
  let thresholds: MatchThresholds = { ...DEFAULT_THRESHOLDS }
  const tuning = __TUNING__
    ? mountTuning(
        root,
        () => thresholds,
        (next) => {
          thresholds = next
        },
      )
    : null
  // Warmed here so the first writing screen has nothing to wait for.
  void loadStrokeData()

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
      thresholds: () => thresholds,
      // The chooser keeps はじめる out of reach until the data has landed, so a
      // run never begins on the empty stand-in below.
      strokesOf: (character) => {
        const data = strokeDataIfLoaded()
        return data ? strokesFor(data, character) : []
      },
    })
    swap(mountChooser(root, choices, session, () => toWriting(session), toCover))
  }

  const toWriting = (session: WritingSession): void =>
    swap(mountWriting(root, choices, session, toCover, (measurements) => tuning?.show(measurements)))

  toCover()
}
