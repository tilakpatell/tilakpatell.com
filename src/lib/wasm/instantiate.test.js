import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { instantiate, pathOf } from './instantiate.js';

// the smallest valid module: the magic and version 1, nothing else
const GOOD = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
const BAD = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x09, 0x00, 0x00, 0x00]);

const response = (bytes, type = 'application/wasm') => new Response(bytes, { headers: { 'content-type': type } });

describe('instantiate', () => {
  it('streams when the browser can and the type is right', async () => {
    const calls = [];
    const WA = {
      instantiateStreaming: async (res, imports) => {
        calls.push(['streaming', res.headers.get('content-type'), imports]);
        return WebAssembly.instantiate(await res.arrayBuffer(), imports);
      },
      instantiate: async () => {
        throw new Error('should not be reached');
      },
    };
    const fetches = [];
    const fetch = async (url) => {
      fetches.push(url);
      return response(GOOD);
    };
    const out = await instantiate('/assets/x.wasm', { env: {} }, { fetch, WebAssembly: WA, node: false });
    expect(out.how).toBe('streaming');
    expect(out.instance).toBeInstanceOf(WebAssembly.Instance);
    expect(calls).toHaveLength(1);
    expect(fetches).toEqual(['/assets/x.wasm']);
  });

  it('falls to bytes when streaming refuses the type', async () => {
    const WA = {
      instantiateStreaming: async () => {
        throw new TypeError('Incorrect response MIME type. Expected application/wasm.');
      },
      instantiate: WebAssembly.instantiate.bind(WebAssembly),
    };
    let fetches = 0;
    const fetch = async () => {
      fetches++;
      return response(GOOD, 'application/octet-stream');
    };
    const out = await instantiate('/assets/x.wasm', {}, { fetch, WebAssembly: WA, node: false });
    expect(out.how).toBe('bytes');
    expect(out.instance).toBeInstanceOf(WebAssembly.Instance);
    expect(fetches).toBeLessThanOrEqual(2);
  });

  it('takes the bytes path where there is no instantiateStreaming', async () => {
    const WA = { instantiate: WebAssembly.instantiate.bind(WebAssembly) };
    const out = await instantiate('/assets/x.wasm', {}, { fetch: async () => response(GOOD), WebAssembly: WA, node: false });
    expect(out.how).toBe('bytes');
  });

  it('reads the file in Node', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wasm-'));
    const file = join(dir, 'x.wasm');
    writeFileSync(file, GOOD);
    const out = await instantiate(file, {}, { node: true });
    expect(out.how).toBe('file');
    expect(out.instance).toBeInstanceOf(WebAssembly.Instance);
  });

  it('rejects with the compile error when the module is bad', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wasm-'));
    const file = join(dir, 'bad.wasm');
    writeFileSync(file, BAD);
    await expect(instantiate(file, {}, { node: true })).rejects.toBeInstanceOf(WebAssembly.CompileError);
  });

  it('rejects when the fetch is not ok', async () => {
    const fetch = async () => new Response('gone', { status: 404 });
    await expect(instantiate('/assets/x.wasm', {}, { fetch, WebAssembly, node: false })).rejects.toThrow(/404/);
  });
});

describe('pathOf', () => {
  it('turns what a ?url import gives in Node into a file path', () => {
    expect(pathOf('/@fs/home/u/repo/node_modules/a/b.wasm')).toBe('/home/u/repo/node_modules/a/b.wasm');
    expect(pathOf('file:///home/u/repo/a.wasm')).toBe('/home/u/repo/a.wasm');
    expect(pathOf('/home/u/repo/a.wasm')).toBe('/home/u/repo/a.wasm');
    expect(pathOf('/node_modules/a/b.wasm?v=1', '/root')).toBe('/root/node_modules/a/b.wasm');
  });

  it('keeps no slash before a Windows drive (else Node reads C:\\C:\\…)', () => {
    expect(pathOf('/@fs/C:/repo/node_modules/a/b.wasm')).toBe('C:/repo/node_modules/a/b.wasm');
    expect(pathOf('file:///C:/repo/a.wasm')).toBe('C:/repo/a.wasm');
  });
});
