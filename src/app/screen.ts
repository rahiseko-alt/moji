/** A mounted screen. The app keeps exactly one at a time and tears it down on the way out. */
export type Screen = { destroy(): void }
