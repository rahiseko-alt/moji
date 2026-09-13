/**
 * Writing one character, stroke by stroke.
 *
 * This is where the app decides what happens next: whether the stroke just
 * written was the one being waited for, whether the learner has to write it
 * again, and when the character is done. Nothing here draws anything, and
 * nothing here knows about fingers or canvases — which is what makes it the
 * one place worth testing thoroughly.
 *
 * In practice, a wrong stroke is refused and the same stroke is waited for
 * again, so a learner never builds the muscle memory of a wrong shape. In a
 * test, every stroke is taken as written and judged at the end.
 */
import type { Point, Stroke } from '../data/stroke-data'
import { DEFAULT_THRESHOLDS, matchStroke, type MatchThresholds, type StrokeVerdict } from './stroke-matcher'

export type SessionMode = 'practice' | 'test'

export type StrokeOutcome = {
  /** Has this stroke been written acceptably yet? */
  readonly done: boolean
  /** Right the first time it was attempted — what the score counts. */
  readonly firstTimeCorrect: boolean
  readonly attempts: number
}

export type WritingSessionState = {
  /** Index of the stroke being waited for; equal to the stroke count once finished. */
  readonly awaitingStroke: number
  readonly outcomes: readonly StrokeOutcome[]
  /** The verdict on the stroke most recently written, if any. */
  readonly lastVerdict: StrokeVerdict | null
  readonly phase: 'writing' | 'finished'
  /** Strokes written correctly at the first attempt, out of the character's total. */
  readonly score: { readonly correct: number; readonly total: number }
}

export type WritingSession = {
  state(): WritingSessionState
  /** Judges one finished stroke and moves the session on. */
  writeStroke(points: readonly Point[]): WritingSessionState
}

export type WritingSessionOptions = {
  readonly strokes: readonly Stroke[]
  readonly mode: SessionMode
  readonly thresholds?: MatchThresholds
}

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { strokes, mode } = options
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS

  const outcomes: StrokeOutcome[] = strokes.map(() => ({
    done: false,
    firstTimeCorrect: false,
    attempts: 0,
  }))
  let awaiting = 0
  let lastVerdict: StrokeVerdict | null = null

  const state = (): WritingSessionState => ({
    awaitingStroke: awaiting,
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    lastVerdict,
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

      const verdict = matchStroke(points, model.median, thresholds)
      lastVerdict = verdict

      const before = outcomes[awaiting]!
      const attempts = before.attempts + 1
      outcomes[awaiting] = {
        done: verdict.correct,
        firstTimeCorrect: verdict.correct && attempts === 1,
        attempts,
      }

      // Practice refuses a wrong stroke and waits for the same one again;
      // a test takes what it is given and moves on regardless.
      if (verdict.correct || mode === 'test') awaiting += 1

      return state()
    },
  }
}
