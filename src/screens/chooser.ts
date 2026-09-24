/**
 * Choosing what to write.
 *
 * Kana are laid out as the gojuon table every Japanese classroom uses: one
 * column per row of the syllabary — a, ka, sa, ta, na, ha, ma, ya, ra, wa —
 * read downward through the five vowels, with the gaps left empty where a
 * syllable does not exist. The marked kana (ga, za, da, ba, pa) follow as five
 * more columns of the same shape, and after them the small kana and the long
 * mark, which belong to no vowel and are simply listed. Kanji come easiest
 * first, by stroke count, so working down the grid is also working up in
 * difficulty. Every character is on screen at once: a learner picks by
 * looking, not by scrolling.
 *
 * ことば is the same screen one level deeper. The twelve 場面 come first,
 * because a learner reaches for a word by remembering where they will need it,
 * and opening one puts its ten 単語 in the same grid. A 単語 joins the run the
 * way a 字 does — the run is a line of お題, and an お題 is whatever was tapped
 * (ADR 0008).
 */
import type { ChoicesStore, Language } from '../app/choices'
import { createConfirm } from '../app/confirm'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import {
  HIRAGANA,
  KANJI_GRADE1,
  KATAKANA,
  LONG_VOWEL,
  MARKED_HIRAGANA,
  MARKED_KATAKANA,
  PLAIN_HIRAGANA,
  PLAIN_KATAKANA,
  SMALL_HIRAGANA,
  SMALL_KATAKANA,
} from '../data/characters'
import { loadStrokeData, strokeDataIfLoaded, type StrokeData } from '../data/stroke-data'
import { loadWordData, type Scene, type Word, type WordData } from '../data/word-data'
import { STRINGS, type Strings } from '../i18n/strings'
import type { WritingSession } from '../writing/writing-session'
import './chooser.css'

type Group = 'hiragana' | 'katakana' | 'kanji' | 'words'

/** The kinds that are a table of 字. ことば is picked a 場面 at a time instead. */
type CharacterGroup = Exclude<Group, 'words'>

const GROUPS: readonly Group[] = ['hiragana', 'katakana', 'kanji', 'words']

/** A grid to lay out, row by row. A null is a hole in the table, left empty. */
type Layout = {
  readonly columns: number
  readonly rows: number
  readonly cells: readonly (string | null)[]
}

/** The five vowels, so each column of the kana table is one row of the syllabary. */
const VOWELS = 5

/**
 * One entry per column of the kana table, saying which vowels that column has.
 * ya has only a, u and o; wa has only a and o; n stands on its own at the end.
 */
const GOJUON: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4], // a
  [0, 1, 2, 3, 4], // ka
  [0, 1, 2, 3, 4], // sa
  [0, 1, 2, 3, 4], // ta
  [0, 1, 2, 3, 4], // na
  [0, 1, 2, 3, 4], // ha
  [0, 1, 2, 3, 4], // ma
  [0, 2, 4], // ya
  [0, 1, 2, 3, 4], // ra
  [0, 4], // wa
  [4], // n
]

/** Chosen so every character of the group lands on screen at a size a finger can hit. */
const KANJI_GRID = { columns: 16, rows: 5 }

/**
 * How wide the tiles of ことば are laid out. How many rows follows from how many
 * there are: the word list says how many 場面 and how many 単語 each holds, and
 * a second count of it here would be a second thing to get wrong.
 */
const SCENE_COLUMNS = 4
const WORD_COLUMNS = 5

/** A grid that many columns wide, with enough rows for everything to fit. */
const tiles = (count: number, columns: number): { columns: number; rows: number } => ({
  columns,
  rows: Math.max(1, Math.ceil(count / columns)),
})

/** One kind of kana, in the blocks the table is built from. */
type KanaBlocks = {
  readonly plain: readonly string[]
  readonly marked: readonly string[]
  readonly small: readonly string[]
  readonly long: readonly string[]
}

