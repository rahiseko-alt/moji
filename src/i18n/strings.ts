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
  readonly sources: string
  readonly close: string
  readonly home: string
  readonly quitQuestion: string
  readonly yes: string
  readonly no: string
}

export const STRINGS: Record<Language, Strings> = {
  ja: {
    practice: '練習',
    test: 'テスト',
    rotateToLandscape: 'スマホを横にしてください',
    sources: '出典',
    close: '閉じる',
    home: 'ホーム',
    quitQuestion: 'やめますか',
    yes: 'はい',
    no: 'いいえ',
  },
  en: {
    practice: 'Practice',
    test: 'Test',
    rotateToLandscape: 'Please turn your phone sideways',
    sources: 'Sources',
    close: 'Close',
    home: 'Home',
    quitQuestion: 'Stop writing?',
    yes: 'Yes',
    no: 'No',
  },
  vi: {
    practice: 'Luyện tập',
    test: 'Kiểm tra',
    rotateToLandscape: 'Vui lòng xoay ngang điện thoại',
    sources: 'Nguồn',
    close: 'Đóng',
    home: 'Trang đầu',
    quitQuestion: 'Dừng viết?',
    yes: 'Có',
    no: 'Không',
  },
  ne: {
    practice: 'अभ्यास',
    test: 'परीक्षा',
    rotateToLandscape: 'कृपया फोन तेर्सो पार्नुहोस्',
    sources: 'स्रोतहरू',
    close: 'बन्द गर्नुहोस्',
    home: 'गृह',
    quitQuestion: 'लेख्न रोक्ने?',
    yes: 'हो',
    no: 'होइन',
  },
}
