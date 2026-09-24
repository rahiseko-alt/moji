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
 * A stroke is marked where the 升目 puts it. The dotted guide and the model are
 * always there to say where the character belongs, so writing it somewhere else
 * in the square is a mistake like any other (ADR 0013).
 *
 * An お題 is one character or a whole 単語 (ADR 0016). A 単語 gets one 升目 per
 * character, side by side, and every stroke belongs to the 升目 it was drawn in
 * — which is the same rule as ADR 0013, applied to a row of them. Nothing about
 * the marking changes: each 升目 is judged against its own character, and the
 * お題 is 一発正解 only when all of them were.
 *
 * The hint also runs ahead while writing: once a learner is about halfway
 * through the stroke in hand, it shows where the next one begins.
 */
import type { Stroke } from '../data/stroke-data'
import { length } from './polyline'
import {
  DEFAULT_THRESHOLDS,
  measureStroke,
  verdictOf,
  type MatchThresholds,
  type MistakeReason,
  type StrokeMeasurement,
} from './stroke-matcher'
import { asPoint, type TracedPoint } from './traced-point'

/** How much of the stroke in hand has to be drawn before the hint moves on. */
const HINT_MOVES_ON_AT = 0.5

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

/** What was written in one 升目 of an お題, and what the marking said about it. */
export type AttemptCell = {
  readonly character: string
  readonly written: readonly (readonly TracedPoint[])[]
  readonly outcomes: readonly StrokeOutcome[]
}

/** What the learner put on the paper for one お題, and what the marking said. */
export type Attempt = {
  readonly item: string
  /** One per character of the お題, in reading order: what to put back on the paper. */
  readonly cells: readonly AttemptCell[]
  /** Strokes right at the first 送信: the count that stands however often it is rewritten. */
  readonly score: { readonly correct: number; readonly total: number }
}

/** How one お題 went, settled the first time it was sent. */
export type ItemResult = {
  readonly item: string
  /** Every stroke was right at the first 送信. */
  readonly firstTimeCorrect: boolean
}

/** One 升目 of the お題 in hand: its character, and the state of the paper in it. */
export type CellState = {
  readonly character: string
  readonly writtenStrokes: number
  /** The marking of this 升目, once 送信 has happened. Empty before it. */
  readonly outcomes: readonly StrokeOutcome[]
  /** Which stroke the hint should point at here, or null when it belongs elsewhere. */
  readonly navigationStroke: number | null
}

export type WritingSessionState = {
  /** Choosing お題, writing them, or done with the lot. */
  readonly phase: 'choosing' | 'writing' | 'finished'
  /** The お題 of the run, in the order they were chosen. */
  readonly chosen: readonly string[]
  /** Which お題 of the run is in hand, counting from one. Zero when not writing. */
  readonly position: number
  /** The お題 in hand, or null while still choosing. It stays in hand at the end. */
  readonly item: string | null
  /**
   * One 升目 per character of the お題 in hand, in reading order — what the screen
   * draws. Empty while still choosing. The fields below describe the お題 as a
   * whole, which is what the tally counts; these say where on the paper it is.
   */
  readonly cells: readonly CellState[]
  /** お題 still to come after the one in hand. */
  readonly remaining: number
  /** How many strokes are on the paper for the お題 in hand, every 升目 counted. */
  readonly writtenStrokes: number
  /** Is there something to send, and has it not been sent yet? */
  readonly canSubmit: boolean
  /** Has the お題 in hand been sent and marked? */
  readonly marked: boolean
  /**
   * What each written stroke measured against its model at the last 送信, for
   * the tuning build's panel. Empty before 送信, and for a stroke the model has
   * no counterpart for.
   */
  readonly measurements: readonly StrokeMeasurement[]
  /** Strokes of the お題 in hand written correctly at the first 送信, or null before it. */
  readonly score: { readonly correct: number; readonly total: number } | null
  /** お題 written correctly at the first 送信, out of them all. */
  readonly runScore: { readonly correct: number; readonly total: number }
  /** How the お題 written so far went, in order. */
  readonly results: readonly ItemResult[]
}

