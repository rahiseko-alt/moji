import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves this project from https://<user>.github.io/moji/,
  // so every asset URL needs the repository name as a prefix.
  base: '/moji/',
  // `assets/` holds files that ship as-is: the cover artwork today, the
  // generated stroke and vocabulary data later.
  publicDir: 'assets',
  build: { outDir: 'dist' },
})
