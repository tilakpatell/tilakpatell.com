import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import * as glsl from '../sky';
import * as nodes from './sky';
import { SYSTEMS, systemById } from '../systems';

// a renderer as far as the bake uses it: where it draws to, what it draws
// (and, for the node renderer's prepare, compileAsync)
const fakeRenderer = () => {
  const before = new THREE.RenderTarget(4, 4);
  return {
    before,
    coordinateSystem: THREE.WebGLCoordinateSystem,
    autoClear: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    xr: { enabled: false },
    target: before,
    getRenderTarget() {
      return this.target;
    },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: vi.fn(function (t) {
      this.target = t;
    }),
    render: vi.fn(function (scene) {
      this.scene = scene;
      this.drew = { autoClear: this.autoClear, toneMapping: this.toneMapping };
    }),
  };
};
const plain = (v) => (Array.isArray(v) ? v.map(plain) : v?.toArray ? v.toArray() : v);
const flags = (m) => ({ transparent: m.transparent, blending: m.blending, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest, fog: m.fog });
const bakeOf = (sky) => {
  const r = fakeRenderer();
  sky.bake(r);
  return r.scene.children[0].material;
};

describe('galaxy/nodes/sky, the twin of galaxy/sky', () => {
  it('exports what sky exports, and its numbers are the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    for (const s of SYSTEMS) expect(nodes.nebulaeOf(s)).toEqual(glsl.nebulaeOf(s));
    for (const small of [false, true])
      for (const level of [null, 'low', 'mid', 'high', 'ultra']) {
        expect(nodes.bakeSize({ small, level })).toBe(glsl.bakeSize({ small, level }));
        expect(nodes.starCount({ small, level })).toBe(glsl.starCount({ small, level }));
      }
  });

  it('draws the same things in the same order, each a node material with the same flags and uniforms', () => {
    const a = glsl.createSky({ level: 'low' });
    const n = nodes.createSky({ level: 'low' });
    expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
    expect(n.group.renderOrder).toBe(a.group.renderOrder);
    expect(n.group.children).toHaveLength(a.group.children.length);
    a.group.children.forEach((o, i) => {
      const t = n.group.children[i];
      expect(t.material.isNodeMaterial, `child ${i}`).toBe(true);
      expect(flags(t.material), `child ${i}`).toEqual(flags(o.material));
      expect(Object.keys(t.material.uniforms).sort(), `child ${i}`).toEqual(Object.keys(o.material.uniforms).sort());
      expect([t.renderOrder, t.frustumCulled, t.visible]).toEqual([o.renderOrder, o.frustumCulled, o.visible]);
    });
    a.dispose();
    n.dispose();
  });

  it('bakes with a node material that has the same flags, and the same uniforms by name and value for a system', () => {
    for (const opts of [{}, { clouds: false }])
    for (const id of ['hoth', 'tatooine', 'kashyyyk']) {
      const a = glsl.createSky({ level: 'high', ...opts });
      const n = nodes.createSky({ level: 'high', ...opts });
      a.setSystem(systemById(id));
      n.setSystem(systemById(id));
      const ma = bakeOf(a);
      const mn = bakeOf(n);
      expect(mn.isNodeMaterial).toBe(true);
      expect(flags(mn)).toEqual(flags(ma));
      expect(Object.keys(mn.uniforms).sort()).toEqual(Object.keys(ma.uniforms).sort());
      for (const k of Object.keys(ma.uniforms)) expect(plain(mn.uniforms[k].value), `${id} ${k} ${JSON.stringify(opts)}`).toEqual(plain(ma.uniforms[k].value));
      a.dispose();
      n.dispose();
    }
  });

  it('leaves its clouds out of the bake when asked, as the original does', () => {
    const n = nodes.createSky({ level: 'low', clouds: false });
    n.setSystem(systemById('kashyyyk'));
    for (const c of bakeOf(n).uniforms.uNebCol.value) expect(plain(c)).toEqual([0, 0, 0]);
    n.dispose();
  });

  it('places the same stars, suns and beacons for a system, and writes the frame’s uniforms by name', () => {
    const a = glsl.createSky({ level: 'mid' });
    const n = nodes.createSky({ level: 'mid' });
    for (const s of [a, n]) {
      s.setSystem(systemById('tatooine'));
      s.focus(s.beacons[3].id);
      s.update(new THREE.PerspectiveCamera(), 2.5);
      s.setRatio(1.5);
    }
    a.group.children.forEach((o, i) => {
      const t = n.group.children[i];
      for (const k of Object.keys(o.geometry.attributes)) if (t.geometry.attributes[k]) expect(t.geometry.attributes[k].array, `child ${i} ${k}`).toEqual(o.geometry.attributes[k].array);
      for (const k of Object.keys(o.material.uniforms)) if (k !== 'uSky' && k !== 'uGrain') expect(plain(t.material.uniforms[k].value), `child ${i} ${k}`).toEqual(plain(o.material.uniforms[k].value));
      expect(t.visible).toBe(o.visible);
    });
    expect(n.sunDirs.map(plain)).toEqual(a.sunDirs.map(plain));
    expect(n.beacons.map((b) => [b.id, plain(b.dir)])).toEqual(a.beacons.map((b) => [b.id, plain(b.dir)]));
    // (the other systems' stars drawn: as many as there are)
    expect(n.group.children[4].geometry.instanceCount).toBe(a.group.children[4].geometry.drawRange.count);
    a.dispose();
    n.dispose();
  });

  it('draws black until it is baked, then the cube; six faces, and the renderer left as it was', () => {
    const sky = nodes.createSky({ small: true });
    const look = sky.group.children[0].material.uniforms.uSky;
    expect(look.value).toBe(null);
    sky.setSystem(systemById('hoth'));
    const r = fakeRenderer();
    sky.bake(r);
    expect(r.render).toHaveBeenCalledTimes(6);
    expect(r.drew).toEqual({ autoClear: true, toneMapping: THREE.NoToneMapping });
    expect(look.value?.isCubeTexture).toBe(true);
    expect(look.value.image[0].width).toBe(512);
    expect(look.value.generateMipmaps).toBe(false);
    expect(r.target).toBe(r.before);
    expect(r.autoClear).toBe(false);
    expect(r.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    sky.dispose();
    sky.bake(r);
    expect(r.render).toHaveBeenCalledTimes(6);
  });

  it('has its shader compiled on the node renderer before the first bake, against the cube it bakes into', async () => {
    const r = fakeRenderer();
    let into = null;
    r.compileAsync = vi.fn(async function (scene) {
      into = this.target;
      return scene;
    });
    const sky = nodes.createSky({ small: true, renderer: r });
    await sky.prepare();
    expect(r.compileAsync).toHaveBeenCalledTimes(1);
    expect(into?.isCubeRenderTarget).toBe(true);
    const mats = [];
    r.compileAsync.mock.calls[0][0].traverse((o) => o.material && mats.push(o.material));
    expect(mats.map((m) => m.isNodeMaterial)).toEqual([true]);
    expect(r.target).toBe(r.before);
    expect(r.render).not.toHaveBeenCalled();
    sky.dispose();
    await sky.prepare();
    expect(r.compileAsync).toHaveBeenCalledTimes(1);
  });

  it('has no panorama on a system without one', () => {
    const sky = nodes.createSky({ level: 'ultra' });
    sky.setSystem(systemById('kashyyyk'));
    const m = bakeOf(sky);
    expect(m.uniforms.uPanoOn.value).toBe(0);
    expect(m.uniforms.uPano.value).toBe(null);
    sky.dispose();
  });
});
