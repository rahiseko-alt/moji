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

  const toCover = (): void => swap(mountCover(root, choices, toChooser))
  const toChooser = (): void => swap(mountChooser(root, choices, toWriting))
  // Home goes back to choosing, not to the cover: a learner who has finished one
  // character almost always wants the next one, not the language buttons again.
  const toWriting = (character: string): void =>
    swap(mountWriting(root, choices, character, toChooser))

  toCover()
}