const KANA: Readonly<Record<'hiragana' | 'katakana', KanaBlocks>> = {
  hiragana: {
    plain: PLAIN_HIRAGANA,
    marked: MARKED_HIRAGANA,
    small: SMALL_HIRAGANA,
    long: [],
  },
  katakana: {
    plain: PLAIN_KATAKANA,
    marked: MARKED_KATAKANA,
    small: SMALL_KATAKANA,
    long: LONG_VOWEL,
  },
}

const label = (strings: Strings, group: Group): string => strings[group]

/** One column of the table, top to bottom, with holes where it runs out. */
const column = (characters: readonly string[]): (string | null)[] =>
  Array.from({ length: VOWELS }, (_, vowel) => characters[vowel] ?? null)

/**
 * Pours the kana into the table column by column, and hands back the cells row
 * by row for the grid to lay out.
 */
function kanaLayout(blocks: KanaBlocks): Layout {
  const columns: (string | null)[][] = []
  let next = 0
  for (const vowels of GOJUON) {
    const cells = column([])
    for (const vowel of vowels) cells[vowel] = blocks.plain[next++] ?? null
    columns.push(cells)
  }
  // The marked kana are five whole rows of the syllabary, so they read down
  // through the vowels exactly like the columns before them.
  for (let at = 0; at < blocks.marked.length; at += VOWELS) {
    columns.push(column(blocks.marked.slice(at, at + VOWELS)))
  }
  // The small kana and the long mark have no vowel of their own. They are
  // listed in columns of the same height, so the table stays one grid.
  for (let at = 0; at < blocks.small.length; at += VOWELS) {
    columns.push(column(blocks.small.slice(at, at + VOWELS)))
  }
  if (blocks.long.length > 0) columns.push(column(blocks.long))

  const cells: (string | null)[] = []
  for (let vowel = 0; vowel < VOWELS; vowel++) {
    for (const cell of columns) cells.push(cell[vowel] ?? null)
  }
  return { columns: columns.length, rows: VOWELS, cells }
}

/** The characters of one kind, in the order they are taught and shown. */
function charactersOf(group: CharacterGroup, data: StrokeData | null): readonly string[] {
  if (group === 'hiragana') return HIRAGANA
  if (group === 'katakana') return KATAKANA
  // Fewest strokes first, and alphabetically within a stroke count so the order
  // never shifts around. Before the data arrives, the table order will do.
  const strokes = (character: string): number => data?.characters[character]?.length ?? 0
  return data
    ? [...KANJI_GRADE1].sort((a, b) => strokes(a) - strokes(b) || a.localeCompare(b, 'ja'))
    : KANJI_GRADE1
}

function layoutOf(group: CharacterGroup, data: StrokeData | null): Layout {
  if (group === 'kanji') return { ...KANJI_GRID, cells: charactersOf(group, data) }
  return kanaLayout(KANA[group])
}

/** The 単語 of one 場面, in the order the word list puts them. */
const wordsOf = (data: WordData, scene: string): readonly Word[] =>
  data.words.filter((word) => word.scene === scene)

