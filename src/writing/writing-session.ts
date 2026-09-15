/**
 * まとめ書き: choosing お題, writing them, and marking each one when it is sent.
 *
 * This is where the app decides what happens next: which お題 are in the run and
 * in what order, which one is in hand, what has been written on it, what the
 * marking said, and when the run is over. Nothing here draws anything, and
 * nothing here knows about fingers or canvases — which is what makes it the one
 * place worth testing thoroughly (ADR 0004).
 *
 * Nothing is judged until it is sent (ADR 0009). A learner writes the whole お題
 * with no interruption; 送信 marks every stroke at once, and the screen shows the
 * wrong ones in red and walks the hint through the characters that went wrong.
 *
 * The hint also runs ahead while writing: once a learner is about halfway
 * through the stroke in hand, it shows where the next one begins.
 */
import type { Stroke } from '../data/stroke-data'
import { length } from './polyline'
import { DEFAULT_THRESHOLDS, matchStroke, type MistakeReason } from './stroke-matcher'
import { asPoint, type TracedPoint } from './traced-point'

/** How much of the stroke in hand has to be drawn before the hint moves on. */
const HINT_MOVES_ON_AT = 0.5

export type SessionMode = 'practice' | 'test'

/** What was wrong with one stroke: how it was drawn, or that it is not a stroke of this character. */
export type StrokeProblem =
  | MistakeReason
  /** The model has this stroke but the learner never wrote it. */
  | 'missing'
  /** The learner wrote this stroke but the model has no such stroke. */
  | 'extra'

export type StrokeOutcome = {
  readonly correct: boolean
  readonly problem: StrokeProblem | null
}

/** What the learner put on the paper for one お題, and what the marking said. */
export type Attempt = {
  readonly character: string
  readonly written: readonly (readonly TracedPoint[])[]
  readonly outcomes: readonly StrokeOutcome[]
}

/** How one お題 went, settled the first time it was sent. */
export type CharacterResult = {
  readonly character: string
  /** Every stroke was right at the first 送信. */
  readonly firstTimeCorrect: boolean
}

export type WritingSessionState = {
  /** Choosing お題, writing them, or done with the lot. */
  readonly phase: 'choosing' | 'writing' | 'finished'
  /** The お題 of the run, in the order they were chosen. */
  readonly chosen: readonly string[]
  /** Which お題 of the run is in hand, counting from one. Zero when not writing. */
  readonly position: number
  /** The お題 in hand, or null while still choosing. It stays in hand at the end. */
  readonly character: string | null
  /** お題 still to come after the one in hand. */
  readonly remaining: number
  /** How many strokes are on the paper for the お題 in hand. */
  readonly writtenStrokes: number
  /** Is there something to send, and has it not been sent yet? */
  readonly canSubmit: boolean
  /** Has the お題 in hand been sent and marked? */
  readonly marked: boolean
  /**
   * One per stroke, once the お題 has been marked: the strokes the learner wrote,
   * then any the model has and they never wrote. Empty before 送信, and while a
   * test keeps its marking back.
   */
  readonly outcomes: readonly StrokeOutcome[]
  /**
   * Which stroke the hint should point at while writing, or null. From halfway
   * through the stroke in hand it points at the one after it. The first stroke
   * is never pointed at: that one the learner attempts on their own.
   */
  readonly navigationStroke: number | null
  /**
   * Which characters of the お題 the hint should walk through after marking,
   * because something in them was wrong. Empty when nothing was.
   */
  readonly navigationCharacters: readonly number[]
  /** Strokes of the お題 in hand written correctly at the first 送信, or null while held back. */
  readonly score: { readonly correct: number; readonly total: number } | null
  /** お題 written correctly at the first 送信, out of them all. */
  readonly runScore: { readonly correct: number; readonly total: number }
  /**
   * How the お題 written so far went, in order. A test holds them all back until
   * the run is finished.
   */
  readonly results: readonly CharacterResult[]
}

