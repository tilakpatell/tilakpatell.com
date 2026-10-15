import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLOW_RATE, WAIT_MS, answered, forgetDown, isDown, markAnswered, markDown, waitFor } from './assetDown';
import * as base from './assetBase';

// The bucket's up-or-down state, apart from the manifest: runtime/install.js
// reads it on every page, and through lib/assetBase it carried the whole
// manifest (77,510 entries, 9 MB of script) into the site's first load
describe('the asset base’s state, without the manifest', () => {
  it('goes down and comes back, and remembers a first answer', () => {
    forgetDown();
    expect(isDown()).toBe(false);
    expect(answered()).toBe(false);
    markAnswered();
    expect(answered()).toBe(true);
    markDown();
    expect(isDown()).toBe(true);
    forgetDown();
    expect(isDown()).toBe(false);
    expect(answered()).toBe(false);
  });

  it('waits at least WAIT_MS, longer for a big first file', () => {
    expect(waitFor(0)).toBe(WAIT_MS);
    expect(waitFor(SLOW_RATE * 60)).toBe(60000);
  });

  it('is the same state lib/assetBase answers with', () => {
    forgetDown();
    markDown();
    expect(base.isDown()).toBe(true);
    base.forgetDown();
    expect(isDown()).toBe(false);
  });

  it('imports no manifest, and the runtime’s installer reads it from here', () => {
    expect(readFileSync(new URL('./assetDown.js', import.meta.url), 'utf8')).not.toMatch(/^import /m);
    expect(readFileSync(new URL('../runtime/install.js', import.meta.url), 'utf8')).not.toMatch(/from '[^']*\/assetBase'/);
  });
});
