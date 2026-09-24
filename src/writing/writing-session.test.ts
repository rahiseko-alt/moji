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
import { DEFAULT_THRESHOLDS } from './stroke-matcher'
import {
  createWritingSession,
  wrongCells,
  type StrokeOutcome,
  type WritingSession,
  type WritingSessionState,
} from './writing-session'

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

/**
 * The marking of an お題 of one character, which is what all but the last block
 * below writes. The marking lives 升目 by 升目; a single character is a row of one.
 */
const marking = (state: WritingSessionState): readonly StrokeOutcome[] =>
  state.cells[0]?.outcomes ?? []

/** Where the hint is: which 升目 and which stroke of it, or nowhere. */
const hintAt = (state: WritingSessionState): [cell: number, stroke: number] | null => {
  const cell = state.cells.findIndex((at) => at.navigationStroke !== null)
  return cell === -1 ? null : [cell, state.cells[cell]!.navigationStroke!]
}

/** A session that has been given お題 and told to begin. */
const begin = (...characters: readonly string[]) => {
  const session = createWritingSession({ strokesOf })
  for (const character of characters) session.chooseItem(character)
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
const send = (...attempts: readonly Point[][]) => {
  const session = begin('日')
  for (const [n, attempt] of attempts.entries()) session.addStroke(traced(attempt, n * 1000))
  return { session, state: session.submit() }
}

const sendAllPerfectly = () => send(...strokes.map((_, index) => perfect(index)))

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
const ruled = (points: readonly Point[]): Point[] => {
  const from = points[0]!
  const to = points[points.length - 1]!
  return points.map((_, n) => {
    const t = n / (points.length - 1)
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
  })
}

const straightened = (index: number): Point[] => ruled(perfect(index))

/**
 * Part way towards the ruler: 0 leaves the curve alone, 1 flattens it away.
 * A learner's curve is always a little shallower than the model's, so the two
 * ends of this are the two answers the marking has to tell apart.
 */
const flattened = (points: readonly Point[], towards: number): Point[] => {
  const line = ruled(points)
  return points.map(([x, y], n) => [
    x + (line[n]![0] - x) * towards,
    y + (line[n]![1] - y) * towards,
  ])
}

/** Writes a character other than 日, one stroke at a time, and sends it. */
const sendCharacter = (character: string, strokeOf: (index: number) => Point[]) => {
  const session = begin(character)
  for (let n = 0; n < strokesOf(character).length; n++) {
    session.addStroke(traced(strokeOf(n), n * 1000))
  }
  return { session, state: session.submit() }
}

/** い: a long hook down and up, then a short curve. The hook is what makes it い. */
const hiraganaI = (index: number): Point[] => perfectOf('い', index)

describe('choosing what to write', () => {
  const choosing = () => createWritingSession({ strokesOf })

  it('starts with nothing chosen and nothing being written', () => {
    const state = choosing().state()
    expect(state.chosen).toEqual([])
    expect(state.phase).toBe('choosing')
    expect(state.item).toBeNull()
  })

  it('keeps the お題 in the order they were chosen', () => {
    const session = choosing()
    session.chooseItem('人')
    session.chooseItem('日')
    expect(session.chooseItem('一').chosen).toEqual(['人', '日', '一'])
  })

  it('takes an お題 out when it is chosen a second time', () => {
    const session = choosing()
    session.chooseItem('日')
    expect(session.chooseItem('日').chosen).toEqual([])
  })

  it('closes the gap when one in the middle is taken out', () => {
    const session = choosing()
    for (const character of ['人', '日', '一']) session.chooseItem(character)
    expect(session.chooseItem('日').chosen).toEqual(['人', '一'])
  })

  it('holds お題 of every kind at once', () => {
    const session = choosing()
    session.chooseItem('あ')
    session.chooseItem('ア')
    expect(session.chooseItem('日').chosen).toEqual(['あ', 'ア', '日'])
  })

  it('will not begin with nothing chosen', () => {
    expect(choosing().start().phase).toBe('choosing')
  })

  it('begins with the first お題 that was chosen', () => {
    const session = choosing()
    session.chooseItem('人')
    session.chooseItem('日')
    const state = session.start()
    expect(state.phase).toBe('writing')
    expect(state.item).toBe('人')
    expect(state.position).toBe(1)
  })

  it('takes no more お題 once the writing has begun', () => {
    const session = begin('日')
    expect(session.chooseItem('一').chosen).toEqual(['日'])
  })
})

describe('choosing a whole kind at once', () => {
  const choosing = () => createWritingSession({ strokesOf })
  const kana = ['あ', 'い', 'う']

  it('adds them all, in the order they were handed over', () => {
    expect(choosing().chooseAll(kana).chosen).toEqual(kana)
  })

  it('leaves the ones already chosen where they are', () => {
    const session = choosing()
    session.chooseItem('う')
    expect(session.chooseAll(kana).chosen).toEqual(['う', 'あ', 'い'])
  })

  it('takes them all out again when every one is already in', () => {
    const session = choosing()
    session.chooseAll(kana)
    expect(session.chooseAll(kana).chosen).toEqual([])
  })

  it('leaves お題 of another kind alone when it takes them out', () => {
    const session = choosing()
    session.chooseItem('日')
    session.chooseAll(kana)
    expect(session.chooseAll(kana).chosen).toEqual(['日'])
  })
})

describe('writing, before anything is sent', () => {
  it('judges nothing while strokes are being written', () => {
    const session = begin('日')
    const state = session.addStroke(traced(reversed(0)))
    expect(state.marked).toBe(false)
    expect(marking(state)).toEqual([])
    expect(state.score).toBeNull()
  })

  it('keeps every stroke on the paper, right or wrong', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    session.addStroke(traced(perfect(1), 1000))
    expect(session.state().writtenStrokes).toBe(2)
  })

  it('cannot be sent with nothing written', () => {
    const session = begin('日')
    expect(session.state().canSubmit).toBe(false)
    expect(session.submit().marked).toBe(false)
  })

  it('can be sent as soon as one stroke is there', () => {
    const session = begin('日')
    expect(session.addStroke(traced(perfect(0))).canSubmit).toBe(true)
  })

  it('takes no more ink once the お題 has been sent', () => {
    const session = begin('日')
    session.addStroke(traced(perfect(0)))
    session.submit()
    expect(session.addStroke(traced(perfect(1), 1000)).writtenStrokes).toBe(1)
  })
})

