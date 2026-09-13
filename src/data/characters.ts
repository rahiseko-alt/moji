/**
 * Which characters MojiDrill teaches.
 *
 * The kanji are the 80 of the first school year, taken from a Japanese
 * government notification, which carries no copyright (Copyright Act art. 13).
 * Textbook kanji lists are not used: publishers forbid copying them, and which
 * characters a book picks and in what order is itself protected.
 *
 * Kana are the 46 plain syllables only. Voiced marks and small kana are written
 * with the same strokes plus a mark, so they are not a separate thing to learn.
 */
import characters from './characters.json'

export const HIRAGANA: readonly string[] = [...characters.hiragana]
export const KATAKANA: readonly string[] = [...characters.katakana]
export const KANJI_GRADE1: readonly string[] = [...characters.kanjiGrade1]

/** Every character the app has stroke data for. */
export const ALL_CHARACTERS: readonly string[] = [...HIRAGANA, ...KATAKANA, ...KANJI_GRADE1]

export const CHARACTER_SOURCES = characters.sources
