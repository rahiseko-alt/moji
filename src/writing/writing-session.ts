/**
 * Writing one character, stroke by stroke.
 *
 * This is where the app decides what happens next: whether the stroke just
 * written was the one being waited for, whether the learner has to write it
 * again, when to offer a hint, and when the character is done. Nothing here
 * draws anything, and nothing here knows about fingers or canvases — which is
 * what makes it the one place worth testing thoroughly.
 *
 * In practice, a wrong stroke is refused and the same stroke is waited for
 * again, so a learner never builds the muscle memory of a wrong shape. In a
 * test, every stroke is taken as written and judged at the end, with no model
 * and no hint.
 */
import type { Stroke } from '../data/stroke-data'
import { DEFAULT_THRESHOLDS, matchStroke, type MistakeReason, type StrokeVerdict } from './stroke-matcher'
import { asPoint, type TracedPoint } from './traced-point'

export type SessionMode = 'practice' | 'test'

/** How long a learner may hesitate before the hint appears. */
export const DEFAULT_NAVIGATION_DELAY_MS = 1500

export type StrokeOutcome = {
  /** Has this stroke been written acceptably yet? */
  readonly done: boolean
  /** Right the first time it was attempted — what the score counts. */
  readonly firstTimeCorrect: boolean
  readonly attempts: number
  /** Why the most recent wrong attempt was wrong. Kept for the whole session. */
  readonly lastMistake: MistakeReason | null
}

export type WritingSessionState = {
  /** Index of the stroke being waited for; equal to the stroke count once finished. */
  readonly awaitingStroke: number
  readonly outcomes: readonly StrokeOutcome[]
  /** The verdict on the stroke most recently written, if any. */
  readonly lastVerdict: StrokeVerdict | null
  /**
   * Whether to show the learner where the awaited stroke begins and which way
   * it runs. Never for the first stroke: that one they attempt on their own.
   */
  readonly showNavigation: boolean
  readonly phase: 'writing' | 'finished'
  /** Strokes written correctly at the first attempt, out of the character's total. */
  readonly score: { readonly correct: number; readonly total: number }
}

export type WritingSession = {
  state(): WritingSessionState
  /** Judges one finished stroke and moves the session on. */
  writeStroke(points: readonly TracedPoint[]): WritingSessionState
  /**
   * Moves the clock on. The time must come from the same clock as the traced
   * points, so that hesitation is measured from when the last stroke ended.
   */
  tick(now: number): WritingSessionState
}

export type WritingSessionOptions = {
  readonly strokes: readonly Stroke[]
  readonly mode: SessionMode
  readonly navigationDelayMs?: number
}

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { strokes, mode } = options
  const navigationDelayMs = options.navigationDelayMs ?? DEFAULT_NAVIGATION_DELAY_MS

  const outcomes: StrokeOutcome[] = strokes.map(() => ({
    done: false,
    firstTimeCorrect: false,
    attempts: 0,
    lastMistake: null,
  }))
  let awaiting = 0
  let lastVerdict: StrokeVerdict | null = null
  let waitingSince: number | null = null
  let navigating = false

  const state = (): WritingSessionState => ({
    awaitingStroke: awaiting,
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    lastVerdict,
    showNavigation: navigating,
    phase: awaiting >= strokes.length ? 'finished' : 'writing',
    score: {
      correct: outcomes.filter((outcome) => outcome.firstTimeCorrect).length,
      total: strokes.length,
    },
  })

  return {
    state,
    writeStroke(points) {
      const model = strokes[awaiting]
      if (!model) return state()

      const verdict = matchStroke(points.map(asPoint), model.median, DEFAULT_THRESHOLDS)
      lastVerdict = verdict

      const before = outcomes[awaiting]!
      const attempts = before.attempts + 1
      outcomes[awaiting] = {
        done: verdict.correct,
        firstTimeCorrect: verdict.correct && attempts === 1,
        attempts,
        lastMistake: verdict.correct ? before.lastMistake : verdict.reason,
      }

      // Practice refuses a wrong stroke and waits for the same one again;
      // a test takes what it is given and moves on regardless.
      if (verdict.correct || mode === 'test') awaiting += 1

      // Hesitation is measured from the end of whatever was just written,
      // right or wrong, so the hint arrives when the learner is actually stuck.
      navigating = false
      waitingSince = points[points.length - 1]?.t ?? null
      return state()
    },
    tick(now) {
      const canNavigate =
        mode === 'practice' && awaiting > 0 && awaiting < strokes.length && waitingSince !== null
      navigating = canNavigate && now - waitingSince! >= navigationDelayMs
      return state()
    },
  }
}
