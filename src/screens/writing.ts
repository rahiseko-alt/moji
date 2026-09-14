/**
 * The screen a learner writes on.
 *
 * It shows one cell at a time: the character the run is up to. Writing it fills
 * the cell, and 次へ puts a fresh one up for the next character. The session
 * decides all of that (#17); this screen only draws what it is told and hands
 * back what the finger did.
 */
import type { ChoicesStore } from '../app/choices'
import { createConfirm } from '../app/confirm'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { loadStrokeData, strokesFor, type Stroke, type StrokeData } from '../data/stroke-data'
import { STRINGS } from '../i18n/strings'
import type { WritingSession, WritingSessionState } from '../writing/writing-session'
import { createWritingSurface, type WritingSurface } from '../writing/writing-surface'
import './writing.css'

export function mountWriting(
  parent: HTMLElement,
  choices: ChoicesStore,
  session: WritingSession,
  onHome: () => void,
): Screen {
  const screen = document.createElement('div')
  screen.className = 'writing'
  screen.innerHTML = `
    <div class="writing__bar">
      <button type="button" class="writing__home"></button>
      <p class="writing__progress" hidden></p>
      <p class="writing__score" hidden></p>
      <button type="button" class="writing__retry" hidden></button>
      <button type="button" class="writing__next" hidden></button>
    </div>
    <div class="writing__cells"></div>
    <div class="summary" hidden>
      <div class="summary__card">
        <p class="summary__total"></p>
        <ol class="summary__characters"></ol>
      </div>
    </div>`

  const home = requireElement<HTMLButtonElement>(screen, '.writing__home')
  const progress = requireElement<HTMLParagraphElement>(screen, '.writing__progress')
  const score = requireElement<HTMLParagraphElement>(screen, '.writing__score')
  const retry = requireElement<HTMLButtonElement>(screen, '.writing__retry')
  const next = requireElement<HTMLButtonElement>(screen, '.writing__next')
  const cells = requireElement<HTMLDivElement>(screen, '.writing__cells')
  const summary = requireElement<HTMLDivElement>(screen, '.summary')
  const summaryTotal = requireElement<HTMLParagraphElement>(summary, '.summary__total')
  const summaryCharacters = requireElement<HTMLOListElement>(summary, '.summary__characters')

  const confirm = createConfirm()

  let data: StrokeData | null = null
  let surface: WritingSurface | null = null
  let model: readonly Stroke[] = []

  /**
   * The session says which stroke the hint belongs on; this puts it there. It
   * has to be called after anything that moves the session on, since the hint
   * runs ahead of the writing rather than on a clock of its own.
   */
  const showHint = (state: WritingSessionState): void => {
    const stroke = state.navigationStroke
    surface?.setNavigation(stroke === null ? null : (model[stroke] ?? null))
  }

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    const state = session.state()
    home.textContent = strings.home
    next.textContent = strings.next
    retry.textContent = strings.retry
    confirm.setAnswers(strings.yes, strings.no)

    // One character on its own needs no counting: the learner can see it.
    progress.hidden = state.phase !== 'writing' || state.chosen.length < 2
    progress.textContent = strings.progress(state.position, state.chosen.length)

    // A test says nothing about a character until the whole run is over.
    const mode = choices.get().mode ?? 'practice'
    score.hidden = !state.characterFinished || (mode === 'test' && state.phase !== 'finished')
    score.textContent = strings.strokeScore(state.score.correct, state.score.total)

    // The summary lies over the last character, which stays on the paper below it.
    summary.hidden = state.phase !== 'finished'
    summaryTotal.textContent = strings.runScore(
      state.results.filter((result) => result.firstTimeCorrect).length,
      state.results.length,
    )
    summaryCharacters.replaceChildren(
      ...state.results.map((result) => {
        const item = document.createElement('li')
        item.className = 'summary__character'
        item.dataset.correct = String(result.firstTimeCorrect)
        const character = document.createElement('span')
        character.lang = 'ja'
        character.textContent = result.character
        const mark = document.createElement('span')
        mark.className = 'summary__mark'
        mark.textContent = result.firstTimeCorrect ? '○' : '×'
        item.append(character, mark)
        return item
      }),
    )

    // Nothing to move on to at the end of the run: #20 puts the summary here.
    next.hidden = !state.characterFinished || state.position >= state.chosen.length
    retry.hidden = !state.characterFinished
  }

  /** Puts a fresh cell up for the character the run is now on. */
  const showCharacter = (): void => {
    surface?.destroy()
    surface = null
    const state = session.state()
    const mode = choices.get().mode ?? 'practice'

    if (data && state.character && !state.characterFinished) {
      model = strokesFor(data, state.character)
      surface = createWritingSurface({
        // A test shows no model: the whole point is writing it from memory.
        model: mode === 'test' ? [] : model,
        square: data.viewBox,
        onStrokeTraced(points) {
          showHint(session.traceStroke(points))
        },
        onStrokeFinished(points) {
          const written = session.writeStroke(points)
          // In practice a wrong stroke is shown back in red and taken away, so the
          // learner never leaves a wrong shape sitting on the paper. A test takes
          // what it is given and says nothing until the end.
          if (mode === 'practice' && written.lastVerdict?.correct === false) {
            surface!.rejectLastStroke()
          }
          // Nothing is left to judge, so further ink would sit there unanswered.
          if (written.characterFinished) surface!.stopAcceptingStrokes()
          showHint(written)
          render()
        },
      })
      cells.replaceChildren(surface.element)
    } else {
      cells.replaceChildren()
    }
    render()
  }

  void loadStrokeData().then((loaded) => {
    data = loaded
    showCharacter()
  })

  next.addEventListener('click', () => {
    session.nextCharacter()
    showCharacter()
  })

  retry.addEventListener('click', () => {
    session.retryCharacter()
    showCharacter()
  })

  // Home goes back to the cover from here. Leaving part-way throws away the
  // whole run, so ask — and say how much of it is still to come. Once the run
  // is finished there is nothing left to lose and the button just works.
  home.addEventListener('click', () => {
    const strings = STRINGS[choices.get().language]
    const state = session.state()
    const toCome = state.chosen.length - state.position + (state.characterFinished ? 0 : 1)
    const written = surface?.hasInk() ?? false
    if (state.phase === 'finished' || (!written && state.position === 1 && toCome <= 1)) {
      onHome()
      return
    }
    confirm.ask(toCome > 1 ? strings.quitRunQuestion(toCome) : strings.quitQuestion, onHome)
  })

  const unsubscribe = choices.subscribe(render)
  render()
  parent.append(screen)

  return {
    destroy() {
      unsubscribe()
      surface?.destroy()
      confirm.destroy()
      screen.remove()
    },
  }
}