export type WritingSession = {
  state(): WritingSessionState
  /** Adds an お題 to the run, or takes it out again if it is already in. */
  chooseCharacter(character: string): WritingSessionState
  /**
   * Adds a whole kind of character at once — or, when every one of them is
   * already in the run, takes that kind back out.
   */
  chooseAll(characters: readonly string[]): WritingSessionState
  /** Begins writing the chosen お題. Does nothing if none were chosen. */
  start(): WritingSessionState
  /**
   * The stroke being drawn right now, as far as it has got. Once it is about
   * half as long as the one it is tracing, the hint moves on to the next stroke.
   */
  traceStroke(points: readonly TracedPoint[]): WritingSessionState
  /** Takes one finished stroke onto the paper. Nothing is judged here. */
  addStroke(points: readonly TracedPoint[]): WritingSessionState
  /** Marks everything written for the お題 in hand. */
  submit(): WritingSessionState
  /** Leaves the marked お題 for the next one. */
  nextCharacter(): WritingSessionState
  /** Wipes the お題 in hand so it can be written again. Its result stands. */
  retryCharacter(): WritingSessionState
  /** The strokes the learner has written for the お題 in hand. */
  writing(): readonly (readonly TracedPoint[])[]
  /**
   * What was written and marked for one お題 of the run, counting from one, so
   * a learner can look back at it. Null while a test holds its marking back.
   */
  attempt(position: number): Attempt | null
}

