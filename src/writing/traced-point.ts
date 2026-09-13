/**
 * A point the learner's finger passed through, with the moment it did.
 *
 * The time matters as much as the place: the session uses when a stroke ended
 * to decide whether the learner has stalled and needs the navigation hint.
 */
import type { Point } from '../data/stroke-data'

export type TracedPoint = { readonly x: number; readonly y: number; readonly t: number }

export const asPoint = ({ x, y }: TracedPoint): Point => [x, y]
