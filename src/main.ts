import './styles/tokens.css'
import './styles/base.css'
import { createChoices } from './app/choices'
import { mountOrientationGate } from './app/orientation-gate'
import { mountCover } from './screens/cover'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app is missing from index.html')

const choices = createChoices()
const orientationGate = mountOrientationGate(root)
choices.subscribe(({ language }) => orientationGate.setLanguage(language))

mountCover(root, choices)
