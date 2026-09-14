/**
 * Small geometry shared by the model strokes and what a learner writes.
 * Everything is in the character's own 109x109 square.
 */
import type { Point } from '../data/stroke-data'

export const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

export function length(points: readonly Point[]): number {
  let total = 0
  for (let n = 1; n < points.length; n++) total += distance(points[n - 1]!, points[n]!)
  return total
}

/**
 * Evenly spaced by arc length, so two polylines can be compared point for point
 * however fast or jerkily one of them was drawn.
 */
export function resample(points: readonly Point[], count: number): readonly Point[] {
  const first = points[0]
  if (!first) return []
  if (points.length === 1) return Array.from({ length: count }, () => first)

  const lengths = [0]
  for (let n = 1; n < points.length; n++) {
    lengths.push(lengths[n - 1]! + distance(points[n - 1]!, points[n]!))
  }
  const total = lengths[lengths.length - 1]!
  if (total === 0) return Array.from({ length: count }, () => first)

  const out: Point[] = []
  let cursor = 1
  for (let n = 0; n < count; n++) {
    const target = (total * n) / (count - 1)
    while (cursor < lengths.length - 1 && lengths[cursor]! < target) cursor++
    const span = lengths[cursor]! - lengths[cursor - 1]!
    const t = span === 0 ? 0 : (target - lengths[cursor - 1]!) / span
    const a = points[cursor - 1]!
    const b = points[cursor]!
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

/**
 * Discrete Fréchet distance: the shortest leash that lets a walker on each
 * polyline get from start to end without either going backwards. It notices a
 * detour in the middle that comparing endpoints alone would miss.
 */
export function frechetDistance(a: readonly Point[], b: readonly Point[]): number {
  const best: number[][] = Array.from({ length: a.length }, () => new Array<number>(b.length).fill(-1))
  const walk = (i: number, j: number): number => {
    const seen = best[i]![j]!
    if (seen >= 0) return seen
    const here = distance(a[i]!, b[j]!)
    let value: number
    if (i === 0 && j === 0) value = here
    else if (i === 0) value = Math.max(walk(0, j - 1), here)
    else if (j === 0) value = Math.max(walk(i - 1, 0), here)
    else value = Math.max(Math.min(walk(i - 1, j), walk(i - 1, j - 1), walk(i, j - 1)), here)
    best[i]![j] = value
    return value
  }
  return walk(a.length - 1, b.length - 1)
}

/** Cosine of the angle between the two polylines' overall direction. */
export function directionAgreement(a: readonly Point[], b: readonly Point[]): number {
  const va = [a[a.length - 1]![0] - a[0]![0], a[a.length - 1]![1] - a[0]![1]] as const
  const vb = [b[b.length - 1]![0] - b[0]![0], b[b.length - 1]![1] - b[0]![1]] as const
  const magnitudes = Math.hypot(...va) * Math.hypot(...vb)
  if (magnitudes === 0) return 1
  return (va[0] * vb[0] + va[1] * vb[1]) / magnitudes
}
