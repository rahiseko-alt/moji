/**
 * Which screen is on show. Exactly one at a time, torn down on the way out, so
 * nothing left behind keeps drawing or listening.
 */
import type { ChoicesStore } from './choices'
import type { Screen } from './screen'
import { mountChooser } from '../screens/chooser'
import { mountCover } from '../screens/cover'
import { mountWriting } from '../screens/writing'

export function startApp(root: HTMLElement, choices: ChoicesStore): void {
  let current: Screen | null = null

  const swap = (next: Screen): void => {
    current?.destroy()
    current = next
  }

  // Home means one thing everywhere: back to the cover. It costs a tap on the
  // way to the next character, and buys a learner who picked the wrong language
  // a way out of it from any screen, with no second kind of button to explain.
  const toCover = (): void => swap(mountCover(root, choices, toChooser))
  const toChooser = (): void => swap(mountChooser(root, choices, toWriting, toCover))
  const toWriting = (character: string): void =>
    swap(mountWriting(root, choices, character, toCover))

  toCover()
}