describe('sending an お題 written correctly', () => {
  it('marks every stroke right and counts them all', () => {
    const { state } = sendAllPerfectly()
    expect(state.marked).toBe(true)
    expect(marking(state).every((outcome) => outcome.correct)).toBe(true)
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length })
  })

  it('forgives hand wobble', () => {
    const { state } = send(wobbled(0, 2.5))
    expect(marking(state)[0]!.correct).toBe(true)
  })

  it('forgives a properly shaky finger', () => {
    const { state } = send(wobbled(0, 5))
    expect(marking(state)[0]!.correct).toBe(true)
  })

  it('forgives a stroke written a little off centre', () => {
    const { state } = send(shifted(0, 4, 4))
    expect(marking(state)[0]!.correct).toBe(true)
  })

  it('forgives a stroke written well off centre, as a finger writes', () => {
    const { state } = send(shifted(0, 9, 9))
    expect(marking(state)[0]!.correct).toBe(true)
  })

  it('forgives a stroke that stops a fifth short of the end', () => {
    const { state } = send(truncated(0, 0.8))
    expect(marking(state)[0]!.correct).toBe(true)
  })

  it('forgives a curve drawn a little shallower than the model', () => {
    // Nobody traces a hook exactly. Losing some of its depth is still the hook.
    const { state } = sendCharacter('い', (n) =>
      n === 0 ? flattened(hiraganaI(0), 0.4) : hiraganaI(n),
    )
    expect(marking(state).every((outcome) => outcome.correct)).toBe(true)
  })
})

/*
 * The boundary the app is tuned to. Everything above is a way of writing the
 * stroke that deserves a pass; everything here is a way of not writing it.
 * Move a threshold and one of these two groups will tell you.
 */
