import { describe, expect, it } from 'vitest';
import worker, { ranged } from './worker';

const file = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 256));
const whole = () => new Response(file, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=0, must-revalidate' } });
const asked = (range) => new Request('https://tilakpatell.com/audio/sitar-listen.mp3', range ? { headers: { range } } : {});
const bytes = async (res) => new Uint8Array(await res.arrayBuffer());

describe('ranged', () => {
  it('answers a range with just those bytes, 206, saying where they sit in the file', async () => {
    const res = await ranged(asked('bytes=100-199'), whole());
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(res.headers.get('content-length')).toBe('100');
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect([...(await bytes(res))]).toEqual([...file.slice(100, 200)]);
  });

  it("answers Safari's first ask, the first two bytes", async () => {
    const res = await ranged(asked('bytes=0-1'), whole());
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1/1000');
    expect([...(await bytes(res))]).toEqual([0, 1]);
  });

  it('reads an open end as the end of the file, and a suffix as the last bytes', async () => {
    const open = await ranged(asked('bytes=990-'), whole());
    expect(open.headers.get('content-range')).toBe('bytes 990-999/1000');
    const last = await ranged(asked('bytes=-10'), whole());
    expect(last.headers.get('content-range')).toBe('bytes 990-999/1000');
    expect((await bytes(last)).length).toBe(10);
  });

  it('cuts an end past the file at the file', async () => {
    const res = await ranged(asked('bytes=900-5000'), whole());
    expect(res.headers.get('content-range')).toBe('bytes 900-999/1000');
  });

  it('says 416 for a start past the end', async () => {
    const res = await ranged(asked('bytes=1000-1001'), whole());
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */1000');
  });

  it('leaves a whole ask whole, saying ranges may be asked for', async () => {
    const res = await ranged(asked(null), whole());
    expect(res.status).toBe(200);
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect((await bytes(res)).length).toBe(1000);
  });

  it('leaves alone what it can’t read: several ranges, another unit, a miss, a 304', async () => {
    for (const r of ['bytes=0-1,5-6', 'items=0-1', 'bytes=abc']) expect((await ranged(asked(r), whole())).status).toBe(200);
    const missing = new Response('nope', { status: 404 });
    expect(await ranged(asked('bytes=0-1'), missing)).toBe(missing);
    const same = new Response(null, { status: 304 });
    expect(await ranged(asked('bytes=0-1'), same)).toBe(same);
  });
});

describe('the Worker', () => {
  it('asks its files for the path and answers the range from them', async () => {
    const seen = [];
    const env = { ASSETS: { fetch: async (req) => (seen.push(new URL(req.url).pathname), whole()) } };
    const res = await worker.fetch(asked('bytes=0-9'), env);
    expect(seen).toEqual(['/audio/sitar-listen.mp3']);
    expect(res.status).toBe(206);
    expect((await bytes(res)).length).toBe(10);
  });
});
