/**
 * The nine numbers the marking judges by, put where a person can move them.
 *
 * They cannot be chosen from a desk: whether a stroke was "close enough" is a
 * question about a finger on a phone, and the only way to answer it is to write
 * on one and look. So this panel sits beside the 升目 in the tuning build, shows
 * what the last 送信 actually measured against what each number allowed, and
 * lets the numbers move between attempts. Nothing here ships to a learner
 * (see `tuning` in vite.config.ts); once the numbers are settled they are
 * written into DEFAULT_THRESHOLDS and this goes back to being a tool.
 */
import { requireElement } from '../app/dom'
import type { Screen } from '../app/screen'
import { DEFAULT_THRESHOLDS, type MatchThresholds, type StrokeMeasurement } from '../writing/stroke-matcher'
import './tuning.css'

type Dial = {
  readonly key: keyof MatchThresholds
  readonly name: string
  readonly step: number
}

/*
 * In the order they are asked at 送信, which is the order a stroke fails in, so
 * that the first row that goes red is the first number worth moving.
 */
const DIALS: readonly Dial[] = [
  { key: 'length', name: '長さ お手本の何割書けばよいか', step: 0.05 },
  { key: 'direction', name: '向き お手本と同じ向きか（1が同じ）', step: 0.05 },
  { key: 'ends', name: '端のずれ 画の長さの何割まで', step: 0.05 },
  { key: 'endsFloor', name: '端のずれ 下限', step: 1 },
  { key: 'endsCeiling', name: '端のずれ 上限', step: 1 },
  { key: 'shape', name: 'はみ出し 画の長さの何割まで', step: 0.05 },
  { key: 'shapeFloor', name: 'はみ出し 下限', step: 1 },
  { key: 'curve', name: '曲がり お手本の何割残せばよいか', step: 0.05 },
  { key: 'bend', name: '曲がりを見はじめる境目', step: 0.01 },
]

/** One measured quantity of one stroke, and whether it cleared its threshold. */
type Reading = { readonly name: string; readonly got: number; readonly allowed: string; readonly passed: boolean }

const readingsOf = (measured: StrokeMeasurement): readonly Reading[] => {
  const { allowed } = measured
  const rows: Reading[] = [
    { name: '長さ', got: measured.length, allowed: `≧${allowed.length.toFixed(2)}`, passed: measured.length >= allowed.length },
    { name: '向き', got: measured.direction, allowed: `≧${allowed.direction.toFixed(2)}`, passed: measured.direction >= allowed.direction },
    { name: '端', got: measured.ends, allowed: `≦${allowed.ends.toFixed(1)}`, passed: measured.ends <= allowed.ends },
    { name: 'はみ出し', got: measured.wander, allowed: `≦${allowed.wander.toFixed(1)}`, passed: measured.wander <= allowed.wander },
  ]
  if (measured.curve !== null) {
    rows.push({
      name: '曲がり',
      got: measured.curve,
      allowed: `≧${allowed.curve.toFixed(2)}`,
      passed: measured.curve >= allowed.curve,
    })
  }
  return rows
}

export type TuningPanel = Screen & {
  /** Puts the last 送信's measurements up, or clears them when there are none. */
  show(measurements: readonly StrokeMeasurement[]): void
}

export function mountTuning(
  parent: HTMLElement,
  read: () => MatchThresholds,
  write: (thresholds: MatchThresholds) => void,
): TuningPanel {
  const panel = document.createElement('div')
  panel.className = 'tuning'
  panel.innerHTML = `
    <div class="tuning__head">
      <button type="button" class="tuning__fold">数値</button>
      <button type="button" class="tuning__reset">もどす</button>
    </div>
    <ul class="tuning__dials"></ul>
    <div class="tuning__readings"></div>`

  const dials = requireElement<HTMLUListElement>(panel, '.tuning__dials')
  const readings = requireElement<HTMLDivElement>(panel, '.tuning__readings')
  const reset = requireElement<HTMLButtonElement>(panel, '.tuning__reset')
  const fold = requireElement<HTMLButtonElement>(panel, '.tuning__fold')

  // A phone has little enough width as it is, so the panel folds away to a tab.
  let folded = false
  fold.addEventListener('click', () => {
    folded = !folded
    panel.dataset.folded = String(folded)
    document.documentElement.classList.toggle('tuning-folded', folded)
  })

  const values = new Map<keyof MatchThresholds, HTMLSpanElement>()

  for (const dial of DIALS) {
    const row = document.createElement('li')
    row.className = 'tuning__dial'
    const name = document.createElement('span')
    name.className = 'tuning__name'
    name.textContent = dial.name
    const down = document.createElement('button')
    down.type = 'button'
    down.textContent = '−'
    const value = document.createElement('span')
    value.className = 'tuning__value'
    const up = document.createElement('button')
    up.type = 'button'
    up.textContent = '＋'
    const move = (by: number) => () => {
      const now = read()
      const next = Math.max(0, Math.round((now[dial.key] + by) * 1000) / 1000)
      write({ ...now, [dial.key]: next })
      render()
    }
    down.addEventListener('click', move(-dial.step))
    up.addEventListener('click', move(dial.step))
    row.append(name, down, value, up)
    values.set(dial.key, value)
    dials.append(row)
  }

  reset.addEventListener('click', () => {
    write({ ...DEFAULT_THRESHOLDS })
    render()
  })

  const render = (): void => {
    const now = read()
    for (const dial of DIALS) {
      const cell = values.get(dial.key)!
      cell.textContent = dial.step < 1 ? now[dial.key].toFixed(2) : String(now[dial.key])
      cell.dataset.moved = String(now[dial.key] !== DEFAULT_THRESHOLDS[dial.key])
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
          const stroke = document.createElement('div')
          stroke.className = 'tuning__stroke'
          const title = document.createElement('p')
          title.className = 'tuning__strokeName'
          title.textContent = `${index + 1}画目`
          stroke.append(title)
          for (const reading of readingsOf(measured)) {
            const line = document.createElement('p')
            line.className = 'tuning__reading'
            line.dataset.passed = String(reading.passed)
            line.textContent = `${reading.name} ${reading.got.toFixed(2)} （${reading.allowed}）`
            stroke.append(line)
          }
          return stroke
        }),
      )
    },
    destroy() {
      document.documentElement.classList.remove('tuning-on')
      panel.remove()
    },
  }
}
