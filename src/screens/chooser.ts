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
 */
import type { ChoicesStore } from '../app/choices'
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
import { STRINGS, type Strings } from '../i18n/strings'
import type { WritingSession } from '../writing/writing-session'
import './chooser.css'

type Group = 'hiragana' | 'katakana' | 'kanji'

const GROUPS: readonly Group[] = ['hiragana', 'katakana', 'kanji']

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
function charactersOf(group: Group, data: StrokeData | null): readonly string[] {
  if (group === 'hiragana') return HIRAGANA
  if (group === 'katakana') return KATAKANA
  // Fewest strokes first, and alphabetically within a stroke count so the order
  // never shifts around. Before the data arrives, the table order will do.
  const strokes = (character: string): number => data?.characters[character]?.length ?? 0
  return data
    ? [...KANJI_GRADE1].sort((a, b) => strokes(a) - strokes(b) || a.localeCompare(b, 'ja'))
    : KANJI_GRADE1
}

function layoutOf(group: Group, data: StrokeData | null): Layout {
  if (group === 'kanji') return { ...KANJI_GRID, cells: charactersOf(group, data) }
  return kanaLayout(KANA[group])
}

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
    <div class="chooser__list"><div class="chooser__grid"></div></div>`

  const home = requireElement<HTMLButtonElement>(screen, '.chooser__home')
  const groupRow = requireElement<HTMLDivElement>(screen, '.chooser__groups')
  const all = requireElement<HTMLButtonElement>(screen, '.chooser__all')
  const start = requireElement<HTMLButtonElement>(screen, '.chooser__start')
  const grid = requireElement<HTMLDivElement>(screen, '.chooser__grid')

  const confirm = createConfirm()
  let group: Group = 'hiragana'
  /** The character buttons on show, with their number, so those can be redrawn alone. */
  const buttons = new Map<string, { button: HTMLButtonElement; number: HTMLElement }>()

  const groupButtons = new Map<Group, HTMLButtonElement>()
  for (const candidate of GROUPS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chooser__group'
    button.addEventListener('click', () => {
      group = candidate
      render()
    })
    groupButtons.set(candidate, button)
    groupRow.append(button)
  }

  /**
   * The number a character carries is its place in the run, so taking one out
   * renumbers everything behind it. Cheap enough to redraw them all.
   */
  const showChosen = (): void => {
    const { chosen } = session.state()
    for (const [character, { button, number }] of buttons) {
      const place = chosen.indexOf(character)
      button.setAttribute('aria-pressed', String(place !== -1))
      number.textContent = place === -1 ? '' : String(place + 1)
    }
    // Without the stroke data there is nothing to write, so the way on stays shut.
    start.disabled = chosen.length === 0 || strokeDataIfLoaded() === null
  }

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    home.textContent = strings.home
    all.textContent = strings.all
    start.textContent = strings.start
    confirm.setAnswers(strings.yes, strings.no)
    for (const [candidate, button] of groupButtons) {
      button.textContent = label(strings, candidate)
      button.setAttribute('aria-pressed', String(candidate === group))
    }

    const { columns, rows, cells } = layoutOf(group, strokeDataIfLoaded())
    buttons.clear()
    grid.style.setProperty('--columns', String(columns))
    grid.style.setProperty('--rows', String(rows))
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
    showChosen()
  }

  // The whole kind on show, in the order it is taught — not the order the
  // table happens to read in.
  all.addEventListener('click', () => {
    session.chooseAll(charactersOf(group, strokeDataIfLoaded()))
    showChosen()
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
