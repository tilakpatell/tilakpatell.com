import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { FAMILIES, LOOKS, buildBody, nearOctaves, pxTall, segmentsFor } from './bodies';
import { createRocks } from './rocks';

// every look the systems name, each body and rock field they'd build: what
// can be checked without a GPU (the shaders themselves need a browser)
const used = () => {
  const ids = new Set();
  for (const s of SYSTEMS) {
    if (s.body) ids.add(s.body.look);
    if (s.parent) ids.add(s.parent.look);
    for (const m of s.moons ?? []) ids.add(m.look);
  }
  return [...ids];
};

describe('LOOKS', () => {
  it('has every look the systems use', () => {
    for (const id of used()) expect(LOOKS[id], id).toBeTruthy();
  });

  it('gives every look a name, a swatch, a family and all its colours', () => {
    for (const [id, l] of Object.entries(LOOKS)) {
      expect(typeof l.name, id).toBe('string');
      expect(l.swatch, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(FAMILIES[l.family], id).toBeTruthy();
      for (const slot of FAMILIES[l.family].slots) expect(l.pal[slot], `${id} ${slot}`).toMatch(/^#[0-9a-f]{6}$/i);
      for (const k of Object.keys(l.p ?? {})) expect(FAMILIES[l.family].params, `${id} ${k}`).toContain(k);
    }
  });
});

describe('buildBody', () => {
  it('builds every look, sized as asked, its reach past its surface', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 9000);
    camera.position.set(0, 0, 200);
    for (const id of Object.keys(LOOKS)) {
      for (const small of [false, true]) {
        const b = buildBody(id, { r: 30, small });
        expect(b.group, id).toBeInstanceOf(THREE.Group);
        expect(b.radius, id).toBe(30);
        expect(b.reach, id).toBeGreaterThanOrEqual(30);
        // (a skin's rings show further: not on a small body, which wears no skin)
        const rings = !small && LOOKS[id].skin?.ringsAt;
        expect(b.reach, id).toBeLessThan(rings ? 30 * rings[1] + 1e-6 : 30 * 1.2);
        b.setSuns([{ dir: new THREE.Vector3(1, 0, 0), color: new THREE.Color(1.2, 1.1, 1) }, { dir: new THREE.Vector3(0, 0, 1), color: new THREE.Color(0.6, 0.5, 0.4) }]);
        b.update(12.5, camera);
        b.set('shield', 1);
        b.set('nonsense', 3);
        const surface = b.group.children[0];
        expect(surface.material.fragmentShader, id).toContain('void surface(');
        expect(surface.material.uniforms.uMaxOct.value, id).toBe(small ? 5 : 9);
        b.dispose();
      }
    }
  });

  it('drops its noise octaves with the detail asked for, never under 4', () => {
    const octaves = (b) => b.group.children[0].material.uniforms.uMaxOct.value;
    const b = buildBody('tatooine', { r: 30, small: false });
    b.setDetail(1);
    expect(octaves(b)).toBe(9);
    b.setDetail(0);
    expect(octaves(b)).toBe(4);
    b.setDetail(0.5);
    expect(octaves(b)).toBe(7); // round(4 + 5 * 0.5) = round(6.5)
    b.setDetail(7);
    expect(octaves(b)).toBe(9); // (asked for more than all: all)
    b.setDetail(-1);
    expect(octaves(b)).toBe(4);
    const s = buildBody('tatooine', { r: 30, small: true });
    s.setDetail(1);
    expect(octaves(s)).toBe(5);
    s.setDetail(0);
    expect(octaves(s)).toBe(4);
    s.setDetail(0.5);
    expect(octaves(s)).toBe(5); // round(4 + 1 * 0.5)
  });

  it('puts Scarif inside its shield, and nothing else in one', () => {
    expect(buildBody('scarif', { r: 32 }).reach).toBeCloseTo(32 * 1.12);
    expect(buildBody('hoth', { r: 36 }).reach).toBeLessThan(36 * 1.1);
  });

  it('lights Scarif’s shield where a ship bumps it, then lets it fade', () => {
    const b = buildBody('scarif', { r: 32 });
    b.set('shield', 1);
    expect(b.hitLeft).toBe(0);
    expect(b.hit(new THREE.Vector3(0, 0, 32 * 1.12))).toBe(true);
    expect(b.hitLeft).toBe(1);
    b.update(10);
    b.update(10.05);
    expect(b.hitLeft).toBeCloseTo(1 - 0.05 * 1.1, 5);
    b.update(20);
    expect(b.hitLeft).toBeCloseTo(1 - 0.15 * 1.1, 5); // (a long gap counts as a tenth of a second: a tab left in the background fades on its return)
    for (let t = 20.05; t < 21.2; t += 0.05) b.update(t);
    expect(b.hitLeft).toBe(0);
    expect(buildBody('hoth', { r: 36 }).hit(new THREE.Vector3(0, 0, 40))).toBe(false);
  });

  it('hands back the mesh a crash can mark', () => {
    for (const small of [false, true]) {
      const b = buildBody('hoth', { r: 20, small });
      expect(b.surface.isMesh).toBe(true);
      expect(b.group.children).toContain(b.surface);
    }
  });

  it('works its ground two octaves finer from orbit on high (four on ultra), eased in, and not small', () => {
    const near = (b) => b.surface.material.uniforms.uNearOct.value;
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 9000);
    const renderer = { getDrawingBufferSize: (v) => v.set(1280, 720) };
    const frames = (b, from, n) => {
      for (let i = 0; i < n; i++) {
        b.surface.onBeforeRender(renderer, null, camera);
        b.update(from + i / 30, camera);
      }
    };
    for (const [tier, small, want] of [['high', false, 2], ['ultra', false, 4], ['mid', false, 0], ['low', false, 0], ['high', true, 0]]) {
      const b = buildBody('tatooine', { r: 30, small, tier });
      expect(near(b), tier).toBe(0);
      camera.position.set(0, 0, 30 * 2.4); // (parked: the world most of the screen tall)
      frames(b, 0, 2);
      expect(near(b), tier).toBeLessThanOrEqual(want); // (eased in, not jumped to)
      frames(b, 1, 60);
      expect(near(b), tier).toBeCloseTo(want, 6);
      camera.position.set(0, 0, 30 * 40); // (and off again, a disc in the sky)
      frames(b, 3, 60);
      expect(near(b), tier).toBeCloseTo(0, 6);
      b.dispose();
    }
  });
});

