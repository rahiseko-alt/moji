/**
 * Turns KanjiVG's SVGs into the stroke data the app ships.
 *
 * For every character the app teaches we keep two things per stroke:
 *   - `d`      the original SVG path, so the faint model character can be
 *              drawn as the smooth curve it is
 *   - `median` evenly spaced points along that path, which is what the
 *              scoring compares a learner's stroke against
 *
 * KanjiVG is CC BY-SA 3.0. This output is an adaptation of it, so it is kept
 * in its own file, apart from the application code, and carries the same
 * licence.
 *
 * Usage: npm run build:data -- [path-to-kanjivg-checkout]
 * The result is committed, so a build never needs the network.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_CHARACTERS } from '../src/data/characters'
import type { Point } from '../src/data/stroke-data'
import { resample } from '../src/writing/polyline'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KANJIVG = process.argv[2] ?? process.env.KANJIVG_DIR ?? join(ROOT, '..', 'kanjivg')
const OUT = join(ROOT, 'assets', 'data', 'strokes.json')

/** Enough points to tell two stroke shapes apart without bloating the file. */
const POINTS_PER_STROKE = 16
/** Sub-samples per cubic segment when measuring arc length. */
const FLATTEN_STEPS = 24

const NUMBER = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/
const TOKEN = new RegExp(`[A-Za-z]|${NUMBER.source}`, 'g')

/** KanjiVG only ever uses M, C/c and S/s. Anything else is a surprise worth failing on. */
type Vector = { x: number; y: number }
type Cubic = [Vector, Vector, Vector, Vector]

function toCubicSegments(d: string): Cubic[] {
  const tokens = d.match(TOKEN) ?? []
  const segments: Cubic[] = []
  let i = 0
  let command = ''
  let current: Vector = { x: 0, y: 0 }
  let start: Vector = { x: 0, y: 0 }
  let previousControl: Vector | null = null
  const number = (): number => {
    const value = Number(tokens[i++])
    if (Number.isNaN(value)) throw new Error(`Expected a number in path: ${d}`)
    return value
  }
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i]!)) command = tokens[i++]!
    const relative = command === command.toLowerCase()
    const base = relative ? current : { x: 0, y: 0 }
    switch (command.toUpperCase()) {
      case 'M': {
        current = { x: base.x + number(), y: base.y + number() }
        start = current
        previousControl = null
        // A repeated coordinate pair after M is an implicit lineto.
        command = relative ? 'l' : 'L'
        break
      }
      case 'L': {
        const end = { x: base.x + number(), y: base.y + number() }
        segments.push([current, current, end, end])
        current = end
        previousControl = null
        break
      }
      case 'C': {
        const c1 = { x: base.x + number(), y: base.y + number() }
        const c2 = { x: base.x + number(), y: base.y + number() }
        const end = { x: base.x + number(), y: base.y + number() }
        segments.push([current, c1, c2, end])
        current = end
        previousControl = c2
        break
      }
      case 'S': {
        const c1 = previousControl
          ? { x: 2 * current.x - previousControl.x, y: 2 * current.y - previousControl.y }
          : current
        const c2 = { x: base.x + number(), y: base.y + number() }
        const end = { x: base.x + number(), y: base.y + number() }
        segments.push([current, c1, c2, end])
        current = end
        previousControl = c2
        break
      }
      case 'Z': {
        segments.push([current, current, start, start])
        current = start
        previousControl = null
        break
      }
      default:
        throw new Error(`Unsupported path command "${command}" in: ${d}`)
    }
  }
  return segments
}

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Vector {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/** The curve, flattened finely enough that arc length along it is accurate. */
function flatten(d: string): Point[] {
  const polyline: Point[] = []
  for (const segment of toCubicSegments(d)) {
    for (let step = 0; step <= FLATTEN_STEPS; step++) {
      const point = cubicAt(segment, step / FLATTEN_STEPS)
      const last = polyline[polyline.length - 1]
      if (!last || last[0] !== point.x || last[1] !== point.y) polyline.push([point.x, point.y])
    }
  }
  return polyline
}

const round = (value: number): number => Math.round(value * 10) / 10

type GeneratedStroke = { d: string; median: Point[] }

function strokesFor(character: string): GeneratedStroke[] {
  const file = join(KANJIVG, 'kanji', `${ord(character)}.svg`)
  const svg = readFileSync(file, 'utf8')
  const paths = [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((match) => match[1]!)
  if (paths.length === 0) throw new Error(`No strokes found for ${character} in ${file}`)
  return paths.map((d) => ({
    d,
    median: resample(flatten(d), POINTS_PER_STROKE).map(([x, y]): Point => [round(x), round(y)]),
  }))
}

const ord = (character: string): string => {
  const code = character.codePointAt(0)
  if (code === undefined) throw new Error('Expected a character, got an empty string')
  return code.toString(16).padStart(5, '0')
}

const data = {
  attribution:
    'Stroke data from KanjiVG (http://kanjivg.tagaini.net), Copyright (C) Ulrich Apel, ' +
    'licensed under CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). ' +
    'Resampled into evenly spaced points by scripts/build-stroke-data.ts.',
  license: 'CC BY-SA 3.0',
  source: 'https://github.com/KanjiVG/kanjivg',
  /** Every coordinate lives in a square of this size, as KanjiVG defines it. */
  viewBox: 109,
  pointsPerStroke: POINTS_PER_STROKE,
  characters: Object.fromEntries(
    ALL_CHARACTERS.map((character) => [character, strokesFor(character)]),
  ),
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data))
const strokeCount = Object.values(data.characters).reduce((sum, strokes) => sum + strokes.length, 0)
console.log(`${ALL_CHARACTERS.length} characters, ${strokeCount} strokes -> ${OUT}`)
