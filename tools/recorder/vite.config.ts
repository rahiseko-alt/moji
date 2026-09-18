import { defineConfig } from 'vite'

/*
 * The recorder is built on its own: it is a measuring tool, published once as
 * an Artifact so a learner can write on a real phone, and it must never end up
 * in the app the school hands out.
 */
export default defineConfig({
  root: 'tools/recorder',
  base: './',
  publicDir: '../../assets',
  build: { outDir: '../../dist-recorder', emptyOutDir: true },
})