export type WritingSession = {
  state(): WritingSessionState
  /** Adds an お題 to the run, or takes it out again if it is already in. */
  chooseItem(item: string): WritingSessionState
  /**
   * Adds a whole set of お題 at once — a kind of character, or the 単語 of one
   * 場面 — or, when every one of them is already in the run, takes the set back
   * out.
   */
  chooseAll(items: readonly string[]): WritingSessionState
  /** Begins writing the chosen お題. Does nothing if none were chosen. */
  start(): WritingSessionState
  /**
   * The stroke being drawn right now, as far as it has got, and which 升目 of the
   * お題 it is being drawn in. Once it is about half as long as the one it is
   * tracing, the hint moves on to the next stroke.
   */
  traceStroke(points: readonly TracedPoint[], cell?: number): WritingSessionState
  /**
   * Takes one finished stroke onto the paper, in the 升目 it was drawn in.
   * Nothing is judged here.
   */
  addStroke(points: readonly TracedPoint[], cell?: number): WritingSessionState
  /** Marks everything written for the お題 in hand. */
  submit(): WritingSessionState
  /** Leaves the marked お題 for the next one. */
  nextItem(): WritingSessionState
  /** Wipes the お題 in hand so it can be written again. Its result stands. */
  retryItem(): WritingSessionState
  /**
   * What was written and marked for one お題 of the run, counting from one, so
   * a learner can look back at it. Null until it has been sent.
   */
  attempt(position: number): Attempt | null
}

/**
 * As much of a marked 升目 as the answer cares about — which the お題 in hand
 * (`CellState`) and one being looked back at (`AttemptCell`) both are.
 */
export type MarkedCell = { readonly outcomes: readonly StrokeOutcome[] }

/**
 * Which 升目 of a marked お題 went wrong: the ones the answer is walked through
 * after 送信, and only those — a 単語 with one character out of place should not
 * have the other three answered at it.
 */
export function wrongCells(cells: readonly MarkedCell[]): readonly number[] {
  return cells.flatMap((cell, index) =>
    cell.outcomes.some((outcome) => !outcome.correct) ? [index] : [],
  )
}

/**
 * One 升目 of the お題 being written: what it asks for, what the learner put in
 * it, and what the marking said. An お題 of one character is a row of one.
 */
type Cell = {
  readonly character: string
  readonly strokes: readonly Stroke[]
  written: (readonly TracedPoint[])[]
  outcomes: StrokeOutcome[]
}

export type WritingSessionOptions = {
  /** The model strokes of any character that might be chosen. */
  readonly strokesOf: (character: string) => readonly Stroke[]
  /**
   * The numbers the marking judges by. Asked for afresh at every 送信, so they
   * can be moved while the app is running — which is how they get chosen at
   * all, since nobody can tell from the numbers alone whether they are right.
   */
  readonly thresholds?: () => MatchThresholds
}

