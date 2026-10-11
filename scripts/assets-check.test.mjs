import { describe, expect, it } from 'vitest';
import { check, verdict } from './assets-check.mjs';

const got = (http, headers) => ({ status: 'fetched', http, headers: new Headers(headers) });
const e = { hash: 'abcdef123456', bytes: 500 };

describe('the bucket held to its manifest', () => {
  it('passes a file of the right size with a year’s cache', () => {
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'public, max-age=31536000' }))).toBeNull();
    expect(verdict(e, got(200, { 'content-length': '500', 'cache-control': 'max-age=31536000' }))).toBeNull();
  });

  it('passes an empty file, which has no first byte to give (HTTP 416, bytes */0): an interior’s horizon.bin', () => {
    const empty = { hash: 'abcdef123456', bytes: 0 };
    expect(verdict(empty, got(416, { 'content-range': 'bytes */0', 'cache-control': 'max-age=31536000' }))).toBeNull();
    expect(verdict(e, got(416, { 'content-range': 'bytes */0' }))).toMatch(/HTTP 416/);
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
});