// The universe draws round the camera (universe/relative.js): for the draw
// alone the map is moved by minus the camera and the camera put at nought.
// A body's middle, read against the shader's cameraPosition, has to be where
// the body is as it's drawn, not where it was when update() ran
describe('buildBody, drawn round the camera', () => {
  const stubRenderer = { getDrawingBufferSize: (v) => v.set(1920, 1080) };
  // a body out in a map, its update() run, then the map shifted as the draw shifts it
  const shifted = (small) => {
    const scene = new THREE.Scene();
    const map = new THREE.Group();
    scene.add(map);
    const b = buildBody('hoth', { r: 40, small });
    b.group.position.set(1e6 + 300, 20, -50);
    b.group.rotation.set(0.3, 1.1, -0.2);
    map.add(b.group);
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 45000);
    camera.position.set(1e6 + 300, 20, 400);
    scene.add(camera);
    scene.updateMatrixWorld();
    b.update(0, camera);
    map.position.set(-1e6, 0, 0);
    camera.position.set(0, 0, 0);
    scene.updateMatrixWorld(); // (as the renderer does, before any onBeforeRender)
    return { scene, camera, b, u: b.surface.material.uniforms };
  };

  it('sets its middle in the draw, from where it is then (small or not)', () => {
    for (const small of [false, true]) {
      const { scene, camera, b, u } = shifted(small);
      b.surface.onBeforeRender(stubRenderer, scene, camera);
      expect(u.uCenter.value.toArray(), String(small)).toEqual([300, 20, -50]);
      expect(u.uRot.value.elements, String(small)).toEqual(new THREE.Matrix3().setFromMatrix4(b.group.matrixWorld).elements);
      b.dispose();
    }
  });

  it('sets it from its air too, for when the ground is out of view and the air is not', () => {
    const { scene, camera, b, u } = shifted(false);
    const air = b.group.children.find((o) => o !== b.surface && o.material.uniforms?.uCenter);
    expect(air.material.uniforms.uCenter).toBe(u.uCenter); // (one, shared)
    air.onBeforeRender(stubRenderer, scene, camera);
    expect(u.uCenter.value.toArray()).toEqual([300, 20, -50]);
    b.dispose();
  });
});

