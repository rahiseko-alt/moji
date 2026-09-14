/**
 * The one seam this project tests thoroughly: what happens as a learner chooses
 * characters and writes them. Scoring runs inside the session, so it is
 * exercised here too rather than poked at directly.
 *
 * Strokes are built from the shipped model data, so "perfect" means what the
 * app actually asks for, and every imperfection is a deliberate distortion of it.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Point, Stroke, StrokeData } from '../data/stroke-data'
import type { TracedPoint } from './traced-point'
import { createWritingSession, type SessionMode, type WritingSession } from './writing-session'

const data = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
const strokesOf = (character: string): readonly Stroke[] => data.characters[character] ?? []
/** Four strokes, all of them long and straight: easy to distort in a controlled way. */
const strokes = data.characters['日']!

/** A stroke as the learner's finger would report it: in place, and taking time. */
const traced = (points: readonly Point[], startedAt = 0): TracedPoint[] =>
  points.map(([x, y], n) => ({ x, y, t: startedAt + n * 10 }))

const perfectOf = (character: string, index: number): Point[] =>
  strokesOf(character)[index]!.median.map(([x, y]) => [x, y])

const perfect = (index: number): Point[] => perfectOf('日', index)

/** A session that has been given characters and told to begin. */
const begin = (mode: SessionMode, ...characters: readonly string[]) => {
  const session = createWritingSession({ mode, strokesOf })
  for (const character of characters) session.chooseCharacter(character)
  session.start()
  return session
}

/** Writes the whole of one character, one stroke after another. */
const writeCharacter = (session: WritingSession, character: string) => {
  let state = session.state()
  for (let n = 0; n < strokesOf(character).length; n++) {
    state = session.writeStroke(traced(perfectOf(character, n), n * 1000))
  }
  return state
}

const write = (
  mode: SessionMode,
  ...attempts: readonly Point[][]
) => {
  const session = begin(mode, '日')
  let state = session.state()
  for (const [n, attempt] of attempts.entries()) state = session.writeStroke(traced(attempt, n * 1000))
  return { session, state }
}

const writeAllPerfectly = (mode: SessionMode) =>
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

const rotated = (index: number, degrees: number): Point[] => {
  const points = perfect(index)
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length
  const r = (degrees * Math.PI) / 180
  return points.map(([x, y]) => [
    cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r),
    cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r),
  ])
}

/** The stroke's two ends joined by a ruler: the shape of a rushed learner. */
const straightened = (index: number): Point[] => {
  const points = perfect(index)
  const from = points[0]!
  const to = points[points.length - 1]!
  return points.map((_, n) => {
    const t = n / (points.length - 1)
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
  })
}

describe('choosing what to write', () => {
  const choosing = () => createWritingSession({ mode: 'practice', strokesOf })

  it('starts with nothing chosen and nothing being written', () => {
    const state = choosing().state()
    expect(state.chosen).toEqual([])
    expect(state.phase).toBe('choosing')
    expect(state.character).toBeNull()
  })

  it('keeps the characters in the order they were chosen', () => {
    const session = choosing()
    session.chooseCharacter('人')
    session.chooseCharacter('日')
    expect(session.chooseCharacter('一').chosen).toEqual(['人', '日', '一'])
  })

  it('takes a character out when it is chosen a second time', () => {
    const session = choosing()
    session.chooseCharacter('日')
    expect(session.chooseCharacter('日').chosen).toEqual([])
  })

  it('closes the gap when a character in the middle is taken out', () => {
    const session = choosing()
    for (const character of ['人', '日', '一']) session.chooseCharacter(character)
    expect(session.chooseCharacter('日').chosen).toEqual(['人', '一'])
  })

  it('holds characters of every kind at once', () => {
    const session = choosing()
    session.chooseCharacter('あ')
    session.chooseCharacter('ア')
    expect(session.chooseCharacter('日').chosen).toEqual(['あ', 'ア', '日'])
  })

  it('will not begin with nothing chosen', () => {
    const session = choosing()
    expect(session.start().phase).toBe('choosing')
  })

  it('begins with the first character that was chosen', () => {
    const session = choosing()
    session.chooseCharacter('人')
    session.chooseCharacter('日')
    const state = session.start()
    expect(state.phase).toBe('writing')
    expect(state.character).toBe('人')
    expect(state.position).toBe(1)
  })

  it('takes no more characters once the writing has begun', () => {
    const session = begin('practice', '日')
    expect(session.chooseCharacter('一').chosen).toEqual(['日'])
  })
})

describe('choosing a whole kind at once', () => {
  const choosing = () => createWritingSession({ mode: 'practice', strokesOf })
  const kana = ['あ', 'い', 'う']

  it('adds them all, in the order they were handed over', () => {
    expect(choosing().chooseAll(kana).chosen).toEqual(kana)
  })

  it('leaves the ones already chosen where they are', () => {
    const session = choosing()
    session.chooseCharacter('う')
    expect(session.chooseAll(kana).chosen).toEqual(['う', 'あ', 'い'])
  })

  it('takes them all out again when every one is already in', () => {
    const session = choosing()
    session.chooseAll(kana)
    expect(session.chooseAll(kana).chosen).toEqual([])
  })

  it('leaves characters of another kind alone when it takes them out', () => {
    const session = choosing()
    session.chooseCharacter('日')
    session.chooseAll(kana)
    expect(session.chooseAll(kana).chosen).toEqual(['日'])
  })
})

