import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// public/_headers as Cloudflare reads it: a path pattern on a line of its
// own, its headers indented under it, # for a comment
const rules = () => {
  const out = [];
  for (const line of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) out.push({ path: line.trim(), headers: {} });
    else {
      const [name, ...rest] = line.trim().split(':');
      out.at(-1).headers[name.trim().toLowerCase()] = rest.join(':').trim();
    }
  }
  return out;
};
// (a pattern's * matches any run of characters, a path's slashes too)
const matches = (pattern, path) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path);

describe('the header rules (docs/stack/cloudflare.md)', () => {
  it('never set Cache-Control twice on a path: Cloudflare joins two matching rules’ values with a comma', () => {
    const caching = rules().filter((r) => r.headers['cache-control']);
    expect(caching.map((r) => r.path)).not.toContain('/*');
    const paths = ['/h/0123456789ab/textures/universe/earth.webp', '/assets/index-abc123.js', '/textures/universe/earth.webp', '/hdri/sky.hdr', '/cc0/rock/albedo.webp', '/fonts/a.woff', '/models/x.glb', '/index.html', '/audio/sitar-listen.mp3'];
    for (const p of paths) expect(caching.filter((r) => matches(r.path, p)).length, p).toBeLessThanOrEqual(1);
  });

  it('keep the hashed bundle and the pictures under their hash a year, and the pictures whose names stay when they change fresh in the background, never a year', () => {
    const at = (p) => rules().find((r) => r.headers['cache-control'] && matches(r.path, p))?.headers['cache-control'] ?? null;
    expect(at('/assets/index-abc123.js')).toMatch(/max-age=31536000.*immutable/);
    // (a picture under its content's hash, scripts/site-hashes.mjs: never changes)
    expect(at('/h/0123456789ab/textures/universe/earth.webp')).toMatch(/max-age=31536000.*immutable/);
    for (const p of ['/textures/universe/earth.webp', '/hdri/sky.hdr', '/cc0/rock/albedo.webp', '/fonts/a.woff']) {
      expect(at(p), p).toMatch(/max-age=0\b/);
      expect(at(p), p).toMatch(/stale-while-revalidate=\d+/);
    }
    // (a model is read for its nodes' names by the code that comes with it:
    // one a visit stale could break that visit, so models keep the default)
    expect(at('/models/x.glb')).toBeNull();
    expect(at('/index.html')).toBeNull();
  });
});
