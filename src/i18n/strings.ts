/**
 * Every word the interface says, in the four languages the school needs.
 *
 * The Vietnamese and Nepali wordings are drafts awaiting a native speaker's
 * review (see issue #2). Only interface wording lives here: the Japanese being
 * written, and its reading, are never translated.
 */
import type { Language } from '../app/choices'

export type Strings = {
  readonly rotateToLandscape: string
  readonly sources: string
  readonly close: string
  readonly home: string
  readonly quitQuestion: string
  /** Asked when the characters picked out for a run would be thrown away. */
  readonly quitChosenQuestion: string
  /** e.g. "あと7字あります。やめますか" — asked part way through a run. */
  readonly quitRunQuestion: (remaining: number) => string
  readonly yes: string
  readonly no: string
  /** e.g. "10画中8画正解" — how many strokes were right at the first attempt. */
  readonly strokeScore: (correct: number, total: number) => string
  /** Chooses every character of the kind on show, or takes them all back out. */
  readonly all: string
  /** Begins writing the characters that have been chosen. */
  readonly start: string
  /** Sends the お題 to be marked. Nothing is judged before this. */
  readonly submit: string
  /** Goes back to the results from the お題 being looked at. */
  readonly results: string
  /** Leaves the marked お題 for the next one of the run. */
  readonly next: string
  /** Wipes the finished character so it can be written again. */
  readonly retry: string
  /** e.g. "3 / 10" — how far through the run the learner is. */
  readonly progress: (position: number, total: number) => string
  /** e.g. "10字中8字、一発正解" — the whole run, counting characters. */
  readonly runScore: (correct: number, total: number) => string
  readonly hiragana: string
  readonly katakana: string
  readonly kanji: string
}

export const STRINGS: Record<Language, Strings> = {
  ja: {
    rotateToLandscape: 'スマホを横にしてください',
    sources: '出典',
    close: '閉じる',
    home: 'ホーム',
    quitQuestion: 'やめますか',
    quitChosenQuestion: '選んだ字が消えます。やめますか',
    quitRunQuestion: (remaining) => `あと${remaining}字あります。やめますか`,
    yes: 'はい',
    no: 'いいえ',
    strokeScore: (correct, total) => `${total}画中${correct}画正解`,
    all: 'ぜんぶ',
    start: 'はじめる',
    submit: '送信',
    results: 'けっか',
    next: '次へ',
    retry: 'やり直す',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `${total}字中${correct}字、一発正解`,
    hiragana: 'ひらがな',
    katakana: 'カタカナ',
    kanji: '漢字',
  },
  en: {
    rotateToLandscape: 'Please turn your phone sideways',
    sources: 'Sources',
    close: 'Close',
    home: 'Home',
    quitQuestion: 'Stop writing?',
    quitChosenQuestion: 'Your chosen characters will be lost. Stop?',
    quitRunQuestion: (remaining) => `${remaining} characters to go. Stop?`,
    yes: 'Yes',
    no: 'No',
    strokeScore: (correct, total) => `${correct} of ${total} strokes correct`,
    all: 'All',
    start: 'Start',
    submit: 'Send',
    results: 'Results',
    next: 'Next',
    retry: 'Again',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `${correct} of ${total} characters right first time`,
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
  },
  vi: {
    rotateToLandscape: 'Vui lòng xoay ngang điện thoại',
    sources: 'Nguồn',
    close: 'Đóng',
    home: 'Trang đầu',
    quitQuestion: 'Dừng viết?',
    quitChosenQuestion: 'Các chữ đã chọn sẽ mất. Dừng lại?',
    quitRunQuestion: (remaining) => `Còn ${remaining} chữ. Dừng lại?`,
    yes: 'Có',
    no: 'Không',
    strokeScore: (correct, total) => `Đúng ${correct}/${total} nét`,
    all: 'Tất cả',
    start: 'Bắt đầu',
    submit: 'Gửi',
    results: 'Kết quả',
    next: 'Tiếp theo',
    retry: 'Viết lại',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `Đúng ngay lần đầu ${correct}/${total} chữ`,
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
  },
  ne: {
    rotateToLandscape: 'कृपया फोन तेर्सो पार्नुहोस्',
    sources: 'स्रोतहरू',
    close: 'बन्द गर्नुहोस्',
    home: 'गृह',
    quitQuestion: 'लेख्न रोक्ने?',
    quitChosenQuestion: 'छानिएका अक्षरहरू हराउँछन्। रोक्ने?',
    quitRunQuestion: (remaining) => `${remaining} अक्षर बाँकी छन्। रोक्ने?`,
    yes: 'हो',
    no: 'होइन',
    strokeScore: (correct, total) => `${total} मध्ये ${correct} स्ट्रोक सही`,
    all: 'सबै',
    start: 'सुरु',
    submit: 'पठाउनुहोस्',
    results: 'नतिजा',
    next: 'अर्को',
    retry: 'फेरि',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `${total} मध्ये ${correct} अक्षर पहिलो पटकमै सही`,
    hiragana: 'हिरागाना',
    katakana: 'काताकाना',
    kanji: 'कान्जी',
  },
}
