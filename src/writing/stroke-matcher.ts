/**
 * Was that stroke the one we were waiting for?
 *
 * Four things have to hold at once, following the approach Hanzi Writer (MIT)
 * takes: the stroke has to run the right way, start and end near where the
 * model does, follow roughly the same path in between, and be long enough to
 * be a stroke at all. Any one of them failing tells the learner something
 * different, so the answer names which.
 *
 * The thresholds are deliberately loose: this is a finger on a phone, not a
 * pen on paper. They live together here so they can be tuned from one place
 * once the app has been used on real hardware.
 */
import type { Point } from '../data/stroke-data'
import { directionAgreement, frechetDistance, length, resample } from './polyline'

export type MistakeReason =
  /** Written from the wrong end. */
  | 'backwards'
  /** Started or finished well away from where the stroke belongs. */
  | 'misplaced'
  /** Went somewhere else on the way. */
  | 'shape'
  /** Barely moved: a dab rather than a stroke. */
  | 'tooShort'

export type StrokeVerdict = { readonly correct: true } | { readonly correct: false; readonly reason: MistakeReason }

export type MatchThresholds = {
  /** Minimum cosine between the two directions. 0.8 allows about 37 degrees. */
  readonly direction: number
  /** How far the start and the end may sit from the model's, in a 109-wide square. */
  readonly ends: number
  /** Allowed wander, as a fraction of the model stroke's own length. */
  readonly shape: number
  /** A floor under the above, so short strokes stay writable. */
  readonly shapeFloor: number
  /** Shortest acceptable stroke, as a fraction of the model stroke's length. */
  readonly length: number
}

/*
 * Chosen by measuring how real ways of writing actually score, not by feel.
 * Steady-hand jitter, a shaky finger and a stroke a little off centre all land
 * well inside these; a stroke that is visibly misplaced, noticeably slanted,
 * stopped short, or drawn straight where the model curves, all land outside.
 * The numbers are in the character's own 109-wide square.
 */
export const DEFAULT_THRESHOLDS: MatchThresholds = {
  direction: 0.8,
  ends: 12,
  shape: 0.2,
  shapeFloor: 8,
  length: 0.85,
}

/** Enough to describe a stroke's shape without being fussy about wobble. */
const COMPARISON_POINTS = 16

export function matchStroke(
  written: readonly Point[],
  model: readonly Point[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): StrokeVerdict {
  const modelLength = length(model)
  if (length(written) < modelLength * thresholds.length) {
    return { correct: false, reason: 'tooShort' }
  }

  const a = resample(written, COMPARISON_POINTS)
  const b = resample(model, COMPARISON_POINTS)

  if (directionAgreement(a, b) < thresholds.direction) {
    return { correct: false, reason: 'backwards' }
  }

  const startGap = Math.hypot(a[0]![0] - b[0]![0], a[0]![1] - b[0]![1])
  const endGap = Math.hypot(
    a[a.length - 1]![0] - b[b.length - 1]![0],
    a[a.length - 1]![1] - b[b.length - 1]![1],
  )
  if (Math.max(startGap, endGap) > thresholds.ends) {
    return { correct: false, reason: 'misplaced' }
  }

  const allowedWander = Math.max(modelLength * thresholds.shape, thresholds.shapeFloor)
  if (frechetDistance(a, b) > allowedWander) {
    return { correct: false, reason: 'shape' }
  }

  return { correct: true }
}
