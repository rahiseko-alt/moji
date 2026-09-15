/**
 * The one seam this project tests thoroughly: what happens as a learner chooses
 * お題, writes them, and sends them to be marked. The marking runs inside the
 * session, so it is exercised here too rather than poked at directly.
 *
 * Strokes are built from the shipped model data, so "perfect" means what the app
 * actually asks for, and every imperfection is a deliberate distortion of it.
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

/** A session that has been given お題 and told to begin. */
const begin = (mode: SessionMode, ...characters: readonly string[]) => {
  const session = createWritingSession({ mode, strokesOf })
  for (const character of characters) session.chooseCharacter(character)
  session.start()
  return session
}

/** Puts every stroke of a character on the paper, without sending it. */
const writeCharacter = (session: WritingSession, character: string) => {
  let state = session.state()
  for (let n = 0; n < strokesOf(character).length; n++) {
    state = session.addStroke(traced(perfectOf(character, n), n * 1000))
  }
  return state
}

/** Writes the given attempts at 日 and sends them to be marked. */
const send = (mode: SessionMode, ...attempts: readonly Point[][]) => {
  const session = begin(mode, '日')
  for (const [n, attempt] of attempts.entries()) session.addStroke(traced(attempt, n * 1000))
  return { session, state: session.submit() }
}

const sendAllPerfectly = (mode: SessionMode) =>
  send(mode, ...strokes.map((_, index) => perfect(index)))

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

  it('keeps the お題 in the order they were chosen', () => {
    const session = choosing()
    session.chooseCharacter('人')
    session.chooseCharacter('日')
    expect(session.chooseCharacter('一').chosen).toEqual(['人', '日', '一'])
  })

  it('takes an お題 out when it is chosen a second time', () => {
    const session = choosing()
    session.chooseCharacter('日')
    expect(session.chooseCharacter('日').chosen).toEqual([])
  })

  it('closes the gap when one in the middle is taken out', () => {
    const session = choosing()
    for (const character of ['人', '日', '一']) session.chooseCharacter(character)
    expect(session.chooseCharacter('日').chosen).toEqual(['人', '一'])
  })

  it('holds お題 of every kind at once', () => {
    const session = choosing()
    session.chooseCharacter('あ')
    session.chooseCharacter('ア')
    expect(session.chooseCharacter('日').chosen).toEqual(['あ', 'ア', '日'])
  })

  it('will not begin with nothing chosen', () => {
    expect(choosing().start().phase).toBe('choosing')
  })

  it('begins with the first お題 that was chosen', () => {
    const session = choosing()
    session.chooseCharacter('人')
    session.chooseCharacter('日')
    const state = session.start()
    expect(state.phase).toBe('writing')
    expect(state.character).toBe('人')
    expect(state.position).toBe(1)
  })

  it('takes no more お題 once the writing has begun', () => {
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

  it('leaves お題 of another kind alone when it takes them out', () => {
    const session = choosing()
    session.chooseCharacter('日')
    session.chooseAll(kana)
    expect(session.chooseAll(kana).chosen).toEqual(['日'])
  })
})

describe('writing, before anything is sent', () => {
  it('judges nothing while strokes are being written', () => {
    const session = begin('practice', '日')
    const state = session.addStroke(traced(reversed(0)))
    expect(state.marked).toBe(false)
    expect(state.outcomes).toEqual([])
    expect(state.score).toBeNull()
  })

  it('keeps every stroke on the paper, right or wrong', () => {
    const session = begin('practice', '日')
    session.addStroke(traced(reversed(0)))
    session.addStroke(traced(perfect(1), 1000))
    expect(session.state().writtenStrokes).toBe(2)
    expect(session.writing()).toHaveLength(2)
  })

  it('cannot be sent with nothing written', () => {
    const session = begin('practice', '日')
    expect(session.state().canSubmit).toBe(false)
    expect(session.submit().marked).toBe(false)
  })

  it('can be sent as soon as one stroke is there', () => {
    const session = begin('practice', '日')
    expect(session.addStroke(traced(perfect(0))).canSubmit).toBe(true)
  })

  it('takes no more ink once the お題 has been sent', () => {
    const session = begin('practice', '日')
    session.addStroke(traced(perfect(0)))
    session.submit()
    expect(session.addStroke(traced(perfect(1), 1000)).writtenStrokes).toBe(1)
  })
})

describe('sending an お題 written correctly', () => {
  it('marks every stroke right and counts them all', () => {
    const { state } = sendAllPerfectly('practice')
    expect(state.marked).toBe(true)
    expect(state.outcomes.every((outcome) => outcome.correct)).toBe(true)
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length })
  })

  it('forgives hand wobble', () => {
    const { state } = send('practice', wobbled(0, 2.5))
    expect(state.outcomes[0]!.correct).toBe(true)
  })

  it('forgives a properly shaky finger', () => {
    const { state } = send('practice', wobbled(0, 5))
    expect(state.outcomes[0]!.correct).toBe(true)
  })

  it('forgives a stroke written a little off centre', () => {
    const { state } = send('practice', shifted(0, 4, 4))
    expect(state.outcomes[0]!.correct).toBe(true)
  })

  it('forgives a stroke written well off centre, as a finger writes', () => {
    const { state } = send('practice', shifted(0, 9, 9))
    expect(state.outcomes[0]!.correct).toBe(true)
  })

  it('forgives a stroke that stops a fifth short of the end', () => {
    const { state } = send('practice', truncated(0, 0.8))
    expect(state.outcomes[0]!.correct).toBe(true)
  })
})

