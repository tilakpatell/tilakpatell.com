// The walker's camera on a world without a level pack is the one it had
// before the game's camera came (lane C of the fidelity design): follow()
// is byte for byte what it was, less the one line that hands a level's
// world to gameFollow, and that line only runs where `site.level` is set.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./scene.js', import.meta.url), 'utf8');
const GUARD = '    if (gameCam && !riding && !state.zone) return gameFollow(dt, p, adsWant);\n';
// (sha-256 of follow() before lane C, from `function follow` to its closing brace)
const BEFORE = '3aa31b6e7179efdf129db19a57e98891faddb3ede4df5945e3550f56670739c1';

const followOf = (s) => {
  const a = s.indexOf('  function follow(dt) {');
  const b = s.indexOf('\n  }\n', a);
  return s.slice(a, b + 4);
};

describe('the surface camera without a level', () => {
  it('follow() is unchanged but for the one guard', () => {
    const follow = followOf(src);
    expect(follow.split(GUARD)).toHaveLength(2);
    expect(createHash('sha256').update(follow.replace(GUARD, '')).digest('hex')).toBe(BEFORE);
  });

  it('the game camera exists only where the site has a level', () => {
    expect(src).toMatch(/const gameCam = site\.level \? \{/);
    // (nothing else in follow() reads it)
    expect(followOf(src).match(/gameCam/g)).toHaveLength(1);
  });
});
