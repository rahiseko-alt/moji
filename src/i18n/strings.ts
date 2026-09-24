/**
 * Every word the interface says, in the four languages the school needs — with
 * one deliberate exception: the cover's START. A learner who cannot yet read any
 * of the four has to be able to see where to press, so that one word is the same
 * everywhere and lives in the cover's own markup.
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
  /** Asked when the お題 picked out for a run would be thrown away. */
  readonly quitChosenQuestion: string
  /**
   * e.g. "あと7つあります。やめますか" — asked part way through a run. It counts お題,
   * which may be single characters or whole 単語, so it names neither.
   */
  readonly quitRunQuestion: (remaining: number) => string
  readonly yes: string
  readonly no: string
  /**
   * How the お題 just sent went. It is one or the other: every stroke right at
   * the first 確定, or not. A count of strokes says nothing a learner can act
   * on — the red ink already shows which ones went wrong.
   */
  readonly correct: string
  readonly incorrect: string
  /** Chooses everything on show — a kind of 字, or one 場面's 単語 — or takes it all back out. */
  readonly all: string
  /** Begins writing the お題 that have been chosen. */
  readonly start: string
  /** Sends the お題 to be marked. Nothing is judged before this. */
  readonly submit: string
  /** Goes back to the results from the お題 being looked at. */
  readonly results: string
  /** Leaves the marked お題 for the next one of the run. */
  readonly next: string
  /** Wipes the finished お題 so it can be written again. */
  readonly retry: string
  /** e.g. "3 / 10" — how far through the run the learner is. */
  readonly progress: (position: number, total: number) => string
  /**
   * e.g. "正解 8/10" — the whole run, counting お題. It counts 一発正解 only, but
   * the learner is never told that in those words: what the tally means is shown
   * by the ○ and × beside each お題, not explained in a label. The お題 are listed
   * right under it, so the count needs no unit of its own.
   */
  readonly runScore: (correct: number, total: number) => string
  readonly hiragana: string
  readonly katakana: string
  readonly kanji: string
  /** The fourth kind to choose from: whole 単語, gathered by 場面, instead of single 字. */
  readonly words: string
  /** Leaves the 単語 of one 場面 for the list of 場面 again. */
  readonly back: string
}

export const STRINGS: Record<Language, Strings> = {
  ja: {
    rotateToLandscape: 'スマホを横にしてください',
    sources: '出典',
    close: '閉じる',
    home: 'ホーム',
    quitQuestion: 'やめますか',
    quitChosenQuestion: '選んだものが消えます。やめますか',
    quitRunQuestion: (remaining) => `あと${remaining}つあります。やめますか`,
    yes: 'はい',
    no: 'いいえ',
    correct: '正解',
    incorrect: '不正解',
    all: 'ぜんぶ',
    start: 'はじめる',
    submit: '確定',
    results: 'けっか',
    next: '次へ',
    retry: 'やり直す',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `正解 ${correct}/${total}`,
    hiragana: 'ひらがな',
    katakana: 'カタカナ',
    kanji: '漢字',
    words: 'ことば',
    back: 'もどる',
  },
  en: {
    rotateToLandscape: 'Please turn your phone sideways',
    sources: 'Sources',
    close: 'Close',
    home: 'Home',
    quitQuestion: 'Stop writing?',
    quitChosenQuestion: 'What you chose will be lost. Stop?',
    quitRunQuestion: (remaining) => `${remaining} more to write. Stop?`,
    yes: 'Yes',
    no: 'No',
    correct: 'Correct',
    incorrect: 'Not correct',
    all: 'All',
    start: 'Start',
    submit: 'Done',
    results: 'Results',
    next: 'Next',
    retry: 'Again',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `Correct ${correct}/${total}`,
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
    words: 'Words',
    back: 'Back',
  },
  vi: {
    rotateToLandscape: 'Vui lòng xoay ngang điện thoại',
    sources: 'Nguồn',
    close: 'Đóng',
    home: 'Trang đầu',
    quitQuestion: 'Dừng viết?',
    quitChosenQuestion: 'Những gì bạn đã chọn sẽ mất. Dừng lại?',
    quitRunQuestion: (remaining) => `Còn ${remaining} phần nữa. Dừng lại?`,
    yes: 'Có',
    no: 'Không',
    correct: 'Đúng',
    incorrect: 'Chưa đúng',
    all: 'Tất cả',
    start: 'Bắt đầu',
    submit: 'Xong',
    results: 'Kết quả',
    next: 'Tiếp theo',
    retry: 'Viết lại',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `Đúng ${correct}/${total}`,
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
    words: 'Từ vựng',
    back: 'Quay lại',
  },
  ne: {
    rotateToLandscape: 'कृपया फोन तेर्सो पार्नुहोस्',
    sources: 'स्रोतहरू',
    close: 'बन्द गर्नुहोस्',
    home: 'गृह',
    quitQuestion: 'लेख्न रोक्ने?',
    quitChosenQuestion: 'छानिएका कुराहरू हराउँछन्। रोक्ने?',
    quitRunQuestion: (remaining) => `अझै ${remaining} लेख्न बाँकी छ। रोक्ने?`,
    yes: 'हो',
    no: 'होइन',
    correct: 'सही',
    incorrect: 'गलत',
    all: 'सबै',
    start: 'सुरु',
    submit: 'सकियो',
    results: 'नतिजा',
    next: 'अर्को',
    retry: 'फेरि',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `सही ${correct}/${total}`,
    hiragana: 'हिरागाना',
    katakana: 'काताकाना',
    kanji: 'कान्जी',
    words: 'शब्दहरू',
    back: 'पछाडि',
  },
}