describe('writing one character after another', () => {
  const run = () => begin('practice', '一', '人')

  it('says which character of how many is in hand', () => {
    const state = run().state()
    expect(state.position).toBe(1)
    expect(state.chosen).toHaveLength(2)
  })

  it('does not move on by itself when a character is written', () => {
    const session = run()
    const state = writeCharacter(session, '一')
    expect(state.characterFinished).toBe(true)
    expect(state.position).toBe(1)
    expect(state.phase).toBe('writing')
  })

  it('moves on to the next character when told to', () => {
    const session = run()
    writeCharacter(session, '一')
    const state = session.nextCharacter()
    expect(state.character).toBe('人')
    expect(state.position).toBe(2)
    expect(state.awaitingStroke).toBe(0)
    expect(state.characterFinished).toBe(false)
  })

  it('gives the next character a clean sheet of paper', () => {
    const session = run()
    writeCharacter(session, '一')
    const state = session.nextCharacter()
    expect(state.outcomes.every((outcome) => !outcome.done)).toBe(true)
    expect(state.outcomes).toHaveLength(strokesOf('人').length)
    expect(state.lastVerdict).toBeNull()
  })

  it('stays put while the character in hand is unfinished', () => {
    const session = run()
    const state = session.nextCharacter()
    expect(state.character).toBe('一')
    expect(state.position).toBe(1)
  })

  it('is finished as soon as the last character has been written', () => {
    const session = run()
    writeCharacter(session, '一')
    session.nextCharacter()
    const state = writeCharacter(session, '人')
    expect(state.phase).toBe('finished')
    // The last character stays in hand: it is still on the paper to look at.
    expect(state.character).toBe('人')
  })

  it('ignores anything written after the run is finished', () => {
    const session = run()
    writeCharacter(session, '一')
    session.nextCharacter()
    const finished = writeCharacter(session, '人')
    expect(session.writeStroke(traced(perfectOf('人', 0)))).toEqual(finished)
  })
})

describe('writing a character again', () => {
  const run = () => begin('practice', '日', '一')

  it('hands back a clean square when the learner asks', () => {
    const session = run()
    writeCharacter(session, '日')
    const state = session.retryCharacter()
    expect(state.character).toBe('日')
    expect(state.awaitingStroke).toBe(0)
    expect(state.characterFinished).toBe(false)
    expect(state.outcomes.every((outcome) => !outcome.done)).toBe(true)
  })

  it('does nothing while the character is still being written', () => {
    const session = run()
    session.writeStroke(traced(perfect(0)))
    const state = session.retryCharacter()
    expect(state.awaitingStroke).toBe(1)
  })

  it('counts the first attempt, however well the character goes the second time', () => {
    const session = run()
    session.writeStroke(traced(reversed(0)))
    for (let n = 0; n < strokes.length; n++) session.writeStroke(traced(perfect(n), n * 1000))
    session.retryCharacter()
    const state = writeCharacter(session, '日')
    expect(state.results[0]).toEqual({ character: '日', firstTimeCorrect: false })
  })

  it('can be asked for again and again', () => {
    const session = run()
    writeCharacter(session, '日')
    session.retryCharacter()
    writeCharacter(session, '日')
    expect(session.retryCharacter().awaitingStroke).toBe(0)
  })

  it('reopens the last character after the run has finished', () => {
    const session = run()
    writeCharacter(session, '日')
    session.nextCharacter()
    writeCharacter(session, '一')
    const state = session.retryCharacter()
    expect(state.phase).toBe('writing')
    expect(state.character).toBe('一')
    expect(state.results).toHaveLength(2)
  })
})

describe('counting a run', () => {
  it('records each character as it is written', () => {
    const session = begin('practice', '日', '一')
    expect(writeCharacter(session, '日').results).toEqual([{ character: '日', firstTimeCorrect: true }])
  })

  it('counts a character as right only when every stroke was right first time', () => {
    const session = begin('practice', '日', '一')
    session.writeStroke(traced(reversed(0)))
    writeCharacter(session, '日')
    session.nextCharacter()
    const state = writeCharacter(session, '一')
    expect(state.results).toEqual([
      { character: '日', firstTimeCorrect: false },
      { character: '一', firstTimeCorrect: true },
    ])
  })
})