describe('a stroke that is close but not good enough', () => {
  it('is wrong when it sits out of place inside the character', () => {
    const { state } = send(
      ...strokes.map((_, n) => (n === 2 ? shifted(2, 17, 17) : perfect(n))),
    )
    expect(marking(state)[2]!.correct).toBe(false)
  })

  it('is wrong when it leans noticeably', () => {
    const { state } = send(rotated(0, 45))
    expect(marking(state)[0]!.correct).toBe(false)
  })

  it('is wrong when it stops half way', () => {
    const { state } = send(truncated(0, 0.5))
    expect(marking(state)[0]!.correct).toBe(false)
  })

  it('is wrong when a curve is drawn as a straight line', () => {
    // The second stroke of 日 turns a corner; a ruled line is not that stroke.
    const { state } = send(perfect(0), straightened(1))
    expect(marking(state)[1]!.correct).toBe(false)
  })

  /*
   * い is two strokes that both run down and to the right, so a learner drawing
   * two plain lines lands both ends in the right places and travels the right
   * way. The hook of the first stroke is the only thing that makes it い, and
   * the marking has to be about that rather than about the ends (ADR 0011).
   */
  it('is wrong when い is drawn as two plain lines', () => {
    const { state } = sendCharacter('い', (n) => ruled(hiraganaI(n)))
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'shape' })
  })

  it('is wrong when most of a curve has been flattened away', () => {
    const { state } = sendCharacter('い', (n) =>
      n === 0 ? flattened(hiraganaI(0), 0.7) : hiraganaI(n),
    )
    expect(marking(state)[0]!.correct).toBe(false)
  })

  it('is wrong when a short stroke is put somewhere else in the character', () => {
    // 学's first stroke is a short tick barely 13 long, so 24 across the square
    // puts it nowhere near where it belongs — though the square is 109 wide.
    const { state } = sendCharacter('学', (n) =>
      n === 0 ? perfectOf('学', 0).map(([x, y]) => [x + 24, y] as Point) : perfectOf('学', n),
    )
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'misplaced' })
  })
})

describe('a stroke that is plainly wrong', () => {
  it('is marked as written from the wrong end', () => {
    const { state } = send(reversed(0))
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'backwards' })
  })

  it('is marked as barely moving', () => {
    const { state } = send(truncated(0, 0.15))
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'tooShort' })
  })

  it('is marked as out of place when it starts and ends well away', () => {
    const { state } = send(
      ...strokes.map((_, n) => (n === 0 ? shifted(0, 40, 0) : perfect(n))),
    )
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'misplaced' })
  })

  it('is marked as the wrong shape when it wanders off on the way', () => {
    const { state } = send(
      ...strokes.map((_, n) => (n === 0 ? bulged(0, 35) : perfect(n))),
    )
    expect(marking(state)[0]).toEqual({ correct: false, problem: 'shape' })
  })
})

/*
 * The dotted guide and the model say where the character belongs, so the cell
 * is what a character is marked against (ADR 0013). A finger lands a little
 * either side of that; a character put somewhere else in the cell does not.
 */
describe('the numbers the marking judges by', () => {
  it('uses the ones it is given rather than the shipped ones', () => {
    // 日's first stroke written 30 to the right is out of place by any normal
    // reckoning; told to allow 40, the marking lets it pass.
    const written = () => strokes.map((_, n) => shifted(n, 30, 0))
    const strict = createWritingSession({ strokesOf })
    strict.chooseItem('日')
    strict.start()
    for (const [n, stroke] of written().entries()) strict.addStroke(traced(stroke, n * 1000))
    expect(marking(strict.submit()).some((outcome) => !outcome.correct)).toBe(true)

    const loose = createWritingSession({
      strokesOf,
      thresholds: () => ({ ...DEFAULT_THRESHOLDS, endsFloor: 40, endsCeiling: 40, shapeFloor: 40 }),
    })
    loose.chooseItem('日')
    loose.start()
    for (const [n, stroke] of written().entries()) loose.addStroke(traced(stroke, n * 1000))
    expect(marking(loose.submit()).every((outcome) => outcome.correct)).toBe(true)
  })

  it('reads them afresh for every 送信, so a change part way through counts', () => {
    let allowed = 40
    const session = createWritingSession({
      strokesOf,
      thresholds: () => ({
        ...DEFAULT_THRESHOLDS,
        endsFloor: allowed,
        endsCeiling: allowed,
        shapeFloor: allowed,
      }),
    })
    session.chooseItem('日')
    session.chooseItem('一')
    session.start()
    for (let n = 0; n < strokes.length; n++) session.addStroke(traced(shifted(n, 30, 0), n * 1000))
    expect(marking(session.submit()).every((outcome) => outcome.correct)).toBe(true)
    allowed = 16
    session.nextItem()
    session.addStroke(traced(perfectOf('一', 0).map(([x, y]) => [x + 30, y] as Point)))
    expect(marking(session.submit()).some((outcome) => !outcome.correct)).toBe(true)
  })
})