/*
 * The boundary the app is tuned to. Everything above is a way of writing the
 * stroke that deserves a pass; everything here is a way of not writing it.
 * Move a threshold and one of these two groups will tell you.
 */
describe('a stroke that is close but not good enough', () => {
  it('is wrong when it sits a sixth of the square out of place', () => {
    const { state } = send('practice', shifted(0, 17, 17))
    expect(state.outcomes[0]!.correct).toBe(false)
  })

  it('is wrong when it leans noticeably', () => {
    const { state } = send('practice', rotated(0, 45))
    expect(state.outcomes[0]!.correct).toBe(false)
  })

  it('is wrong when it stops half way', () => {
    const { state } = send('practice', truncated(0, 0.5))
    expect(state.outcomes[0]!.correct).toBe(false)
  })

  it('is wrong when a curve is drawn as a straight line', () => {
    // The second stroke of 日 turns a corner; a ruled line is not that stroke.
    const { state } = send('practice', perfect(0), straightened(1))
    expect(state.outcomes[1]!.correct).toBe(false)
  })
})

describe('a stroke that is plainly wrong', () => {
  it('is marked as written from the wrong end', () => {
    const { state } = send('practice', reversed(0))
    expect(state.outcomes[0]).toEqual({ correct: false, problem: 'backwards' })
  })

  it('is marked as barely moving', () => {
    const { state } = send('practice', truncated(0, 0.15))
    expect(state.outcomes[0]).toEqual({ correct: false, problem: 'tooShort' })
  })

  it('is marked as out of place when it starts and ends well away', () => {
    const { state } = send('practice', shifted(0, 40, 0))
    expect(state.outcomes[0]).toEqual({ correct: false, problem: 'misplaced' })
  })

  it('is marked as the wrong shape when it wanders off on the way', () => {
    const { state } = send('practice', bulged(0, 35))
    expect(state.outcomes[0]).toEqual({ correct: false, problem: 'shape' })
  })
})

describe('marking what was written against what the お題 needs', () => {
  it('takes the strokes in the order they were written', () => {
    const { state } = send('practice', perfect(1), perfect(0))
    expect(state.outcomes[0]!.correct).toBe(false)
    expect(state.outcomes[1]!.correct).toBe(false)
  })

  it('counts a stroke too many as wrong', () => {
    const { state } = send('practice', ...strokes.map((_, n) => perfect(n)), perfect(0))
    expect(state.outcomes).toHaveLength(strokes.length + 1)
    expect(state.outcomes[strokes.length]).toEqual({ correct: false, problem: 'extra' })
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length + 1 })
  })

  it('counts a stroke never written as wrong', () => {
    const { state } = send('practice', perfect(0), perfect(1))
    expect(state.outcomes).toHaveLength(strokes.length)
    expect(state.outcomes[2]).toEqual({ correct: false, problem: 'missing' })
    expect(state.outcomes[3]).toEqual({ correct: false, problem: 'missing' })
  })

  it('marks an お題 wrong when a single stroke was wrong', () => {
    const session = begin('practice', '日')
    session.addStroke(traced(reversed(0)))
    for (let n = 1; n < strokes.length; n++) session.addStroke(traced(perfect(n), n * 1000))
    expect(session.submit().results[0]).toEqual({ character: '日', firstTimeCorrect: false })
  })
})

describe('writing one お題 after another', () => {
  const run = () => begin('practice', '一', '人')

  it('says which お題 of how many is in hand', () => {
    const state = run().state()
    expect(state.position).toBe(1)
    expect(state.chosen).toHaveLength(2)
    expect(state.remaining).toBe(1)
  })

  it('does not move on by itself when an お題 is sent', () => {
    const session = run()
    writeCharacter(session, '一')
    const state = session.submit()
    expect(state.marked).toBe(true)
    expect(state.position).toBe(1)
  })

  it('moves on to the next お題 when told to', () => {
    const session = run()
    writeCharacter(session, '一')
    session.submit()
    const state = session.nextCharacter()
    expect(state.character).toBe('人')
    expect(state.position).toBe(2)
    expect(state.marked).toBe(false)
    expect(state.writtenStrokes).toBe(0)
  })

  it('will not move on until the お題 in hand has been sent', () => {
    const session = run()
    writeCharacter(session, '一')
    expect(session.nextCharacter().character).toBe('一')
  })

  it('is finished as soon as the last お題 has been sent', () => {
    const session = run()
    writeCharacter(session, '一')
    session.submit()
    session.nextCharacter()
    writeCharacter(session, '人')
    const state = session.submit()
    expect(state.phase).toBe('finished')
    // The last お題 stays in hand: it is still on the paper to look at.
    expect(state.character).toBe('人')
  })
})

