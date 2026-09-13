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

/*
 * Transcribed independently of src/data/characters.json, from the Ministry of
 * Education's own table, and left in that table's order rather than the app's.
 * Comparing the app's list against itself would prove nothing; this is the
 * second witness.
 *
 * https://www.mext.go.jp/a_menu/shotou/new-cs/__icsFiles/afieldfile/2017/05/15/1385768.pdf
 */
const FIRST_YEAR_KANJI =
  '一円右雨火王音花下貝学気九休玉金空月犬見五口校左三山糸子四七字耳車手十女出小上森水人正青生夕石赤千川先草早足村大男中虫竹町天田土二年日入白八百文木本名目立林力六'

/** The 46 plain syllables, in the order they are taught. */
const PLAIN_HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
const PLAIN_KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

const sorted = (characters: Iterable<string>): string[] => [...characters].sort()

describe('the characters the app teaches', () => {
  it('has exactly the 80 kanji of the first school year', () => {
    expect(FIRST_YEAR_KANJI).toHaveLength(80)
    expect(sorted(KANJI_GRADE1)).toEqual(sorted(FIRST_YEAR_KANJI))
    expect(new Set(KANJI_GRADE1).size).toBe(80)
  })

  it('has exactly the 46 plain hiragana and the 46 plain katakana', () => {
    expect(sorted(HIRAGANA)).toEqual(sorted(PLAIN_HIRAGANA))
    expect(sorted(KATAKANA)).toEqual(sorted(PLAIN_KATAKANA))
  })

  it('leaves out voiced marks and small kana, which add a mark rather than strokes', () => {
    const notPlain = [...'がざだばぱぁぃゃっガザダバパァィャッ']
    for (const character of notPlain) {
      expect([...HIRAGANA, ...KATAKANA], character).not.toContain(character)
    }
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
