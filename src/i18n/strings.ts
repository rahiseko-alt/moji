/**
 * Every word the interface says, in the languages the school's learners speak —
 * with one deliberate exception: the cover's START. A learner who cannot yet read
 * any of them has to be able to see where to press, so that one word is the same
 * everywhere and lives in the cover's own markup.
 *
 * Every wording but the Japanese and English is a draft awaiting a native
 * speaker's review (see issue #2). Only interface wording lives here: the Japanese being
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
  /**
   * The tile at the head of the 場面 that opens every 場面's 単語 in one list, so
   * a run can be picked from all of them without going in and out of each.
   */
  readonly everyScene: string
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
    everyScene: 'すべての場面',
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
    everyScene: 'Every scene',
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
    everyScene: 'Tất cả chủ đề',
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
    everyScene: 'सबै विषय',
  },  my: {
    rotateToLandscape: 'ဖုန်းကို အလျားလိုက် လှည့်ပေးပါ',
    sources: 'ကိုးကားချက်',
    close: 'ပိတ်ရန်',
    home: 'ပင်မ',
    quitQuestion: 'ရေးတာ ရပ်မလား။',
    quitChosenQuestion: 'ရွေးထားတာတွေ ပျောက်သွားပါမယ်။ ရပ်မလား။',
    quitRunQuestion: (remaining) => `နောက်ထပ် ${remaining} ခု ကျန်ပါသေးတယ်။ ရပ်မလား။`,
    yes: 'ဟုတ်ကဲ့',
    no: 'မဟုတ်ပါ',
    correct: 'မှန်',
    incorrect: 'မှား',
    all: 'အားလုံး',
    start: 'စမယ်',
    submit: 'ပြီးပြီ',
    results: 'ရလဒ်',
    next: 'နောက်တစ်ခု',
    retry: 'ပြန်ရေး',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `မှန် ${correct}/${total}`,
    hiragana: 'ဟီရာဂါနာ',
    katakana: 'ခါတာခါနာ',
    kanji: 'ခန်ဂျိ',
    words: 'စကားလုံး',
    back: 'နောက်သို့',
    everyScene: 'အကြောင်းအရာ အားလုံး',
  },
  si: {
    rotateToLandscape: 'කරුණාකර දුරකථනය තිරස් අතට හරවන්න',
    sources: 'මූලාශ්‍ර',
    close: 'වසන්න',
    home: 'මුල් පිටුව',
    quitQuestion: 'ලිවීම නවත්වන්නද?',
    quitChosenQuestion: 'ඔබ තෝරාගත් දේ නැති වේ. නවත්වන්නද?',
    quitRunQuestion: (remaining) => `තව ${remaining}ක් ඉතිරියි. නවත්වන්නද?`,
    yes: 'ඔව්',
    no: 'නැත',
    correct: 'නිවැරදියි',
    incorrect: 'වැරදියි',
    all: 'සියල්ල',
    start: 'අරඹන්න',
    submit: 'අවසන්',
    results: 'ප්‍රතිඵල',
    next: 'ඊළඟ',
    retry: 'නැවත',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `නිවැරදි ${correct}/${total}`,
    hiragana: 'හිරගනා',
    katakana: 'කතකනා',
    kanji: 'කන්ජි',
    words: 'වචන',
    back: 'ආපසු',
    everyScene: 'සියලු මාතෘකා',
  },
  bn: {
    rotateToLandscape: 'অনুগ্রহ করে ফোনটি আড়াআড়ি করুন',
    sources: 'উৎস',
    close: 'বন্ধ করুন',
    home: 'হোম',
    quitQuestion: 'লেখা বন্ধ করবেন?',
    quitChosenQuestion: 'আপনার বাছাই করা সব মুছে যাবে। বন্ধ করবেন?',
    quitRunQuestion: (remaining) => `আরও ${remaining}টি বাকি আছে। বন্ধ করবেন?`,
    yes: 'হ্যাঁ',
    no: 'না',
    correct: 'সঠিক',
    incorrect: 'ভুল',
    all: 'সব',
    start: 'শুরু',
    submit: 'শেষ',
    results: 'ফলাফল',
    next: 'পরবর্তী',
    retry: 'আবার',
    progress: (position, total) => `${position} / ${total}`,
    runScore: (correct, total) => `সঠিক ${correct}/${total}`,
    hiragana: 'হিরাগানা',
    katakana: 'কাতাকানা',
    kanji: 'কানজি',
    words: 'শব্দ',
    back: 'ফিরে যান',
    everyScene: 'সব বিষয়',
  },
}