describe('nearOctaves', () => {
  it('is two on high and four on ultra for a world over 300 pixels tall, and none otherwise', () => {
    expect(nearOctaves({ tier: 'high', pxTall: 600 })).toBe(2);
    expect(nearOctaves({ tier: 'ultra', pxTall: 600 })).toBe(4);
    for (const tier of ['high', 'ultra']) expect(nearOctaves({ tier, pxTall: 200 })).toBe(0);
    for (const tier of ['mid', 'low']) {
      expect(nearOctaves({ tier, pxTall: 600 })).toBe(0);
      expect(nearOctaves({ tier, pxTall: 200 })).toBe(0);
    }
  });

  it('measures a world as tall as it is on the screen', () => {
    // (a world just filling a 60° view from top to bottom: sin 30° = r / d)
    expect(pxTall({ r: 1, dist: 2, fov: 60, height: 720 })).toBeCloseTo(720, 6);
    expect(pxTall({ r: 1, dist: 4, fov: 60, height: 720 })).toBeCloseTo((2 * Math.asin(0.25) * 720) / (Math.PI / 3), 6);
    expect(pxTall({ r: 1, dist: 0.5, fov: 60, height: 720 })).toBe(Infinity); // (inside it)
  });
});

describe('createRocks', () => {
  const kinds = [
    { kind: 'ring', at: [10, 0, -5], inner: 54, outer: 88, thickness: 5, tilt: [0.22, 0.08], count: 900, seed: 11 },
    { kind: 'field', at: [230, 30, 150], radius: 80, count: 420, seed: 7 },
    { kind: 'debris', at: [0, 0, 0], radius: 70, count: 520, seed: 3 },
  ];

  it('makes its solids, the big rocks, where the field is', () => {
    for (const k of kinds) {
      const r = createRocks(k);
      expect(r.solids.length, k.kind).toBeGreaterThan(0);
      expect(r.solids.length, k.kind).toBeLessThanOrEqual(60);
      const c = new THREE.Vector3(...k.at);
      const far = k.kind === 'ring' ? k.outer + k.thickness + 10 : k.radius * 1.3;
      for (const s of r.solids) {
        expect(s.id).toMatch(/^rock-\d+$/);
        expect(s.r).toBeGreaterThan(0);
        expect(s.reach).toBe(s.r);
        expect(new THREE.Vector3(...s.at).distanceTo(c), k.kind).toBeLessThan(far);
        if (k.kind === 'ring') expect(new THREE.Vector3(...s.at).distanceTo(c)).toBeGreaterThan(k.inner - k.thickness - 10);
      }
      r.update(30, null);
      r.dispose();
    }
  });

  it('gives the Hoth field a few huge rocks and the big ones room', () => {
    const r = createRocks(kinds[1]);
    const max = Math.max(...r.solids.map((s) => s.r));
    expect(max).toBeGreaterThan(4);
    expect(max).toBeLessThanOrEqual(8);
    for (let a = 0; a < r.solids.length; a++) {
      for (let b = a + 1; b < r.solids.length; b++) {
        const d = new THREE.Vector3(...r.solids[a].at).distanceTo(new THREE.Vector3(...r.solids[b].at));
        expect(d).toBeGreaterThan((r.solids[a].r + r.solids[b].r) * 0.9);
      }
    }
  });

  it('is the same field for everyone with the same seed', () => {
    const a = createRocks(kinds[2]).solids;
    const b = createRocks(kinds[2]).solids;
    expect(a).toEqual(b);
  });

  // every mesh of a field, with the triangles of one rock in it and the sizes of the rocks it draws
  const meshesOf = (r) => {
    const out = [];
    r.group.traverse((o) => o.isInstancedMesh && out.push(o));
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    return out.map((mesh) => {
      const sizes = Array.from({ length: mesh.count }, (_, i) => {
        mesh.getMatrixAt(i, m);
        return s.setFromMatrixScale(m).x;
      });
      return { mesh, sizes, size: sizes.reduce((a, b) => a + b, 0) / sizes.length, tris: mesh.geometry.attributes.position.count / 3 };
    });
  };

  it('writes its rocks once and turns them on the GPU', () => {
    const r = createRocks({ kind: 'ring', inner: 54, outer: 88, thickness: 5, count: 300, seed: 11 });
    const meshes = meshesOf(r).map((x) => x.mesh);
    expect(meshes.length).toBeGreaterThan(1);
    const versions = meshes.map((m) => m.instanceMatrix.version);
    r.update(10, null);
    r.update(55, { position: new THREE.Vector3(1e6, 0, 0) });
    expect(meshes.map((m) => m.instanceMatrix.version)).toEqual(versions);
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const sz = new THREE.Vector3();
    for (const mesh of meshes) {
      const axis = mesh.geometry.getAttribute('aSpinAxis');
      const spin = mesh.geometry.getAttribute('aSpin');
      expect(axis.isInstancedBufferAttribute).toBe(true);
      expect(spin.isInstancedBufferAttribute).toBe(true);
      expect(axis.count).toBe(mesh.count);
      expect(spin.count).toBe(mesh.count);
      expect(axis.itemSize).toBe(3);
      expect(spin.itemSize).toBe(2);
      for (let i = 0; i < mesh.count; i++) {
        expect(Math.hypot(axis.getX(i), axis.getY(i), axis.getZ(i))).toBeCloseTo(1, 4);
        expect(Math.abs(spin.getY(i))).toBeGreaterThan(0);
        // (an instance is a place and a size: the turning is the shader's)
        mesh.getMatrixAt(i, m);
        m.decompose(p, q, sz);
        expect(Math.abs(q.w)).toBeCloseTo(1, 4);
      }
    }
    r.dispose();
  });

  it('keeps every rock turning about its own axis from one time uniform', () => {
    const r = createRocks({ kind: 'debris', radius: 70, count: 200, seed: 3 });
    const found = [];
    r.group.traverse((o) => o.isInstancedMesh && !found.includes(o.material) && found.push(o.material));
    expect(found.length).toBe(2); // (the rock, the scorched debris)
    const uniforms = found.map((mat) => {
      expect(mat.customProgramCacheKey()).toBe('rock-spin');
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: '' };
      mat.onBeforeCompile(shader, null);
      expect(shader.vertexShader).toMatch(/attribute vec3 aSpinAxis;/);
      expect(shader.vertexShader).toMatch(/attribute vec2 aSpin;/);
      expect(shader.vertexShader).toMatch(/uniform float uTime;/);
      expect(shader.vertexShader).toMatch(/transformed = rockSpin\(transformed/);
      expect(shader.vertexShader).toMatch(/objectNormal = rockSpin\(objectNormal/);
      expect(shader.uniforms.uTime).toBeTruthy();
      return shader.uniforms.uTime;
    });
    expect(uniforms[0]).toBe(uniforms[1]);
    r.update(12.5, null);
    expect(uniforms[0].value).toBeCloseTo(12.5, 6);
    r.update(40, { position: new THREE.Vector3(1e6, 0, 0) });
    expect(uniforms[0].value).toBeCloseTo(40, 6);
    r.dispose();
  });

  it('gives the small rocks the coarser shape', () => {
    for (const k of kinds) {
      const r = createRocks(k);
      const all = meshesOf(r);
      const smallest = all.reduce((a, b) => (b.size < a.size ? b : a));
      const biggest = all.reduce((a, b) => (b.size > a.size ? b : a));
      expect(smallest.tris, k.kind).toBeLessThan(biggest.tris);
      // each rock by size, with the triangles it is drawn with: the finest shape (detail 3) is the big rocks' alone, and the smaller half
      // have lost a subdivision (80 faces of the 180 an ordinary rock has, 180 of the 320)
      const rocks = all.flatMap((x) => x.sizes.map((size) => ({ size, tris: x.tris }))).sort((a, b) => a.size - b.size);
      const half = Math.floor(rocks.length / 2);
      const [small, big] = [rocks.slice(0, half), rocks.slice(half)];
      const finest = Math.max(...rocks.map((x) => x.tris));
      expect(finest, k.kind).toBe(320);
      expect(Math.max(...small.map((x) => x.tris)), k.kind).toBeLessThan(finest);
      expect(Math.min(...big.map((x) => x.tris)), k.kind).toBeGreaterThanOrEqual(180);
      const mean = (list) => list.reduce((sum, x) => sum + x.tris, 0) / list.length;
      expect(mean(small), k.kind).toBeLessThan(mean(big));
      r.dispose();
    }
  });

  it('is still the same rocks in the same places', () => {
    const at = (r) =>
      meshesOf(r)
        .flatMap(({ mesh }) => Array.from({ length: mesh.count }, (_, i) => new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16).elements.slice(12, 15).map((x) => +x.toFixed(4)).join()))
        .sort();
    expect(at(createRocks(kinds[0]))).toEqual(at(createRocks(kinds[0])));
  });
});

describe("a world's sphere at ultra", () => {
  it('is twice as fine each way, and as it was below', () => {
    expect(segmentsFor('big', 'ultra')).toEqual([256, 192]);
    expect(segmentsFor('big', 'high')).toEqual([128, 96]);
    expect(segmentsFor('small', 'mid')).toEqual([64, 48]);
  });

  it('works its ground to more octaves only at ultra', () => {
    const at = (tier) => buildBody('tatooine', { tier });
    const hi = at('high');
    const ul = at('ultra');
    const mat = (b) => b.group.children[0].material;
    expect(mat(hi).defines.FBM_OCT).toBeUndefined();
    expect(mat(ul).defines.FBM_OCT).toBeGreaterThan(10);
    expect(mat(ul).uniforms.uMaxOct.value).toBeGreaterThan(mat(hi).uniforms.uMaxOct.value);
    hi.dispose();
    ul.dispose();
  });
});
