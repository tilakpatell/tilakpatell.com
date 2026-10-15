// The command, run for each guest on the pack that is in git (the
// humanoid's): the same files in give the same bytes out, every turn in a
// pack is the game's to the bit through the writer and back, and the site's
// own loader plays the pack on the body. A guest's whole pack also takes the
// pistol's stance and its host hero's own pack, which are only in the asset
// bucket and so are not read here: for those the command itself compares
// every turn it wrote with its source and fails on a difference (sameTurns),
// which is tested below on a turn spoilt by hand.
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
import { PACKS_OUT, packFile, packGuest, sameTurns } from './guest-clips.mjs';

const GAME = 'public/models/galaxy/bf2017/clips-humanoid.glb';
const GUESTS = ['rick', 'morty', 'walt', 'jesse'];
// (a few clips of the 31, to keep the test quick: a gait, the aim, a death, a roll)
const ONLY = ['walk', 'sprint', 'aim.pistol', 'die', 'dodge.front'];
let dir;
let made;
let game;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'guest-clips-'));
  const run = (who, to) => packGuest(who, { packs: ['humanoid'], only: ONLY, out: join(dir, to), log: () => {} });
  made = {};
  for (const who of GUESTS) made[who] = await run(who, 'a');
  made.again = await run('rick', 'b');
  game = await readPack(GAME);
}, 120000);
afterAll(() => {
  clearGLTFCache();
  rmSync(dir, { recursive: true, force: true });
});

const sources = () => new Map(ONLY.map((name) => [name, game.clips.find((c) => c.name === name)]));

describe('node scripts/guest-clips.mjs', () => {
  it('writes the same bytes twice', () => {
    const [a, b] = [made.rick, made.again].map((m) => readFileSync(m.file));
    expect(a.length).toBeGreaterThan(10000);
    expect(a.equals(b)).toBe(true);
  });

  it('writes a guest’s pack outside git unless told where', () => {
    expect(PACKS_OUT.replace(/\\/g, '/')).toMatch(/\/lab\/assets\/packs\/guests$/);
  });

  it.each(GUESTS)('%s: writes clips-<who>.glb with the clips it was asked for, under the game packs’ own names, and the alias a pack carries', async (who) => {
    expect(made[who].file.replace(/\\/g, '/')).toMatch(new RegExp(`/a/clips-${who}\\.glb$`));
    const out = await readPack(made[who].file);
    expect(out.clips.map((c) => c.name)).toEqual(ONLY);
    expect(out.aliases).toEqual({ 'die.fwd': 'die' });
    expect(out.pack).toBe(`guest-${who}`);
    // (it carries the fitted skeleton, as a game pack carries the game's)
    expect(out.rows.length).toBe(256);
    expect(out.rows.find((r) => r.name === 'head_end').parent).toBe('Head');
  });

  it.each(GUESTS)('%s: keeps every turn to the bit through the writer and back', async (who) => {
    const out = await readPack(made[who].file);
    // (as the command itself checked before it returned)
    expect(made[who].turns).toBe(sameTurns(out, sources()));
    expect(made[who].turns).toBeGreaterThan(300);
    for (const clip of out.clips) for (const t of clip.tracks) if (t.path === 'rotation') expect(t.values.constructor).toBe(Int16Array);
  });

  it.each(GUESTS)('%s: is played by the site’s loader on the body, whole and alone', async (who) => {
    const loader = { loadAsync: (url) => parseGlb(url.startsWith('/models/') ? `public${url}` : url) };
    const { model, clips, sockets } = await loadWalrusBody(`/models/guests/${who}.glb`, { packs: packUrls(null, { whole: made[who].file }), loader });
    for (const name of [...ONLY, 'die.fwd']) expect(clips[name], name).toBeTruthy();
    expect(clips.walk.userData.root.length).toBeGreaterThan(10);
    // posed at the pistol's aim, the weapon socket is in the right hand: within 12 cm of the wrist
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clips['aim.pistol']).play();
    mixer.setTime(0);
    model.updateMatrixWorld(true);
    const hand = model.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3());
    expect(sockets.weapon.getWorldPosition(new THREE.Vector3()).distanceTo(hand)).toBeLessThan(0.12);
    // and his feet are on the ground: the toes' joints within their own height of it
    for (const s of ['Left', 'Right']) expect(Math.abs(model.getObjectByName(`${s}ToeBase`).getWorldPosition(new THREE.Vector3()).y)).toBeLessThan(0.06);
  });
});

describe('the command’s own check of what it wrote', () => {
  // the written pack as read back, one number of one turn changed by the smallest step a short has
  const spoilt = async (change) => {
    const out = await readPack(made.rick.file);
    const clip = out.clips.find((c) => c.name === 'walk');
    change(clip, clip.tracks.findIndex((t) => t.node === 'Spine1' && t.path === 'rotation'));
    return out;
  };

  it('passes a pack whose turns are its source’s', async () => {
    expect(sameTurns(await readPack(made.rick.file), sources())).toBe(made.rick.turns);
  });

  it('throws on one turn off by one step of a short, naming the clip and the bone', async () => {
    const out = await spoilt((clip, i) => {
      const values = Int16Array.from(clip.tracks[i].values);
      values[5] += 1;
      clip.tracks[i] = { ...clip.tracks[i], values };
    });
    expect(() => sameTurns(out, sources())).toThrow(/walk: Spine1/);
  });

  it('throws on a turn keyed at another time, on one stored as floats, and on one left out', async () => {
    const times = await spoilt((clip, i) => {
      const moved = Float32Array.from(clip.tracks[i].times);
      moved[1] += 1e-3;
      clip.tracks[i] = { ...clip.tracks[i], times: moved };
    });
    expect(() => sameTurns(times, sources())).toThrow(/walk: Spine1/);
    const floats = await spoilt((clip, i) => {
      clip.tracks[i] = { ...clip.tracks[i], values: Float32Array.from(clip.tracks[i].values, (v) => v / 32767), normalized: false };
    });
    expect(() => sameTurns(floats, sources())).toThrow(/walk: Spine1/);
    const gone = await spoilt((clip, i) => clip.tracks.splice(i, 1));
    expect(() => sameTurns(gone, sources())).toThrow(/walk: Spine1/);
    expect(() => sameTurns({ clips: [] }, sources())).toThrow(/walk: not in the pack/);
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