describe('where in the 升目 the character was written', () => {
  it('passes a character written 12 off centre', () => {
    // A finger lands either side of the dotted guide. Every one of the shipped
    // characters passes at 12; from 13 they start to fail.
    const { state } = send(...strokes.map((_, n) => shifted(n, 12, 0)))
    expect(marking(state).every((outcome) => outcome.correct)).toBe(true)
  })

  it('fails a character written 20 off centre', () => {
    const { state } = send(...strokes.map((_, n) => shifted(n, 20, 0)))
    expect(marking(state).some((outcome) => !outcome.correct)).toBe(true)
  })

  /*
   * The exception, and it is the rule working rather than failing: what a
   * stroke may be out by is a share of its own length, capped at 22, and that
   * cap is what lets a long stroke stop a fifth short and still pass. 一 is one
   * long stroke, so the same budget lets the whole character sit 20 to one side.
   * Tightening the cap costs the honest finger far more than it costs this.
   */
  it('passes 一 written 20 off centre, because it is one long stroke', () => {
    const { state } = sendCharacter('一', (n) =>
      perfectOf('一', n).map(([x, y]) => [x + 20, y] as Point),
    )
    expect(marking(state).every((outcome) => outcome.correct)).toBe(true)
  })

  it('marks a single stroke where the 升目 puts it, not where it was drawn', () => {
    // Before, one stroke on its own was the whole of what was written, and the
    // marking moved it over the model wherever it had been put.
    const { state } = send(shifted(0, 30, 0))
    expect(marking(state)[0]!.correct).toBe(false)
  })

  it('still passes a single stroke written where it belongs', () => {
    const { state } = send(perfect(0))
    expect(marking(state)[0]!.correct).toBe(true)
  })
})

describe('marking what was written against what the お題 needs', () => {
  it('takes the strokes in the order they were written', () => {
    const { state } = send(perfect(1), perfect(0))
    expect(marking(state)[0]!.correct).toBe(false)
    expect(marking(state)[1]!.correct).toBe(false)
  })

  it('counts a stroke too many as wrong', () => {
    const { state } = send(...strokes.map((_, n) => perfect(n)), perfect(0))
    expect(marking(state)).toHaveLength(strokes.length + 1)
    expect(marking(state)[strokes.length]).toEqual({ correct: false, problem: 'extra' })
    expect(state.score).toEqual({ correct: strokes.length, total: strokes.length + 1 })
  })

  it('counts a stroke never written as wrong', () => {
    const { state } = send(perfect(0), perfect(1))
    expect(marking(state)).toHaveLength(strokes.length)
    expect(marking(state)[2]).toEqual({ correct: false, problem: 'missing' })
    expect(marking(state)[3]).toEqual({ correct: false, problem: 'missing' })
  })

  it('marks an お題 wrong when a single stroke was wrong', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    for (let n = 1; n < strokes.length; n++) session.addStroke(traced(perfect(n), n * 1000))
    expect(session.submit().results[0]).toEqual({ item: '日', firstTimeCorrect: false })
  })
})

describe('writing one お題 after another', () => {
  const run = () => begin('一', '人')

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
    const state = session.nextItem()
    expect(state.item).toBe('人')
    expect(state.position).toBe(2)
    expect(state.marked).toBe(false)
    expect(state.writtenStrokes).toBe(0)
  })

  it('will not move on until the お題 in hand has been sent', () => {
    const session = run()
    writeCharacter(session, '一')
    expect(session.nextItem().item).toBe('一')
  })

  it('is finished as soon as the last お題 has been sent', () => {
    const session = run()
    writeCharacter(session, '一')
    session.submit()
    session.nextItem()
    writeCharacter(session, '人')
    const state = session.submit()
    expect(state.phase).toBe('finished')
    // The last お題 stays in hand: it is still on the paper to look at.
    expect(state.item).toBe('人')
  })
})

