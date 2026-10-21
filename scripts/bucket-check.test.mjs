import { describe, expect, it } from 'vitest';
import { probe } from './bucket-check.mjs';

const page = (keys) => `<ListBucketResult>${keys.map(([k, s]) => `<Contents><Key>${k}</Key><Size>${s}</Size></Contents>`).join('')}<IsTruncated>true</IsTruncated><NextContinuationToken>t</NextContinuationToken></ListBucketResult>`;

describe('probe', () => {
  it('lists one page alone and asks for its first key, held to the listing’s size', async () => {
    const asked = [];
    const fetch = async (url, init = {}) => {
      asked.push([init.method ?? 'GET', url]);
      return url.includes('list-type') ? new Response(page([['abc/a.glb', 5], ['abc/b.glb', 6]])) : new Response(null, { status: 200, headers: { 'content-length': '5' } });
    };
    expect(await probe(fetch, 'site-assets')).toEqual({ ok: true, keys: 2, first: 'abc/a.glb', status: 200, bytes: 5 });
    expect(asked.map(([m]) => m)).toEqual(['GET', 'HEAD']);
  });

  it('says a refusal, an empty bucket and a size that differs', async () => {
    expect(await probe(async () => new Response('no', { status: 403 }), 'b')).toMatchObject({ ok: false, error: 'list b/: HTTP 403' });
    expect(await probe(async () => new Response(page([])), 'b')).toMatchObject({ ok: false, error: 'no keys listed' });
    const short = async (url) => (url.includes('list-type') ? new Response(page([['k', 9]])) : new Response(null, { headers: { 'content-length': '3' } }));
    expect(await probe(short, 'b')).toMatchObject({ ok: false, bytes: 3 });
  });
});
