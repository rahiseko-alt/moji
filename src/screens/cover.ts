/**
 * The cover: the first thing a learner sees after scanning the classroom QR
 * code. It carries the school's seal, and asks for the only thing the app needs
 * before it can start — which language to speak.
 */
import { LANGUAGES, LANGUAGE_ENDONYMS, type ChoicesStore, type Language } from '../app/choices'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { mountCredits } from './credits'
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
        <button type="button" class="cover__start">START</button>
      </div>
    </div>`

  const credits = mountCredits(requireElement<HTMLElement>(screen, '.cover__frame'), choices)

  const languageRow = requireElement<HTMLDivElement>(screen, '.cover__languages')
  const start = requireElement<HTMLButtonElement>(screen, '.cover__start')

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

  // The one word on the cover that is not translated: a learner who cannot yet
  // read any of the four languages can still see where to press.
  start.addEventListener('click', onStart)

  const render = (): void => {
    const { language } = choices.get()
    for (const [candidate, button] of languageButtons) {
      button.setAttribute('aria-pressed', String(candidate === language))
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
