/**
 * A one-off tool, not part of the app: it records what a real finger does on a
 * real phone.
 *
 * The judgement thresholds were tuned against strokes this project made up —
 * jitter and offsets applied to the model by a script. Whether they match a
 * learner's hand can only be answered by a learner's hand, which is why the app
 * kept coming back to its user with "try it again now". This page closes that
 * loop once: a learner writes here, the strokes are kept, and from then on the
 * tuning is checked against them by the test suite instead of by a person.
 *
 * It draws with the app's own writing surface, so every point lands in the same
 * 109-wide square the app judges in.
 */
import { loadStrokeData, strokesFor, type Stroke, type StrokeData } from '../../src/data/stroke-data'
import { createWritingSurface, type WritingSurface } from '../../src/writing/writing-surface'
import type { TracedPoint } from '../../src/writing/traced-point'
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'
import './recorder.css'

/** The page is published as an Artifact, which hands it somewhere to put the strokes. */
declare global {
  interface Window {
    readonly claude?: {
      use(name: 'db'): Promise<{
        doc(path: string): { set(data: Record<string, unknown>): Promise<void> }
      } | null>
    }
  }
}

/** What the learner was asked to do, which is what makes the stroke worth keeping. */
type Intent = 'honest' | 'backwards' | 'misplaced' | 'short'

type Task = {
  readonly character: string
  readonly intent: Intent
  readonly instruction: string
  /** How many strokes to record before moving on. Null means the whole character. */
  readonly strokes: number | null
}

/*
 * Five characters written honestly — short and curved, long and straight, and
 * one crowded — then the three ways of getting a stroke wrong that the app
 * claims to tell apart. The mistakes are asked for on 一 so that a single
 * stroke carries the whole answer.
 */
const TASKS: readonly Task[] = [
  { character: 'い', intent: 'honest', instruction: 'ふつうに書いてください', strokes: null },
  { character: 'う', intent: 'honest', instruction: 'ふつうに書いてください', strokes: null },
  { character: 'ん', intent: 'honest', instruction: 'ふつうに書いてください', strokes: null },
  { character: '日', intent: 'honest', instruction: 'ふつうに書いてください', strokes: null },
  { character: '学', intent: 'honest', instruction: 'ふつうに書いてください', strokes: null },
  { character: '一', intent: 'backwards', instruction: 'わざと逆向き（右から左）に書いてください', strokes: 1 },
  { character: '一', intent: 'misplaced', instruction: 'わざと、ずっと下のほうに書いてください', strokes: 1 },
  { character: '一', intent: 'short', instruction: 'わざと、ちょんと短く書いてください', strokes: 1 },
]

type Recorded = {
  readonly character: string
  readonly intent: Intent
  /** Which stroke of the character this was meant to be. */
  readonly strokeIndex: number
  /** The points as the app sees them, in the character's own 109-wide square. */
  readonly points: readonly (readonly [number, number, number])[]
}

const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `
  <div class="rec">
    <div class="rec__bar">
      <p class="rec__count"></p>
      <p class="rec__instruction"></p>
      <button type="button" class="rec__again">この字をやり直す</button>
    </div>
    <div class="rec__cell"></div>
    <div class="rec__done" hidden><p class="rec__message"></p></div>
  </div>`

const count = root.querySelector<HTMLParagraphElement>('.rec__count')!
const instruction = root.querySelector<HTMLParagraphElement>('.rec__instruction')!
const again = root.querySelector<HTMLButtonElement>('.rec__again')!
const cell = root.querySelector<HTMLDivElement>('.rec__cell')!
const done = root.querySelector<HTMLDivElement>('.rec__done')!
const message = root.querySelector<HTMLParagraphElement>('.rec__message')!

const recorded: Recorded[] = []
let data: StrokeData | null = null
let at = 0
let surface: WritingSurface | null = null
let model: readonly Stroke[] = []
let written = 0
/** Where this attempt's strokes start, so a discarded attempt leaves nothing behind. */
let attemptStart = 0

const asRow = (points: readonly TracedPoint[]): Recorded['points'] =>
  points.map(
    (point) =>
      [Math.round(point.x * 100) / 100, Math.round(point.y * 100) / 100, Math.round(point.t)] as const,
  )

const showTask = (): void => {
  surface?.destroy()
  surface = null
  written = 0
  attemptStart = recorded.length
  const task = TASKS[at]
  if (!task || !data) {
    save()
    return
  }
  model = strokesFor(data, task.character)
  count.textContent = `${at + 1} / ${TASKS.length}`
  instruction.textContent = `「${task.character}」を ${task.instruction}`
  surface = createWritingSurface({
    model,
    guide: true,
    square: data.viewBox,
    onStrokeTraced: () => {},
    onStrokeFinished(points) {
      recorded.push({
        character: task.character,
        intent: task.intent,
        strokeIndex: written,
        points: asRow(points),
      })
      written += 1
      if (written >= (task.strokes ?? model.length)) {
        // Filed a character at a time: a learner who stops half way still
        // leaves the strokes they did write.
        void file(recorded.slice(attemptStart))
        at += 1
        // A beat, so the learner sees the stroke land before the sheet changes.
        setTimeout(showTask, 450)
      }
    },
  })
  cell.replaceChildren(surface.element)
}

/** The whole point of the exercise: the strokes have to come back to the repo. */
let filed = 0
let trouble = ''

const file = async (strokes: readonly Recorded[]): Promise<void> => {
  if (strokes.length === 0) return
  const db = (await window.claude?.use('db')) ?? null
  if (!db) {
    trouble = '保存先が使えません'
    return
  }
  try {
    await db.doc(`traces/${Date.now()}`).set({
      recordedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      strokes: strokes as unknown as Record<string, unknown>[],
    })
    filed += strokes.length
  } catch (error) {
    trouble = String(error)
  }
}

const save = (): void => {
  done.hidden = false
  message.textContent = trouble
    ? `記録できませんでした: ${trouble}`
    : `記録しました（${filed}画）。ありがとうございました。`
}

// A learner who fumbles and starts over would otherwise file the fumble as an
// honest attempt, so the discarded attempt is dropped with the sheet.
again.addEventListener('click', () => {
  recorded.length = attemptStart
  showTask()
})

void loadStrokeData().then((loaded) => {
  data = loaded
  showTask()
})
