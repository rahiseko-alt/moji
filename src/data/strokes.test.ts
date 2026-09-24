/**
 * The shipped stroke data has to be complete and sane before anything can be
 * drawn or scored, and it is produced by a script rather than written by hand.
 * These tests check the artefact, not the script.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ALL_CHARACTERS,
  charactersFor,
  HIRAGANA,
  KANJI_GRADE1,
  KATAKANA,
  LONG_VOWEL,
  MARKED_HIRAGANA,
  MARKED_KATAKANA,
  PLAIN_HIRAGANA,
  PLAIN_KATAKANA,
  SMALL_HIRAGANA,
  SMALL_KATAKANA,
} from './characters'
import type { StrokeData } from './stroke-data'
import type { WordData } from './word-data'

const data = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
const words = JSON.parse(readFileSync('assets/data/words.json', 'utf8')) as WordData
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

/*
 * The kana, transcribed here independently of src/data/characters.json so the
 * list is compared against something other than itself.
 */
const PLAIN_HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
const PLAIN_KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
/** The 20 voiced, then the 5 half-voiced. */
const MARKED_HIRA = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'
const MARKED_KATA = 'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'
/** The five small vowels, small ya/yu/yo, the double consonant, small wa. */
const SMALL_HIRA = 'ぁぃぅぇぉゃゅょっゎ'
const SMALL_KATA = 'ァィゥェォャュョッヮ'

const sorted = (characters: Iterable<string>): string[] => [...characters].sort()

describe('the characters the app teaches', () => {
  it('has exactly the 80 kanji of the first school year', () => {
    expect(FIRST_YEAR_KANJI).toHaveLength(80)
    expect(sorted(KANJI_GRADE1)).toEqual(sorted(FIRST_YEAR_KANJI))
    expect(new Set(KANJI_GRADE1).size).toBe(80)
  })

  it('has the 46 plain syllables of each kana, in the order the table reads', () => {
    expect([...PLAIN_HIRAGANA].join('')).toBe(PLAIN_HIRA)
    expect([...PLAIN_KATAKANA].join('')).toBe(PLAIN_KATA)
  })

  it('has the 25 marked and the 10 small of each kana', () => {
    expect([...MARKED_HIRAGANA].join('')).toBe(MARKED_HIRA)
    expect([...MARKED_KATAKANA].join('')).toBe(MARKED_KATA)
    expect([...SMALL_HIRAGANA].join('')).toBe(SMALL_HIRA)
    expect([...SMALL_KATAKANA].join('')).toBe(SMALL_KATA)
  })

  // Written words need these: でんしゃ and コンビニ cannot be spelled without
  // them, whatever the strokes of the plain syllable already taught (ADR 0015).
  it('teaches every kana a modern word can be written with', () => {
    expect(sorted(HIRAGANA)).toEqual(sorted(PLAIN_HIRA + MARKED_HIRA + SMALL_HIRA))
    expect(sorted(KATAKANA)).toEqual(sorted(PLAIN_KATA + MARKED_KATA + SMALL_KATA + 'ー'))
    expect(LONG_VOWEL).toEqual(['ー'])
  })

  it('carries stroke data for every one of them, and every one a 単語 needs, and nothing spare', () => {
    const needed = charactersFor(words.words)
    expect(Object.keys(data.characters).sort()).toEqual([...needed].sort())
    for (const character of ALL_CHARACTERS) expect(needed).toContain(character)
  })
})

/*
 * Nearly nine thousand strokes, so each check walks them all once and collects
 * what fails, then asserts on the list: an empty list passes, and a failing
 * one names every offending stroke at once. Asserting point by point made
 * hundreds of thousands of assertions and ran past the time limit.
 */
const everyStroke = function* () {
  for (const [character, strokes] of entries) {
    for (const [index, stroke] of strokes.entries()) {
      yield { name: `${character} stroke ${index + 1}`, stroke }
    }
  }
}

describe('every stroke', () => {
  it('belongs to a character that has at least one', () => {
    expect(entries.filter(([, strokes]) => strokes.length === 0).map(([character]) => character)).toEqual([])
  })

  it('has the same number of points as every other', () => {
    const wrong = [...everyStroke()]
      .filter(({ stroke }) => stroke.median.length !== data.pointsPerStroke)
      .map(({ name }) => name)
    expect(wrong).toEqual([])
  })

  it('stays inside the square the coordinates are defined in', () => {
    const inside = (value: number): boolean => value >= 0 && value <= data.viewBox
    const outside = [...everyStroke()]
      .filter(({ stroke }) => stroke.median.some(([x, y]) => !inside(x) || !inside(y)))
      .map(({ name }) => name)
    expect(outside).toEqual([])
  })

  it('goes somewhere, rather than collapsing to a point', () => {
    const collapsed = [...everyStroke()]
      .filter(({ stroke }) => {
        const [first] = stroke.median
        return !stroke.median.some(([x, y]) => Math.hypot(x - first![0], y - first![1]) > 1)
      })
      .map(({ name }) => name)
    expect(collapsed).toEqual([])
  })

  it('keeps the path it was sampled from', () => {
    const pathless = [...everyStroke()]
      .filter(({ stroke }) => !/^[Mm]/.test(stroke.d))
      .map(({ name }) => name)
    expect(pathless).toEqual([])
  })
})

describe('stroke counts follow Japanese school convention', () => {
  // Spot checks where other stroke-order datasets are known to disagree.
  it.each([
    ['あ', 3],
    ['き', 4],
    ['ん', 1],
    // A mark is drawn, not implied: が is か plus its two, ぱ is は plus the ring.
    ['が', 5],
    ['ぱ', 4],
    ['っ', 1],
    ['ー', 1],
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
