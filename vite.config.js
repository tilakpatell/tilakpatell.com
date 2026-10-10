import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import iconsApart from './scripts/icons-apart.mjs'
import prerender from './scripts/prerender.mjs'
import packs from './scripts/packs.mjs'
import assetManifest from './scripts/assets-manifest.mjs'
import bf2Dev from './scripts/bf2-dev.mjs'

export default defineConfig({
  // each react-icons icon a module of its own, so the entry chunk carries
  // only the icons the nav and footer draw (scripts/icons-apart.mjs)
  // and after a build, a page of its own for each route, for links shared
  // and search (scripts/prerender.mjs), and each world's install pack
  // (scripts/packs.mjs), and the heavy assets' manifest, only the entries
  // still true of public/ (scripts/assets-manifest.mjs)
  // (and, in dev with BF2_ROOT set, the local Battlefront export at /bf2/:
  // scripts/bf2-dev.mjs; nothing when it is unset)
  plugins: [iconsApart(), react(), prerender(), packs(), assetManifest(), bf2Dev()],
  // (the icons' modules import react-icons' own GenIcon: bundled up front in dev)
  optimizeDeps: { include: ['react-icons/lib'] },
  base: '/',
  // the skills and the other branches' worktrees under .claude, and the
  // scratch checkouts under lab/, bring their own tests; the AI tiers are
  // `npm run test:ai` (vitest.ai.config.js), slower than this run promises
  test: { exclude: [...configDefaults.exclude, '.claude/**', '.agents/**', 'lab/**', 'scripts/health/fixtures/**', 'scripts/ai-e2e/**', '**/*.fuzz.test.js', '**/*.scenario.test.js', 'src/lib/battlefront/**/arena.test.js'] },
  build: {
    // the chunk graph scripts/packs.mjs reads for each world's pack
    manifest: true,
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
