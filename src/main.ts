import './styles/tokens.css'
import './styles/base.css'
import { createChoicesStore } from './app/choices'
import { requireElement } from './app/dom'
import { loadStrokeData } from './data/stroke-data'
import { mountOrientationGate } from './app/orientation-gate'
import { mountCover } from './screens/cover'

const root = requireElement<HTMLElement>(document, '#app')

const choices = createChoicesStore()
const orientationGate = mountOrientationGate(root)
choices.subscribe(({ language }) => orientationGate.setLanguage(language))

mountCover(root, choices)

// Warm the stroke data while the learner is still choosing, so the first
// writing screen has nothing to wait for — and so a later visit works offline.
void loadStrokeData()
