// The flight core's budgets (src/runtime/hud/flight/*.scenario.test.js): a
// frame's time, its writes, what it allocates and a radar draw, over a
// fight held in Node. Apart from `npm test` (timings want a quiet run, and
// the allocation's measure, V8's sampling heap profiler, a process of its
// own); `npx vitest run --config vitest.flight.config.js` runs it.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/runtime/hud/flight/*.scenario.test.js'],
  },
})
