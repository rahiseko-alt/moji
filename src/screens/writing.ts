/**
 * The screen a learner writes on.
 *
 * It shows the お題 the run is up to: one 升目 for a character, a row of them for
 * a 単語 (ADR 0016). Writing fills them, and 次へ puts a fresh お題 up. The session
 * decides all of that (#17); this screen only draws what it is told, says which
 * 升目 the finger was in, and hands back what it did.
 */
import type { ChoicesStore } from '../app/choices'
import { createConfirm } from '../app/confirm'
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { loadStrokeData, strokesFor, type Stroke, type StrokeData } from '../data/stroke-data'
import { STRINGS } from '../i18n/strings'
import type { StrokeMeasurement } from '../writing/stroke-matcher'
import type { TracedPoint } from '../writing/traced-point'
import {
  wrongCells,
  type MarkedCell,
  type WritingSession,
  type WritingSessionState,
} from '../writing/writing-session'
import { createWritingSurface, type WritingSurface } from '../writing/writing-surface'
import './writing.css'

/**
 * What a 升目 needs to go on the paper: which character it asks for, and any ink
 * already in it. `CellState` is one being written; `AttemptCell`, which carries
 * its ink, is one being looked back at.
 */
type PaperCell = {
  readonly character: string
  readonly written?: readonly (readonly TracedPoint[])[]
}

export function mountWriting(
  parent: HTMLElement,
  choices: ChoicesStore,
  session: WritingSession,
  onHome: () => void,
  /** The tuning build's panel wants the numbers behind the last 送信. */
  onMarked: (measurements: readonly StrokeMeasurement[]) => void = () => {},
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
    <div class="summary" hidden>
      <p class="summary__total"></p>
      <ol class="summary__items"></ol>
    </div>
    <div class="writing__cells"></div>`

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
  const summaryItems = requireElement<HTMLOListElement>(summary, '.summary__items')

  const confirm = createConfirm()

  let data: StrokeData | null = null
  /** One per 升目 of the お題 on the paper, in reading order. */
  let surfaces: WritingSurface[] = []
  /** The model strokes behind each of those 升目. */
  let models: (readonly Stroke[])[] = []
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
   * The session says which stroke of which 升目 the hint belongs on; this puts it
   * there and takes it out of the others. It has to be called after anything
   * that moves the session on, since the hint runs ahead of the writing rather
   * than on a clock of its own.
   */
  const showHint = (state: WritingSessionState): void => {
    for (const [index, surface] of surfaces.entries()) {
      const stroke = state.cells[index]?.navigationStroke ?? null
      surface.setNavigation(stroke === null ? null : (models[index]?.[stroke] ?? null))
    }
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

    // One お題 on its own needs no counting: the learner can see it.
    progress.hidden = state.phase !== 'writing' || state.chosen.length < 2
    progress.textContent = strings.progress(state.position, state.chosen.length)

    // While an お題 is being looked back at, the verdict belongs to that one
    // rather than to the one in hand. An お題 is 一発正解 or it is not: every
    // stroke right at the first 送信, or not, and which strokes went wrong is
    // already on the paper in red.
    const reviewed = reviewing === null ? null : session.attempt(reviewing)
    const showing = reviewed ? reviewed.score : state.score
    score.hidden = showing === null
    if (showing) {
      const allRight = showing.correct === showing.total
      score.textContent = allRight ? strings.correct : strings.incorrect
      score.dataset.correct = String(allRight)
    }

    // The results sit above the paper rather than over it: the answer walks
    // through the last お題 as they appear, and a card in the way would hide the
    // one thing the learner most needs to see. Looking back at one of them puts
    // the strip away until けっか brings it back.
    summary.hidden = !showingResults
    // One お題 on its own needs no total: the ○ or × beside it is the whole of
    // what there is to say, and counting to one helps nobody.
    summaryTotal.hidden = state.chosen.length < 2
    summaryTotal.textContent = strings.runScore(state.runScore.correct, state.runScore.total)
    summaryItems.replaceChildren(
      ...state.results.map((result, index) => {
        const item = document.createElement('li')
        // Each one opens what was written for it, so a learner can see why.
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'summary__item'
        open.dataset.correct = String(result.firstTimeCorrect)
        const written = document.createElement('span')
        written.lang = 'ja'
        written.textContent = result.item
        const mark = document.createElement('span')
        mark.className = 'summary__mark'
        mark.textContent = result.firstTimeCorrect ? '○' : '×'
        open.append(written, mark)
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
   * Walks the answer through each 升目 that went wrong, and leaves the ones that
   * went right alone. Both the moment the お題 is sent and every time it is
   * looked back at, which is the same thing to the learner. The learner's own
   * ink is never recoloured: the paper keeps their hand, and the hint shows what
   * it should have been.
   */
  const showMarking = (marking: readonly MarkedCell[]): void => {
    const wrong = wrongCells(marking)
    for (const [index, surface] of surfaces.entries()) {
      surface.showAnswer(wrong.includes(index) ? (models[index] ?? []) : [])
    }
  }

  /**
   * Puts a row of 升目 on the paper, one per character, and remembers what each
   * asks for. A 升目 that arrives with ink in it is an お題 being looked back at
   * rather than written, so the paper takes nothing more.
   */
  const putUpCells = (paper: readonly PaperCell[]): void => {
    const loaded = data
    if (!loaded) return
    for (const surface of surfaces) surface.destroy()
    const lookingBack = paper.some((cell) => cell.written !== undefined)
    models = paper.map((cell) => strokesFor(loaded, cell.character))
    surfaces = models.map((model, index) =>
      createWritingSurface({
        model,
        square: loaded.viewBox,
        ...(lookingBack ? { ink: paper[index]!.written ?? [], readOnly: true } : {}),
        onStrokeTraced(points) {
          showHint(session.traceStroke(points, index))
        },
        onStrokeFinished(points) {
          // Nothing is judged here: the stroke goes on the paper and stays
          // there until the learner sends the お題 (ADR 0009).
          showHint(session.addStroke(points, index))
          render()
        },
      }),
    )
    // The row has to fit across the screen however many 升目 it holds; the
    // stylesheet needs the count to work that out.
    cells.style.setProperty('--cells', String(paper.length))
    cells.replaceChildren(...surfaces.map((surface) => surface.element))
  }

  /** Puts what was written for one お題 of the finished run back on the paper. */
  const showAttempt = (position: number): void => {
    const attempt = session.attempt(position)
    if (!data || !attempt) return
    reviewing = position
    showingResults = false
    putUpCells(attempt.cells)
    // The same marking and the same answer the learner saw when they sent it.
    showMarking(attempt.cells)
    render()
  }

  /** Puts fresh 升目 up for the お題 the run is now on. */
  const showItem = (): void => {
    reviewing = null
    showingResults = false
    const state = session.state()

    if (data && state.item && !state.marked) {
      putUpCells(state.cells)
      // The hint is on before the first stroke: a learner who does not know
      // where the character starts should not have to guess to find out.
      showHint(state)
    } else {
      for (const surface of surfaces) surface.destroy()
      surfaces = []
      models = []
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
    // The ink stays where it is; the marking only answers beside it.
    for (const surface of surfaces) {
      surface.stopAcceptingStrokes()
      surface.setNavigation(null)
    }
    if (state.phase === 'finished') {
      resultsExist = true
      showingResults = true
    }
    showMarking(state.cells)
    onMarked(state.measurements)
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
    const written = surfaces.some((surface) => surface.hasInk()) || state.position > 1
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
      for (const surface of surfaces) surface.destroy()
      confirm.destroy()
      screen.remove()
    },
  }
}
