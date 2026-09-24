/**
 * Which characters MojiDrill teaches.
 *
 * The kanji are the 80 of the first school year, taken from a Japanese
 * government notification, which carries no copyright (Copyright Act art. 13).
 * Textbook kanji lists are not used: publishers forbid copying them, and which
 * characters a book picks and in what order is itself protected.
 *
 * Kana are the whole modern set: the 46 plain syllables, the 25 that carry a
 * voicing mark, the 10 small ones, and the long vowel mark katakana words need.
 * The mark is only two more strokes to draw, but without it 「でんしゃ」 and
 * 「コンビニ」 cannot be written at all — and those are the words a learner is
 * here for (ADR 0015).
 */
import characters from './characters.json'

/** The 46 plain syllables, in the order the gojuon table reads. */
export const PLAIN_HIRAGANA: readonly string[] = [...characters.hiragana]
export const PLAIN_KATAKANA: readonly string[] = [...characters.katakana]

/** The 25 carrying a voicing mark: が行 to ば行 voiced, then ぱ行 half-voiced. */
export const MARKED_HIRAGANA: readonly string[] = [...characters.hiraganaMarked]
export const MARKED_KATAKANA: readonly string[] = [...characters.katakanaMarked]

/** The 10 written small: the five vowels, ya/yu/yo, the double consonant, wa. */
export const SMALL_HIRAGANA: readonly string[] = [...characters.hiraganaSmall]
export const SMALL_KATAKANA: readonly string[] = [...characters.katakanaSmall]

/** The long vowel mark. Katakana words are full of it; hiragana words are not. */
export const LONG_VOWEL: readonly string[] = [...characters.longVowel]

export const HIRAGANA: readonly string[] = [
  ...PLAIN_HIRAGANA,
  ...MARKED_HIRAGANA,
  ...SMALL_HIRAGANA,
]
export const KATAKANA: readonly string[] = [
  ...PLAIN_KATAKANA,
  ...MARKED_KATAKANA,
  ...SMALL_KATAKANA,
  ...LONG_VOWEL,
]
export const KANJI_GRADE1: readonly string[] = [...characters.kanjiGrade1]

/** Every character the app has stroke data for. */
export const ALL_CHARACTERS: readonly string[] = [...HIRAGANA, ...KATAKANA, ...KANJI_GRADE1]

export const CHARACTER_SOURCES = characters.sources
