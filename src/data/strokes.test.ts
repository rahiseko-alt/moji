/**
 * The shipped stroke data has to be complete and sane before anything can be
 * drawn or scored, and it is produced by a script rather than written by hand.
 * These tests check the artefact, not the script.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_CHARACTERS, HIRAGANA, KANJI_GRADE1, KATAKANA } from './characters'
import type { StrokeData } from './stroke-data'

const data = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
const entries = Object.entries(data.characters)

describe('the characters the app teaches', () => {
  it('has the 80 kanji of the first school year, and no others', () => {
    expect(KANJI_GRADE1).toHaveLength(80)
    expect(new Set(KANJI_GRADE1).size).toBe(80)
  })

  it('has 46 hiragana and 46 katakana', () => {
    expect(HIRAGANA).toHaveLength(46)
    expect(KATAKANA).toHaveLength(46)
    expect(new Set(HIRAGANA).size).toBe(46)
    expect(new Set(KATAKANA).size).toBe(46)
  })

  it('carries stroke data for every one of them, and nothing spare', () => {
    expect(Object.keys(data.characters).sort()).toEqual([...ALL_CHARACTERS].sort())
  })
})

describe('every stroke', () => {
  it('belongs to a character that has at least one', () => {
    for (const [character, strokes] of entries) {
      expect(strokes.length, character).toBeGreaterThan(0)
    }
  })

  it('has the same number of points as every other', () => {
    for (const [character, strokes] of entries) {
      for (const [index, stroke] of strokes.entries()) {
        expect(stroke.median.length, `${character} stroke ${index + 1}`).toBe(data.pointsPerStroke)
      }
    }
  })

  it('stays inside the square the coordinates are defined in', () => {
    for (const [character, strokes] of entries) {
      for (const [index, stroke] of strokes.entries()) {
        for (const [x, y] of stroke.median) {
          expect(x, `${character} stroke ${index + 1}`).toBeGreaterThanOrEqual(0)
          expect(x, `${character} stroke ${index + 1}`).toBeLessThanOrEqual(data.viewBox)
          expect(y, `${character} stroke ${index + 1}`).toBeGreaterThanOrEqual(0)
          expect(y, `${character} stroke ${index + 1}`).toBeLessThanOrEqual(data.viewBox)
        }
      }
    }
  })

  it('goes somewhere, rather than collapsing to a point', () => {
    for (const [character, strokes] of entries) {
      for (const [index, stroke] of strokes.entries()) {
        const [first] = stroke.median
        const last = stroke.median[stroke.median.length - 1]
        const spread = Math.max(
          ...stroke.median.map(([x, y]) => Math.hypot(x - first![0], y - first![1])),
        )
        expect(spread, `${character} stroke ${index + 1} from ${first} to ${last}`).toBeGreaterThan(1)
      }
    }
  })

  it('keeps the path it was sampled from', () => {
    for (const [character, strokes] of entries) {
      for (const [index, stroke] of strokes.entries()) {
        expect(stroke.d, `${character} stroke ${index + 1}`).toMatch(/^[Mm]/)
      }
    }
  })
})

describe('stroke counts follow Japanese school convention', () => {
  // Spot checks where other stroke-order datasets are known to disagree.
  it.each([
    ['あ', 3],
    ['き', 4],
    ['ん', 1],
    ['日', 4],
    ['学', 8],
    ['森', 12],
    ['一', 1],
  ])('%s is %i strokes', (character, count) => {
    expect(data.characters[character]).toHaveLength(count)
  })
})

describe('attribution', () => {
  it('names KanjiVG and its licence, as KanjiVG requires', () => {
    expect(data.attribution).toContain('KanjiVG')
    expect(data.attribution).toContain('kanjivg.tagaini.net')
    expect(data.license).toBe('CC BY-SA 3.0')
  })
})
