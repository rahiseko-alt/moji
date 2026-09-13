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
import { createWritingSession } from './writing-session'

const data = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
/** Four strokes, all of them long and straight: easy to distort in a controlled way. */
const strokes = data.characters['日']!

const perfect = (index: number): Point[] => strokes[index]!.median.map(([x, y]) => [x, y])

const write = (
  mode: 'practice' | 'test',
  ...attempts: readonly Point[][]
) => {
  const session = createWritingSession({ strokes, mode })
  let state = session.state()
  for (const attempt of attempts) state = session.writeStroke(attempt)
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
    expect(session.writeStroke(perfect(0)).awaitingStroke).toBe(1)
    expect(session.writeStroke(perfect(1)).awaitingStroke).toBe(2)
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

describe('once the character is finished', () => {
  it('ignores anything else written', () => {
    const { session, state } = writeAllPerfectly('practice')
    expect(session.writeStroke(perfect(0))).toEqual(state)
  })
})
