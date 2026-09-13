/**
 * Which screen is on show. Exactly one at a time, torn down on the way out, so
 * nothing left behind keeps drawing or listening.
 */
import type { ChoicesStore } from './choices'
import type { Screen } from './screen'
import { mountCover } from '../screens/cover'
import { mountWriting } from '../screens/writing'

export function startApp(root: HTMLElement, choices: ChoicesStore): void {
  let current: Screen | null = null

  const swap = (next: Screen): void => {
    current?.destroy()
    current = next
  }

  const toCover = (): void => swap(mountCover(root, choices, toWriting))
  const toWriting = (): void => swap(mountWriting(root, choices, toCover))

  toCover()
}
