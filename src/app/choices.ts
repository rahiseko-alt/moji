/**
 * What the learner picked on the cover: the language the interface speaks, and
 * whether they are practising or being tested.
 *
 * Deliberately held in memory only. The app takes no account, stores no
 * personal data, and remembers nothing between visits (see issue #2), so there
 * is no localStorage, cookie or query parameter behind this.
 */

export const LANGUAGES = ['ja', 'en', 'vi', 'ne'] as const
export type Language = (typeof LANGUAGES)[number]

/** Each language names itself, so a learner can find their own without reading Japanese. */
export const LANGUAGE_ENDONYMS: Record<Language, string> = {
  ja: '日本語',
  en: 'English',
  vi: 'Tiếng Việt',
  ne: 'नेपाली',
}

/** A learner who picks nothing still gets a working app. */
export const DEFAULT_LANGUAGE: Language = 'ja'

export const MODES = ['practice', 'test'] as const
export type Mode = (typeof MODES)[number]

export type Choices = {
  readonly language: Language
  /** Null until the learner taps 練習 or テスト on the cover. */
  readonly mode: Mode | null
}

export type ChoicesStore = {
  get(): Choices
  setLanguage(language: Language): void
  setMode(mode: Mode): void
  subscribe(listener: (choices: Choices) => void): () => void
}

export function createChoices(): ChoicesStore {
  let choices: Choices = { language: DEFAULT_LANGUAGE, mode: null }
  const listeners = new Set<(choices: Choices) => void>()

  const update = (next: Choices): void => {
    choices = next
    for (const listener of listeners) listener(choices)
  }

  return {
    get: () => choices,
    setLanguage: (language) => update({ ...choices, language }),
    setMode: (mode) => update({ ...choices, mode }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
