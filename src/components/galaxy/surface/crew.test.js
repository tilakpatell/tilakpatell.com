import { existsSync } from 'node:fs';
import { onSite } from '../../../../scripts/lib/asset-manifest.mjs';
import PUBLISHED from '../../../data/galaxyAssets.json';
import { describe, expect, it } from 'vitest';
import { CREW, fileOf } from './crew';
import { faceOf, filesOf } from './crewList';
import { SURFACE_MODELS } from './catalog';

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
    // (the B1 waits for its markings map: the remaster's, rigged with Meshy)
    expect(CREW.battledroid).toEqual({ url: '/models/galaxy/troops/battledroid.glb', tall: 1.91 });
  });
});
