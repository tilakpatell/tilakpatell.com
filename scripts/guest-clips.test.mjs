// The command, run, and the two packs it has made: the same files in give
// the same bytes out, every turn in a pack is the game's to the bit through
// the writer and back, and the site's own loader plays the pack on the body.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseGlb } from '../src/components/battlefront/figures/fixtures/glb.js';
import { clearGLTFCache } from '../src/lib/three/gltfCache.js';
import { loadWalrusBody, packUrls } from '../src/lib/three/walrus.js';
import { hashOf } from './lib/asset-manifest.mjs';
import { readPack } from './lib/guest-file.mjs';
import { packFile, packGuest } from './guest-clips.mjs';

const GAME = 'public/models/galaxy/bf2017/clips-humanoid.glb';
const GUESTS = 'public/models/guests';
let dir;
let made;
let game;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'guest-clips-'));
  const run = (to) => packGuest('rick', { packs: ['humanoid'], only: ['walk', 'aim.pistol', 'die'], out: join(dir, to), bodies: GUESTS, log: () => {} });
  made = [await run('a'), await run('b')];
  game = await readPack(GAME);
}, 60000);
afterAll(() => {
  clearGLTFCache();
  rmSync(dir, { recursive: true, force: true });
});

const turnsOf = (pack, name) => new Map(pack.clips.find((c) => c.name === name).tracks.filter((t) => t.path === 'rotation').map((t) => [t.node, t]));

describe('node scripts/guest-clips.mjs rick', () => {
  it('writes the same bytes twice', () => {
    const [a, b] = made.map((m) => readFileSync(m.file));
    expect(a.length).toBeGreaterThan(10000);
    expect(a.equals(b)).toBe(true);
  });

  it('writes clips-<who>.glb with the clips it was asked for, under the game packs’ own names, and the alias a pack carries', async () => {
    expect(made[0].file.replace(/\\/g, '/')).toMatch(/\/a\/clips-rick\.glb$/);
    const out = await readPack(made[0].file);
    expect(out.clips.map((c) => c.name)).toEqual(['walk', 'aim.pistol', 'die']);
    expect(out.aliases).toEqual({ 'die.fwd': 'die' });
    expect(out.pack).toBe('guest-rick');
    // (it carries the fitted skeleton, as a game pack carries the game's)
    expect(out.rows.length).toBe(256);
    expect(out.rows.find((r) => r.name === 'head_end').parent).toBe('Head');
  });

  it('keeps every turn to the bit through the writer and back', async () => {
    const out = await readPack(made[0].file);
    for (const name of ['walk', 'aim.pistol', 'die']) {
      const was = turnsOf(game, name);
      const is = turnsOf(out, name);
      expect([...is.keys()]).toEqual([...was.keys()]);
      for (const [node, t] of was) {
        expect(is.get(node).values.constructor).toBe(Int16Array);
        expect(is.get(node).normalized).toBe(true);
        expect(Buffer.from(is.get(node).values.buffer, is.get(node).values.byteOffset, is.get(node).values.byteLength).equals(Buffer.from(t.values.buffer, t.values.byteOffset, t.values.byteLength)), `${name} ${node}`).toBe(true);
        expect([...is.get(node).times]).toEqual([...t.times]);
      }
    }
  });
});

