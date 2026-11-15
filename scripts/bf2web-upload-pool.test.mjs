// bf2web-upload.mjs's copy pool: copies (server-side, no body) on BF2WEB_COPY_STREAMS streams (default 32), everything else on four, and 4
// is the old single pool exactly. The uploader runs at import (top-level await), so its pool code is read as text, and the split it does is
// replayed here on a plan of the uploader's shape.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./bf2web-upload.mjs', import.meta.url), 'utf8');

describe('bf2web-upload copy pool', () => {
  it('defaults to 32 copy streams, read from BF2WEB_COPY_STREAMS, and keeps four for bodies', () => {
    expect(src).toContain('Math.floor(Number(process.env.BF2WEB_COPY_STREAMS ?? 32)) || 32');
    expect(src).toContain('...Array.from({ length: 4 }, lane(rest))');
    expect(src).toContain('...Array.from({ length: copies.length ? COPY_STREAMS : 0 }, lane(copies))');
    expect(src).toMatch(/await send\(last\);\s*console\.log\(`\$\{id\}: uploaded, its manifest last`\);/);
  });
  it('splits copies from the rest, and at 4 keeps one pool of four for all (the old behaviour)', () => {
    const split = (plan, streams) => {
      const copies = streams === 4 ? [] : plan.filter((q) => q.action === 'copy');
      const copySet = new Set(copies);
      return { copies, rest: plan.filter((q) => !copySet.has(q)) };
    };
    expect(src).toContain("const copies = COPY_STREAMS === 4 ? [] : queue.filter((q) => q.action === 'copy');");
    expect(src).toContain('const copySet = new Set(copies), rest = queue.filter((q) => !copySet.has(q));');
    const plan = [{ action: 'copy' }, { action: 'put' }, { action: 'skip' }, { action: 'copy' }];
    expect(split(plan, 32).copies).toHaveLength(2);
    expect(split(plan, 32).rest.map((q) => q.action)).toEqual(['put', 'skip']);
    expect(split(plan, 4).copies).toHaveLength(0);
    expect(split(plan, 4).rest).toHaveLength(4);
  });
});