export function mountChooser(
  parent: HTMLElement,
  choices: ChoicesStore,
  session: WritingSession,
  onStart: () => void,
  onHome: () => void,
): Screen {
  const screen = document.createElement('div')
  screen.className = 'chooser'
  screen.innerHTML = `
    <div class="chooser__bar">
      <button type="button" class="chooser__home"></button>
      <div class="chooser__groups" role="group"></div>
      <div class="chooser__actions">
        <button type="button" class="chooser__all"></button>
        <button type="button" class="chooser__start"></button>
      </div>
    </div>
    <div class="chooser__scene" hidden>
      <button type="button" class="chooser__back"></button>
      <h2 class="chooser__scene-name"></h2>
    </div>
    <div class="chooser__list"><div class="chooser__grid"></div></div>`

  const home = requireElement<HTMLButtonElement>(screen, '.chooser__home')
  const groupRow = requireElement<HTMLDivElement>(screen, '.chooser__groups')
  const all = requireElement<HTMLButtonElement>(screen, '.chooser__all')
  const start = requireElement<HTMLButtonElement>(screen, '.chooser__start')
  const sceneBar = requireElement<HTMLDivElement>(screen, '.chooser__scene')
  const back = requireElement<HTMLButtonElement>(screen, '.chooser__back')
  const sceneName = requireElement<HTMLHeadingElement>(screen, '.chooser__scene-name')
  const grid = requireElement<HTMLDivElement>(screen, '.chooser__grid')

  const confirm = createConfirm()
  let group: Group = 'hiragana'
  /** Whose 単語 are on show, or null while the twelve 場面 are. */
  let openScene: string | null = null
  /** The 単語 land after the screen is first drawn, exactly as the strokes do. */
  let words: WordData | null = null
  /** The お題 buttons on show, with their number, so those can be redrawn alone. */
  const buttons = new Map<string, { button: HTMLButtonElement; number: HTMLElement }>()

  const groupButtons = new Map<Group, HTMLButtonElement>()
  for (const candidate of GROUPS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chooser__group'
    button.addEventListener('click', () => {
      group = candidate
      // Coming back to ことば starts at the 場面 again. A learner who left the
      // words behind is asking where to look, not carrying on down a list.
      openScene = null
      render()
    })
    groupButtons.set(candidate, button)
    groupRow.append(button)
  }

  /**
   * The 場面 whose 単語 are on show, with them, or null when the twelve 場面 are.
   * One answer to "where are we in ことば", so the grid, ぜんぶ and the 場面 bar
   * cannot disagree about it.
   */
  const sceneOnShow = (): { scene: Scene; words: readonly Word[] } | null => {
    if (words === null || openScene === null) return null
    const scene = words.scenes[openScene]
    return scene === undefined ? null : { scene, words: wordsOf(words, openScene) }
  }

  /**
   * The number an お題 carries is its place in the run, so taking one out
   * renumbers everything behind it. Cheap enough to redraw them all.
   */
  const showChosen = (): void => {
    const { chosen } = session.state()
    for (const [item, { button, number }] of buttons) {
      const place = chosen.indexOf(item)
      button.setAttribute('aria-pressed', String(place !== -1))
      number.textContent = place === -1 ? '' : String(place + 1)
    }
    // Without the stroke data there is nothing to write, so the way on stays shut.
    start.disabled = chosen.length === 0 || strokeDataIfLoaded() === null
  }

  /**
   * Sizes the grid for what is about to go in it. Tiles are the 場面 and 単語 of
   * ことば, which fill the space they are given; the kana table's squares do not.
   */
  const setGrid = ({ columns, rows }: { columns: number; rows: number }, asTiles: boolean): void => {
    grid.className = asTiles ? 'chooser__grid chooser__grid--tiles' : 'chooser__grid'
    grid.style.setProperty('--columns', String(columns))
    grid.style.setProperty('--rows', String(rows))
  }

  const drawCharacters = (kind: CharacterGroup): void => {
    const { columns, rows, cells } = layoutOf(kind, strokeDataIfLoaded())
    setGrid({ columns, rows }, false)
    grid.replaceChildren(
      ...cells.map((character) => {
        if (character === null) {
          const gap = document.createElement('span')
          gap.className = 'chooser__gap'
          gap.setAttribute('aria-hidden', 'true')
          return gap
        }
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'chooser__character'
        button.lang = 'ja'
        const number = document.createElement('span')
        number.className = 'chooser__number'
        // The character is what the button is called; its place in the run is
        // said by the pressed state, so the number must not join the name.
        number.setAttribute('aria-hidden', 'true')
        button.append(number, character)
        button.addEventListener('click', () => {
          session.chooseItem(character)
          showChosen()
        })
        buttons.set(character, { button, number })
        return button
      }),
    )
  }

  /** One 場面, named in the learner's own language — the Japanese is what they write. */
  const sceneButton = (id: string, scene: Scene, language: Language): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chooser__scene-tile'
    button.lang = language
    button.textContent = scene.name[language]
    button.addEventListener('click', () => {
      openScene = id
      render()
    })
    return button
  }

  /**
   * A 単語 as it is written, with what it means underneath. The meaning is
   * there to pick by, not to learn: it is said once, small, in one language.
   */
  const wordButton = (word: Word, language: Language): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chooser__word'
    const number = document.createElement('span')
    number.className = 'chooser__number'
    number.setAttribute('aria-hidden', 'true')
    const written = document.createElement('span')
    written.className = 'chooser__written'
    written.lang = 'ja'
    written.textContent = word.written
    const meaning = document.createElement('span')
    meaning.className = 'chooser__meaning'
    meaning.lang = language
    meaning.textContent = word.meaning[language]
    button.append(number, written, meaning)
    button.addEventListener('click', () => {
      session.chooseItem(word.written)
      showChosen()
    })
    buttons.set(word.written, { button, number })
    return button
  }

  const drawWords = (strings: Strings, language: Language): void => {
    if (words === null) {
      // The 単語 are still on their way; the fetch draws the screen again.
      grid.replaceChildren()
      return
    }
    const showing = sceneOnShow()
    if (showing === null) {
      const scenes = Object.entries(words.scenes)
      setGrid(tiles(scenes.length, SCENE_COLUMNS), true)
      grid.replaceChildren(...scenes.map(([id, each]) => sceneButton(id, each, language)))
      return
    }
    back.textContent = strings.back
    sceneName.textContent = showing.scene.name[language]
    sceneName.lang = language
    sceneBar.hidden = false
    setGrid(tiles(showing.words.length, WORD_COLUMNS), true)
    grid.replaceChildren(...showing.words.map((word) => wordButton(word, language)))
  }

  const render = (): void => {
    const { language } = choices.get()
    const strings = STRINGS[language]
    home.textContent = strings.home
    all.textContent = strings.all
    start.textContent = strings.start
    confirm.setAnswers(strings.yes, strings.no)
    for (const [candidate, button] of groupButtons) {
      button.textContent = label(strings, candidate)
      button.setAttribute('aria-pressed', String(candidate === group))
    }

    buttons.clear()
    sceneBar.hidden = true
    if (group === 'words') drawWords(strings, language)
    else drawCharacters(group)
    // A 場面 is not an お題, so with the twelve on show ぜんぶ has nothing to take.
    all.disabled = group === 'words' && sceneOnShow() === null
    showChosen()
  }

  // The whole kind on show, in the order it is taught — not the order the
  // table happens to read in. Inside a 場面 that kind is its ten 単語.
  all.addEventListener('click', () => {
    if (group === 'words') {
      const showing = sceneOnShow()
      if (showing === null) return
      session.chooseAll(showing.words.map((word) => word.written))
    } else session.chooseAll(charactersOf(group, strokeDataIfLoaded()))
    showChosen()
  })

  // Leaving a 場面 keeps whatever was chosen in it: the run is built across
  // 場面 as freely as across the kana table.
  back.addEventListener('click', () => {
    openScene = null
    render()
  })

  // Choosing thirty characters is work of its own, so it is not thrown away
  // on one tap. With nothing chosen there is nothing to ask about.
  home.addEventListener('click', () => {
    const strings = STRINGS[choices.get().language]
    if (session.state().chosen.length === 0) onHome()
    else confirm.ask(strings.quitChosenQuestion, onHome)
  })
  start.addEventListener('click', () => {
    if (session.start().phase === 'writing') onStart()
  })

  // The kanji are ordered by stroke count, so the grid is drawn again once the
  // data lands — and only then can a run begin.
  void loadStrokeData().then(() => render())
  // The 場面 and their 単語 arrive the same way. Fetched whether or not ことば
  // is tapped, so that the grid is ready the moment it is.
  void loadWordData().then((data) => {
    words = data
    render()
  })

  const unsubscribe = choices.subscribe(render)
  render()
  parent.append(screen)

  return {
    destroy() {
      unsubscribe()
      confirm.destroy()
      screen.remove()
    },
  }
}
