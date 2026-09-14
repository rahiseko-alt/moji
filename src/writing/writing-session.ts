/**
 * まとめ書き: choosing characters, then writing them one after another.
 *
 * This is where the app decides what happens next: which characters are in the
 * run and in what order, which one is in hand, whether the stroke just written
 * was the one being waited for, whether the learner has to write it again, when
 * to offer a hint, and when the run is over. Nothing here draws anything, and
 * nothing here knows about fingers or canvases — which is what makes it the one
 * place worth testing thoroughly (ADR 0004).
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
  /** Choosing characters, writing them, or done with the lot. */
  readonly phase: 'choosing' | 'writing' | 'finished'
  /** The characters of the run, in the order they were chosen. */
  readonly chosen: readonly string[]
  /** Which character of the run is in hand, counting from one. Zero when not writing. */
  readonly position: number
  /** The character in hand, or null before the run starts and after it ends. */
  readonly character: string | null
  /** Every stroke of the character in hand is written; the run waits to be moved on. */
  readonly characterFinished: boolean
  /** Index of the stroke being waited for; equal to the stroke count once the character is done. */
  readonly awaitingStroke: number
  /** How each stroke of the character in hand has gone. */
  readonly outcomes: readonly StrokeOutcome[]
  /** The verdict on the stroke most recently written, if any. */
  readonly lastVerdict: StrokeVerdict | null
  /**
   * Which stroke the hint should point at, or null for no hint. From halfway
   * through the stroke in hand it points at the one after it. Nothing is shown
   * for the very first stroke until the learner has got it wrong once.
   */
  readonly navigationStroke: number | null
  /** Strokes of the character in hand written correctly at the first attempt. */
  readonly score: { readonly correct: number; readonly total: number }
}

export type WritingSession = {
  state(): WritingSessionState
  /** Adds a character to the run, or takes it out again if it is already in. */
  chooseCharacter(character: string): WritingSessionState
  /** Begins writing the chosen characters. Does nothing if none were chosen. */
  start(): WritingSessionState
  /**
   * The stroke being drawn right now, as far as it has got. Once it is about
   * half as long as the one it is tracing, the hint moves on to the next stroke.
   */
  traceStroke(points: readonly TracedPoint[]): WritingSessionState
  /** Judges one finished stroke and moves the session on. */
  writeStroke(points: readonly TracedPoint[]): WritingSessionState
  /** Leaves the character in hand for the next one, once it has been written. */
  nextCharacter(): WritingSessionState
}

export type WritingSessionOptions = {
  readonly mode: SessionMode
  /** The model strokes of any character that might be chosen. */
  readonly strokesOf: (character: string) => readonly Stroke[]
}

const freshOutcomes = (count: number): StrokeOutcome[] =>
  Array.from({ length: count }, () => ({
    done: false,
    firstTimeCorrect: false,
    attempts: 0,
    lastMistake: null,
  }))

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { mode, strokesOf } = options

  const chosen: string[] = []
  let phase: WritingSessionState['phase'] = 'choosing'
  /** Index into the chosen characters of the one in hand. */
  let at = 0
  let strokes: readonly Stroke[] = []
  let outcomes: StrokeOutcome[] = []
  let awaiting = 0
  let lastVerdict: StrokeVerdict | null = null
  /** Is the stroke in hand far enough along for the hint to move on? */
  let pastHalfway = false

  const characterFinished = (): boolean => phase === 'writing' && awaiting >= strokes.length

  /**
   * One ahead of the stroke in hand: from the middle of stroke N the hint shows
   * N+1, and the moment N is accepted it is already there. Nothing is shown
   * during a test, nor once the character is written, nor when there is no next
   * stroke to point at.
   */
  const navigationStroke = (): number | null => {
    if (mode === 'test' || phase !== 'writing' || characterFinished()) return null
    const target = awaiting + (pastHalfway ? 1 : 0)
    if (target >= strokes.length) return null
    // The very first stroke is the learner's own to attempt. Only once they
    // have got it wrong does the hint step in and show it.
    if (target === 0 && outcomes[0]!.attempts === 0) return null
    return target
  }

  const takeUpCharacter = (): void => {
    strokes = strokesOf(chosen[at]!)
    outcomes = freshOutcomes(strokes.length)
    awaiting = 0
    lastVerdict = null
    pastHalfway = false
  }

  const state = (): WritingSessionState => ({
    phase,
    chosen: [...chosen],
    position: phase === 'writing' ? at + 1 : 0,
    character: phase === 'writing' ? chosen[at]! : null,
    characterFinished: characterFinished(),
    awaitingStroke: awaiting,
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    lastVerdict,
    navigationStroke: navigationStroke(),
    score: {
      correct: outcomes.filter((outcome) => outcome.firstTimeCorrect).length,
      total: strokes.length,
    },
  })

  return {
    state,
    chooseCharacter(character) {
      // Once the writing has begun the run is settled: a stray tap must not
      // lengthen or shorten what the learner is part way through.
      if (phase !== 'choosing') return state()
      const already = chosen.indexOf(character)
      if (already === -1) chosen.push(character)
      else chosen.splice(already, 1)
      return state()
    },
    start() {
      if (phase !== 'choosing' || chosen.length === 0) return state()
      phase = 'writing'
      at = 0
      takeUpCharacter()
      return state()
    },
    traceStroke(points) {
      if (phase !== 'writing') return state()
      const model = strokes[awaiting]
      // A fresh stroke starts short, so this falls back to false on its own the
      // moment the learner lifts and begins the next one.
      pastHalfway = model !== undefined
        && length(points.map(asPoint)) >= length(model.median) * HINT_MOVES_ON_AT
      return state()
    },
    writeStroke(points) {
      if (phase !== 'writing') return state()
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
    nextCharacter() {
      // Moving on is the learner's to ask for: a character that vanished the
      // instant its last stroke landed would leave nothing to look at.
      if (!characterFinished()) return state()
      if (at + 1 < chosen.length) {
        at += 1
        takeUpCharacter()
      } else {
        phase = 'finished'
      }
      return state()
    },
  }
}
