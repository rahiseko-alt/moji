/**
 * Choosing what to write.
 *
 * Kana are laid out as the gojuon table every Japanese classroom uses: one
 * column per row of the syllabary — a, ka, sa, ta, na, ha, ma, ya, ra, wa —
 * read downward through the five vowels, with the gaps left empty where a
 * syllable does not exist. Kanji come easiest first, by stroke count, so
 * working down the grid is also working up in difficulty. Every character is
 * on screen at once: a learner picks by looking, not by scrolling.
 */
import type { ChoicesStore } from '../app/choices'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { HIRAGANA, KANJI_GRADE1, KATAKANA } from '../data/characters'
import { loadStrokeData, type StrokeData } from '../data/stroke-data'
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

const label = (strings: Strings, group: Group): string => strings[group]

/**
 * Pours the kana, which are in syllabary order, into the table column by
 * column, and hands back the cells row by row for the grid to lay out.
 */
function gojuonLayout(characters: readonly string[]): Layout {
  const columns = GOJUON.length
  const cells: (string | null)[] = Array.from({ length: columns * VOWELS }, () => null)
  let next = 0
  for (const [column, vowels] of GOJUON.entries()) {
    for (const vowel of vowels) cells[vowel * columns + column] = characters[next++] ?? null
  }
  return { columns, rows: VOWELS, cells }
}

function layoutOf(group: Group, data: StrokeData | null): Layout {
  if (group === 'hiragana') return gojuonLayout(HIRAGANA)
  if (group === 'katakana') return gojuonLayout(KATAKANA)
  // Fewest strokes first, and alphabetically within a stroke count so the order
  // never shifts around. Before the data arrives, the table order will do.
  const strokes = (character: string): number => data?.characters[character]?.length ?? 0
  const sorted = data
    ? [...KANJI_GRADE1].sort((a, b) => strokes(a) - strokes(b) || a.localeCompare(b, 'ja'))
    : KANJI_GRADE1
  return { ...KANJI_GRID, cells: sorted }
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
      <button type="button" class="chooser__start"></button>
    </div>
    <div class="chooser__list"><div class="chooser__grid"></div></div>`

  const home = requireElement<HTMLButtonElement>(screen, '.chooser__home')
  const groupRow = requireElement<HTMLDivElement>(screen, '.chooser__groups')
  const start = requireElement<HTMLButtonElement>(screen, '.chooser__start')
  const grid = requireElement<HTMLDivElement>(screen, '.chooser__grid')

  let group: Group = 'hiragana'
  let data: StrokeData | null = null
  /** The buttons of the grid on show, so the numbers can be redrawn without rebuilding it. */
  const buttons = new Map<string, HTMLButtonElement>()

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
    for (const [character, button] of buttons) {
      const place = chosen.indexOf(character)
      button.dataset.chosen = String(place !== -1)
      const number = button.firstElementChild as HTMLElement
      number.textContent = place === -1 ? '' : String(place + 1)
    }
    start.disabled = chosen.length === 0
  }

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    home.textContent = strings.home
    start.textContent = strings.start
    for (const [candidate, button] of groupButtons) {
      button.textContent = label(strings, candidate)
      button.setAttribute('aria-pressed', String(candidate === group))
    }

    const { columns, rows, cells } = layoutOf(group, data)
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
        button.append(number, character)
        button.addEventListener('click', () => {
          session.chooseCharacter(character)
          showChosen()
        })
        buttons.set(character, button)
        return button
      }),
    )
    showChosen()
  }

  home.addEventListener('click', onHome)
  start.addEventListener('click', () => {
    if (session.start().phase === 'writing') onStart()
  })

  void loadStrokeData().then((loaded) => {
    data = loaded
    render()
  })

  const unsubscribe = choices.subscribe(render)
  render()
  parent.append(screen)

  return {
    destroy() {
      unsubscribe()
      screen.remove()
    },
  }
}
