import { describe, expect, it } from 'vitest';
import { WORKER_SOURCE } from './engineCache.js';
import { withReturn } from './playReturn.js';
import { sourceOf } from './source.js';

describe('a function sent as its source text', () => {
  it('runs as the Worker’s bundle names it, the bundler’s __name stood in for', () => {
    // (what esbuild's keepNames makes of `const g = () => 2` inside a function)
    const named = '(function f(out) { const g = /* @__PURE__ */ __name(() => 2, "g"); out.v = g(); })';
    expect(() => new Function('out', `${named}(out);`)({})).toThrow(/__name/);
    const out = {};
    new Function('out', sourceOf(`${named}(out);`))(out);
    expect(out.v).toBe(2);
  });

  it('leaves nothing behind in the scope it runs in', () => {
    const scope = {};
    new Function('scope', sourceOf('scope.seen = typeof __name;'))(scope);
    expect(scope.seen).toBe('function');
    expect(typeof globalThis.__name).toBe('undefined');
  });

  it('is how the worker and the engine page’s script are sent', () => {
    const shim = 'const __name = (f) => f;';
    expect(WORKER_SOURCE).toContain(shim);
    expect(/<script>(.*)<\/script>/s.exec(withReturn(''))[1]).toContain(shim);
  });
});
