// A small battle drawn whole: ../../../src/components/universe/battleScene.js
// against its twin, battleSceneNodes.js. Three ships a side, each a plain
// box (galaxy/models.js’s face, stubbed), fought a second on the same dice;
// then the defender’s flagship goes and breaks in two, its halves left to
// drift three seconds apart (the classic side clipping its materials, the
// node side its ClippingGroups), seen from above with you flying for the
// attacker, so the shield generators are marked. Every die is one seeded
// stream, set afresh for each side.
import * as THREE from 'three';
import { createBattle } from '../../../src/components/universe/battle.js';
import * as SO from '../../../src/components/universe/battleScene.js';
import * as SN from '../../../src/components/universe/battleSceneNodes.js';
import { WARS } from '../../../src/components/universe/wars.js';

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const models = () => ({
  slot(kind, size) {
    const holder = new THREE.Group();
    const hue = kind.length / 12;
    holder.add(new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.2, size), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.4, 0.5) })));
    return { kind, size, holder };
  },
  want() {},
  drop(s) {
    s.holder.removeFromParent();
  },
});

const battle = (S) => ({ scene, camera, renderer }) => {
  // (as galaxy/scene.js has it, so the classic side cuts the halves at all; the node side clips by group)
  renderer.localClippingEnabled = true;
  const random = Math.random;
  Math.random = seeded(11);
  try {
    const b = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 3, rand: seeded(5) });
    b.setYou?.(0);
    const draw = S.createBattleScene(scene, { models: models(), small: true });
    draw.show(b, WARS.starwars);
    camera.far = 2000;
    camera.position.set(45, 45, 95);
    camera.lookAt(55, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const local = camera.position.clone();
    for (let i = 0; i < 30; i++) draw.update(1 / 30, i / 30, camera, local, b.update(1 / 30, null), 0);
    const flag = b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    draw.update(0.5, 1.5, camera, local, [{ type: 'capital', id: flag.id, kind: flag.kind, team: 1, at: { ...flag.pos } }], 0);
    // (the halves let drift a while, so the cut between them shows)
    for (let i = 1; i <= 90; i++) draw.update(1 / 30, 1.5 + i / 30, camera, local, [], 0);
  } finally {
    Math.random = random;
  }
};

export default {
  'universe:battleScene': { node: battle(SN), classic: battle(SO) },
};
