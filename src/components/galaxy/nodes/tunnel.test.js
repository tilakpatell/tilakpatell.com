import { describe, expect, it } from 'vitest';
import * as glsl from '../tunnel';
import * as nodes from './tunnel';

const plain = (v) => (v?.toArray ? v.toArray() : v);
// (toneMapped too, but on a ShaderMaterial: its GLSL had no tone-mapping
// chunk, so it never was, and the twin says so with toneMapped: false)
const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest'];
const toneMapped = (m) => (m.isShaderMaterial ? false : m.toneMapped);

describe('the tunnel as nodes, the twin of ../tunnel', () => {
  it('exports what tunnel.js exports, and its pure path the same, number for number', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    const opts = { length: 50, turns: 3, bend: 0.6 };
    expect(nodes.tunnelPath('t', opts)).toEqual(glsl.tunnelPath('t', opts));
    const ctrl = [[0, 0, 0], [0, 0, 8], [2, 1, 20], [-1, 0, 34]];
    const path = glsl.tunnelPath(null, { ctrl, steps: 40 });
    expect(nodes.tunnelPath(null, { ctrl, steps: 40 })).toEqual(path);
    const tube = { path, radius: 2, chamber: 6 };
    expect(nodes.chamberAt(tube)).toEqual(glsl.chamberAt(tube));
    for (const p of [[0, 0, 5], [3, 0, 12], [0.5, 0, -1], [30, 30, 30], [-1, 0.2, 38]]) {
      expect(nodes.nearestOn(path, p)).toEqual(glsl.nearestOn(path, p));
      expect(nodes.keepIn(tube, p)).toEqual(glsl.keepIn(tube, p));
    }
    const fa = glsl.frameOf([1, 2, 3], [0, 0.2, 1], [0, 1, 0]);
    const fn = nodes.frameOf([1, 2, 3], [0, 0.2, 1], [0, 1, 0]);
    for (const k of ['toLocal', 'toWorld', 'dirToWorld']) expect(fn[k]([4, -1, 2])).toEqual(fa[k]([4, -1, 2]));
  });

  it('builds the same group, its materials node materials with the same flags and uniforms', () => {
    const path = glsl.tunnelPath('b', { length: 30 });
    for (const look of ['ds2', 'isd']) {
      const a = glsl.buildTunnel(path, { look, small: true });
      const n = nodes.buildTunnel(path, { look, small: true });
      expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
      expect(n.centre).toEqual(a.centre);
      expect(n.group.children.length).toBe(a.group.children.length);
      n.group.children.forEach((o, i) => {
        const g = a.group.children[i];
        expect(o.type).toBe(g.type);
        expect(o.material.isNodeMaterial).toBe(true);
        for (const k of flags) expect(o.material[k], `${i} ${k}`).toBe(g.material[k]);
        expect(o.material.toneMapped).toBe(toneMapped(g.material));
        expect(o.position.toArray()).toEqual(g.position.toArray());
        expect(o.geometry.attributes.position.count).toBe(g.geometry.attributes.position.count);
      });
      // the walls' uniforms by name, as the frame writes them
      const wa = a.group.children[0].material.uniforms;
      const wn = n.group.children[0].material.uniforms;
      expect(Object.keys(wn).sort()).toEqual(Object.keys(wa).sort());
      for (const k of Object.keys(wa)) expect(plain(wn[k].value)).toEqual(plain(wa[k].value));
      a.update(12.5, 0.4);
      n.update(12.5, 0.4);
      for (const k of Object.keys(wa)) expect(plain(wn[k].value)).toEqual(plain(wa[k].value));
      expect(n.core.scale.toArray()).toEqual(a.core.scale.toArray());
      expect(n.core.material.color.toArray()).toEqual(a.core.material.color.toArray());
      n.dispose();
      a.dispose();
    }
  });
});
