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
      <div class="writing__actions">
        <button type="button" class="writing__submit"></button>
        <button type="button" class="writing__retry" hidden></button>
        <button type="button" class="writing__next" hidden></button>
      </div>
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
  const submit = requireElement<HTMLButtonElement>(screen, '.writing__submit')
  const retry = requireElement<HTMLButtonElement>(screen, '.writing__retry')
  const next = requireElement<HTMLButtonElement>(screen, '.writing__next')
  const cells = requireElement<HTMLDivElement>(screen, '.writing__cells')
  const summary = requireElement<HTMLDivElement>(screen, '.summary')
  const summaryTotal = requireElement<HTMLParagraphElement>(summary, '.summary__total')
  const summaryCharacters = requireElement<HTMLOListElement>(summary, '.summary__characters')

  const confirm = createConfirm()

  const modeNow = (): 'practice' | 'test' => choices.get().mode ?? 'practice'

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
    submit.textContent = strings.submit
    next.textContent = strings.next
    retry.textContent = strings.retry
    confirm.setAnswers(strings.yes, strings.no)

    // One character on its own needs no counting: the learner can see it.
    progress.hidden = state.phase !== 'writing' || state.chosen.length < 2
    progress.textContent = strings.progress(state.position, state.chosen.length)

    // The session holds a test's marking back until the run is over, so there
    // is simply nothing to show until then.
    score.hidden = state.score === null
    if (state.score) score.textContent = strings.strokeScore(state.score.correct, state.score.total)

    // The summary lies over the last character, which stays on the paper below it.
    summary.hidden = state.phase !== 'finished'
    summaryTotal.textContent = strings.runScore(state.runScore.correct, state.runScore.total)
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

    // Sending is the only way on, and only once something is on the paper.
    submit.hidden = state.marked
    submit.disabled = !state.canSubmit
    // At the end of the run there is nowhere to go on to: the summary is there.
    next.hidden = !state.marked || state.remaining === 0
    retry.hidden = !state.marked
  }

  /** Puts a fresh cell up for the character the run is now on. */
  const showCharacter = (): void => {
    surface?.destroy()
    surface = null
    const state = session.state()
    const mode = modeNow()

    if (data && state.character && !state.marked) {
      model = strokesFor(data, state.character)
      surface = createWritingSurface({
        // A test shows no model: the whole point is writing it from memory.
        model: mode === 'test' ? [] : model,
        square: data.viewBox,
        onStrokeTraced(points) {
          showHint(session.traceStroke(points))
        },
        onStrokeFinished(points) {
          // Nothing is judged here: the stroke goes on the paper and stays
          // there until the learner sends the お題 (ADR 0009).
          showHint(session.addStroke(points))
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

  submit.addEventListener('click', () => {
    const state = session.submit()
    if (!state.marked) return
    // The ink stays where it is; the marking only colours it.
    surface?.stopAcceptingStrokes()
    surface?.setNavigation(null)
    surface?.markWrong(
      state.outcomes.flatMap((outcome, index) => (outcome.correct ? [] : [index])),
    )
    render()
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
    // Nothing written yet and nothing written before: there is nothing to lose,
    // and a question there would only be in the way. Once the run is over, the
    // same is true — the tally has already been shown.
    const written = (surface?.hasInk() ?? false) || state.position > 1
    if (state.phase === 'finished' || !written) {
      onHome()
      return
    }
    confirm.ask(
      state.remaining > 0 ? strings.quitRunQuestion(state.remaining) : strings.quitQuestion,
      onHome,
    )
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
