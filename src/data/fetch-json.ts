/**
 * Fetching one of the shipped data files.
 *
 * The stroke data and the word data are kept apart on purpose — two licences,
 * two files (ADR 0002, ADR 0014) — but they are fetched the same way, and the
 * way is worth writing once.
 */
export async function fetchData<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`)
  return (await response.json()) as T
}