describe('counting the first 送信 and no other', () => {
  it('keeps the stroke count of the first attempt when the お題 is rewritten', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    for (let n = 1; n < strokes.length; n++) session.addStroke(traced(perfect(n), n * 1000))
    const first = session.submit().score
    expect(first).toEqual({ correct: strokes.length - 1, total: strokes.length })
    session.retryItem()
    writeCharacter(session, '日')
    expect(session.submit().score).toEqual(first)
  })

  it('hands the same count back with the attempt', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    session.submit()
    expect(session.attempt(1)?.score).toEqual({ correct: 0, total: strokes.length })
  })
})

describe('writing an お題 again', () => {
  const run = () => begin('日', '一')

  it('hands back a clean square when the learner asks', () => {
    const session = run()
    writeCharacter(session, '日')
    session.submit()
    const state = session.retryItem()
    expect(state.item).toBe('日')
    expect(state.writtenStrokes).toBe(0)
    expect(state.marked).toBe(false)
    expect(marking(state)).toEqual([])
  })

  it('does nothing while the お題 in hand is unsent', () => {
    const session = run()
    session.addStroke(traced(perfect(0)))
    expect(session.retryItem().writtenStrokes).toBe(1)
  })

  it('counts the first 送信, however well it goes the second time', () => {
    const session = run()
    session.addStroke(traced(reversed(0)))
    session.submit()
    session.retryItem()
    writeCharacter(session, '日')
    const state = session.submit()
    expect(state.results[0]).toEqual({ item: '日', firstTimeCorrect: false })
  })

  it('finishes the run again when the last お題 is sent a second time', () => {
    const session = run()
    writeCharacter(session, '日')
    session.submit()
    session.nextItem()
    writeCharacter(session, '一')
    session.submit()
    session.retryItem()
    writeCharacter(session, '一')
    const state = session.submit()
    expect(state.phase).toBe('finished')
    expect(state.results).toHaveLength(2)
  })
})

describe('looking back at what was written', () => {
  it('keeps what was written for each お題 of the run', () => {
    const session = begin('日', '一')
    writeCharacter(session, '日')
    session.submit()
    session.nextItem()
    writeCharacter(session, '一')
    session.submit()
    expect(session.attempt(1)?.item).toBe('日')
    expect(session.attempt(1)?.cells[0]?.written).toHaveLength(strokes.length)
    expect(session.attempt(2)?.item).toBe('一')
  })

  it('carries the marking with it', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    session.submit()
    expect(session.attempt(1)?.cells[0]?.outcomes[0]).toEqual({ correct: false, problem: 'backwards' })
  })

  it('replaces it when the お題 is written again', () => {
    const session = begin('日')
    session.addStroke(traced(reversed(0)))
    session.submit()
    session.retryItem()
    writeCharacter(session, '日')
    session.submit()
    expect(session.attempt(1)?.cells[0]?.written).toHaveLength(strokes.length)
    expect(session.attempt(1)?.cells[0]?.outcomes.every((outcome) => outcome.correct)).toBe(true)
  })

  it('has nothing for an お題 that has not been sent', () => {
    const session = begin('日', '一')
    writeCharacter(session, '日')
    expect(session.attempt(1)).toBeNull()
    expect(session.attempt(2)).toBeNull()
  })
})

describe('counting a run', () => {
  it('records each お題 as it is sent', () => {
    const session = begin('日', '一')
    writeCharacter(session, '日')
    expect(session.submit().results).toEqual([{ item: '日', firstTimeCorrect: true }])
  })

  it('counts an お題 as right only when every stroke was right first time', () => {
    const session = begin('日', '一')
    session.addStroke(traced(reversed(0)))
    session.submit()
    expect(session.state().runScore).toEqual({ correct: 0, total: 2 })
    session.nextItem()
    writeCharacter(session, '一')
    expect(session.submit().runScore).toEqual({ correct: 1, total: 2 })
  })
})

