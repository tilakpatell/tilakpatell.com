import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodePng16 } from '../../../scripts/lib/png16.mjs';
import { createAssets, pathFor } from './assets.js';

const ROOT = fileURLToPath(new URL('../../../scripts/fixtures/bf2017/web', import.meta.url));

// the dev backend over the committed fixture: each path the adapter asks
// for read from the folder, every ask recorded
function fixtureFetch(extra = {}) {
  const asked = [];
  const fetchBytes = async (url) => {
    asked.push(url);
    const path = url.replace(/^\/bf2\//, '');
    if (extra[path]) return extra[path];
    return new Uint8Array(await readFile(join(ROOT, path))).buffer;
  };
  return { asked, fetchBytes };
}

describe('the assets adapter, dev backend', () => {
  it('reads a map: its manifest and a bin of 20 bytes an instance and a group', async () => {
    const { fetchBytes, asked } = fixtureFetch();
    const assets = createAssets({ backend: 'dev', fetchBytes });
    const { manifest, bin } = await assets.loadMap('fixture_01/fixture_01');
    expect(manifest.groups).toHaveLength(6);
    expect(bin.byteLength).toBe(manifest.bin.bytes);
    expect(asked).toEqual(['/bf2/maps/fixture_01/fixture_01.json', '/bf2/maps/fixture_01/fixture_01.bin']);
  });

  it('decodes a 16-bit heightmap', async () => {
    const png = encodePng16(new Uint16Array([0, 65535, 32768, 1]), 2, 2);
    const map = { level: 'x', terrain: [{ heightScale: 1024, world: { file: 'terrain/x/x_height.png', width: 2, height: 2 } }], bin: { file: 'x.bin' } };
    const { fetchBytes } = fixtureFetch({ 'maps/x/x.json': new TextEncoder().encode(JSON.stringify(map)).buffer, 'terrain/x/x_height.png': png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) });
    const assets = createAssets({ backend: 'dev', fetchBytes });
    const t = await assets.loadTerrain('x/x');
    expect([...t.height]).toEqual([0, 65535, 32768, 1]);
    expect([t.width, t.rows]).toEqual([2, 2]);
    expect(t.meta.heightScale).toBe(1024);
  });

  it('asks a clip by its anims.jsonl row, the index fetched once', async () => {
    const jsonl = ['{"name":"x","skeleton":"walrus_humanmale","file":"anims/walrus_humanmale/x.glb"}', '{"name":"y","skeleton":"walrus_humanmale","file":"anims/walrus_humanmale/y.glb"}'].join('\n');
    const { fetchBytes, asked } = fixtureFetch({ 'anims.jsonl': new TextEncoder().encode(jsonl).buffer });
    const got = [];
    const assets = createAssets({ backend: 'dev', fetchBytes, loadGltf: async (url) => (got.push(url), { animations: [{ name: 'take' }] }) });
    const a = await assets.loadClip('x');
    await assets.loadClip('y');
    expect(a.name).toBe('x');
    expect(got).toEqual(['/bf2/anims/walrus_humanmale/x.glb', '/bf2/anims/walrus_humanmale/y.glb']);
    expect(asked.filter((u) => u.endsWith('anims.jsonl'))).toHaveLength(1);
    await expect(assets.loadClip('nope')).rejects.toThrow(/nope/);
  });

  it('names a model and its LODs as the export does', () => {
    expect(pathFor.model('a/b_mesh')).toBe('models/a/b_mesh.glb');
    expect(pathFor.model('a/b_mesh', 2)).toBe('models/a/b_mesh_lod2.glb');
    expect(pathFor.physics('a/b')).toBe('physics/a/b.glb');
  });

  it('the bucket backend is the streaming session’s, not here yet', async () => {
    const assets = createAssets({ backend: 'bucket', fetchBytes: async () => new ArrayBuffer(0) });
    await expect(assets.loadMap('fixture_01/fixture_01')).rejects.toThrow(/not here yet/);
    await expect(assets.loadStrings()).rejects.toThrow(/not here yet/);
  });
});