describe('writing a character correctly', () => {
  it('accepts every stroke and finishes the character', () => {
    const { state } = writeAllPerfectly('practice')
    expect(state.characterFinished).toBe(true)
    expect(state.awaitingStroke).toBe(strokes.length)
    expect(state.outcomes.every((outcome) => outcome.done)).toBe(true)
  })

  it('scores every stroke as right first time', () => {
    const { state } = writeAllPerfectly('practice')
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length })
  })

  it('waits for the strokes in order', () => {
    const session = begin('practice', '日')
    expect(session.state().awaitingStroke).toBe(0)
    expect(session.writeStroke(traced(perfect(0))).awaitingStroke).toBe(1)
    expect(session.writeStroke(traced(perfect(1), 1000)).awaitingStroke).toBe(2)
  })

  it('forgives hand wobble', () => {
    const { state } = write('practice', wobbled(0, 2.5))
    expect(state.lastVerdict).toEqual({ correct: true })
  })

  it('forgives a properly shaky finger', () => {
    const { state } = write('practice', wobbled(0, 5))
    expect(state.lastVerdict).toEqual({ correct: true })
  })

  it('forgives a stroke written a little off centre', () => {
    const { state } = write('practice', shifted(0, 4, 4))
    expect(state.lastVerdict).toEqual({ correct: true })
  })
})

/*
 * The boundary the app is tuned to. Everything above is a way of writing the
 * stroke that deserves a pass; everything here is a way of not writing it.
 * Move a threshold and one of these two groups will tell you.
 */
describe('a stroke that is close but not good enough', () => {
  it('is refused when it sits a tenth of the square out of place', () => {
    const { state } = write('practice', shifted(0, 9, 9))
    expect(state.lastVerdict).toEqual({ correct: false, reason: 'misplaced' })
  })

  it('is refused when it leans noticeably', () => {
    const { state } = write('practice', rotated(0, 45))
    expect(state.lastVerdict?.correct).toBe(false)
  })

  it('is refused when it stops a fifth short of the end', () => {
    const { state } = write('practice', truncated(0, 0.8))
    expect(state.lastVerdict?.correct).toBe(false)
  })

  it('is refused when a curve is drawn as a straight line', () => {
    // The second stroke of 日 turns a corner; a ruled line is not that stroke.
    const session = begin('practice', '日')
    session.writeStroke(traced(perfect(0)))
    const state = session.writeStroke(traced(straightened(1)))
    expect(state.lastVerdict?.correct).toBe(false)
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

  it('reaches the end of the character and reports how many were right', () => {
    const { state } = write(
      'test',
      reversed(0),
      perfect(1),
      perfect(2),
      perfect(3),
    )
    expect(state.characterFinished).toBe(true)
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

describe('a test keeps its results back', () => {
  const run = () => begin('test', '一', '人')

  it('says nothing about a character while the run is going on', () => {
    const session = run()
    const state = writeCharacter(session, '一')
    expect(state.characterFinished).toBe(true)
    expect(state.results).toEqual([])
  })

  it('hands over every result once the run is finished', () => {
    const session = run()
    writeCharacter(session, '一')
    session.nextCharacter()
    const state = writeCharacter(session, '人')
    expect(state.phase).toBe('finished')
    expect(state.results).toEqual([
      { character: '一', firstTimeCorrect: true },
      { character: '人', firstTimeCorrect: true },
    ])
  })
})

describe('the hint, which runs one stroke ahead', () => {
  const practising = () => begin('practice', '日')

  it('shows nothing before the learner has put a finger down', () => {
    expect(practising().state().navigationStroke).toBeNull()
  })

  it('stays away while the first stroke has barely begun', () => {
    const session = practising()
    expect(session.traceStroke(traced(truncated(0, 0.2))).navigationStroke).toBeNull()
  })

  it('points at the next stroke once the one in hand is half written', () => {
    const session = practising()
    expect(session.traceStroke(traced(truncated(0, 0.6))).navigationStroke).toBe(1)
  })

  it('is already there when the stroke in hand is accepted', () => {
    const session = practising()
    session.traceStroke(traced(truncated(0, 0.6)))
    expect(session.writeStroke(traced(perfect(0))).navigationStroke).toBe(1)
  })

  it('keeps running ahead as the character is written', () => {
    const session = practising()
    session.writeStroke(traced(perfect(0)))
    expect(session.traceStroke(traced(truncated(1, 0.6))).navigationStroke).toBe(2)
  })

  it('points at the stroke in hand once the learner has got it wrong', () => {
    const session = practising()
    expect(session.writeStroke(traced(reversed(0))).navigationStroke).toBe(0)
  })

  it('has nothing to point at beyond the last stroke', () => {
    const session = practising()
    strokes.slice(0, -1).forEach((_, index) => session.writeStroke(traced(perfect(index))))
    const last = strokes.length - 1
    expect(session.traceStroke(traced(truncated(last, 0.6))).navigationStroke).toBeNull()
  })

  it('never appears in a test', () => {
    const session = begin('test', '日')
    expect(session.traceStroke(traced(truncated(0, 0.6))).navigationStroke).toBeNull()
  })

  it('stops once the character is finished', () => {
    const { state } = writeAllPerfectly('practice')
    expect(state.navigationStroke).toBeNull()
  })
})

describe('once the character is finished', () => {
  it('ignores anything else written', () => {
    const { session, state } = writeAllPerfectly('practice')
    expect(session.writeStroke(traced(perfect(0)))).toEqual(state)
  })
})
