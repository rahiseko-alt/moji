/**
 * The shipped word data has to be complete and sane before a learner can be
 * asked to write any of it. Which words are in the list is the school's choice
 * and changes; these tests check that whatever is in there is usable — every
 * character writable, every meaning present, no word listed twice.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../app/choices'
import { KANJI_GRADE1 } from './characters'
import type { StrokeData } from './stroke-data'
import type { WordData } from './word-data'

const words = JSON.parse(readFileSync('assets/data/words.json', 'utf8')) as WordData
const strokes = JSON.parse(readFileSync('assets/data/strokes.json', 'utf8')) as StrokeData
const joyo = JSON.parse(readFileSync('src/data/joyo-kanji.json', 'utf8')) as { kanji: string }
const JOYO = new Set(joyo.kanji)

const isKanji = (character: string): boolean => /\p{Script=Han}/u.test(character)

const entries = words.words
const scenes = words.scenes

/**
 * A reading is read, never written, so nothing is asked of it beyond being
 * kana. A word written in katakana reads as itself, so katakana counts. What it
 * must not be is kanji or romaji.
 */
const KANA = /^[\u3041-\u3096\u30A1-\u30FA\u30FC]+$/

describe('the scenes a word can belong to', () => {
  it('has the thirteen the school chose', () => {
    expect(Object.keys(scenes)).toHaveLength(13)
  })

  it('has a hundred words in each', () => {
    for (const id of Object.keys(scenes)) {
      expect(entries.filter((word) => word.scene === id), id).toHaveLength(100)
    }
  })

  it('names every scene in all four languages', () => {
    for (const [id, scene] of Object.entries(scenes)) {
      for (const language of LANGUAGES) {
        expect(scene.name[language], `${id} in ${language}`).toBeTruthy()
      }
    }
  })
})

describe('the list as a whole', () => {
  it('has the thirteen hundred words the school asked for', () => {
    expect(entries).toHaveLength(1300)
  })

  it('says how it was made, including what could not be backed up', () => {
    expect(words.notes.length).toBeGreaterThan(0)
    for (const note of words.notes) expect(note).toBeTruthy()
  })
})

describe('every word', () => {
  it('is at most four characters', () => {
    for (const word of entries) expect(word.written.length, word.written).toBeLessThanOrEqual(4)
  })

  it('is written only in characters the app can teach', () => {
    for (const word of entries) {
      for (const character of word.written) {
        expect(strokes.characters[character], `${word.written} needs ${character}`).toBeDefined()
      }
    }
  })

  // A kanji beyond the first year is there because a 単語 needs it, and it has
  // to be one the government lists for everyday writing — not a rare one that
  // happens to have strokes in KanjiVG (ADR 0017).
  it('uses only kanji from the 常用漢字表', () => {
    for (const word of entries) {
      for (const character of word.written) {
        if (isKanji(character)) expect(JOYO.has(character), `${word.written} uses ${character}`).toBe(true)
      }
    }
  })

  it('has a reading written in kana', () => {
    for (const word of entries) {
      expect(word.reading, word.written).toMatch(KANA)
    }
  })

  it('belongs to one of the scenes', () => {
    for (const word of entries) {
      expect(scenes[word.scene], `${word.written} is in "${word.scene}"`).toBeDefined()
    }
  })

  it('has a meaning in all four languages', () => {
    for (const word of entries) {
      for (const language of LANGUAGES) {
        expect(word.meaning[language], `${word.written} in ${language}`).toBeTruthy()
      }
    }
  })

  it('appears only once', () => {
    const written = entries.map((word) => word.written)
    expect(new Set(written).size).toBe(written.length)
  })
})

describe('the 常用漢字表 the kanji are drawn from', () => {
  it('has its 2,136 kanji, once each, the first-year ones among them', () => {
    expect([...joyo.kanji]).toHaveLength(2136)
    expect(JOYO.size).toBe(2136)
    for (const character of KANJI_GRADE1) expect(JOYO.has(character), character).toBe(true)
  })
})

describe('where the words came from', () => {
  it('says so, with a licence and an address', () => {
    for (const source of words.sources) {
      expect(source.title).toBeTruthy()
      expect(source.license).toBeTruthy()
      expect(source.url).toMatch(/^https?:\/\//)
    }
    expect(words.sources.length).toBeGreaterThan(0)
  })
})
