/**
 * The 単語 a learner is asked to write, and the 場面 they belong to.
 *
 * Kept apart from the stroke data on purpose. The strokes come from KanjiVG
 * under a share-alike licence; these words are chosen from the National
 * Institute for Japanese Language and Linguistics' basic vocabulary under a
 * plain attribution licence (ADR 0014). Two licences, two files, so neither
 * condition is read as covering the other.
 */
import type { Language } from '../app/choices'
import { fetchData } from './fetch-json'

/** One line of text per language the interface speaks. */
export type PerLanguage = Readonly<Record<Language, string>>

export type Scene = {
  readonly name: PerLanguage
}

export type Word = {
  /** How it is written, which is what the learner writes. 1 to 4 characters. */
  readonly written: string
  /**
   * How it is read, in kana. Shown, never written, so nothing is asked of it
   * beyond being kana; a word written in katakana reads as itself.
   */
  readonly reading: string
  /** Which scene it belongs to, as a key of `scenes`. */
  readonly scene: string
  readonly meaning: PerLanguage
  /**
   * The Vietnamese and Nepali meanings have not been through a native speaker
   * yet. True until one has seen them. The learner is never told: a warning
   * they cannot act on only undermines the word in front of them.
   */
  readonly draftTranslation: boolean
}

export type WordSource = {
  readonly title: string
  readonly license: string
  readonly url: string
}

export type WordData = {
  readonly sources: readonly WordSource[]
  /**
   * What a reader of the list should know about how it was made: which words
   * are compounds rather than entries in the basic vocabulary, and which scene
   * has no backing at all. Not shown to a learner.
   */
  readonly notes: readonly string[]
  readonly scenes: Readonly<Record<string, Scene>>
  readonly words: readonly Word[]
}

let pending: Promise<WordData> | null = null

export function loadWordData(): Promise<WordData> {
  pending ??= fetchData<WordData>('words.json')
  return pending
}
