import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildManifest, hashBytes, rowFor } from './build-manifest.mjs';

let root;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'manifest-'));
  await mkdir(join(root, 'endor'), { recursive: true });
  await writeFile(join(root, 'player.glb'), 'GLB-BYTES');
  await writeFile(join(root, 'endor', 'tree.ktx2'), 'KTX-BYTES');
  await writeFile(join(root, 'endor', 'ambience.mp3'), 'MP3');
  await writeFile(join(root, 'readme.txt'), 'not an asset');
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('hashBytes', () => {
  it('is deterministic and 16 hex chars', () => {
    const a = hashBytes(Buffer.from('same'));
    expect(a).toBe(hashBytes(Buffer.from('same')));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(hashBytes(Buffer.from('different')));
  });
});

describe('rowFor', () => {
  it('builds a canonical, forward-slash id with size and kind', async () => {
    const row = await rowFor(join(root, 'endor', 'tree.ktx2'), root);
    expect(row.id).toBe('endor/tree.ktx2');
    expect(row.kind).toBe('texture');
    expect(row.bytes).toBe(9); // 'KTX-BYTES'
    expect(row.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('buildManifest', () => {
  it('indexes only asset files, skips non-assets, and can assign tiers', async () => {
    const m = await buildManifest(root, { tier: (r) => (r.id === 'player.glb' ? 'boot' : null) });
    const ids = m.assets.map((r) => r.id);
    expect(ids).toEqual(['endor/ambience.mp3', 'endor/tree.ktx2', 'player.glb']);
    expect(ids).not.toContain('readme.txt'); // non-asset skipped
    expect(m.count).toBe(3);
    expect(m.assets.find((r) => r.id === 'player.glb').tier).toBe('boot');
    expect(m.assets.find((r) => r.id === 'endor/tree.ktx2').tier).toBeUndefined();
    expect(m.version).toBe(1);
  });
});
