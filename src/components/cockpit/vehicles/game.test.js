import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import PUBLISHED from '../../../data/galaxyAssets.json';
import { COCKPITS, EYE, EYE_AT, build, cab, dressCab, placeCab } from './game';

// the X-wing's cockpit as lane V stood it in its hull's frame: facing +z,
// 1.17 wide, 1.42 tall, 2.29 long, its floor 0.73 up the hull (`_source`:
// surface/xwingcockpit.glb's box, read 2026-10-11)
const XWING_BOX = new THREE.Box3(new THREE.Vector3(-0.584, 0.729, -1.065), new THREE.Vector3(0.584, 2.146, 1.225));

// a cockpit as GLTFLoader gives one: a textured shell, a fake-AO quad and a window
const fakeCockpit = () => {
  const scene = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.168, 1.417, 2.29), new THREE.MeshStandardMaterial({ name: 'Cockpit_Shader' }));
  shell.position.set(0, 1.4375, 0.08);
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ name: 'FakeAO' }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ name: 'Window_shader', transparent: true, opacity: 0.32 }));
  scene.add(shell, ao, glass);
  return { scene, animations: [] };
};

describe('the game’s cockpit as the cab', () => {
  it('has the game’s cockpit file for the X-wing and the Falcon, each published', () => {
    expect(Object.keys(COCKPITS)).toEqual(['xwing', 'falcon']);
    for (const [kind, url] of Object.entries(COCKPITS)) {
      expect(url, kind).toBe(`/models/galaxy/surface/${kind}cockpit.glb`);
      expect(PUBLISHED[url.slice(1)], kind).toBeTruthy();
      expect(EYE_AT[kind], kind).toHaveLength(3);
    }
  });

  it('turns the cockpit to face −z and puts the pilot’s eye at the cab’s eye', () => {
    const root = new THREE.Group();
    const eye = placeCab(root, 'xwing', XWING_BOX.clone());
    expect(eye).toEqual(EYE);
    expect(root.rotation.y).toBeCloseTo(Math.PI, 9);
    // (the eye's point in the hull's frame, carried through the cockpit's turn and move, lands on EYE)
    const size = XWING_BOX.getSize(new THREE.Vector3());
    const at = EYE_AT.xwing;
    const p = new THREE.Vector3(XWING_BOX.min.x + size.x * at[0], XWING_BOX.min.y + size.y * at[1], XWING_BOX.min.z + size.z * at[2]);
    root.localToWorld(p);
    for (const [i, c] of ['x', 'y', 'z'].entries()) expect(p[c], c).toBeCloseTo(EYE[i], 6);
    // (and the cockpit's nose, +z in the hull's frame, is ahead of the eye, down −z)
    const nose = root.localToWorld(new THREE.Vector3(0, XWING_BOX.min.y + size.y * at[1], XWING_BOX.max.z));
    expect(nose.z).toBeLessThan(EYE[2]);
  });

  it('leaves out the game’s fake-AO quad and draws its glass last', () => {
    const { scene } = fakeCockpit();
    expect(dressCab(scene)).toBe(1);
    const names = [];
    scene.traverse((o) => o.isMesh && names.push(o.material.name));
    expect(names).toEqual(['Cockpit_Shader', 'Window_shader']);
    expect(scene.children.find((o) => o.material?.name === 'Window_shader').renderOrder).toBe(10);
  });

  it('builds a cab in the built cabs’ shape from a stand-in loader, and refuses a kind the game has no cockpit for', async () => {
    const asked = [];
    const load = async (url) => (asked.push(url), fakeCockpit());
    const built = await cab('xwing').build({ load });
    expect(asked).toEqual([COCKPITS.xwing]);
    expect(built.eye).toEqual(EYE);
    expect(built.game).toBe(true);
    for (const key of ['inside', 'outside', 'rest', 'range', 'hfov', 'vmin', 'vmax', 'exposure', 'envIntensity', 'bloom', 'flash', 'rumble', 'triggers', 'resize', 'launch', 'update', 'dispose']) expect(built[key], key).toBeDefined();
    expect(built.inside.getObjectByProperty('isHemisphereLight', true)).toBeTruthy();
    expect(() => built.update(0.016, 1, { launching: false, look: { yaw: 0, pitch: 0 } })).not.toThrow();
    built.dispose();
    await expect(build({ kind: 'rv', load })).rejects.toThrow(/no cockpit/);
  });
});
