import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./useStage.js', import.meta.url), 'utf8');

describe('a page’s live view', () => {
  // Back from a building, the compound's mount ran loading, ready and on while
  // the page was busy, React batched them back to the 'on' it held from before
  // the game, and dropped the render that would have seen the world was now
  // the page's own: the canvas stayed hidden behind the veil for good.
  it('asks again whether the runtime’s world is its own at every change of the runtime’s status', () => {
    expect(src).toMatch(/const \[, heard\] = useState\(0\);/);
    expect(src).toMatch(/rt\?\.on\(\(\) => heard\(\(n\) => n \+ 1\)\)/);
  });
});
