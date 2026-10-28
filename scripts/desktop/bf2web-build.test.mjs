import { describe, expect, it } from 'vitest';
import { ENTRY, buildId, steps } from './bf2web-build.mjs';

const sha = 'da7a51b38f445971d66c1c6f9124e09c064f8595';

describe('the desktop’s bf2-web build', () => {
  it('names a build by its commit, and refuses what isn’t one', () => {
    expect(buildId(sha)).toBe('main-da7a51b3');
    expect(() => buildId('main')).toThrow(/not a commit/);
  });

  it('builds by bf2-web’s own entry point, checks, takes the rulebooks, then uploads and releases, in that order', () => {
    const plan = steps({ sha, id: 'main-da7a51b3', repo: '/r', tree: '/h/main-da7a51b3', site: '/h/site', ui: '/h/ui', web: '/x/web' });
    expect(plan.map((s) => s.name)).toEqual(['the worktree', 'the build (bf2-web’s entry point)', 'the site checked against its manifest', 'the front end’s rulebooks', 'the upload', 'the engine’s private release']);
    expect(plan[1]).toMatchObject({ cmd: 'node', args: [ENTRY, '--out', '/h/site', '--commit', sha], cwd: '/h/main-da7a51b3' });
    expect(plan[4].args).toEqual(['scripts/bf2web-upload.mjs', '/h/site', '--build', 'main-da7a51b3', '--ui-data', '/h/ui']);
    // (only the release may fail and the build stand: the site plays from the bucket, not the release)
    expect(plan.filter((s) => s.optional).map((s) => s.name)).toEqual(['the engine’s private release']);
  });
});
