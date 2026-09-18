import { defineConfig } from 'vite'

/*
 * The judgement's numbers cannot be chosen from a desk, so a build with
 * MOJI_TUNING=1 carries a panel for moving them while writing. The build the
 * school hands out never does (see src/screens/tuning.ts).
 */
export default defineConfig({
  define: { __TUNING__: JSON.stringify(process.env.MOJI_TUNING === '1') },
  // GitHub Pages serves this project from https://<user>.github.io/moji/,
  // so every asset URL needs the repository name as a prefix.
  base: '/moji/',
  // `assets/` holds files that ship as-is: the cover artwork today, the
  // generated stroke and vocabulary data later.
  publicDir: 'assets',
  build: { outDir: 'dist' },
})
