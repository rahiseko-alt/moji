/**
 * One dial: how strict the marking is, from 1 to 5.
 *
 * Whether a stroke was "close enough" cannot be settled at a desk — it is a
 * question about a finger on a phone — and nine separate numbers turned out to
 * be nobody's idea of a dial. What a person can say is "this is too strict", so
 * that is what there is to move: each setting carries its own nine numbers
 * (STRICTNESS_LEVELS), chosen together.
 *
 * The panel also names what stopped each stroke, so the choice is informed
 * rather than blind. Nothing here ships to a learner: it is in the build only
 * when MOJI_TUNING=1. Once a setting is chosen it becomes DEFAULT_STRICTNESS.
 */
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import {
  DEFAULT_STRICTNESS,
  STRICTNESS_LEVELS,
  verdictOf,
  type MistakeReason,
  type StrokeMeasurement,
} from '../writing/stroke-matcher'
import './tuning.css'

/** The four reasons a stroke can be wrong, as CONTEXT.md names them. */
const REASONS: Readonly<Record<MistakeReason, string>> = {
  backwards: '逆向き',
  misplaced: '位置ずれ',
  shape: '形違い',
  tooShort: '短すぎ',
}

export type TuningPanel = Screen & {
  /** Puts the last 送信 up, or clears it when there is none. */
  show(measurements: readonly StrokeMeasurement[]): void
}

export function mountTuning(
  parent: HTMLElement,
  read: () => number,
  write: (strictness: number) => void,
): TuningPanel {
  const panel = document.createElement('div')
  panel.className = 'tuning'
  panel.innerHTML = `
    <button type="button" class="tuning__fold">判定</button>
    <div class="tuning__body">
      <p class="tuning__title">きびしさ</p>
      <div class="tuning__levels" role="group"></div>
      <p class="tuning__ends"><span>きびしい</span><span>ゆるい</span></p>
      <div class="tuning__readings"></div>
    </div>`

  const levels = requireElement<HTMLDivElement>(panel, '.tuning__levels')
  const readings = requireElement<HTMLDivElement>(panel, '.tuning__readings')
  const fold = requireElement<HTMLButtonElement>(panel, '.tuning__fold')

  // A phone has little enough width as it is, so the panel folds away to a tab.
  let folded = false
  fold.addEventListener('click', () => {
    folded = !folded
    panel.dataset.folded = String(folded)
    document.documentElement.classList.toggle('tuning-folded', folded)
  })

  const buttons = STRICTNESS_LEVELS.map((_, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tuning__level'
    button.textContent = String(index + 1)
    button.addEventListener('click', () => {
      write(index + 1)
      render()
    })
    levels.append(button)
    return button
  })

  const render = (): void => {
    const now = read()
    for (const [index, button] of buttons.entries()) {
      button.setAttribute('aria-pressed', String(index + 1 === now))
      button.dataset.shipped = String(index + 1 === DEFAULT_STRICTNESS)
    }
  }

  render()
  // The app gives up the width this takes; see tuning.css.
  document.documentElement.classList.add('tuning-on')
  parent.append(panel)

  return {
    show(measurements) {
      readings.replaceChildren(
        ...measurements.map((measured, index) => {
          // The same call the marking makes, so the panel can never name a
          // reason the app would not give.
          const verdict = verdictOf(measured)
          const line = document.createElement('p')
          line.className = 'tuning__reading'
          line.dataset.passed = String(verdict.correct)
          line.textContent = `${index + 1}画目 ${verdict.correct ? '○' : REASONS[verdict.reason]}`
          return line
        }),
      )
    },
    destroy() {
      document.documentElement.classList.remove('tuning-on')
      panel.remove()
    },
  }
}
