import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import iconsApart from './scripts/icons-apart.mjs'
import prerender from './scripts/prerender.mjs'

// The crews' lines made in their voices (scripts/voices) are for this
// machine's dev server and a signed-in server only: whatever is in
// public/audio/voiced is left out of every build, so `npm run deploy` from
// this machine can't put it on the public site.
function keepVoicedOut() {
  let outDir = 'dist'
  return {
    name: 'keep-voiced-out',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      rmSync(resolve(outDir, 'audio/voiced'), { recursive: true, force: true })
    },
  }
}

export default defineConfig({
  // each react-icons icon a module of its own, so the entry chunk carries
  // only the icons the nav and footer draw (scripts/icons-apart.mjs)
  // and after a build, a page of its own for each route, for links shared
  // and search (scripts/prerender.mjs)
  plugins: [iconsApart(), react(), prerender(), keepVoicedOut()],
  // (the icons' modules import react-icons' own GenIcon: bundled up front in dev)
  optimizeDeps: { include: ['react-icons/lib'] },
  base: '/',
  // the skills and the other branches' worktrees under .claude, and the
  // scratch checkouts under lab/, bring their own tests
  test: { exclude: [...configDefaults.exclude, '.claude/**', '.agents/**', 'lab/**'] },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React and the router change rarely, so they cache apart from the
            // app. react-dom/server (one world renders SVG markup with it)
            // stays out, so it only loads with that world.
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\\/](?!.*server)/ },
          ],
        },
      },
    },
  },
})
