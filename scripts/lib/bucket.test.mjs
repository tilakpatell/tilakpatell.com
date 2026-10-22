import { describe, expect, it } from 'vitest';
import { ENDPOINT, assetBase, bucketEnv, folder, keysOf, list, listing, objectUrl, put, remove, sign, signer } from './bucket.mjs';

// AWS's worked examples for a signed S3 request ("Signature calculations for
// the Authorization header: transferring payload in a single chunk"): their
// keys, their bucket, 24 May 2013 at midnight, and the signatures they print.
const AWS = { id: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z') };
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const signatureOf = (h) => h.authorization.match(/Signature=([0-9a-f]+)/)[1];

describe('sign', () => {
  it("matches AWS's GET Object example (a range, signed)", () => {
    const h = sign({ ...AWS, url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, payload: EMPTY });
    expect(h.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
    expect(h['x-amz-date']).toBe('20130524T000000Z');
    expect(h.host).toBeUndefined();
  });

  it("matches AWS's PUT Object example (an encoded path, more headers)", () => {
    const h = sign({
      ...AWS,
      method: 'PUT',
      url: 'https://examplebucket.s3.amazonaws.com/test%24file.text',
      headers: { Date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
      payload: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    });
    expect(signatureOf(h)).toBe('98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  });

  it("matches AWS's lifecycle and list examples (a query, sorted)", () => {
    expect(signatureOf(sign({ ...AWS, url: 'https://examplebucket.s3.amazonaws.com/?lifecycle', payload: EMPTY }))).toBe('fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543');
    expect(signatureOf(sign({ ...AWS, url: 'https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2', payload: EMPTY }))).toBe('34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
  });
});

describe('the keys', () => {
  it('drops the whitespace a paste leaves, and is null without both', () => {
    expect(keysOf({ R2_ACCESS_KEY_ID: ' abc\n', R2_SECRET_ACCESS_KEY: 'def\r\n' })).toEqual({ id: 'abc', secret: 'def' });
    expect(keysOf({ R2_ACCESS_KEY_ID: 'abc' })).toBeNull();
    expect(bucketEnv({})).toBeNull();
    expect(bucketEnv({ R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b' }).base).toBe(ENDPOINT);
  });
});

describe('signer', () => {
  it("signs a request to the account's R2, at the time asked, and leaves any other alone", async () => {
    const seen = [];
    const f = signer({ id: 'id', secret: 'secret' }, async (url, init) => (seen.push({ url, init }), new Response('ok')), () => new Date('2026-10-21T20:00:00Z'));
    await f(objectUrl('bf2017-assets', 'web/a.glb'), { headers: { range: 'bytes=0-0' } });
    await f('https://assets.tilakpatell.com/abc/x.glb', { headers: { range: 'bytes=0-0' } });
    expect(seen[0].init.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=id\/20261021\/auto\/s3\/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(seen[0].init.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD');
    expect(seen[1].init.headers).toEqual({ range: 'bytes=0-0' });
  });
});

describe('addresses', () => {
  it('encodes each part of a path as S3 signs it', () => {
    expect(objectUrl('bf2017-assets', "web/maps/a b/(x)!'*.glb")).toBe(`${ENDPOINT}/bf2017-assets/web/maps/a%20b/%28x%29%21%27%2A.glb`);
  });
  it("reads site-assets' public address from the environment, else its own domain", () => {
    expect(assetBase({})).toBe('https://assets.tilakpatell.com');
    expect(assetBase({ VITE_ASSET_BASE: 'https://x.example/' })).toBe('https://x.example');
    expect(assetBase({ ASSET_BASE: 'https://a.example', VITE_ASSET_BASE: 'https://x.example' })).toBe('https://a.example');
  });
});

const page = ({ files = [], folders = [], next = null, prefix = '' }) =>
  `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>b</Name><Prefix>${prefix}</Prefix>${files.map(([k, s]) => `<Contents><Key>${k}</Key><LastModified>2026-10-21T00:00:00.000Z</LastModified><ETag>"e"</ETag><Size>${s}</Size></Contents>`).join('')}${folders.map((p) => `<CommonPrefixes><Prefix>${p}</Prefix></CommonPrefixes>`).join('')}<IsTruncated>${next ? 'true' : 'false'}</IsTruncated>${next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ''}</ListBucketResult>`;

describe('listing', () => {
  it("reads a page's files, folders and where the next starts, the request's own prefix not a folder", () => {
    expect(listing(page({ prefix: 'web/', files: [['web/a &amp; b.glb', 12]], folders: ['web/maps/'], next: 'tok&amp;1' }))).toEqual({ files: [{ key: 'web/a & b.glb', size: 12 }], folders: ['web/maps/'], next: 'tok&1' });
    expect(listing(page({ files: [['x', 1]] })).next).toBeNull();
  });
});

// A bucket in memory that answers ListObjectsV2 a page of `per` at a time
const fakeBucket = (keys, per = 2) => {
  const asked = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    asked.push(u.search);
    const prefix = u.searchParams.get('prefix') ?? '';
    const delimiter = u.searchParams.get('delimiter');
    const start = Number(u.searchParams.get('continuation-token') ?? 0);
    const under = Object.keys(keys).filter((k) => k.startsWith(prefix)).sort();
    const folders = new Set();
    const files = [];
    for (const k of under) {
      const rest = k.slice(prefix.length);
      if (delimiter && rest.includes(delimiter)) folders.add(prefix + rest.slice(0, rest.indexOf(delimiter) + 1));
      else files.push([k, keys[k]]);
    }
    const slice = files.slice(start, start + per);
    const next = start + per < files.length ? String(start + per) : null;
    return new Response(page({ prefix, files: slice, folders: start ? [] : [...folders], next }));
  };
  return { fetchImpl, asked };
};

describe('list and folder', () => {
  const keys = { 'web/maps/hoth/a.glb': 10, 'web/maps/hoth/b.glb': 20, 'web/maps/hoth/c.png': 30, 'web/maps/hoth/sub/d.glb': 40, 'web/maps/other.txt': 1 };

  it('reads every page', async () => {
    const { fetchImpl, asked } = fakeBucket(keys);
    const { files } = await list(fetchImpl, 'bf2017-assets', 'web/maps/hoth/');
    expect(files.map((f) => f.key)).toEqual(['web/maps/hoth/a.glb', 'web/maps/hoth/b.glb', 'web/maps/hoth/c.png', 'web/maps/hoth/sub/d.glb']);
    expect(asked.length).toBe(2);
    expect(asked[0]).toBe('?list-type=2&prefix=web%2Fmaps%2Fhoth%2F');
  });

  it("answers one folder in Storage's old shape: names under it, a subfolder with no id", async () => {
    const { fetchImpl } = fakeBucket(keys);
    for (const prefix of ['web/maps/hoth', 'web/maps/hoth/']) {
      expect(await folder(fetchImpl, 'bf2017-assets', prefix)).toEqual([
        { name: 'a.glb', id: 'web/maps/hoth/a.glb', metadata: { size: 10 } },
        { name: 'b.glb', id: 'web/maps/hoth/b.glb', metadata: { size: 20 } },
        { name: 'c.png', id: 'web/maps/hoth/c.png', metadata: { size: 30 } },
        { name: 'sub', id: null, metadata: null },
      ]);
    }
  });

  it('stops at the pages asked for', async () => {
    const { fetchImpl, asked } = fakeBucket(keys);
    expect((await list(fetchImpl, 'bf2017-assets', 'web/maps/hoth/', { pages: 1 })).files.length).toBe(2);
    expect(asked.length).toBe(1);
  });

  it('says which listing was refused', async () => {
    await expect(list(async () => new Response('no', { status: 403 }), 'bf2017-assets', 'web/')).rejects.toThrow('list bf2017-assets/web/: HTTP 403');
  });
});

describe('put and remove', () => {
  it('sends the type and the cache, and says a refusal', async () => {
    const seen = [];
    const ok = async (url, init) => (seen.push({ url, init }), new Response(null, { status: 200 }));
    await put(ok, 'site-assets', 'abc/models/x.glb', Buffer.from('x'), { type: 'model/gltf-binary', cache: 'max-age=31536000' });
    expect(seen[0].url).toBe(`${ENDPOINT}/site-assets/abc/models/x.glb`);
    expect(seen[0].init).toMatchObject({ method: 'PUT', headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'max-age=31536000' } });
    await expect(put(async () => new Response('denied', { status: 403 }), 'site-assets', 'k', 'x')).rejects.toThrow('put site-assets/k: HTTP 403 denied');
  });

  it('takes a key already gone as removed', async () => {
    await expect(remove(async () => new Response(null, { status: 404 }), 'site-assets', 'k')).resolves.toBeTruthy();
    await expect(remove(async () => new Response(null, { status: 500 }), 'site-assets', 'k')).rejects.toThrow('HTTP 500');
  });
});
