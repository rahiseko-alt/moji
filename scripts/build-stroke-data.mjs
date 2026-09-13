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
 * Usage: node scripts/build-stroke-data.mjs [path-to-kanjivg-checkout]
 * The result is committed, so a build never needs the network.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
function toCubicSegments(d) {
  const tokens = d.match(TOKEN) ?? []
  const segments = []
  let i = 0
  let command = ''
  let current = null
  let start = null
  let previousControl = null
  const number = () => {
    const value = Number(tokens[i++])
    if (Number.isNaN(value)) throw new Error(`Expected a number in path: ${d}`)
    return value
  }
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++]
    const relative = command === command.toLowerCase()
    const base = relative && current ? current : { x: 0, y: 0 }
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
        if (start) segments.push([current, current, start, start])
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

function cubicAt([p0, p1, p2, p3], t) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/** Evenly spaced by arc length, so the points describe the shape rather than the curve's parameterisation. */
function medianOf(d) {
  const polyline = []
  for (const segment of toCubicSegments(d)) {
    for (let step = 0; step <= FLATTEN_STEPS; step++) {
      const point = cubicAt(segment, step / FLATTEN_STEPS)
      const last = polyline[polyline.length - 1]
      if (!last || last.x !== point.x || last.y !== point.y) polyline.push(point)
    }
  }
  if (polyline.length === 1) {
    return Array.from({ length: POINTS_PER_STROKE }, () => [round(polyline[0].x), round(polyline[0].y)])
  }
  const lengths = [0]
  for (let n = 1; n < polyline.length; n++) {
    const dx = polyline[n].x - polyline[n - 1].x
    const dy = polyline[n].y - polyline[n - 1].y
    lengths.push(lengths[n - 1] + Math.hypot(dx, dy))
  }
  const total = lengths[lengths.length - 1]
  const points = []
  let cursor = 1
  for (let n = 0; n < POINTS_PER_STROKE; n++) {
    const target = (total * n) / (POINTS_PER_STROKE - 1)
    while (cursor < lengths.length - 1 && lengths[cursor] < target) cursor++
    const span = lengths[cursor] - lengths[cursor - 1]
    const t = span === 0 ? 0 : (target - lengths[cursor - 1]) / span
    const a = polyline[cursor - 1]
    const b = polyline[cursor]
    points.push([round(a.x + (b.x - a.x) * t), round(a.y + (b.y - a.y) * t)])
  }
  return points
}

const round = (value) => Math.round(value * 10) / 10

function strokesFor(character) {
  const file = join(KANJIVG, 'kanji', `${ord(character)}.svg`)
  const svg = readFileSync(file, 'utf8')
  const paths = [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((match) => match[1])
  if (paths.length === 0) throw new Error(`No strokes found for ${character} in ${file}`)
  return paths.map((d) => ({ d, median: medianOf(d) }))
}

const ord = (character) => character.codePointAt(0).toString(16).padStart(5, '0')

const characters = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'characters.json'), 'utf8'))
const all = [...characters.hiragana, ...characters.katakana, ...characters.kanjiGrade1]

const data = {
  attribution:
    'Stroke data from KanjiVG (http://kanjivg.tagaini.net), Copyright (C) Ulrich Apel, ' +
    'licensed under CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). ' +
    'Resampled into evenly spaced points by scripts/build-stroke-data.mjs.',
  license: 'CC BY-SA 3.0',
  source: 'https://github.com/KanjiVG/kanjivg',
  /** Every coordinate lives in a square of this size, as KanjiVG defines it. */
  viewBox: 109,
  pointsPerStroke: POINTS_PER_STROKE,
  characters: Object.fromEntries(all.map((character) => [character, strokesFor(character)])),
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data))
const strokeCount = Object.values(data.characters).reduce((sum, strokes) => sum + strokes.length, 0)
console.log(`${all.length} characters, ${strokeCount} strokes -> ${OUT}`)
