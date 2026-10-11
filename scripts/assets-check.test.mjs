import { describe, expect, it } from 'vitest';
import { check, verdict } from './assets-check.mjs';

const got = (http, headers) => ({ status: 'fetched', http, headers: new Headers(headers) });
const e = { hash: 'abcdef123456', bytes: 500 };

describe('the bucket held to its manifest', () => {
  it('passes a file of the right size with a year’s cache', () => {
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'public, max-age=31536000' }))).toBeNull();
    expect(verdict(e, got(200, { 'content-length': '500', 'cache-control': 'max-age=31536000' }))).toBeNull();
  });

  it('fails a file that is not there, the wrong size, or cached for less than a year', () => {
    expect(verdict(e, { status: 'missing', http: 400 })).toMatch(/not in the bucket/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/499', 'cache-control': 'max-age=31536000' }))).toMatch(/499 bytes, the manifest says 500/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'no-cache' }))).toMatch(/no-cache/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500' }))).toMatch(/none/);
    expect(verdict(e, { status: 'failed', error: 'timed out' })).toBe('timed out');
  });

  it('asks each entry’s published URL for one byte, and names the ones that are wrong', async () => {
    const asked = [];
    const pool = {
      run: async (job) => {
        asked.push([job.url, job.headers.range]);
        return job.url.includes('bad') ? { status: 'missing', http: 404 } : got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'max-age=31536000' });
      },
    };
    const said = [];
    const bad = await check({ base: 'https://b/site-assets/', entries: { 'models/ok.glb': e, 'models/bad.glb': e }, pool, log: (s) => said.push(s) });
    expect(bad).toEqual(['models/bad.glb']);
    expect(asked).toContainEqual(['https://b/site-assets/abcdef123456/models/ok.glb', 'bytes=0-0']);
    expect(said.join('\n')).toMatch(/models\/bad\.glb: not in the bucket/);
  });

  it('holds a whole level’s folder row by its level.json under the folder’s hash (lane G2)', async () => {
    const asked = [];
    const pool = { run: async (job) => (asked.push(job.url), got(206, { 'content-range': 'bytes 0-0/40', 'cache-control': 'max-age=31536000' })) };
    const row = { hash: 'abcdef123456', bytes: 9000, files: 12, check: { file: 'level.json', bytes: 40 } };
    const bad = await check({ base: 'https://b/site-assets', entries: { 'models/galaxy/bf2017/levels/hoth/game/hoth_01/': row }, pool, log: () => {} });
    expect(bad).toEqual([]);
    expect(asked).toEqual(['https://b/site-assets/abcdef123456/models/galaxy/bf2017/levels/hoth/game/hoth_01/level.json']);
  });
});
