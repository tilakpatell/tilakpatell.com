import { existsSync, readFileSync } from 'node:fs';
import { onSite } from '../../../../scripts/lib/asset-manifest.mjs';
import PUBLISHED from '../../../data/galaxyAssets.json';
import { describe, expect, it } from 'vitest';
import { CREW, fileOf } from './crew';
import { faceOf, filesOf } from './crewList';
import { SURFACE_MODELS } from './catalog';
import BONE_SETS from '../../../data/bf2017/physics/bones.json';
import { OWN_RIGS } from '../../../lib/three/walrusClips';

const at = (path) => new URL(`../../../../public${path}`, import.meta.url);
// (in public/, or published to the bucket: a checkout without its files, as CI's, takes the manifest's word)
const has = (path) => onSite(path, { publicDir: at('').pathname, manifest: PUBLISHED });

describe('the surfaces’ crew', () => {
  it('has a model in the site for each of them', () => {
    for (const [kind, c] of Object.entries(CREW)) for (const file of filesOf(c)) expect(has(file), `${kind}: ${file}`).toBe(true);
  });

  it('gives a kind with other faces each of them in turn', () => {
    expect([0, 1, 2, 3].map((i) => fileOf(faceOf(CREW.jedi, i)))).toEqual(['/models/galaxy/crew/jedi.glb', '/models/galaxy/crew/jedi2.glb', '/models/galaxy/crew/jedi3.glb', '/models/galaxy/crew/jedi.glb']);
    expect(faceOf(CREW.han, 3)).toBe(CREW.han);
  });

  it('walks the 2017 game’s heroes on the game’s skeleton, each with its pack of the game’s clips', () => {
    for (const [kind, tall] of Object.entries({ luke: 1.72, leia: 1.5, han: 1.85, chewie: 2.28, bobafett: 1.83, vader: 2.02, obiwan: 1.82, anakin: 1.85, maul: 1.75, dooku: 1.93, palpatine: 1.73, lando: 1.78, bossk: 1.9 })) {
      expect(CREW[kind], kind).toEqual({ url: `/models/galaxy/bf2017/crew/${kind}.glb`, tall, rig: 'walrus', pack: kind });
      expect(has(`/models/galaxy/bf2017/crew/${kind}.lod1.glb`), `${kind}'s light cut`).toBe(true);
      expect(has(`/models/galaxy/bf2017/clips-${kind}.glb`), `${kind}'s pack`).toBe(true);
    }
  });

  it('walks the Battlefront’s soldiers as the 2017 game’s, at full fidelity, their old statues left to stand in', () => {
    const troops = { clone: 1.83, superdroid: 1.93, stormtrooper: 1.83, snowtrooper: 1.83, hothtrooper: 1.78, sandtrooper: 1.83, scouttrooper: 1.83, shoretrooper: 1.83, deathtrooper: 1.88 };
    for (const [kind, tall] of Object.entries(troops)) {
      expect(CREW[kind].url, kind).toBe(`/models/galaxy/bf2017/crew/${kind}.glb`);
      expect(CREW[kind].tall, kind).toBe(tall);
      expect(['walrus', 'own'], kind).toContain(CREW[kind].rig);
      expect(CREW[kind].full && CREW[kind].lod && CREW[kind].far, kind).toBe(true);
      expect(SURFACE_MODELS[kind], `${kind}'s catalogue row`).toBeTruthy();
      expect(existsSync(at(`/models/galaxy/surface/${kind}.glb`)), `${kind}'s statue`).toBe(true);
    }
    // (Tatooine's Jawas, dewbacks and banthas: the game's, each on its own rig
    // with its pack, over the catalogue's statues; their light and far cuts in
    // the site, their full cuts waiting on the bucket: every file committed)
    for (const kind of ['jawa', 'dewback', 'bantha']) {
      expect(CREW[kind], kind).toMatchObject({ url: `/models/galaxy/bf2017/crew/${kind}.glb`, rig: 'own', ownRig: kind, lod: true, far: true });
      for (const file of [`crew/${kind}.glb`, `crew/${kind}.lod1.glb`, `crew/${kind}.far.glb`, `clips-${kind}.glb`]) expect(existsSync(at(`/models/galaxy/bf2017/${file}`)), file).toBe(true);
    }
    // (and Yoda and Grievous on theirs, Iden Versio on the humanoid one, the
    // same way: Yoda over the catalogue's statue, the other two new)
    for (const kind of ['yoda', 'grievous']) {
      expect(CREW[kind], kind).toMatchObject({ rig: 'own', ownRig: kind, lod: true, far: true });
      expect(existsSync(at(`/models/galaxy/bf2017/clips-${kind}.glb`)), kind).toBe(true);
    }
    expect(CREW.iden).toMatchObject({ rig: 'walrus', lod: true, far: true });
    for (const kind of ['yoda', 'grievous', 'iden']) for (const cut of ['', '.lod1', '.far']) expect(existsSync(at(`/models/galaxy/bf2017/crew/${kind}${cut}.glb`)), `${kind}${cut}`).toBe(true);
    // (the B1 is the game's on its own rig, its skin's tan on its grey map,
    // over the remaster's rigged with Meshy: its light and far cuts and its
    // pack committed, its full cut waiting on the bucket)
    expect(CREW.battledroid).toMatchObject({ url: '/models/galaxy/bf2017/crew/battledroid.glb', rig: 'own', ownRig: 'b1', lod: true, far: true });
    for (const file of ['crew/battledroid.glb', 'crew/battledroid.lod1.glb', 'crew/battledroid.far.glb', 'clips-b1.glb']) expect(existsSync(at(`/models/galaxy/bf2017/${file}`)), file).toBe(true);
  });

  it('hits the B1 where the game does: its rig names the skeleton the game’s B1 capsules are fitted to, and each of its cuts has every bone they ride on', () => {
    // (a bolt finds an own-rig figure’s capsules by its skeleton’s name,
    // boltPlay.js’s gameBodies, and puts each on the bone it names: a bone
    // the swapped body lacked would drop that capsule, and the droid would
    // be shot through there)
    const set = BONE_SETS.sets.find((x) => x.skeleton?.endsWith(`/${OWN_RIGS.b1.skeleton}`));
    expect(set?.id).toBe('defaultsoldierbonecollision_b1');
    const nodes = (file) => {
      const glb = readFileSync(at(file));
      return new Set(JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()).nodes.map((n) => n.name));
    };
    for (const cut of ['', '.lod1', '.far']) {
      const has = nodes(`/models/galaxy/bf2017/crew/battledroid${cut}.glb`);
      for (const c of set.bones.filter((b) => b.hiLod)) expect(has.has(c.bone), `battledroid${cut}: ${c.bone}`).toBe(true);
    }
  });
});
