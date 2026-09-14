/**
 * The cover: the first thing a learner sees after scanning the classroom QR
 * code. It carries the school's seal, and asks for the only two things the app
 * needs before it can start — which language to speak, and whether this is
 * practice or a test.
 */
import {
  LANGUAGES,
  LANGUAGE_ENDONYMS,
  MODES,
  type ChoicesStore,
  type Language,
  type Mode,
} from '../app/choices'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { mountCredits } from './credits'
import { STRINGS } from '../i18n/strings'
import './cover.css'

export function mountCover(
  parent: HTMLElement,
  choices: ChoicesStore,
  onStart: () => void,
): Screen {
  const screen = document.createElement('div')
  screen.className = 'cover'
  screen.innerHTML = `
    <div class="cover__frame">
      <div class="cover__controls">
        <div class="cover__languages" role="group"></div>
        <div class="cover__modes" role="group"></div>
      </div>
    </div>`

  const credits = mountCredits(requireElement<HTMLElement>(screen, '.cover__frame'), choices)

  const languageRow = requireElement<HTMLDivElement>(screen, '.cover__languages')
  const modeRow = requireElement<HTMLDivElement>(screen, '.cover__modes')

  const languageButtons = new Map<Language, HTMLButtonElement>()
  for (const language of LANGUAGES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cover__language'
    button.lang = language
    button.textContent = LANGUAGE_ENDONYMS[language]
    button.addEventListener('click', () => choices.setLanguage(language))
    languageButtons.set(language, button)
    languageRow.append(button)
  }

  const modeButtons = new Map<Mode, HTMLButtonElement>()
  for (const mode of MODES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cover__mode'
    button.addEventListener('click', () => {
      choices.setMode(mode)
      onStart()
    })
    modeButtons.set(mode, button)
    modeRow.append(button)
  }

  const render = (): void => {
    const { language, mode } = choices.get()
    for (const [candidate, button] of languageButtons) {
      button.setAttribute('aria-pressed', String(candidate === language))
    }
    for (const [candidate, button] of modeButtons) {
      button.lang = language
      button.textContent = STRINGS[language][candidate]
      button.setAttribute('aria-pressed', String(candidate === mode))
    }
  }

  const unsubscribe = choices.subscribe(render)
  render()
  parent.append(screen)

  return {
    destroy() {
      unsubscribe()
      credits.destroy()
      screen.remove()
    },
  }
}
