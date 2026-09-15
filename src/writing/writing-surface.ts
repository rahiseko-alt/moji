/**
 * The square a learner writes one character into.
 *
 * It draws three things — the dotted guide, the faint model character, and the
 * ink the learner lays down — and reports each finished stroke as a list of
 * points. It holds no opinion about whether a stroke was right; the writing
 * session says so at 送信 (ADR 0009), and the ink then turns red where it was
 * wrong. Nothing is ever taken off the paper.
 */
import type { Point, Stroke } from '../data/stroke-data'
import type { TracedPoint } from './traced-point'

export type WritingSurfaceOptions = {
  /** The character's model strokes, drawn faintly to trace over. Empty hides the model. */
  readonly model: readonly Stroke[]
  /** The side of the square the stroke coordinates are defined in. */
  readonly square: number
  /** Called as the finger moves, with the stroke so far. The hint follows this. */
  readonly onStrokeTraced: (points: readonly TracedPoint[]) => void
  /** Called once the finger lifts, with the stroke in the character's own coordinates. */
  readonly onStrokeFinished: (points: readonly TracedPoint[]) => void
}

/** Three dotted lines each way, splitting the square into sixteen. */
const DIVISIONS = 4
const MODEL_WIDTH = 5

const INK_WIDTH = 5.5
/** Below this, a touch is a tap rather than a stroke, and is discarded. */
const MINIMUM_STROKE_LENGTH = 2
/** One trip of the hint along a stroke. Brisk, but still a movement rather than a flash. */
const NAVIGATION_MS = 800
/** The pause at the end of a trip, before it starts over. */
const NAVIGATION_REST_MS = 250

export type WritingSurface = {
  readonly element: HTMLElement
  /** Turns the given strokes red: the marking said they were wrong. */
  markWrong(strokes: readonly number[]): void
  /** Stops taking ink, for once the character is finished and there is nothing left to judge. */
  stopAcceptingStrokes(): void
  /**
   * Shows where a stroke begins and which way it runs, by walking a lit point
   * along it over and over. Null puts the hint away.
   */
  setNavigation(stroke: Stroke | null): void
  hasInk(): boolean
  destroy(): void
}

