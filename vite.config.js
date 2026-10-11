import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import iconsApart from './scripts/icons-apart.mjs'
import prerender from './scripts/prerender.mjs'
import packs from './scripts/packs.mjs'
import assetManifest from './scripts/assets-manifest.mjs'
import bf2Dev from './scripts/bf2-dev.mjs'
import rapierWasm from './scripts/rapier-wasm.mjs'

export default defineConfig({
  // each react-icons icon a module of its own, so the entry chunk carries
  // only the icons the nav and footer draw (scripts/icons-apart.mjs)
  // and after a build, a page of its own for each route, for links shared
  // and search (scripts/prerender.mjs), and each world's install pack
  // (scripts/packs.mjs), and the heavy assets' manifest, only the entries
  // still true of public/ (scripts/assets-manifest.mjs)
  // (and, in dev with BF2_ROOT set, the local Battlefront export at /bf2/:
  // scripts/bf2-dev.mjs; nothing when it is unset)
  // (and Rapier's wasm import sent to the shim that streams the binary:
  // scripts/rapier-wasm.mjs, lane X3)
  plugins: [rapierWasm(), iconsApart(), react(), prerender(), packs(), assetManifest(), bf2Dev()],
  // (the icons' modules import react-icons' own GenIcon: bundled up front in dev)
  // (scanned from the site's own page only: the tool pages under scripts/ and
  // .claude/ import aliases and packages the site doesn't, and a failed scan
  // leaves react-dom bundled twice, the page blank; and every dependency
  // found only as a browser asks for it, each a re-bundle and a "504
  // (Outdated Optimize Dep)" reload, which took CI's Multiplayer check's page
  // from under it, 2026-10-10)
  // (Rapier's two packages left out of the optimizer: prebundled, their wasm
  // import would be met before scripts/rapier-wasm.mjs could send it to the
  // shim; both are plain ES modules and serve as they are)
  optimizeDeps: { entries: ['index.html'], include: ['react-icons/lib'], exclude: ['@dimforge/rapier3d', '@dimforge/rapier3d-simd'] },
  base: '/',
  // Rapier's packages carry only a `module` entry, which Node's own
  // resolution (what Vite's SSR uses for a dependency it leaves external)
  // does not read: the tests and scripts/x2-profile.mjs load them through
  // Vite instead, so scripts/rapier-wasm.mjs meets their wasm import there
  // too (lane X3)
  ssr: { noExternal: ['@dimforge/rapier3d', '@dimforge/rapier3d-simd'] },
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