describe('the hint while writing, which runs one stroke ahead', () => {
  const writing = () => begin('日')

  it('points at the first stroke before the learner has put a finger down', () => {
    expect(hintAt(writing().state())).toEqual([0, 0])
  })

  it('stays on it while that stroke has barely begun', () => {
    const session = writing()
    expect(hintAt(session.traceStroke(traced(truncated(0, 0.2))))).toEqual([0, 0])
  })

  it('points at the next stroke once the one in hand is half written', () => {
    const session = writing()
    expect(hintAt(session.traceStroke(traced(truncated(0, 0.6))))).toEqual([0, 1])
  })

  it('is already there when the stroke in hand lands on the paper', () => {
    const session = writing()
    session.traceStroke(traced(truncated(0, 0.6)))
    expect(hintAt(session.addStroke(traced(perfect(0))))).toEqual([0, 1])
  })

  it('keeps running ahead as the お題 is written', () => {
    const session = writing()
    session.addStroke(traced(perfect(0)))
    expect(hintAt(session.traceStroke(traced(truncated(1, 0.6))))).toEqual([0, 2])
  })

  it('has nothing to point at beyond the last stroke', () => {
    const session = writing()
    strokes.slice(0, -1).forEach((_, index) => session.addStroke(traced(perfect(index))))
    expect(hintAt(session.traceStroke(traced(truncated(strokes.length - 1, 0.6))))).toBeNull()
  })

  it('stops once the お題 has been sent', () => {
    const { state } = sendAllPerfectly()
    expect(hintAt(state)).toBeNull()
  })
})

describe('the hint after marking, which shows the answer', () => {
  it('walks the 升目 that went wrong', () => {
    const { state } = send(reversed(0))
    expect(wrongCells(state.cells)).toEqual([0])
  })

  it('walks a 升目 with a stroke missing', () => {
    const { state } = send(perfect(0))
    expect(wrongCells(state.cells)).toEqual([0])
  })

  it('leaves an お題 written correctly alone', () => {
    const { state } = sendAllPerfectly()
    expect(wrongCells(state.cells)).toEqual([])
  })

  it('says nothing before the お題 has been sent', () => {
    const session = begin('日')
    expect(wrongCells(session.addStroke(traced(reversed(0))).cells)).toEqual([])
  })

  it('goes away when the お題 is written again', () => {
    const { session } = send(reversed(0))
    expect(wrongCells(session.retryItem().cells)).toEqual([])
  })
})

