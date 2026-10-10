// The second test run, for the AI and the models (scripts/ai-e2e/README.md):
// the pipelines with fake engines, the assets as shipped, the brains
// scripted and fuzzed, the agent's guards, the galaxy war's balance over
// whole campaigns. Apart from `npm test` so that one stays fast; `npm run
// test:ai` runs this.
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/ai-e2e/**/*.test.mjs', 'src/**/*.fuzz.test.js', 'src/components/universe/npcs/brains/*.scenario.test.js', 'src/components/universe/battle*.scenario.test.js', 'src/components/galaxy/*.scenario.test.js', 'src/components/galaxy/surface/ground/*.scenario.test.js', 'src/lib/battlefront/**/arena.test.js'],
    // tier 3's renders need a browser: `npm run test:ai:render` runs them (vitest.render.config.js)
    exclude: [...configDefaults.exclude, '.claude/**', '.agents/**', 'lab/**', '**/*.render.test.mjs'],
    // a contract test runs a pipeline in subprocesses: seconds, not milliseconds
    testTimeout: 15000,
    // they share temporary repositories and ports, so one file at a time
    fileParallelism: false,
    passWithNoTests: true,
  },
})
