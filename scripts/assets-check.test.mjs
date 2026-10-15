import { describe, expect, it } from 'vitest';
import { changedSince, check, manifestAt, verdict } from './assets-check.mjs';

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
    // (as the pool answers it: a 4xx is `failed` with its headers kept)
    expect(verdict(empty, { status: 'failed', http: 416, headers: new Headers({ 'content-range': 'bytes */0' }), error: 'HTTP 416' })).toBeNull();
    expect(verdict(empty, { status: 'failed', http: 416, error: 'HTTP 416' })).toBe('HTTP 416');
  });

  it('fails a file that is not there, the wrong size, or cached for less than a year', () => {
    expect(verdict(e, { status: 'missing', http: 400 })).toMatch(/not in the bucket/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/499', 'cache-control': 'max-age=31536000' }))).toMatch(/499 bytes, the manifest says 500/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'no-cache' }))).toMatch(/no-cache/);
    expect(verdict(e, got(206, { 'content-range': 'bytes 0-0/500' }))).toMatch(/none/);
    expect(verdict(e, { status: 'failed', error: 'timed out' })).toBe('timed out');
  });

  it('asks each entry’s published URL for one byte, the body unread, and names the ones that are wrong', async () => {
    const asked = [];
    const pool = {
      run: async (job) => {
        asked.push([job.url, job.headers.range, job.peek]);
        if (job.url.includes('bad')) return { status: 'missing', http: 404 };
        if (job.url.includes('whole')) return got(200, { 'content-length': '500', 'cache-control': 'max-age=31536000' });
        return got(206, { 'content-range': 'bytes 0-0/500', 'cache-control': 'max-age=31536000' });
      },
    };
    const said = [];
    const tally = {};
    const bad = await check({ base: 'https://b/site-assets/', entries: { 'models/ok.glb': e, 'models/bad.glb': e, 'models/whole.glb': e }, pool, log: (s) => said.push(s), tally });
    expect(bad).toEqual(['models/bad.glb']);
    expect(asked).toContainEqual(['https://b/site-assets/abcdef123456/models/ok.glb', 'bytes=0-0', true]);
    expect(said.join('\n')).toMatch(/models\/bad\.glb: not in the bucket/);
    // (a CDN that gave the whole file to the one-byte range is counted, so the deploy's log says so)
    expect(tally.whole).toBe(1);
  });

  it('with --since, asks only what the manifests gained or changed since that commit', () => {
    const old = { 'a.glb': { hash: 'aaaaaaaaaaaa', bytes: 1 }, 'b.glb': { hash: 'bbbbbbbbbbbb', bytes: 2 }, 'c.glb': { hash: 'cccccccccccc', bytes: 3 }, 'gone.glb': { hash: 'dddddddddddd', bytes: 4 } };
    const now = { 'a.glb': { hash: 'aaaaaaaaaaaa', bytes: 1 }, 'b.glb': { hash: 'b2b2b2b2b2b2', bytes: 2 }, 'c.glb': { hash: 'cccccccccccc', bytes: 30 }, 'new.glb': { hash: 'eeeeeeeeeeee', bytes: 5 } };
    expect(Object.keys(changedSince(now, old))).toEqual(['b.glb', 'c.glb', 'new.glb']);
    expect(Object.keys(changedSince(now, {}))).toEqual(Object.keys(now));
    expect(Object.keys(changedSince(now, undefined))).toEqual(Object.keys(now));
    // (the manifest as a commit had it, read from git; one that wasn't there is empty, so everything is asked)
    expect(manifestAt('HEAD', `${process.cwd()}/package.json`, process.cwd())).toHaveProperty('name', 'tilakpatell.com');
    expect(manifestAt('HEAD', `${process.cwd()}/src/data/no-such-manifest.json`, process.cwd())).toEqual({});
    expect(manifestAt('no-such-ref', `${process.cwd()}/package.json`, process.cwd())).toEqual({});
  });
});