describe('an お題 that is a 単語 rather than one character', () => {
  /** 日本: four strokes in the first 升目, five in the second. */
  const word = () => begin('日本')

  /** Writes one character perfectly into the 升目 it belongs in. */
  const writeCell = (session: WritingSession, cell: number, character: string) => {
    let state = session.state()
    for (let n = 0; n < strokesOf(character).length; n++) {
      state = session.addStroke(traced(perfectOf(character, n), n * 1000), cell)
    }
    return state
  }

  it('puts one 升目 up per character, in reading order', () => {
    expect(word().state().cells.map((cell) => cell.character)).toEqual(['日', '本'])
  })

  it('takes each stroke into the 升目 it was drawn in', () => {
    const session = word()
    session.addStroke(traced(perfectOf('本', 0)), 1)
    const state = session.state()
    expect(state.cells[0]!.writtenStrokes).toBe(0)
    expect(state.cells[1]!.writtenStrokes).toBe(1)
    expect(state.writtenStrokes).toBe(1)
  })

  it('ignores a stroke drawn in a 升目 the お題 does not have', () => {
    const session = word()
    expect(session.addStroke(traced(perfect(0)), 2).writtenStrokes).toBe(0)
  })

  it('marks each 升目 against its own character', () => {
    const session = word()
    writeCell(session, 0, '日')
    // 日 written again into the 升目 that asked for 本: a character of the お題,
    // but not the one this 升目 wants.
    writeCell(session, 1, '日')
    const state = session.submit()
    expect(state.cells[0]!.outcomes.every((outcome) => outcome.correct)).toBe(true)
    // Wrong from its very first stroke, rather than merely short of one.
    expect(state.cells[1]!.outcomes[0]!.correct).toBe(false)
    expect(state.cells[1]!.outcomes[0]!.problem).not.toBe('missing')
  })

  it('is 一発正解 only when every 升目 was right', () => {
    const session = word()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    expect(session.submit().results).toEqual([{ item: '日本', firstTimeCorrect: true }])
  })

  it('counts a 単語 with one 升目 wrong as wrong, whole', () => {
    const session = word()
    writeCell(session, 0, '日')
    session.addStroke(traced(reversed(0)), 1)
    expect(session.submit().results[0]!.firstTimeCorrect).toBe(false)
  })

  it('counts every 升目 towards the お題, not only the first', () => {
    const session = word()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    const state = session.submit()
    const strokes = strokesOf('日').length + strokesOf('本').length
    expect(state.writtenStrokes).toBe(strokes)
    expect(state.score).toEqual({ correct: strokes, total: strokes })
  })

  it('counts a 升目 left empty as strokes missing', () => {
    const session = word()
    writeCell(session, 0, '日')
    const state = session.submit()
    expect(state.score).toEqual({
      correct: strokesOf('日').length,
      total: strokesOf('日').length + strokesOf('本').length,
    })
    expect(state.cells[1]!.outcomes.every((outcome) => outcome.problem === 'missing')).toBe(true)
  })

  it('can be sent with only one 升目 written', () => {
    const session = word()
    expect(session.state().canSubmit).toBe(false)
    expect(session.addStroke(traced(perfect(0)), 0).canSubmit).toBe(true)
  })

  it('leads the hint into the next 升目 from the middle of the last stroke', () => {
    const session = word()
    for (let n = 0; n < strokesOf('日').length - 1; n++) {
      session.addStroke(traced(perfectOf('日', n), n * 1000), 0)
    }
    const last = strokesOf('日').length - 1
    // Half way through 日's fourth stroke: the first 升目 is as good as done, so
    // the hint is already showing where 本 begins.
    expect(hintAt(session.traceStroke(traced(truncated(last, 0.6)), 0))).toEqual([1, 0])
  })

  it('runs one stroke ahead inside a later 升目 too', () => {
    const session = word()
    writeCell(session, 0, '日')
    session.addStroke(traced(perfectOf('本', 0)), 1)
    const half = perfectOf('本', 1).slice(0, 10)
    expect(hintAt(session.traceStroke(traced(half), 1))).toEqual([1, 2])
  })

  it('moves on to the next お題 with every 升目 wiped', () => {
    const session = createWritingSession({ strokesOf })
    session.chooseItem('日本')
    session.chooseItem('一')
    session.start()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    session.submit()
    const state = session.nextItem()
    expect(state.item).toBe('一')
    expect(state.cells.map((cell) => cell.character)).toEqual(['一'])
    expect(state.writtenStrokes).toBe(0)
  })

  it('keeps the first 送信 as the tally when it is written again', () => {
    const session = word()
    writeCell(session, 0, '日')
    session.addStroke(traced(reversed(0)), 1)
    session.submit()
    session.retryItem()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    const state = session.submit()
    expect(state.results[0]!.firstTimeCorrect).toBe(false)
    expect(state.runScore).toEqual({ correct: 0, total: 1 })
    // What is on the paper now is the second attempt, right this time.
    expect(session.attempt(1)?.cells[1]!.outcomes.every((outcome) => outcome.correct)).toBe(true)
  })

  it('starts the hint in the first 升目 and nowhere else', () => {
    const state = word().state()
    expect(state.cells[0]!.navigationStroke).toBe(0)
    expect(state.cells[1]!.navigationStroke).toBeNull()
  })

  it('moves the hint along once a 升目 is full', () => {
    const session = word()
    const state = writeCell(session, 0, '日')
    expect(state.cells[0]!.navigationStroke).toBeNull()
    expect(state.cells[1]!.navigationStroke).toBe(0)
  })

  it('does not let a stroke drawn ahead walk the hint on', () => {
    const session = word()
    // Tracing in the second 升目 while the first is still empty: the hint stays
    // where the learner is being led.
    const state = session.traceStroke(traced(truncated(0, 0.6)), 1)
    expect(state.cells[0]!.navigationStroke).toBe(0)
  })

  it('walks the answer only through the 升目 that went wrong', () => {
    const session = word()
    writeCell(session, 0, '日')
    session.addStroke(traced(reversed(0)), 1)
    expect(wrongCells(session.submit().cells)).toEqual([1])
  })

  it('keeps what was written in each 升目 to look back at', () => {
    const session = word()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    session.submit()
    const attempt = session.attempt(1)
    expect(attempt?.cells.map((cell) => cell.character)).toEqual(['日', '本'])
    expect(attempt?.cells[0]!.written).toHaveLength(strokesOf('日').length)
    expect(attempt?.cells[1]!.written).toHaveLength(strokesOf('本').length)
  })

  it('wipes every 升目 when the お題 is written again', () => {
    const session = word()
    writeCell(session, 0, '日')
    writeCell(session, 1, '本')
    session.submit()
    const state = session.retryItem()
    expect(state.writtenStrokes).toBe(0)
    expect(state.cells.every((cell) => cell.outcomes.length === 0)).toBe(true)
  })
})
