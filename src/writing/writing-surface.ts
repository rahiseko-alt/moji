/**
 * The square a learner writes one character into.
 *
 * It draws three things — the dotted guide, the faint model character, and the
 * ink the learner lays down — and reports each finished stroke as a list of
 * points. It holds no opinion about whether a stroke was right; that is the
 * writing session's job (#6).
 */
import type { Stroke } from '../data/stroke-data'
import type { TracedPoint } from './traced-point'

export type WritingSurfaceOptions = {
  /** The character's model strokes, drawn faintly to trace over. Empty hides the model. */
  readonly model: readonly Stroke[]
  /** The side of the square the stroke coordinates are defined in. */
  readonly square: number
  /** Called once the finger lifts, with the stroke in the character's own coordinates. */
  readonly onStrokeFinished: (points: readonly TracedPoint[]) => void
}

/** Three dotted lines each way, splitting the square into sixteen. */
const DIVISIONS = 4
const MODEL_WIDTH = 5

const INK_WIDTH = 5.5
/** Below this, a touch is a tap rather than a stroke, and is discarded. */
const MINIMUM_STROKE_LENGTH = 2
/** Long enough to see what was written before it is taken away, short enough not to nag. */
const REJECTION_MS = 450

export type WritingSurface = {
  readonly element: HTMLElement
  /** Shows the last stroke in red for a moment, then takes it off the paper. */
  rejectLastStroke(): void
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

  const finished: TracedPoint[][] = []
  let inProgress: TracedPoint[] | null = null
  /** The stroke currently being shown back as wrong, if any. */
  let rejected: number | null = null
  let rejectionTimer: ReturnType<typeof setTimeout> | null = null

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
    for (const [index, stroke] of finished.entries()) {
      context.strokeStyle = colour(index === rejected ? '--wrong' : '--ink')
      strokePolyline(stroke)
    }
    if (inProgress) {
      context.strokeStyle = colour('--ink')
      strokePolyline(inProgress)
    }
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
    if (inProgress) return
    canvas.setPointerCapture(event.pointerId)
    inProgress = [toCharacterSpace(event)]
    draw()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!inProgress || !canvas.hasPointerCapture(event.pointerId)) return
    inProgress.push(toCharacterSpace(event))
    draw()
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
    finished.push(points)
    draw()
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
    rejectLastStroke() {
      if (finished.length === 0) return
      rejected = finished.length - 1
      draw()
      rejectionTimer = setTimeout(() => {
        finished.pop()
        rejected = null
        rejectionTimer = null
        draw()
      }, REJECTION_MS)
    },
    hasInk: () => finished.length > 0 || inProgress !== null,
    destroy() {
      if (rejectionTimer) clearTimeout(rejectionTimer)
      observer.disconnect()
    },
  }
}