describe.each(['rick', 'morty'])('the committed pack, %s’s', (who) => {
  let pack;
  beforeAll(async () => {
    pack = await readPack(`${GUESTS}/clips-${who}.glb`);
  });

  it('has every clip of the humanoid pack and the pistol’s stance under the same names, and its host hero’s death', () => {
    const names = pack.clips.map((c) => c.name);
    for (const c of game.clips) expect(names).toContain(c.name);
    expect(names.filter((n) => n.startsWith('stance.p.')).length).toBe(17);
    expect(names.length).toBe(game.clips.length + 17);
    expect(new Set(names).size).toBe(names.length);
    expect(pack.clips.find((c) => c.name === 'die').extras.source).toBe(who === 'rick' ? 'A_Han_Defeated_01' : 'A_Lando_Defeated_01');
    expect(pack.aliases).toEqual({ 'die.fwd': 'die' });
  });

  it('has every turn of every humanoid clip the game’s to the bit', () => {
    let tracks = 0;
    for (const clip of game.clips) {
      // (the death is the host hero's own, over the humanoid's)
      if (clip.name === 'die') continue;
      const is = turnsOf(pack, clip.name);
      for (const [node, t] of turnsOf(game, clip.name)) {
        tracks++;
        const got = is.get(node).values;
        if (got.length !== t.values.length || got.some((v, i) => v !== t.values[i])) throw new Error(`${clip.name} ${node}: a turn is not the game's`);
      }
    }
    expect(tracks).toBeGreaterThan(2000);
  });

  it('is played by the site’s loader on the body, whole and alone', async () => {
    const loader = { loadAsync: (url) => parseGlb(`public${url}`) };
    const { model, clips, sockets } = await loadWalrusBody(`/models/guests/${who}.glb`, { packs: packUrls(null, { whole: `/models/guests/clips-${who}.glb` }), loader });
    for (const name of ['idle', 'walk', 'run', 'sprint', 'aim.pistol', 'die', 'die.fwd', 'stance.p.aim', 'stance.p.walk']) expect(clips[name], name).toBeTruthy();
    expect(clips.walk.userData.root.length).toBeGreaterThan(10);
    // posed at the pistol's aim, the weapon socket is in the right hand: within 12 cm of the wrist
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clips['stance.p.aim']).play();
    mixer.setTime(0);
    model.updateMatrixWorld(true);
    const hand = model.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3());
    expect(sockets.weapon.getWorldPosition(new THREE.Vector3()).distanceTo(hand)).toBeLessThan(0.12);
    // and his feet are on the ground: the toes' joints within their own height of it
    for (const s of ['Left', 'Right']) expect(Math.abs(model.getObjectByName(`${s}ToeBase`).getWorldPosition(new THREE.Vector3()).y)).toBeLessThan(0.06);
  });
});

describe('a pack that is only in the asset bucket', () => {
  const bytes = Buffer.from('a pack’s bytes');
  const root = () => {
    const r = mkdtempSync(join(tmpdir(), 'guest-packs-'));
    mkdirSync(join(r, 'src', 'data'), { recursive: true });
    writeFileSync(join(r, 'src', 'data', 'galaxyAssets.json'), JSON.stringify({ 'models/galaxy/bf2017/clips-x.glb': { hash: hashOf(bytes), bytes: bytes.length } }));
    writeFileSync(join(r, '.env.bucketcheck.local'), 'VITE_ASSET_BASE=https://bucket.test/assets\n');
    return r;
  };

  it('is fetched once by its hash from the dev server’s base, and kept where git does not look', async () => {
    const r = root();
    const asked = [];
    const fetch = async (url) => {
      asked.push(url);
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    };
    const file = await packFile('x', { root: r, fetch });
    expect(asked).toEqual([`https://bucket.test/assets/${hashOf(bytes)}/models/galaxy/bf2017/clips-x.glb`]);
    expect(file.replace(/\\/g, '/')).toContain(`/lab/assets/packs/${hashOf(bytes)}/clips-x.glb`);
    expect(readFileSync(file).equals(bytes)).toBe(true);
    expect(await packFile('x', { root: r, fetch })).toBe(file);
    expect(asked.length).toBe(1);
    rmSync(r, { recursive: true, force: true });
  });

  it('is refused when what comes is not the file the manifest names, or the manifest names none', async () => {
    const r = root();
    const wrong = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    await expect(packFile('x', { root: r, fetch: wrong })).rejects.toThrow(/not the file/);
    await expect(packFile('y', { root: r, fetch: wrong })).rejects.toThrow(/not in the asset bucket/);
    rmSync(r, { recursive: true, force: true });
  });

  it('is left alone when the site has its own copy on disk', async () => {
    const file = await packFile('humanoid', { fetch: () => Promise.reject(new Error('no network in a test')) });
    expect(file.replace(/\\/g, '/')).toMatch(/public\/models\/galaxy\/bf2017\/clips-humanoid\.glb$/);
  });
});
