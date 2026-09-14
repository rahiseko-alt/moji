/**
 * MojiDrill is a landscape app: three writing cells side by side do not fit a
 * phone held upright at a size a finger can write in. Rather than shrink the
 * cells, we ask the learner to turn the phone and hold everything until they do.
 */
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './choices'
import { requireElement } from './dom'
import { STRINGS } from '../i18n/strings'
import './orientation-gate.css'

const PHONE_ICON = `
<svg class="orientation-gate__phone" viewBox="0 0 48 80" fill="none" aria-hidden="true">
  <rect x="4" y="2" width="40" height="76" rx="6" stroke="currentColor" stroke-width="3" />
  <line x1="18" y1="70" x2="30" y2="70" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>`

export type OrientationGate = {
  /** Re-orders the messages so the learner's own language comes first. */
  setLanguage(language: Language): void
}

/**
 * @param appRoot the element to make unreachable while the phone is upright
 */
export function mountOrientationGate(appRoot: HTMLElement): OrientationGate {
  const gate = document.createElement('div')
  gate.className = 'orientation-gate'
  gate.hidden = true
  gate.setAttribute('role', 'alertdialog')
  gate.innerHTML = `${PHONE_ICON}<ul class="orientation-gate__messages"></ul>`
  const messages = requireElement<HTMLUListElement>(gate, '.orientation-gate__messages')
  document.body.append(gate)

  const renderMessages = (first: Language): void => {
    const order = [first, ...LANGUAGES.filter((language) => language !== first)]
    messages.replaceChildren(
      ...order.map((language) => {
        const item = document.createElement('li')
        item.lang = language
        item.textContent = STRINGS[language].rotateToLandscape
        return item
      }),
    )
  }

  const portrait = window.matchMedia('(orientation: portrait)')
  const apply = (): void => {
    gate.hidden = !portrait.matches
    appRoot.inert = portrait.matches
  }

  portrait.addEventListener('change', apply)
  renderMessages(DEFAULT_LANGUAGE)
  apply()

  return { setLanguage: renderMessages }
}
