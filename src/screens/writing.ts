/**
 * The screen a learner writes on.
 *
 * At this stage it shows one cell with a model character to trace and captures
 * what is written. Judging the strokes (#6), the navigation hint (#7) and
 * whole words across several cells (#10) all build on top of this.
 */
import type { ChoicesStore } from '../app/choices'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { loadStrokeData, strokesFor, type Stroke } from '../data/stroke-data'
import { STRINGS } from '../i18n/strings'
import { createWritingSession, type WritingSession } from '../writing/writing-session'
import { createWritingSurface, type WritingSurface } from '../writing/writing-surface'
import './writing.css'

/** Until the character-choosing screen exists (#8), everyone practises the same character. */
const PLACEHOLDER_CHARACTER = '日'

export function mountWriting(parent: HTMLElement, choices: ChoicesStore, onHome: () => void): Screen {
  const screen = document.createElement('div')
  screen.className = 'writing'
  screen.innerHTML = `
    <div class="writing__bar">
      <button type="button" class="writing__home"></button>
      <p class="writing__score" hidden></p>
    </div>
    <div class="writing__cells"></div>`

  const home = requireElement<HTMLButtonElement>(screen, '.writing__home')
  const score = requireElement<HTMLParagraphElement>(screen, '.writing__score')
  const cells = requireElement<HTMLDivElement>(screen, '.writing__cells')

  const confirm = document.createElement('div')
  confirm.className = 'confirm'
  confirm.hidden = true
  confirm.setAttribute('role', 'alertdialog')
  confirm.innerHTML = `
    <div class="confirm__card">
      <p class="confirm__question"></p>
      <div class="confirm__answers">
        <button type="button" data-answer="no"></button>
        <button type="button" data-answer="yes"></button>
      </div>
    </div>`
  const question = requireElement<HTMLParagraphElement>(confirm, '.confirm__question')
  const yes = requireElement<HTMLButtonElement>(confirm, '[data-answer="yes"]')
  const no = requireElement<HTMLButtonElement>(confirm, '[data-answer="no"]')

  let surface: WritingSurface | null = null
  let session: WritingSession | null = null

  const showScore = (): void => {
    if (!session) return
    const { phase, score: tally } = session.state()
    score.hidden = phase !== 'finished'
    score.textContent = STRINGS[choices.get().language].strokeScore(tally.correct, tally.total)
  }

  const start = (model: readonly Stroke[], square: number): void => {
    const mode = choices.get().mode ?? 'practice'
    session = createWritingSession({ strokes: model, mode })
    surface = createWritingSurface({
      // A test shows no model: the whole point is writing it from memory.
      model: mode === 'test' ? [] : model,
      square,
      onStrokeFinished(points) {
        const state = session!.writeStroke(points)
        // In practice a wrong stroke is shown back in red and taken away, so the
        // learner never leaves a wrong shape sitting on the paper. A test takes
        // what it is given and says nothing until the end.
        if (mode === 'practice' && state.lastVerdict?.correct === false) {
          surface!.rejectLastStroke()
        }
        showScore()
      },
    })
    cells.replaceChildren(surface.element)
  }

  void loadStrokeData().then((data) => {
    start(strokesFor(data, PLACEHOLDER_CHARACTER), data.viewBox)
  })

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    home.textContent = strings.home
    question.textContent = strings.quitQuestion
    yes.textContent = strings.yes
    no.textContent = strings.no
    showScore()
  }

  // Leaving part-way throws away what has been written, so ask — but only then.
  // Once the character is finished there is nothing left to lose, and asking
  // every time would make the button tiresome.
  home.addEventListener('click', () => {
    const unfinished = session?.state().phase !== 'finished'
    if (unfinished && surface?.hasInk()) confirm.hidden = false
    else onHome()
  })
  yes.addEventListener('click', onHome)
  no.addEventListener('click', () => {
    confirm.hidden = true
  })

  const unsubscribe = choices.subscribe(render)
  render()
  parent.append(screen)
  document.body.append(confirm)

  return {
    destroy() {
      unsubscribe()
      surface?.destroy()
      confirm.remove()
      screen.remove()
    },
  }
}
