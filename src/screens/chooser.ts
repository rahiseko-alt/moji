/**
 * Choosing what to write.
 *
 * Kana come in the order they are taught; kanji come easiest first, by stroke
 * count, so working down the grid is also working up in difficulty. Every
 * character is on screen at once: a learner picks by looking, not by scrolling.
 */
import type { ChoicesStore } from '../app/choices'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { HIRAGANA, KANJI_GRADE1, KATAKANA } from '../data/characters'
import { loadStrokeData, type StrokeData } from '../data/stroke-data'
import { STRINGS, type Strings } from '../i18n/strings'
import './chooser.css'

type Group = 'hiragana' | 'katakana' | 'kanji'

const GROUPS: readonly Group[] = ['hiragana', 'katakana', 'kanji']

/** Chosen so every character of the group lands on screen at a size a finger can hit. */
const GRID: Record<Group, { columns: number; rows: number }> = {
  hiragana: { columns: 12, rows: 4 },
  katakana: { columns: 12, rows: 4 },
  kanji: { columns: 16, rows: 5 },
}

const label = (strings: Strings, group: Group): string => strings[group]

function charactersOf(group: Group, data: StrokeData | null): readonly string[] {
  if (group === 'hiragana') return HIRAGANA
  if (group === 'katakana') return KATAKANA
  // Fewest strokes first, and alphabetically within a stroke count so the order
  // never shifts around. Before the data arrives, the table order will do.
  if (!data) return KANJI_GRADE1
  const strokes = (character: string): number => data.characters[character]?.length ?? 0
  return [...KANJI_GRADE1].sort(
    (a, b) => strokes(a) - strokes(b) || a.localeCompare(b, 'ja'),
  )
}

export function mountChooser(
  parent: HTMLElement,
  choices: ChoicesStore,
  onCharacterChosen: (character: string) => void,
  onHome: () => void,
): Screen {
  const screen = document.createElement('div')
  screen.className = 'chooser'
  screen.innerHTML = `
    <div class="chooser__bar">
      <button type="button" class="chooser__home"></button>
      <div class="chooser__groups" role="group"></div>
    </div>
    <div class="chooser__list"><div class="chooser__grid"></div></div>`

  const home = requireElement<HTMLButtonElement>(screen, '.chooser__home')
  const groupRow = requireElement<HTMLDivElement>(screen, '.chooser__groups')
  const grid = requireElement<HTMLDivElement>(screen, '.chooser__grid')

  let group: Group = 'hiragana'
  let data: StrokeData | null = null

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

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    home.textContent = strings.home
    for (const [candidate, button] of groupButtons) {
      button.textContent = label(strings, candidate)
      button.setAttribute('aria-pressed', String(candidate === group))
    }

    const { columns, rows } = GRID[group]
    grid.style.setProperty('--columns', String(columns))
    grid.style.setProperty('--rows', String(rows))
    grid.replaceChildren(
      ...charactersOf(group, data).map((character) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'chooser__character'
        button.lang = 'ja'
        button.textContent = character
        button.addEventListener('click', () => onCharacterChosen(character))
        return button
      }),
    )
  }

  home.addEventListener('click', onHome)

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