export function createWritingSurface(options: WritingSurfaceOptions): WritingSurface {
  const SIDE = options.square

  const element = document.createElement('div')
  element.className = 'cell'
  const canvas = document.createElement('canvas')
  element.append(canvas)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot draw on a canvas')

  /** Everything the learner has written, right or wrong. Nothing is removed. */
  const written: TracedPoint[][] = []
  /** Which of them the marking called wrong. */
  const wrong = new Set<number>()
  let inProgress: TracedPoint[] | null = null
  /** Goes false once the character is finished, so no more ink can be laid down. */
  let accepting = true
  /** The stroke the hint is walking along, if the learner has stalled. */
  let navigation: Stroke | null = null
  let navigationStartedAt = 0
  let navigationFrame: number | null = null

  const style = getComputedStyle(document.documentElement)
  const colour = (token: string): string => style.getPropertyValue(token).trim()

  const resize = (): void => {
    const side = Math.min(element.clientWidth, element.clientHeight)
    if (side === 0) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(side * ratio)
    canvas.height = Math.round(side * ratio)
    canvas.style.width = `${side}px`
    canvas.style.height = `${side}px`
    draw()
  }

  const draw = (): void => {
    const scale = canvas.width / SIDE
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, SIDE, SIDE)

    context.fillStyle = colour('--paper-plain')
    context.fillRect(0, 0, SIDE, SIDE)

    context.lineWidth = 0.6
    context.strokeStyle = colour('--guide')
    context.setLineDash([2, 2.6])
    context.beginPath()
    for (let n = 1; n < DIVISIONS; n++) {
      const at = (SIDE * n) / DIVISIONS
      context.moveTo(at, 0)
      context.lineTo(at, SIDE)
      context.moveTo(0, at)
      context.lineTo(SIDE, at)
    }
    context.stroke()
    context.setLineDash([])

    context.lineCap = 'round'
    context.lineJoin = 'round'

    context.strokeStyle = colour('--ink-faint')
    context.lineWidth = MODEL_WIDTH
    for (const stroke of options.model) context.stroke(new Path2D(stroke.d))

    context.lineWidth = INK_WIDTH
    for (const [index, stroke] of written.entries()) {
      context.strokeStyle = colour(wrong.has(index) ? '--wrong' : '--ink')
      strokePolyline(stroke)
    }
    context.strokeStyle = colour('--ink')
    if (inProgress) strokePolyline(inProgress)

    if (navigation) drawNavigation()
  }

  /**
   * A lit point that starts where the stroke starts and travels its length,
   * with the part already covered drawn behind it. Direction is the thing a
   * still picture cannot teach, so the hint has to move.
   */
  const drawNavigation = (): void => {
    const median = navigation!.median
    const elapsed = (performance.now() - navigationStartedAt) % (NAVIGATION_MS + NAVIGATION_REST_MS)
    const progress = Math.min(elapsed / NAVIGATION_MS, 1)
    const reached = progress * (median.length - 1)
    const index = Math.min(Math.floor(reached), median.length - 2)
    const from = median[index]!
    const to = median[index + 1]!
    const between = reached - index
    const head: Point = [
      from[0] + (to[0] - from[0]) * between,
      from[1] + (to[1] - from[1]) * between,
    ]

    context.strokeStyle = colour('--vermilion')
    context.globalAlpha = 0.35
    context.lineWidth = MODEL_WIDTH
    context.beginPath()
    context.moveTo(median[0]![0], median[0]![1])
    for (let n = 1; n <= index; n++) context.lineTo(median[n]![0], median[n]![1])
    context.lineTo(head[0], head[1])
    context.stroke()

    context.globalAlpha = 0.25
    context.fillStyle = colour('--vermilion')
    context.beginPath()
    context.arc(head[0], head[1], MODEL_WIDTH * 1.9, 0, Math.PI * 2)
    context.fill()

    context.globalAlpha = 1
    context.beginPath()
    context.arc(head[0], head[1], MODEL_WIDTH * 0.8, 0, Math.PI * 2)
    context.fill()
  }

  const animateNavigation = (): void => {
    navigationFrame = null
    if (!navigation) return
    draw()
    navigationFrame = requestAnimationFrame(animateNavigation)
  }

  const strokePolyline = (points: readonly TracedPoint[]): void => {
    if (points.length === 0) return
    context.beginPath()
    const [first, ...rest] = points
    context.moveTo(first!.x, first!.y)
    for (const point of rest) context.lineTo(point.x, point.y)
    // A single touch still deserves a dot, so the learner sees they were heard.
    if (rest.length === 0) context.lineTo(first!.x + 0.01, first!.y)
    context.stroke()
  }

  const toCharacterSpace = (event: PointerEvent): TracedPoint => {
    const box = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - box.left) / box.width) * SIDE,
      y: ((event.clientY - box.top) / box.height) * SIDE,
      t: event.timeStamp,
    }
  }

  const lengthOf = (points: readonly TracedPoint[]): number => {
    let total = 0
    for (let n = 1; n < points.length; n++) {
      total += Math.hypot(points[n]!.x - points[n - 1]!.x, points[n]!.y - points[n - 1]!.y)
    }
    return total
  }

  const onPointerDown = (event: PointerEvent): void => {
    // A resting palm or a second finger must not take over the stroke, and it
    // must not silently swallow the one the learner is drawing either.
    if (!event.isPrimary || inProgress || !accepting) return
    canvas.setPointerCapture(event.pointerId)
    inProgress = [toCharacterSpace(event)]
    draw()
    options.onStrokeTraced(inProgress)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!inProgress || !canvas.hasPointerCapture(event.pointerId)) return
    inProgress.push(toCharacterSpace(event))
    draw()
    options.onStrokeTraced(inProgress)
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (!inProgress) return
    const points = inProgress
    inProgress = null
    canvas.releasePointerCapture(event.pointerId)
    if (lengthOf(points) < MINIMUM_STROKE_LENGTH) {
      draw()
      return
    }
    written.push(points)
    draw()
    // The session only takes it down; judging waits for 送信.
    options.onStrokeFinished(points)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  const observer = new ResizeObserver(resize)
  observer.observe(element)
  resize()

  return {
    element,
    markWrong(strokes) {
      wrong.clear()
      for (const index of strokes) wrong.add(index)
      draw()
    },
    stopAcceptingStrokes() {
      accepting = false
    },
    setNavigation(stroke) {
      if (navigation === stroke) return
      navigation = stroke
      if (stroke) {
        navigationStartedAt = performance.now()
        if (navigationFrame === null) navigationFrame = requestAnimationFrame(animateNavigation)
      } else {
        if (navigationFrame !== null) cancelAnimationFrame(navigationFrame)
        navigationFrame = null
        draw()
      }
    },
    hasInk: () => written.length > 0 || inProgress !== null,
    destroy() {
      if (navigationFrame !== null) cancelAnimationFrame(navigationFrame)
      observer.disconnect()
    },
  }
}