export function createWritingSession(options: WritingSessionOptions): WritingSession {
  const { strokesOf, thresholds = () => DEFAULT_THRESHOLDS } = options

  const chosen: string[] = []
  let phase: WritingSessionState['phase'] = 'choosing'
  /** Index into the chosen お題 of the one in hand. */
  let at = 0
  /** One 升目 per character of the お題 in hand, in reading order. */
  let cells: Cell[] = []
  /** What the strokes on the paper measured, kept so the tuning panel can show the numbers. */
  let measurements: StrokeMeasurement[] = []
  let marked = false
  /** One per お題 already sent, settled at its first 送信. */
  const results: ItemResult[] = []
  /**
   * The last thing written for each お題, kept for the whole run so the learner
   * can look back at it. In memory only: nothing is stored (ADR 0005).
   */
  const attempts: Attempt[] = []
  /**
   * The first 送信's marking of each お題. Writing an お題 again is practice, not
   * a second chance at the count (一発正解), so this is what the tally reads.
   */
  const firstMarking: StrokeOutcome[][] = []
  /** Is the stroke in hand far enough along for the hint to move on? */
  let pastHalfway = false

  /** How a marking reads as a count of strokes, or nothing if there is no marking. */
  const countOf = (
    marking: readonly StrokeOutcome[] | undefined,
  ): { correct: number; total: number } | null =>
    marking
      ? { correct: marking.filter((outcome) => outcome.correct).length, total: marking.length }
      : null

  const takeUpItem = (): void => {
    cells = [...chosen[at]!].map((character) => ({
      character,
      strokes: strokesOf(character),
      written: [],
      outcomes: [],
    }))
    measurements = []
    marked = false
    pastHalfway = false
  }

  /** Everything on the paper for the お題 in hand, 升目 by 升目, in reading order. */
  const allWritten = (): (readonly TracedPoint[])[] => cells.flatMap((cell) => cell.written)

  const allOutcomes = (): StrokeOutcome[] =>
    cells.flatMap((cell) => cell.outcomes.map((outcome) => ({ ...outcome })))

  /**
   * The 升目 the learner is taken to be in: the first one still short of the
   * strokes its character asks for. A 単語 is written left to right, so that is
   * where the hint belongs — and once a 升目 is full the hint moves along.
   */
  const cellInHand = (): number | null => {
    const found = cells.findIndex((cell) => cell.written.length < cell.strokes.length)
    return found === -1 ? null : found
  }

  /**
   * Where the hint belongs: one ahead of the stroke in hand. The first stroke
   * from the moment the お題 comes up — a learner who does not know where a
   * character starts is exactly who this app is for — and from the middle of
   * stroke N, the stroke N+1. Half way through the last stroke of a 升目 that
   * is the first stroke of the next one, so the hint leads the learner across
   * the 単語 rather than going dark between squares. Nothing is shown once the
   * お題 has been sent.
   */
  const navigationAt = (): { cell: number; stroke: number } | null => {
    if (phase === 'choosing' || marked) return null
    const inHand = cellInHand()
    if (inHand === null) return null
    const target = cells[inHand]!.written.length + (pastHalfway ? 1 : 0)
    if (target < cells[inHand]!.strokes.length) return { cell: inHand, stroke: target }
    // The next 升目 still short of its model, which is not always the one after:
    // a learner who filled a later square first should not be sent back to it.
    const next = cells.findIndex(
      (cell, index) => index > inHand && cell.written.length < cell.strokes.length,
    )
    return next === -1 ? null : { cell: next, stroke: 0 }
  }

  const state = (): WritingSessionState => {
    const hint = navigationAt()
    const writtenStrokes = cells.reduce((total, cell) => total + cell.written.length, 0)
    return {
      phase,
      chosen: [...chosen],
      position: phase === 'choosing' ? 0 : at + 1,
      item: phase === 'choosing' ? null : chosen[at]!,
      cells: cells.map((cell, index) => ({
        character: cell.character,
        writtenStrokes: cell.written.length,
        outcomes: cell.outcomes.map((outcome) => ({ ...outcome })),
        navigationStroke: hint?.cell === index ? hint.stroke : null,
      })),
      remaining: phase === 'choosing' ? chosen.length : chosen.length - (at + 1),
      writtenStrokes,
      canSubmit: phase !== 'choosing' && !marked && writtenStrokes > 0,
      marked,
      measurements: [...measurements],
      score: countOf(firstMarking[at]),
      runScore: {
        correct: results.filter((result) => result.firstTimeCorrect).length,
        total: chosen.length,
      },
      results: results.map((result) => ({ ...result })),
    }
  }

  return {
    state,
    attempt(position) {
      return attempts[position - 1] ?? null
    },
    chooseItem(item) {
      // Once the writing has begun the run is settled: a stray tap must not
      // lengthen or shorten what the learner is part way through.
      if (phase !== 'choosing') return state()
      const already = chosen.indexOf(item)
      if (already === -1) chosen.push(item)
      else chosen.splice(already, 1)
      return state()
    },
    chooseAll(items) {
      if (phase !== 'choosing') return state()
      const missing = items.filter((item) => !chosen.includes(item))
      if (missing.length > 0) chosen.push(...missing)
      else {
        for (const item of items) {
          const place = chosen.indexOf(item)
          if (place !== -1) chosen.splice(place, 1)
        }
      }
      return state()
    },
    start() {
      if (phase !== 'choosing' || chosen.length === 0) return state()
      phase = 'writing'
      at = 0
      takeUpItem()
      return state()
    },
    traceStroke(points, cell = 0) {
      if (phase === 'choosing' || marked) return state()
      // Only the 升目 the hint is in can move it on. Drawing in one further
      // along the 単語 is allowed, but it must not walk the hint somewhere the
      // learner is not looking.
      const drawnIn = cells[cell]
      const model = cell === cellInHand() ? drawnIn?.strokes[drawnIn.written.length] : undefined
      // A fresh stroke starts short, so this falls back to false on its own the
      // moment the learner lifts and begins the next one.
      pastHalfway =
        model !== undefined &&
        length(points.map(asPoint)) >= length(model.median) * HINT_MOVES_ON_AT
      return state()
    },
    addStroke(points, cell = 0) {
      // Judging happens at 送信 and nowhere else, so this only takes the ink.
      if (phase === 'choosing' || marked || points.length === 0) return state()
      const target = cells[cell]
      if (!target) return state()
      target.written = [...target.written, [...points]]
      pastHalfway = false
      return state()
    },
    submit() {
      if (phase === 'choosing' || marked || allWritten().length === 0) return state()

      // Each 升目 is marked against its own character, and within it the written
      // strokes answer for the model's strokes in the order they were written:
      // writing them out of order is exactly the mistake this app is about.
      // Anything beyond the model's count is a stroke too many, and a model
      // stroke never written is a stroke missing; both count as wrong.
      const judgingBy = thresholds()
      measurements = []
      for (const cell of cells) {
        cell.outcomes = Array.from(
          { length: Math.max(cell.written.length, cell.strokes.length) },
          (_, index) => {
            const model = cell.strokes[index]
            const stroke = cell.written[index]
            if (!model) return { correct: false, problem: 'extra' as const }
            if (!stroke) return { correct: false, problem: 'missing' as const }
            const measured = measureStroke(stroke.map(asPoint), model.median, judgingBy)
            measurements.push(measured)
            const verdict = verdictOf(measured)
            return verdict.correct
              ? { correct: true, problem: null }
              : { correct: false, problem: verdict.reason }
          },
        )
      }
      marked = true
      pastHalfway = false

      const marking = allOutcomes()
      // How an お題 went is settled the first time it is sent: writing it again
      // afterwards is practice, not a second chance at the tally (一発正解).
      if (results.length === at) {
        firstMarking[at] = marking.map((outcome) => ({ ...outcome }))
        results.push({
          item: chosen[at]!,
          firstTimeCorrect: marking.every((outcome) => outcome.correct),
        })
      }
      // Written again, an お題 keeps only its latest attempt: the tally was
      // settled at the first 送信 and does not change.
      attempts[at] = {
        item: chosen[at]!,
        cells: cells.map((cell) => ({
          character: cell.character,
          written: cell.written.map((stroke) => [...stroke]),
          outcomes: cell.outcomes.map((outcome) => ({ ...outcome })),
        })),
        score: countOf(firstMarking[at])!,
      }
      // The run ends with its last お題: there is nothing else to wait for.
      if (at + 1 === chosen.length) phase = 'finished'
      return state()
    },
    nextItem() {
      // Moving on is the learner's to ask for: an お題 that vanished the instant
      // it was marked would leave nothing to look at.
      if (phase !== 'writing' || !marked || at + 1 >= chosen.length) return state()
      at += 1
      takeUpItem()
      return state()
    },
    retryItem() {
      if (!marked) return state()
      // A finished run reopens on its last お題. The tally was settled when it
      // was first sent, so nothing about it changes here.
      phase = 'writing'
      takeUpItem()
      return state()
    },
  }
}
