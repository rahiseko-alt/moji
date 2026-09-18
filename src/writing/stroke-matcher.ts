/**
 * Was that stroke the one we were waiting for?
 *
 * Five things have to hold at once, following the approach Hanzi Writer (MIT)
 * takes and adding one of our own: the stroke has to run the right way, start
 * and end near where the model does, follow roughly the same path in between,
 * be long enough to be a stroke at all, and keep the bend the model has rather
 * than being ruled straight. Any one of them failing tells the learner
 * something different, so the answer names which.
 *
 * The thresholds are deliberately loose: this is a finger on a phone, not a
 * pen on paper. They live together here so they can be tuned from one place
 * once the app has been used on real hardware.
 */
import type { Point } from '../data/stroke-data'
import { bend, bow, directionAgreement, frechetDistance, length, resample } from './polyline'

export type MistakeReason =
  /** Written from the wrong end. */
  | 'backwards'
  /** Started or finished well away from where the stroke belongs. */
  | 'misplaced'
  /** Went somewhere else on the way, or was ruled straight where it should bend. */
  | 'shape'
  /** Barely moved: a dab rather than a stroke. */
  | 'tooShort'

export type StrokeVerdict = { readonly correct: true } | { readonly correct: false; readonly reason: MistakeReason }

export type MatchThresholds = {
  /** Minimum cosine between the two directions. 0.6 allows about 53 degrees. */
  readonly direction: number
  /** How far an end may sit from the model's, as a fraction of that stroke's own length. */
  readonly ends: number
  /** A floor under the above, so the shortest strokes stay writable. */
  readonly endsFloor: number
  /** A ceiling over it, so the longest strokes are not given the run of the square. */
  readonly endsCeiling: number
  /** Allowed wander, as a fraction of the model stroke's own length. */
  readonly shape: number
  /** A floor under the above, so short strokes stay writable. */
  readonly shapeFloor: number
  /** Shortest acceptable stroke, as a fraction of the model stroke's length. */
  readonly length: number
  /** How much of the model stroke's bend the written one has to keep, 1 being all of it. */
  readonly curve: number
  /** Only a model stroke bending at least this much of its own length is judged on its bend. */
  readonly bend: number
}

/*
 * Five settings, from strict to forgiving, and the app runs on one of them.
 * Nine separate numbers turned out to be nobody's idea of a dial: what a person
 * can say is "this is too strict", so that is what there is to move.
 *
 * Measured against the strokes a real finger drew on a real phone, kept in
 * the recorder tool, and against ways of not writing the character at all. Level 3
 * is where honest handwriting starts passing; below it, a normally written い
 * or う is failed. The numbers are in the character's own 109-wide square.
 */
export const STRICTNESS_LEVELS: readonly MatchThresholds[] = [
  { direction: 0.7, ends: 0.35, endsFloor: 12, endsCeiling: 18, shape: 0.25, shapeFloor: 10, length: 0.7, curve: 0.5, bend: 0.05 },
  { direction: 0.65, ends: 0.4, endsFloor: 16, endsCeiling: 22, shape: 0.3, shapeFloor: 13, length: 0.6, curve: 0.4, bend: 0.06 },
  { direction: 0.6, ends: 0.5, endsFloor: 20, endsCeiling: 28, shape: 0.35, shapeFloor: 16, length: 0.5, curve: 0.3, bend: 0.07 },
  { direction: 0.55, ends: 0.6, endsFloor: 25, endsCeiling: 34, shape: 0.42, shapeFloor: 20, length: 0.4, curve: 0.2, bend: 0.08 },
  { direction: 0.45, ends: 0.75, endsFloor: 32, endsCeiling: 42, shape: 0.5, shapeFloor: 26, length: 0.3, curve: 0.1, bend: 0.1 },
]

/** Counting from one, as the tuning panel shows it. */
export const DEFAULT_STRICTNESS = 3

/** The numbers of one setting, counting from one as the panel shows it. */
export function thresholdsFor(strictness: number): MatchThresholds {
  return STRICTNESS_LEVELS[strictness - 1] ?? STRICTNESS_LEVELS[DEFAULT_STRICTNESS - 1]!
}

