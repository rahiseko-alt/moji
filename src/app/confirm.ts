/**
 * The only question the app ever asks: whether to throw away what a learner
 * has built up. Both the chooser (a run half chosen) and the writing screen
 * (a run half written) have something to lose, so the card lives here rather
 * than in either of them.
 */
import { requireElement } from './dom'
import './confirm.css'

export type Confirm = {
  /** Puts the question up. Answering yes runs `onYes`; answering no puts it away. */
  ask(question: string, onYes: () => void): void
  /** The wording of the two answers, which follows the language choice. */
  setAnswers(yes: string, no: string): void
  destroy(): void
}

export function createConfirm(): Confirm {
  const element = document.createElement('div')
  element.className = 'confirm'
  element.hidden = true
  element.setAttribute('role', 'alertdialog')
  element.innerHTML = `
    <div class="confirm__card">
      <p class="confirm__question"></p>
      <div class="confirm__answers">
        <button type="button" data-answer="no"></button>
        <button type="button" data-answer="yes"></button>
      </div>
    </div>`

  const question = requireElement<HTMLParagraphElement>(element, '.confirm__question')
  const yes = requireElement<HTMLButtonElement>(element, '[data-answer="yes"]')
  const no = requireElement<HTMLButtonElement>(element, '[data-answer="no"]')

  let answerYes: (() => void) | null = null

  yes.addEventListener('click', () => {
    element.hidden = true
    answerYes?.()
  })
  no.addEventListener('click', () => {
    element.hidden = true
  })

  document.body.append(element)

  return {
    ask(text, onYes) {
      question.textContent = text
      answerYes = onYes
      element.hidden = false
    },
    setAnswers(yesText, noText) {
      yes.textContent = yesText
      no.textContent = noText
    },
    destroy() {
      element.remove()
    },
  }
}
