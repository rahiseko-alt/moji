/**
 * The model strokes every character is drawn and scored against.
 *
 * Generated from KanjiVG by scripts/build-stroke-data.mjs and fetched once, so
 * the whole set is in memory before a learner starts writing.
 */

export type Point = readonly [x: number, y: number]

export type Stroke = {
  /** The original SVG path, for drawing the faint model character smoothly. */
  readonly d: string
  /** Evenly spaced points along that path, for comparing against what was written. */
  readonly median: readonly Point[]
}

export type StrokeData = {
  readonly attribution: string
  readonly license: string
  readonly source: string
  /** Every coordinate lives in a square of this size. */
  readonly viewBox: number
  readonly pointsPerStroke: number
  readonly characters: Readonly<Record<string, readonly Stroke[]>>
}

let pending: Promise<StrokeData> | null = null
let arrived: StrokeData | null = null

export function loadStrokeData(): Promise<StrokeData> {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/strokes.json`).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load stroke data: ${response.status}`)
    arrived = (await response.json()) as StrokeData
    return arrived
  })
  return pending
}

/** The data if the fetch has already landed, for screens that cannot wait for it. */
export function strokeDataIfLoaded(): StrokeData | null {
  return arrived
}

export function strokesFor(data: StrokeData, character: string): readonly Stroke[] {
  const strokes = data.characters[character]
  if (!strokes) throw new Error(`No stroke data for "${character}"`)
  return strokes
}
