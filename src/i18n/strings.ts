/**
 * Every word the interface says, in the four languages the school needs.
 *
 * The Vietnamese and Nepali wordings are drafts awaiting a native speaker's
 * review (see issue #2). Only interface wording lives here: the Japanese being
 * written, and its reading, are never translated.
 */
import type { Language } from '../app/choices'

export type Strings = {
  readonly practice: string
  readonly test: string
  readonly rotateToLandscape: string
}

export const STRINGS: Record<Language, Strings> = {
  ja: {
    practice: '練習',
    test: 'テスト',
    rotateToLandscape: 'スマホを横にしてください',
  },
  en: {
    practice: 'Practice',
    test: 'Test',
    rotateToLandscape: 'Please turn your phone sideways',
  },
  vi: {
    practice: 'Luyện tập',
    test: 'Kiểm tra',
    rotateToLandscape: 'Vui lòng xoay ngang điện thoại',
  },
  ne: {
    practice: 'अभ्यास',
    test: 'परीक्षा',
    rotateToLandscape: 'कृपया फोन तेर्सो पार्नुहोस्',
  },
}
