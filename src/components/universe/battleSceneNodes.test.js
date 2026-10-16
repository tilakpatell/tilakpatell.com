import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import * as glsl from './battleScene';
import * as nodes from './battleSceneNodes';
import { WARS } from './wars';

// galaxy/models.js's face, with a box for every ship
const stubModels = () => {
  const slots = [];
  return {
    slots,
    slot(kind, size) {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.2, size), new THREE.MeshBasicMaterial()));
      const s = { kind, size, holder };
      slots.push(s);
      return s;
    },
    want() {},
    drop(s) {
      s.holder.removeFromParent();
      slots.splice(slots.indexOf(s), 1);
    },
  };
};

// the same battle drawn by each, a few steps in, with the same dice
const drawn = (scene) => {
  let seed = 7;
  const random = Math.random;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  try {
    const parent = new THREE.Group();
    const models = stubModels();
    const made = parent.children.length;
    const draw = scene.createBattleScene(parent, { models, small: true });
    const own = parent.children.slice(made);
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 4 });
    draw.show(battle, WARS.starwars);
    const cam = new THREE.PerspectiveCamera();
    for (let i = 0; i < 4; i++) draw.update(1 / 30, i / 30, cam, new THREE.Vector3(), battle.update(1 / 30, null), 0);
    const flag = battle.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    draw.update(0.1, 0.3, cam, new THREE.Vector3(), [{ type: 'capital', id: flag.id, kind: flag.kind, team: 1, at: { ...flag.pos } }], 0);
    return { parent, models, own, draw };
  } finally {
    Math.random = random;
  }
};

describe('battleSceneNodes, the twin of battleScene', () => {
  it('exports what battleScene exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('draws its bolts, glows, shield and flashes with node materials', () => {
    const { own, draw } = drawn(nodes);
    const mats = own.filter((o) => o.material).map((o) => o.material);
    expect(mats.length).toBeGreaterThanOrEqual(4);
    for (const m of mats) expect(m.isNodeMaterial, m.type).toBe(true);
    draw.dispose();
  });

  it('draws a battle as the original does: the same slots in the same places, the flagship broken in two, the same markers', () => {
    const a = drawn(glsl);
    const n = drawn(nodes);
    expect(n.models.slots.map((s) => s.kind)).toEqual(a.models.slots.map((s) => s.kind));
    n.models.slots.forEach((s, i) => expect(s.holder.position.distanceTo(a.models.slots[i].holder.position)).toBeLessThan(1e-9));
    expect(n.draw.halves).toBe(2);
    expect(n.draw.halves).toBe(a.draw.halves);
    // (each half in a clipping group of its own: the node renderer reads no material’s planes)
    const clips = n.parent.children.filter((o) => o.isClippingGroup);
    expect(clips).toHaveLength(2);
    for (const c of clips) expect(c.clippingPlanes).toHaveLength(1);
    const marks = (p) => p.children.filter((o) => o.isSprite && o.renderOrder === 10).map((o) => o.position.toArray());
    expect(marks(n.parent)).toEqual(marks(a.parent));
    for (const s of n.parent.children.filter((o) => o.isSprite && o.renderOrder === 10)) expect(s.material.isNodeMaterial).toBe(true);
    a.draw.dispose();
    n.draw.dispose();
    expect(n.models.slots).toHaveLength(0);
    expect(n.parent.children.some((o) => o.isClippingGroup)).toBe(false);
  });
});
