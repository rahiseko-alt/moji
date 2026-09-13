/**
 * The one seam this project tests thoroughly: what happens as a learner writes.
 * Scoring runs inside the session, so it is exercised here too rather than
 * poked at directly.
 *
 * Strokes are built from the shipped model data, so "perfect" means what the
 * app actually asks for, and every imperfection is a deliberate distortion of it.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Point, StrokeData } from '../data/stroke-data'
import type { TracedPoint } from './traced-point'
import { createWritingSession, DEFAULT_NAVIGATION_DELAY_MS } from './writing-session'

const data = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
/** Four strokes, all of them long and straight: easy to distort in a controlled way. */
const strokes = data.characters['日']!

/** A stroke as the learner's finger would report it: in place, and taking time. */
const traced = (points: readonly Point[], startedAt = 0): TracedPoint[] =>
  points.map(([x, y], n) => ({ x, y, t: startedAt + n * 10 }))

const perfect = (index: number): Point[] => strokes[index]!.median.map(([x, y]) => [x, y])

const write = (
  mode: 'practice' | 'test',
  ...attempts: readonly Point[][]
) => {
  const session = createWritingSession({ strokes, mode })
  let state = session.state()
  for (const [n, attempt] of attempts.entries()) state = session.writeStroke(traced(attempt, n * 1000))
  return { session, state }
}

const writeAllPerfectly = (mode: 'practice' | 'test') =>
  write(mode, ...strokes.map((_, index) => perfect(index)))

const reversed = (index: number): Point[] => [...perfect(index)].reverse()

const shifted = (index: number, dx: number, dy: number): Point[] =>
  perfect(index).map(([x, y]) => [x + dx, y + dy])

/** Keeps the start and end but bulges out sideways in the middle. */
const bulged = (index: number, amount: number): Point[] => {
  const points = perfect(index)
  const last = points.length - 1
  return points.map(([x, y], n) => {
    const bulge = Math.sin((n / last) * Math.PI) * amount
    return [x + bulge, y - bulge]
  })
}

/** Only the first fraction of the stroke, as if the finger stopped early. */
const truncated = (index: number, fraction: number): Point[] =>
  perfect(index).slice(0, Math.max(2, Math.round(perfect(index).length * fraction)))

/** Hand wobble: a small alternating jitter along the whole stroke. */
const wobbled = (index: number, amount: number): Point[] =>
  perfect(index).map(([x, y], n) => [x + (n % 2 ? amount : -amount), y + (n % 3 ? -amount : amount)])

describe('writing a character correctly', () => {
  it('accepts every stroke and finishes', () => {
    const { state } = writeAllPerfectly('practice')
    expect(state.phase).toBe('finished')
    expect(state.awaitingStroke).toBe(strokes.length)
    expect(state.outcomes.every((outcome) => outcome.done)).toBe(true)
  })

  it('scores every stroke as right first time', () => {
    const { state } = writeAllPerfectly('practice')
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length })
  })

  it('waits for the strokes in order', () => {
    const session = createWritingSession({ strokes, mode: 'practice' })
    expect(session.state().awaitingStroke).toBe(0)
    expect(session.writeStroke(traced(perfect(0))).awaitingStroke).toBe(1)
    expect(session.writeStroke(traced(perfect(1), 1000)).awaitingStroke).toBe(2)
  })

  it('forgives hand wobble', () => {
    const { state } = write('practice', wobbled(0, 2.5))
    expect(state.lastVerdict).toEqual({ correct: true })
  })
})

describe('a stroke that is wrong', () => {
  it('is refused when written from the wrong end', () => {
    const { state } = write('practice', reversed(0))
    expect(state.lastVerdict).toEqual({ correct: false, reason: 'backwards' })
  })

  it('is refused when it barely moves', () => {
    const { state } = write('practice', truncated(0, 0.15))
    expect(state.lastVerdict).toEqual({ correct: false, reason: 'tooShort' })
  })

  it('is refused when it starts and ends well away from the model', () => {
    const { state } = write('practice', shifted(0, 40, 0))
    expect(state.lastVerdict).toEqual({ correct: false, reason: 'misplaced' })
  })

  it('is refused when it wanders off on the way', () => {
    const { state } = write('practice', bulged(0, 35))
    expect(state.lastVerdict).toEqual({ correct: false, reason: 'shape' })
  })
})