describe('writing an お題 again', () => {
  const run = () => begin('practice', '日', '一')

  it('hands back a clean square when the learner asks', () => {
    const session = run()
    writeCharacter(session, '日')
    session.submit()
    const state = session.retryCharacter()
    expect(state.character).toBe('日')
    expect(state.writtenStrokes).toBe(0)
    expect(state.marked).toBe(false)
    expect(state.outcomes).toEqual([])
  })

  it('does nothing while the お題 in hand is unsent', () => {
    const session = run()
    session.addStroke(traced(perfect(0)))
    expect(session.retryCharacter().writtenStrokes).toBe(1)
  })

  it('counts the first 送信, however well it goes the second time', () => {
    const session = run()
    session.addStroke(traced(reversed(0)))
    session.submit()
    session.retryCharacter()
    writeCharacter(session, '日')
    const state = session.submit()
    expect(state.results[0]).toEqual({ character: '日', firstTimeCorrect: false })
  })

  it('finishes the run again when the last お題 is sent a second time', () => {
    const session = run()
    writeCharacter(session, '日')
    session.submit()
    session.nextCharacter()
    writeCharacter(session, '一')
    session.submit()
    session.retryCharacter()
    writeCharacter(session, '一')
    const state = session.submit()
    expect(state.phase).toBe('finished')
    expect(state.results).toHaveLength(2)
  })
})

describe('counting a run', () => {
  it('records each お題 as it is sent', () => {
    const session = begin('practice', '日', '一')
    writeCharacter(session, '日')
    expect(session.submit().results).toEqual([{ character: '日', firstTimeCorrect: true }])
  })

  it('counts an お題 as right only when every stroke was right first time', () => {
    const session = begin('practice', '日', '一')
    session.addStroke(traced(reversed(0)))
    session.submit()
    expect(session.state().runScore).toEqual({ correct: 0, total: 2 })
    session.nextCharacter()
    writeCharacter(session, '一')
    expect(session.submit().runScore).toEqual({ correct: 1, total: 2 })
  })
})

describe('a test keeps its marking back', () => {
  const run = () => begin('test', '一', '人')

  it('says nothing when an お題 is sent part way through the run', () => {
    const session = run()
    writeCharacter(session, '一')
    const state = session.submit()
    expect(state.marked).toBe(true)
    expect(state.outcomes).toEqual([])
    expect(state.score).toBeNull()
    expect(state.results).toEqual([])
    expect(state.navigationCharacters).toEqual([])
  })

  it('hands over every result once the run is finished', () => {
    const session = run()
    writeCharacter(session, '一')
    session.submit()
    session.nextCharacter()
    writeCharacter(session, '人')
    const state = session.submit()
    expect(state.phase).toBe('finished')
    expect(state.results).toEqual([
      { character: '一', firstTimeCorrect: true },
      { character: '人', firstTimeCorrect: true },
    ])
  })
})

describe('the hint while writing, which runs one stroke ahead', () => {
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

  it('is already there when the stroke in hand lands on the paper', () => {
    const session = practising()
    session.traceStroke(traced(truncated(0, 0.6)))
    expect(session.addStroke(traced(perfect(0))).navigationStroke).toBe(1)
  })

  it('keeps running ahead as the お題 is written', () => {
    const session = practising()
    session.addStroke(traced(perfect(0)))
    expect(session.traceStroke(traced(truncated(1, 0.6))).navigationStroke).toBe(2)
  })

  it('has nothing to point at beyond the last stroke', () => {
    const session = practising()
    strokes.slice(0, -1).forEach((_, index) => session.addStroke(traced(perfect(index))))
    expect(session.traceStroke(traced(truncated(strokes.length - 1, 0.6))).navigationStroke).toBeNull()
  })

  it('never appears in a test', () => {
    const session = begin('test', '日')
    expect(session.traceStroke(traced(truncated(0, 0.6))).navigationStroke).toBeNull()
  })

  it('stops once the お題 has been sent', () => {
    const { state } = sendAllPerfectly('practice')
    expect(state.navigationStroke).toBeNull()
  })
})

describe('the hint after marking, which shows the answer', () => {
  it('walks the お題 that went wrong', () => {
    const { state } = send('practice', reversed(0))
    expect(state.navigationCharacters).toEqual([0])
  })

  it('walks an お題 with a stroke missing', () => {
    const { state } = send('practice', perfect(0))
    expect(state.navigationCharacters).toEqual([0])
  })

  it('leaves an お題 written correctly alone', () => {
    const { state } = sendAllPerfectly('practice')
    expect(state.navigationCharacters).toEqual([])
  })

  it('says nothing before the お題 has been sent', () => {
    const session = begin('practice', '日')
    expect(session.addStroke(traced(reversed(0))).navigationCharacters).toEqual([])
  })

  it('goes away when the お題 is written again', () => {
    const { session } = send('practice', reversed(0))
    expect(session.retryCharacter().navigationCharacters).toEqual([])
  })
})
