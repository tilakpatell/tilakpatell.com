import { describe, expect, it } from 'vitest';
import { collisionHull, collisionPath, glbPoints } from './bf2017-collision.mjs';

// a GLB of one node (moved 10 m up x) holding a 2 m cube's eight corners, as float32
function cubeGlb() {
  const pts = new Float32Array([-1, 0, -1, 1, 0, -1, -1, 2, -1, 1, 2, -1, -1, 0, 1, 1, 0, 1, -1, 2, 1, 1, 2, 1]);
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [10, 0, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3' }], bufferViews: [{ buffer: 0, byteLength: pts.byteLength }], buffers: [{ byteLength: pts.byteLength }] };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const bin = Buffer.from(pts.buffer);
  const head = Buffer.alloc(12);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8);
  c1.writeUInt32LE(text.length, 0);
  c1.write('JSON', 4, 'ascii');
  const c2 = Buffer.alloc(8);
  c2.writeUInt32LE(bin.length, 0);
  c2.write('BIN\0', 4, 'ascii');
  return Buffer.concat([head, c1, text, c2, bin]);
}

describe('a prop’s collision mesh as its solid', () => {
  it('finds the collision cut beside the model', () => {
    expect(collisionPath('models/objects/props/crate_01/crate_01_mesh.glb')).toBe('collision/objects/props/crate_01/crate_01_mesh.glb');
  });

  it('reads the points through the node and makes one hull of them', () => {
    const p = glbPoints(cubeGlb());
    expect(p.length).toBe(24);
    expect(p[0]).toBe(9);
    const h = collisionHull(cubeGlb());
    expect(h.kind).toBe('hull');
    expect(h.points.length).toBe(24);
    expect(Math.max(...h.points.filter((_, i) => i % 3 === 0))).toBe(11);
  });
});
