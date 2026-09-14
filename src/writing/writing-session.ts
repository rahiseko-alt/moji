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
 *
 * The hint runs one stroke ahead: once a learner is about halfway through the
 * stroke in hand, it already shows where the next one begins. Waiting until the
 * current stroke is finished arrives too late to be of any use.
 */
import type { Stroke } from '../data/stroke-data'
import { length } from './polyline'
import { DEFAULT_THRESHOLDS, matchStroke, type MistakeReason, type StrokeVerdict } from './stroke-matcher'
import { asPoint, type TracedPoint } from './traced-point'

/** How much of the stroke in hand has to be drawn before the hint moves on. */
const HINT_MOVES_ON_AT = 0.5

export type SessionMode = 'practice' | 'test'

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
   * Which stroke the hint should point at, or null for no hint. From halfway
   * through the stroke in hand it points at the one after it. Nothing is shown
   * for the very first stroke until the learner has got it wrong once.
   */
  readonly navigationStroke: number | null
  readonly phase: 'writing' | 'finished'
  /** Strokes written correctly at the first attempt, out of the character's total. */
  readonly score: { readonly correct: number; readonly total: number }
}

export type WritingSession = {
  state(): WritingSessionState
  /**
   * The stroke being drawn right now, as far as it has got. Once it is about
   * half as long as the one it is tracing, the hint moves on to the next stroke.
   */
  traceStroke(points: readonly TracedPoint[]): WritingSessionState
  /** Judges one finished stroke and moves the session on. */
  writeStroke(points: readonly TracedPoint[]): WritingSessionState
}

export type WritingSessionOptions = {
  readonly strokes: readonly Stroke[]
  readonly mode: SessionMode
}

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { strokes, mode } = options

  const outcomes: StrokeOutcome[] = strokes.map(() => ({
    done: false,
    firstTimeCorrect: false,
    attempts: 0,
    lastMistake: null,
  }))
  let awaiting = 0
  let lastVerdict: StrokeVerdict | null = null
  /** Is the stroke in hand far enough along for the hint to move on? */
  let pastHalfway = false

  /**
   * One ahead of the stroke in hand: from the middle of stroke N the hint shows
   * N+1, and the moment N is accepted it is already there. Nothing is shown
   * before the learner has started, nor during a test, nor once there is no
   * next stroke to point at.
   */
  const navigationStroke = (): number | null => {
    if (mode === 'test' || awaiting >= strokes.length) return null
    const target = awaiting + (pastHalfway ? 1 : 0)
    if (target >= strokes.length) return null
    // The very first stroke is the learner's own to attempt. Only once they
    // have got it wrong does the hint step in and show it.
    if (target === 0 && outcomes[0]!.attempts === 0) return null
    return target
  }

  const state = (): WritingSessionState => ({
    awaitingStroke: awaiting,
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    lastVerdict,
    navigationStroke: navigationStroke(),
    phase: awaiting >= strokes.length ? 'finished' : 'writing',
    score: {
      correct: outcomes.filter((outcome) => outcome.firstTimeCorrect).length,
      total: strokes.length,
    },
  })

  return {
    state,
    traceStroke(points) {
      const model = strokes[awaiting]
      // A fresh stroke starts short, so this falls back to false on its own the
      // moment the learner lifts and begins the next one.
      pastHalfway = model !== undefined
        && length(points.map(asPoint)) >= length(model.median) * HINT_MOVES_ON_AT
      return state()
    },
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

      pastHalfway = false
      return state()
    },
  }
}
