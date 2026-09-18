/**
 * The words a learner is asked to write, and the scenes they belong to.
 *
 * Kept apart from the stroke data on purpose. The strokes come from KanjiVG
 * under a share-alike licence; these words are chosen from the National
 * Institute for Japanese Language and Linguistics' basic vocabulary under a
 * plain attribution licence (ADR 0014). Two licences, two files, so neither
 * condition is read as covering the other.
 */
import type { Language } from '../app/choices'

/** One line of text per language the interface speaks. */
export type PerLanguage = Readonly<Record<Language, string>>

export type Scene = {
  readonly name: PerLanguage
}

export type Word = {
  /** How it is written, which is what the learner writes. 1 to 4 characters. */
  readonly written: string
  /** How it is read, in plain hiragana. Shown, never written. */
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
  readonly scenes: Readonly<Record<string, Scene>>
  readonly words: readonly Word[]
}

let pending: Promise<WordData> | null = null

export function loadWordData(): Promise<WordData> {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/words.json`).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load word data: ${response.status}`)
    return (await response.json()) as WordData
  })
  return pending
}

/** The words of one scene, in the order the data lists them. */
export function wordsOfScene(data: WordData, scene: string): readonly Word[] {
  return data.words.filter((word) => word.scene === scene)
}