export const DEFAULT_THRESHOLDS: MatchThresholds = thresholdsFor(DEFAULT_STRICTNESS)

/** Enough to describe a stroke's shape without being fussy about wobble. */
const COMPARISON_POINTS = 16

/**
 * How much of the model's bend the written stroke kept: 1 all of it, 0 a ruled
 * line, above 1 a curve overdone. Wobble pulls this either way by a little and
 * cancels out over the length of the stroke, which a plain distance between the
 * two paths does not.
 */
function curveKept(written: readonly number[], model: readonly number[]): number {
  let together = 0
  let alone = 0
  for (const [at, value] of model.entries()) {
    together += (written[at] ?? 0) * value
    alone += value * value
  }
  return alone === 0 ? 1 : together / alone
}

/**
 * What one stroke measured against its model, alongside what each threshold
 * allowed it. The verdict is these five comparisons and nothing else, so this
 * is also what to show someone asking why a stroke was called wrong, or
 * choosing where to move a number.
 */
export type StrokeMeasurement = {
  /** What the stroke did: the same five quantities the verdict is made of. */
  readonly direction: number
  readonly ends: number
  readonly wander: number
  readonly length: number
  /** Null when the model stroke is too straight to have a bend worth keeping. */
  readonly curve: number | null
  /** What the thresholds allowed it, in the same units. */
  readonly allowed: {
    readonly direction: number
    readonly ends: number
    readonly wander: number
    readonly length: number
    readonly curve: number
  }
}

export function measureStroke(
  written: readonly Point[],
  model: readonly Point[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): StrokeMeasurement {
  const modelLength = length(model)
  const a = resample(written, COMPARISON_POINTS)
  const b = resample(model, COMPARISON_POINTS)
  const startGap = Math.hypot(a[0]![0] - b[0]![0], a[0]![1] - b[0]![1])
  const endGap = Math.hypot(
    a[a.length - 1]![0] - b[b.length - 1]![0],
    a[a.length - 1]![1] - b[b.length - 1]![1],
  )
  // A stroke the model draws straight has no bend to keep, and nothing is asked
  // of it on that count.
  const modelBow = bow(model, COMPARISON_POINTS)
  const bends = bend(modelBow) >= modelLength * thresholds.bend
  return {
    direction: directionAgreement(a, b),
    ends: Math.max(startGap, endGap),
    wander: frechetDistance(a, b),
    length: modelLength === 0 ? 1 : length(written) / modelLength,
    curve: bends ? curveKept(bow(written, COMPARISON_POINTS), modelBow) : null,
    allowed: {
      direction: thresholds.direction,
      ends: Math.max(
        thresholds.endsFloor,
        Math.min(thresholds.endsCeiling, modelLength * thresholds.ends),
      ),
      wander: Math.max(modelLength * thresholds.shape, thresholds.shapeFloor),
      length: thresholds.length,
      curve: thresholds.curve,
    },
  }
}

/** The verdict is nothing but these five comparisons, in this order. */
export function verdictOf(measured: StrokeMeasurement): StrokeVerdict {
  // In this order, so that the reason a learner is given is the plainest one
  // that applies: barely drawn beats backwards, backwards beats out of place.
  if (measured.length < measured.allowed.length) return { correct: false, reason: 'tooShort' }
  if (measured.direction < measured.allowed.direction) return { correct: false, reason: 'backwards' }
  if (measured.ends > measured.allowed.ends) return { correct: false, reason: 'misplaced' }
  if (measured.wander > measured.allowed.wander) return { correct: false, reason: 'shape' }
  // Two ends in the right places, the right way round, and no great detour in
  // between still leaves how the stroke bends unaccounted for. い is two lines
  // that run the same way, and only the hook of the first tells them apart, so
  // a ruler passes everything above.
  if (measured.curve !== null && measured.curve < measured.allowed.curve) {
    return { correct: false, reason: 'shape' }
  }

  return { correct: true }
}

export function matchStroke(
  written: readonly Point[],
  model: readonly Point[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): StrokeVerdict {
  return verdictOf(measureStroke(written, model, thresholds))
}
