/**
 * Where the app's contents come from.
 *
 * Two of the sources oblige us to say so: KanjiVG's licence spells out the
 * wording, and the government material asks that its origin be stated. The
 * panel is also the honest answer to "where did these 80 kanji come from?",
 * which matters because textbook lists were deliberately not used.
 */
import { CHARACTER_SOURCES } from '../data/characters'
import { loadStrokeData } from '../data/stroke-data'
import { requireElement } from '../app/dom'
import { STRINGS } from '../i18n/strings'
import type { ChoicesStore } from '../app/choices'
import type { Screen } from '../app/screen'
import './credits.css'

/** The address KanjiVG's licence asks to be linked. */
const KANJIVG_SITE = 'http://kanjivg.tagaini.net'

export function mountCredits(coverFrame: HTMLElement, choices: ChoicesStore): Screen {
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'credits__open'
  coverFrame.append(open)

  const panel = document.createElement('div')
  panel.className = 'credits'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.innerHTML = `
    <div class="credits__panel">
      <h1 class="credits__title"></h1>
      <dl class="credits__list"></dl>
      <button type="button" class="credits__close"></button>
    </div>`
  document.body.append(panel)

  const title = requireElement<HTMLHeadingElement>(panel, '.credits__title')
  const list = requireElement<HTMLDListElement>(panel, '.credits__list')
  const close = requireElement<HTMLButtonElement>(panel, '.credits__close')

  const entry = (term: string, lines: readonly string[], urls: readonly string[]): void => {
    const dt = document.createElement('dt')
    dt.textContent = term
    list.append(dt)
    for (const line of lines) {
      const dd = document.createElement('dd')
      dd.textContent = line
      list.append(dd)
    }
    for (const url of urls) {
      const dd = document.createElement('dd')
      const link = document.createElement('a')
      link.href = url
      link.textContent = url
      link.rel = 'noreferrer'
      dd.append(link)
      list.append(dd)
    }
  }

  const kanji = CHARACTER_SOURCES.kanjiGrade1
  void loadStrokeData().then((data) => {
    list.replaceChildren()
    // KanjiVG's licence asks for a link to its own site, not only to the code.
    entry('筆順 / Stroke order', [data.attribution], [KANJIVG_SITE, data.source])
    entry('漢字80字', [kanji.title, kanji.note], [kanji.url])
  })

  const render = (): void => {
    const strings = STRINGS[choices.get().language]
    open.textContent = strings.sources
    title.textContent = strings.sources
    close.textContent = strings.close
  }

  open.addEventListener('click', () => {
    panel.hidden = false
  })
  close.addEventListener('click', () => {
    panel.hidden = true
  })

  const unsubscribe = choices.subscribe(render)
  render()

  return {
    destroy() {
      unsubscribe()
      panel.remove()
    },
  }
}
