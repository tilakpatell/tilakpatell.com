import { describe, expect, it } from 'vitest';
import { VOLUME_BACKENDS, volumeBatch, volumeMaterial, volumeOk } from './volume.js';

// a TSL stand-in recording the graph (as surface/weather.test.js's)
const node = (op, args = []) => {
  const n = { op, args };
  for (const c of ['x', 'y', 'z', 'w', 'xy', 'xz', 'xyz', 'r', 'g', 'b', 'a', 'rgb']) Object.defineProperty(n, c, { get: () => node('.' + c, [n]), enumerable: false });
  for (const m of ['mul', 'add', 'sub', 'div', 'greaterThan', 'lessThan', 'or', 'and']) n[m] = (...a) => node(m, [n, ...a]);
  return n;
};
const ATOMS = new Set(['cameraViewMatrix', 'screenUV', 'cameraProjectionMatrixInverse', 'cameraWorldMatrix', 'modelWorldMatrixInverse', 'positionView']);
const recorded = [];
const tsl = new Proxy(
  {},
  {
    get: (_, op) => {
      if (ATOMS.has(op)) return node(op);
      if (op === 'Fn') return (cb) => (...args) => cb(args);
      return (...args) => {
        const n = node(op, args);
        recorded.push(n);
        return n;
      };
    },
  },
);
class FakeMaterial {
  constructor(o = {}) {
    Object.assign(this, o);
  }
}
const THREE = { MeshStandardNodeMaterial: FakeMaterial, BackSide: 1, BoxGeometry: class {}, Mesh: class {
  constructor(g, m) {
    Object.assign(this, { geometry: g, material: m, position: { fromArray: (a) => (this.p = a) }, quaternion: { fromArray: (a) => (this.q = a) }, scale: { fromArray: (a) => (this.s = a) }, userData: {} });
  }
} };
const count = (n, op) => (n && n.op ? (n.op === op ? 1 : 0) + n.args.reduce((s, a) => s + count(a, op), 0) : 0);
const ops = (n, out = new Set()) => {
  if (n && n.op) {
    out.add(n.op);
    for (const a of n.args) ops(a, out);
  }
  return out;
};

describe('volumeMaterial', () => {
  it('reads the depth the world left, back to the world, into the box; samples the texture by its xz; discards outside', () => {
    recorded.length = 0;
    const map = { isTexture: true };
    const m = volumeMaterial(map, { THREE, tsl });
    const color = ops(m.colorNode);
    expect(color.has('viewportDepthTexture')).toBe(true);
    expect(color.has('getViewPosition')).toBe(true);
    expect(color.has('cameraWorldMatrix')).toBe(true);
    // into each instance's box by its own inverse, from instanced attributes
    // (one draw for a cell's boxes of one texture: Review Focus 4)
    expect(color.has('modelWorldMatrixInverse')).toBe(false);
    expect(color.has('mat4')).toBe(true);
    expect(recorded.some((n) => n.op === 'attribute' && n.args[0] === 'decalInv0')).toBe(true);
    expect(color.has('texture')).toBe(true);
    expect(color.has('.xz')).toBe(true);
    expect(recorded.some((n) => n.op === 'Discard')).toBe(true);
    expect(JSON.stringify(m.opacityNode)).toContain('decalOpacity');
    // the box's inside drawn, over whatever is in front of its faces
    expect(m.side).toBe(THREE.BackSide);
    expect(m.depthTest).toBe(false);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    // the surface's own normal, from the depth's slopes
    expect(ops(m.normalNode).has('dFdx')).toBe(true);
    // faded out where the surface turns away from the box's axis (a wall's
    // face under a ground decal)
    expect(ops(m.opacityNode).has('smoothstep')).toBe(true);
    expect(ops(m.opacityNode).has('cameraViewMatrix')).toBe(true);
    expect(JSON.stringify(m.opacityNode)).toContain('decalUp');
    // and soft at the box's sides
    expect(count(m.opacityNode, 'smoothstep')).toBe(2);
  });
  it('a mask decal: the scorch’s colour, the coverage from the look’s channel', () => {
    const m = volumeMaterial({ isTexture: true }, { THREE, tsl }, { mask: 'b', color: [0.02, 0.02, 0.02] });
    expect(m.colorNode.op).toBe('vec3');
    expect(ops(m.opacityNode).has('.b')).toBe(true);
    expect(ops(m.opacityNode).has('.a')).toBe(false);
  });
});

describe('volumeBatch (three in Node)', () => {
  it('one instanced box per texture: each instance at its decal, its inverse, up and opacity as attributes', async () => {
    const T = await import('three/webgpu');
    const decals = [
      { position: [1, 2, 3], quaternion: [0, 0, 0, 1], size: [4, 1, 4], texture: 't', opacity: 1 },
      { position: [-5, 0, 2], quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2], size: [2, 3, 2], texture: 't', opacity: 0.4 },
    ];
    const mesh = volumeBatch(decals, new T.MeshBasicMaterial(), new T.BoxGeometry(1, 1, 1), { THREE: T });
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(2);
    const m = new T.Matrix4();
    mesh.getMatrixAt(1, m);
    const p = new T.Vector3().setFromMatrixPosition(m);
    expect(p.toArray()).toEqual([-5, 0, 2]);
    // the inverse takes the decal's centre to the box's origin
    const g = mesh.geometry;
    const inv = new T.Matrix4().fromArray([0, 1, 2, 3].flatMap((c) => [g.attributes[`decalInv${c}`].getX(1), g.attributes[`decalInv${c}`].getY(1), g.attributes[`decalInv${c}`].getZ(1), g.attributes[`decalInv${c}`].getW(1)]));
    expect(new T.Vector3(-5, 0, 2).applyMatrix4(inv).length()).toBeCloseTo(0, 5);
    expect(g.attributes.decalOpacity.getX(1)).toBeCloseTo(0.4);
    expect(g.attributes.decalUp.getY(0)).toBeCloseTo(1);
    expect(g.attributes.decalInv0.isInstancedBufferAttribute).toBe(true);
  });
});

describe('volumeOk', () => {
  it('the node renderer on either backend reads its depth (WebGL 2 shown on SwiftShader only)', () => {
    expect(VOLUME_BACKENDS).toContain('webgpu');
    expect(volumeOk('webgpu')).toBe(true);
    expect(volumeOk('webgl')).toBe(false);
  });
});
