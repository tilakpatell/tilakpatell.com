import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addOnly } from './bf2web-assets.mjs';
import { plan } from '../bucket-put.mjs';
import { ENDPOINT } from '../lib/bucket.mjs';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tree(files) {
  const d = mkdtempSync(join(tmpdir(), 'bf2web-assets-'));
  dirs.push(d);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(d, path, '..'), { recursive: true });
    writeFileSync(join(d, path), body);
  }
  return d;
}
// a pool over a bucket kept in a Map (as bucket-put.test.mjs): a HEAD says its size, a PUT stores it; `deny` answers a HEAD 403
function fakePool(stored = {}, { deny = [], refuse = [] } = {}) {
  const asked = [];
  return {
    asked,
    stored,
    run: async (job) => {
      const key = decodeURIComponent(job.url.slice(`${ENDPOINT}/bf2017-assets/`.length));
      asked.push([job.method, key]);
      if (job.method === 'HEAD') {
        if (deny.includes(key)) return { status: 'failed', http: 403, error: 'HTTP 403' };
        return key in stored ? { status: 'fetched', headers: new Headers({ 'content-length': String(stored[key]) }) } : { status: 'missing' };
      }
      if (refuse.includes(key)) return { status: 'failed', error: 'HTTP 500' };
      stored[key] = job.body.length;
      return { status: 'fetched', headers: new Headers() };
    },
  };
}
const CARD = 'textures/ui/bitmaps/frontend/cards/card_images/characters';
const files = { [`${CARD}/rey/card_rey_01_small.png`]: 'aaaa', [`${CARD}/rey/card_rey_02_small.png`]: 'bbbbbb', [`${CARD}/yoda/card_yoda_01_small.png`]: 'cc' };
const items = plan(Object.keys(files), 'web/');

describe('add-only', () => {
  it('sends only the keys the bucket answers 404 for, and verifies each after the PUT', async () => {
    const root = tree(files);
    const pool = fakePool({ [`web/${CARD}/rey/card_rey_01_small.png`]: 4 });
    const r = await addOnly({ root, items, pool, fetch: null, bucket: 'bf2017-assets', log: () => {} });
    expect(r).toEqual({ uploaded: 2, skipped: 1, failed: [], sent: [`web/${CARD}/rey/card_rey_02_small.png`, `web/${CARD}/yoda/card_yoda_01_small.png`] });
    expect(pool.asked.filter(([m]) => m === 'PUT').map(([, k]) => k)).toEqual([`web/${CARD}/rey/card_rey_02_small.png`, `web/${CARD}/yoda/card_yoda_01_small.png`]);
  });
  it('never overwrites a key the bucket holds, even at another size (bucket-put would re-send it)', async () => {
    const root = tree(files);
    const pool = fakePool({ [`web/${CARD}/rey/card_rey_01_small.png`]: 999, [`web/${CARD}/rey/card_rey_02_small.png`]: 1, [`web/${CARD}/yoda/card_yoda_01_small.png`]: 7 });
    const r = await addOnly({ root, items, pool, fetch: null, bucket: 'bf2017-assets', log: () => {} });
    expect(r.uploaded).toBe(0);
    expect(r.skipped).toBe(3);
    expect(pool.asked.some(([m]) => m === 'PUT')).toBe(false);
    expect(pool.stored[`web/${CARD}/rey/card_rey_01_small.png`]).toBe(999);
  });
  it('a HEAD that is neither 200 nor 404 stops the run before any PUT', async () => {
    const root = tree(files);
    const pool = fakePool({}, { deny: [`web/${CARD}/yoda/card_yoda_01_small.png`] });
    const r = await addOnly({ root, items, pool, fetch: null, bucket: 'bf2017-assets', log: () => {} });
    expect(r.failed).toEqual([{ key: `web/${CARD}/yoda/card_yoda_01_small.png`, error: 'HEAD 403 HTTP 403' }]);
    expect(pool.asked.some(([m]) => m === 'PUT')).toBe(false);
  });
  it('a listed file missing on disk stops the run before anything is asked', async () => {
    const root = tree({ [`${CARD}/rey/card_rey_01_small.png`]: 'aaaa' });
    const pool = fakePool({});
    const r = await addOnly({ root, items, pool, fetch: null, bucket: 'bf2017-assets', log: () => {} });
    expect(r.failed.map((f) => f.error)).toEqual(['not on disk', 'not on disk']);
    expect(pool.asked).toHaveLength(0);
  });
  it('a failed PUT is counted as failed, not uploaded', async () => {
    const root = tree(files);
    const pool = fakePool({}, { refuse: [`web/${CARD}/rey/card_rey_02_small.png`] });
    const r = await addOnly({ root, items, pool, fetch: null, bucket: 'bf2017-assets', log: () => {} });
    expect(r.uploaded).toBe(2);
    expect(r.failed.map((f) => f.key)).toEqual([`web/${CARD}/rey/card_rey_02_small.png`]);
  });
});