describe('practice', () => {
  it('waits for the same stroke again after a wrong one', () => {
    const { state } = write('practice', reversed(0))
    expect(state.awaitingStroke).toBe(0)
    expect(state.phase).toBe('writing')
  })

  it('accepts the stroke on a second, correct attempt', () => {
    const { state } = write('practice', reversed(0), perfect(0))
    expect(state.awaitingStroke).toBe(1)
    expect(state.outcomes[0]!.done).toBe(true)
  })

  it('does not count a stroke that took two goes towards the score', () => {
    const { state } = write('practice', reversed(0), perfect(0), perfect(1))
    expect(state.outcomes[0]!.firstTimeCorrect).toBe(false)
    expect(state.outcomes[0]!.attempts).toBe(2)
    expect(state.score.correct).toBe(1)
  })

  it('cannot be finished by writing the wrong stroke over and over', () => {
    const { state } = write('practice', reversed(0), reversed(0), reversed(0))
    expect(state.awaitingStroke).toBe(0)
    expect(state.phase).toBe('writing')
  })
})

describe('a test', () => {
  it('moves on even when the stroke was wrong', () => {
    const { state } = write('test', reversed(0))
    expect(state.awaitingStroke).toBe(1)
    expect(state.outcomes[0]!.done).toBe(false)
  })

  it('reaches the end and reports how many were right', () => {
    const { state } = write(
      'test',
      reversed(0),
      perfect(1),
      perfect(2),
      perfect(3),
    )
    expect(state.phase).toBe('finished')
    expect(state.score).toEqual({ correct: 3, total: 4 })
  })
})

describe('remembering what went wrong', () => {
  it('keeps the reason for each stroke, not just the last one written', () => {
    const { state } = write('test', reversed(0), truncated(1, 0.15), perfect(2))
    expect(state.outcomes[0]!.lastMistake).toBe('backwards')
    expect(state.outcomes[1]!.lastMistake).toBe('tooShort')
    expect(state.outcomes[2]!.lastMistake).toBe(null)
  })

  it('keeps the reason for a stroke that was later written correctly', () => {
    const { state } = write('practice', reversed(0), perfect(0))
    expect(state.outcomes[0]!.done).toBe(true)
    expect(state.outcomes[0]!.lastMistake).toBe('backwards')
  })
})

describe('the hint for a learner who has stalled', () => {
  const stall = (...attempts: readonly Point[][]) => {
    const session = createWritingSession({ strokes, mode: 'practice' })
    attempts.forEach((attempt, n) => session.writeStroke(traced(attempt, n * 10_000)))
    const endedAt = (attempts.length - 1) * 10_000 + (perfect(0).length - 1) * 10
    return { session, endedAt }
  }

  it('never appears before the first stroke, however long the wait', () => {
    const session = createWritingSession({ strokes, mode: 'practice' })
    expect(session.tick(10_000_000).showNavigation).toBe(false)
  })

  it('appears once the learner has waited, from the second stroke on', () => {
    const { session, endedAt } = stall(perfect(0))
    expect(session.tick(endedAt + DEFAULT_NAVIGATION_DELAY_MS).showNavigation).toBe(true)
  })

  it('stays away while the learner is still within the grace period', () => {
    const { session, endedAt } = stall(perfect(0))
    expect(session.tick(endedAt + DEFAULT_NAVIGATION_DELAY_MS - 1).showNavigation).toBe(false)
  })

  it('goes away again as soon as something is written', () => {
    const { session, endedAt } = stall(perfect(0))
    session.tick(endedAt + DEFAULT_NAVIGATION_DELAY_MS)
    expect(session.writeStroke(traced(perfect(1), 20_000)).showNavigation).toBe(false)
  })

  it('appears after a refused stroke too, since that learner is stuck as well', () => {
    const { session, endedAt } = stall(perfect(0), reversed(1))
    expect(session.tick(endedAt + DEFAULT_NAVIGATION_DELAY_MS).showNavigation).toBe(true)
  })

  it('never appears in a test', () => {
    const session = createWritingSession({ strokes, mode: 'test' })
    session.writeStroke(traced(perfect(0)))
    expect(session.tick(10_000_000).showNavigation).toBe(false)
  })

  it('stops once the character is finished', () => {
    const { session } = writeAllPerfectly('practice')
    expect(session.tick(10_000_000).showNavigation).toBe(false)
  })

  it('can be told to wait longer', () => {
    const session = createWritingSession({ strokes, mode: 'practice', navigationDelayMs: 5000 })
    session.writeStroke(traced(perfect(0)))
    const endedAt = (perfect(0).length - 1) * 10
    expect(session.tick(endedAt + 1500).showNavigation).toBe(false)
    expect(session.tick(endedAt + 5000).showNavigation).toBe(true)
  })
})

describe('once the character is finished', () => {
  it('ignores anything else written', () => {
    const { session, state } = writeAllPerfectly('practice')
    expect(session.writeStroke(traced(perfect(0)))).toEqual(state)
  })
})
