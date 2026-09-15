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
        <button type="button" class="writing__list" hidden></button>
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
  const list = requireElement<HTMLButtonElement>(screen, '.writing__list')
  const submit = requireElement<HTMLButtonElement>(screen, '.writing__submit')
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
  /** Which お題 of the finished run is being looked back at, counting from one. */
  let reviewing: number | null = null
  /**
   * The run has reached its end at least once, so the results exist and are
   * worth a way back to — even after the learner reopens the last お題 with
   * やり直す.
   */
  let resultsExist = false
  /** Is the results card up? It is, from the moment the run ends, until something else asks. */
  let showingResults = false

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
    list.textContent = strings.results
    next.textContent = strings.next
    retry.textContent = strings.retry
    confirm.setAnswers(strings.yes, strings.no)

    // One character on its own needs no counting: the learner can see it.
    progress.hidden = state.phase !== 'writing' || state.chosen.length < 2
    progress.textContent = strings.progress(state.position, state.chosen.length)

    // While an お題 is being looked back at, the count belongs to that one
    // rather than to the one in hand.
    const reviewed = reviewing === null ? null : session.attempt(reviewing)
    const showing = reviewed ? reviewed.score : state.score
    score.hidden = showing === null
    if (showing) score.textContent = strings.strokeScore(showing.correct, showing.total)

    // The results lie over the last お題, which stays on the paper below them.
    // Looking back at one of them puts the card away until けっか brings it back.
    summary.hidden = !showingResults
    summaryTotal.textContent = strings.runScore(state.runScore.correct, state.runScore.total)
    summaryCharacters.replaceChildren(
      ...state.results.map((result, index) => {
        const item = document.createElement('li')
        // Each one opens what was written for it, so a learner can see why.
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'summary__character'
        open.dataset.correct = String(result.firstTimeCorrect)
        const character = document.createElement('span')
        character.lang = 'ja'
        character.textContent = result.item
        const mark = document.createElement('span')
        mark.className = 'summary__mark'
        mark.textContent = result.firstTimeCorrect ? '○' : '×'
        open.append(character, mark)
        open.addEventListener('click', () => showAttempt(index + 1))
        item.append(open)
        return item
      }),
    )

    // Sending is the only way on, and only once something is on the paper. The
    // results card lets taps through, so the bar keeps working under it.
    const away = reviewing !== null
    submit.hidden = state.marked || away
    submit.disabled = !state.canSubmit
    // At the end of the run there is nowhere to go on to: the results are there.
    next.hidden = !state.marked || state.remaining === 0 || away
    retry.hidden = !state.marked || away
    // Once the results exist they are always one tap away, including from an
    // お題 reopened with やり直す after the run had already ended.
    list.hidden = !resultsExist || showingResults
  }

  /**
   * Colours the ink the marking called wrong, and walks the answer through the
   * お題 when something in it was. Both the moment it is sent and every time it
   * is looked back at, which is the same thing to the learner.
   */
  const showMarking = (outcomes: readonly { readonly correct: boolean }[]): void => {
    surface?.markWrong(
      outcomes.flatMap((outcome, index) => (outcome.correct ? [] : [index])),
    )
    surface?.showAnswer(outcomes.some((outcome) => !outcome.correct) ? model : [])
  }

  /** Puts what was written for one お題 of the finished run back on the paper. */
  const showAttempt = (position: number): void => {
    const attempt = session.attempt(position)
    if (!data || !attempt) return
    reviewing = position
    showingResults = false
    surface?.destroy()
    model = strokesFor(data, attempt.item)
    surface = createWritingSurface({
      model,
      guide: true,
      square: data.viewBox,
      ink: attempt.written,
      readOnly: true,
      onStrokeTraced: () => {},
      onStrokeFinished: () => {},
    })
    cells.replaceChildren(surface.element)
    // The same marking and the same answer the learner saw when they sent it.
    showMarking(attempt.outcomes)
    render()
  }

  /** Puts a fresh cell up for the お題 the run is now on. */
  const showItem = (): void => {
    reviewing = null
    showingResults = false
    surface?.destroy()
    surface = null
    const state = session.state()

    if (data && state.item && !state.marked) {
      model = strokesFor(data, state.item)
      surface = createWritingSurface({
        model,
        guide: true,
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
      // The hint is on before the first stroke: a learner who does not know
      // where the character starts should not have to guess to find out.
      showHint(state)
    } else {
      cells.replaceChildren()
    }
    render()
  }

  void loadStrokeData().then((loaded) => {
    data = loaded
    showItem()
  })

  submit.addEventListener('click', () => {
    const state = session.submit()
    if (!state.marked) return
    // The ink stays where it is; the marking only colours it.
    surface?.stopAcceptingStrokes()
    surface?.setNavigation(null)
    if (state.phase === 'finished') {
      resultsExist = true
      showingResults = true
    }
    showMarking(state.outcomes)
    render()
  })

  list.addEventListener('click', () => {
    // Back to the results card, over whatever square is on the paper.
    showingResults = true
    render()
  })

  next.addEventListener('click', () => {
    session.nextItem()
    showItem()
  })

  retry.addEventListener('click', () => {
    session.retryItem()
    showItem()
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
