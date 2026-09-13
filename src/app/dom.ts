/**
 * Screens build their own markup, so a missing element is a bug in this
 * repository rather than something to recover from at runtime.
 */
export function requireElement<E extends Element>(root: ParentNode, selector: string): E {
  const element = root.querySelector<E>(selector)
  if (!element) throw new Error(`No element matches ${selector}`)
  return element
}
