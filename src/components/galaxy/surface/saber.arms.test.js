import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (the hilt files and the clip library watched: what a Meshy figure's saber asks for)
const asked = vi.hoisted(() => ({ glb: [], clips: [] }));
vi.mock('./placer', async (orig) => ({ ...(await orig()), loadGlb: (u) => (asked.glb.push(u), Promise.resolve(null)) }));
vi.mock('../../../lib/three/clipLibrary', async (orig) => ({ ...(await orig()), loadClip: (n) => (asked.clips.push(n), Promise.resolve(null)) }));
const { meshyRig } = await import('../../../lib/three/meshyRig.fixture');
const { createGunplay } = await import('../../universe/gunplay');
const { ARMS, createSaber } = await import('./saber');
const { HILTS } = await import('../heroes');

describe('the bones a stroke lays over the guard', () => {
  it('names the game’s spine and neck beside Meshy’s, so both kinds of figure swing', () => {
    for (const n of ['Spine1', 'Spine2', 'Neck', 'Spine02', 'Spine01', 'Spine']) expect(ARMS).toContain(n);
  });
});

describe('a Meshy figure', () => {
  it('has no saber, and asks for no hilt nor clip (one path: the game’s rig)', () => {
    const rig = meshyRig();
    new THREE.Group().add(rig.model);
    const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
    asked.glb.length = 0;
    asked.clips.length = 0;
    const hilt = HILTS.find((h) => h.id === 'luke');
    expect(hilt.model).toBeTruthy();
    expect(createSaber(gp, { hilt, fig: { bones: rig.bones, hipsY: rig.hipsY } })).toBe(null);
    expect(asked.glb).toEqual([]);
    expect(asked.clips).toEqual([]);
  });
  it('keeps the built hilts’ lengths and names as they were', () => {
    const was = { skywalker: [0.28, 'Skywalker'], luke: [0.26, 'Luke’s own'], dooku: [0.27, 'Curved'], temple: [0.3, 'Temple guard'], ahsoka: [0.24, 'Ahsoka’s'] };
    for (const [id, [length, name]] of Object.entries(was)) {
      const h = HILTS.find((x) => x.id === id);
      expect([h.length, h.name], id).toEqual([length, name]);
    }
  });
});