export type WritingSessionOptions = {
  readonly mode: SessionMode
  /** The model strokes of any character that might be chosen. */
  readonly strokesOf: (character: string) => readonly Stroke[]
}

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { mode, strokesOf } = options

  const chosen: string[] = []
  let phase: WritingSessionState['phase'] = 'choosing'
  /** Index into the chosen お題 of the one in hand. */
  let at = 0
  let strokes: readonly Stroke[] = []
  /** What the learner has put on the paper for the お題 in hand. */
  let written: (readonly TracedPoint[])[] = []
  /** The marking of those strokes, once 送信 has happened. */
  let outcomes: StrokeOutcome[] = []
  let marked = false
  /** One per お題 already sent, settled at its first 送信. */
  const results: CharacterResult[] = []
  /**
   * The last thing written for each お題, kept for the whole run so the learner
   * can look back at it. In memory only: nothing is stored (ADR 0005).
   */
  const attempts: Attempt[] = []
  /** Is the stroke in hand far enough along for the hint to move on? */
  let pastHalfway = false

  /** A test tells the learner nothing about how it went until the run is over. */
  const heldBack = (): boolean => mode === 'test' && phase !== 'finished'

  const takeUpCharacter = (): void => {
    strokes = strokesOf(chosen[at]!)
    written = []
    outcomes = []
    marked = false
    pastHalfway = false
  }

  /**
   * One ahead of the stroke in hand: from the middle of stroke N the hint shows
   * N+1. Nothing is shown during a test, nor once the お題 has been sent, nor
   * when there is no next stroke to point at. The first stroke is the learner's
   * own to attempt.
   */
  const navigationStroke = (): number | null => {
    if (mode === 'test' || phase === 'choosing' || marked) return null
    const target = written.length + (pastHalfway ? 1 : 0)
    if (target === 0 || target >= strokes.length) return null
    return target
  }

  /**
   * After marking, the hint walks the whole of any character that went wrong.
   * Today an お題 is one character, so this is either empty or holds a single
   * position; it is a list so that a word's cells can each answer for themselves.
   */
  const navigationCharacters = (): readonly number[] => {
    if (!marked || heldBack()) return []
    return outcomes.some((outcome) => !outcome.correct) ? [0] : []
  }

  const state = (): WritingSessionState => ({
    phase,
    chosen: [...chosen],
    position: phase === 'choosing' ? 0 : at + 1,
    character: phase === 'choosing' ? null : chosen[at]!,
    remaining: phase === 'choosing' ? chosen.length : chosen.length - (at + 1),
    writtenStrokes: written.length,
    canSubmit: phase !== 'choosing' && !marked && written.length > 0,
    marked,
    outcomes: heldBack() ? [] : outcomes.map((outcome) => ({ ...outcome })),
    navigationStroke: navigationStroke(),
    navigationCharacters: navigationCharacters(),
    score:
      heldBack() || !marked
        ? null
        : {
            correct: outcomes.filter((outcome) => outcome.correct).length,
            total: Math.max(strokes.length, outcomes.length),
          },
    runScore: {
      correct: heldBack() ? 0 : results.filter((result) => result.firstTimeCorrect).length,
      total: chosen.length,
    },
    results: heldBack() ? [] : results.map((result) => ({ ...result })),
  })

  return {
    state,
    writing: () => written.map((stroke) => [...stroke]),
    attempt(position) {
      const kept = attempts[position - 1]
      if (!kept || heldBack()) return null
      return kept
    },
    chooseCharacter(character) {
      // Once the writing has begun the run is settled: a stray tap must not
      // lengthen or shorten what the learner is part way through.
      if (phase !== 'choosing') return state()
      const already = chosen.indexOf(character)
      if (already === -1) chosen.push(character)
      else chosen.splice(already, 1)
      return state()
    },
    chooseAll(characters) {
      if (phase !== 'choosing') return state()
      const missing = characters.filter((character) => !chosen.includes(character))
      if (missing.length > 0) chosen.push(...missing)
      else {
        for (const character of characters) {
          const place = chosen.indexOf(character)
          if (place !== -1) chosen.splice(place, 1)
        }
      }
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
      if (phase === 'choosing' || marked) return state()
      const model = strokes[written.length]
      // A fresh stroke starts short, so this falls back to false on its own the
      // moment the learner lifts and begins the next one.
      pastHalfway =
        model !== undefined &&
        length(points.map(asPoint)) >= length(model.median) * HINT_MOVES_ON_AT
      return state()
    },
    addStroke(points) {
      // Judging happens at 送信 and nowhere else, so this only takes the ink.
      if (phase === 'choosing' || marked || points.length === 0) return state()
      written = [...written, [...points]]
      pastHalfway = false
      return state()
    },
    submit() {
      if (phase === 'choosing' || marked || written.length === 0) return state()

      // Written strokes answer for the model's strokes in the order they were
      // written: writing them out of order is exactly the mistake this app is
      // about. Anything beyond the model's count is a stroke too many, and a
      // model stroke never written is a stroke missing; both count as wrong.
      outcomes = Array.from({ length: Math.max(written.length, strokes.length) }, (_, index) => {
        const model = strokes[index]
        const stroke = written[index]
        if (!model) return { correct: false, problem: 'extra' as const }
        if (!stroke) return { correct: false, problem: 'missing' as const }
        const verdict = matchStroke(stroke.map(asPoint), model.median, DEFAULT_THRESHOLDS)
        return verdict.correct
          ? { correct: true, problem: null }
          : { correct: false, problem: verdict.reason }
      })
      marked = true
      pastHalfway = false
      // Written again, an お題 keeps only its latest attempt: the tally was
      // settled at the first 送信 and does not change.
      attempts[at] = {
        character: chosen[at]!,
        written: written.map((stroke) => [...stroke]),
        outcomes: outcomes.map((outcome) => ({ ...outcome })),
      }

      // How an お題 went is settled the first time it is sent: writing it again
      // afterwards is practice, not a second chance at the tally (一発正解).
      if (results.length === at) {
        results.push({
          character: chosen[at]!,
          firstTimeCorrect: outcomes.every((outcome) => outcome.correct),
        })
      }
      // The run ends with its last お題: there is nothing else to wait for.
      if (at + 1 === chosen.length) phase = 'finished'
      return state()
    },
    nextCharacter() {
      // Moving on is the learner's to ask for: an お題 that vanished the instant
      // it was marked would leave nothing to look at.
      if (phase !== 'writing' || !marked || at + 1 >= chosen.length) return state()
      at += 1
      takeUpCharacter()
      return state()
    },
    retryCharacter() {
      if (!marked) return state()
      // A finished run reopens on its last お題. The tally was settled when it
      // was first sent, so nothing about it changes here.
      phase = 'writing'
      takeUpCharacter()
      return state()
    },
  }
}
