// The two test runs stay apart: `npm test` keeps its sub-second promise and
// never picks up a contract test that spawns a pipeline, and `npm run
// test:ai` finds every tier it can run without a GPU.
import { describe, expect, it } from 'vitest';
import ai from '../../vitest.ai.config.js';
import site from '../../vite.config.js';
import render from '../../vitest.render.config.js';

const AI_GLOBS = ['scripts/ai-e2e/**', '**/*.fuzz.test.js', '**/*.scenario.test.js', 'src/lib/battlefront/**/arena.test.js'];

describe('the two vitest runs', () => {
  it('keep the AI tiers out of npm test', () => {
    for (const glob of AI_GLOBS) expect(site.test.exclude).toContain(glob);
  });
  it('give npm run test:ai the contract tests, the fuzz tests, the brains’ scenarios, the space battles’ and the galaxy war’s campaigns, the ground war’s scenes and the Battlefront arena', () => {
    expect(ai.test.include).toEqual(['scripts/ai-e2e/**/*.test.mjs', 'src/**/*.fuzz.test.js', 'src/components/universe/npcs/brains/*.scenario.test.js', 'src/components/universe/battle*.scenario.test.js', 'src/components/galaxy/*.scenario.test.js', 'src/components/galaxy/surface/ground/*.scenario.test.js', 'src/lib/battlefront/**/arena.test.js']);
    expect(ai.test.testTimeout).toBe(15000);
    // the contract tests share temporary repositories and the dev-server port
    expect(ai.test.fileParallelism).toBe(false);
  });
  it('leave the renders, which need a browser, to npm run test:ai:render', () => {
    expect(ai.test.exclude).toContain('**/*.render.test.mjs');
    expect(render.test.include).toEqual(['scripts/ai-e2e/render/**/*.render.test.mjs']);
    expect(render.test.exclude).not.toContain('**/*.render.test.mjs');
    // a browser, a dev server and a model a test: a minute, not fifteen seconds
    expect(render.test.testTimeout).toBeGreaterThanOrEqual(60000);
  });
});
