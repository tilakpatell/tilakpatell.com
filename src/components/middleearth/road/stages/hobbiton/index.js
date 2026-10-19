// Hobbiton, the first stage in full (the plan’s Task 17, the recipe the
// other fifteen follow): its props, Gandalf’s cart up the lane, the dancers
// on the Party Field, the dragon over it and Bilbo by the tree, and then
// not. The data is the stage’s row (stages/index.js), its beats.js and
// lore.js; this file only draws, each beat’s scene a function of where the
// walker is (`local`, metres into the stage) and how long since the beat
// began (`since[id]`, seconds, or null before it), so walking back puts it
// back.
//
//   build(ctx) → { group, update(local, dt, { since, speed }), dispose }
//   ctx: { road (hooks.js’s house), heightAt (the stage’s land), rt, weather, tier }

import * as THREE from 'three';
import { walker } from '../../cast';
import { createHorse } from '../../creatures/horse';
import { HEIGHTS } from '../../cast';
import { TREE, buildCart, buildProps } from './props';

const LANE = 2.4; // m: the cart keeps the lane’s far half from the side shot, coming down it
const CART = { from: 75, k: 0.4 }; // the cart’s z = from − k × local: it comes on as the walker goes
const BILBO = [TREE[0] - 6, TREE[1] - 8];
const DRAGON = 9; // s the dragon flies
const GONE = 6; // s into the beat Bilbo puts the Ring on

// the dragon’s path over the field, 0…1: up from the tree’s foot, a loop, and away east
function dragonAt(u, heightAt, out) {
  const a = u * Math.PI * 2.2;
  const x = TREE[0] - 4 + u * 22 + Math.sin(a) * 7;
  const z = TREE[1] + 6 + Math.cos(a) * 8 + u * 10;
  return out.set(x, heightAt(TREE[0], TREE[1]) + 4 + u * 22 + Math.sin(a * 0.5) * 4, z);
}

export function build({ road, heightAt, rt, weather, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'stage:hobbiton';
  const material = road.material({ vertexColors: true, flatShading: true });
  const props = buildProps({ material, heightAt, rt });
  group.add(props.group);

  // Gandalf’s cart: the bed, the bay horse before it, the wizard on the bench
  const cart = buildCart(material);
  const horse = createHorse(rt, { coat: 'bay', height: 1.55 });
  horse.group.position.set(0, 0, -2.7);
  cart.add(horse.group);
  const gandalf = walker('gandalf', { rt, seed: 3 });
  gandalf.group.position.set(0, 1.0, 0.4);
  gandalf.set({ base: 'sit.ground', speed: 0 });
  cart.add(gandalf.group);
  cart.rotation.y = Math.PI; // (coming down the lane, toward the walkers)
  group.add(cart);

  // the dancers on the field, round the tree (four on low)
  const names = ['rosie', 'hobbit', 'rosie', 'hobbit', 'rosie', 'hobbit', 'rosie', 'hobbit'].slice(0, tier === 'low' ? 4 : 8);
  const dancers = names.map((name, i) => {
    const d = walker(name, { rt, seed: 10 + i, height: HEIGHTS.hobbit });
    const a = (i / names.length) * Math.PI * 2 + 0.3;
    const x = TREE[0] - 3 + Math.cos(a) * 5.5;
    const z = TREE[1] + 4 + Math.sin(a) * 4;
    d.group.position.set(x, heightAt(x, z), z);
    d.group.rotation.y = a + Math.PI / 2;
    d.set({ base: 'dance.ual', speed: 0 });
    group.add(d.group);
    return d;
  });

  // Bilbo by the tree, facing the lane, until the Ring
  const bilbo = walker('bilbo', { rt, seed: 21 });
  bilbo.group.position.set(BILBO[0], heightAt(BILBO[0], BILBO[1]), BILBO[1]);
  bilbo.group.rotation.y = -Math.PI / 2;
  bilbo.set({ base: null, speed: 0 });
  group.add(bilbo.group);

  let dragon = null;
  const at = new THREE.Vector3();

  return {
    group,
    update(local, dt, { since = {}, speed = 0 } = {}) {
      props.update(dt);
      // the cart, from up the lane toward the walkers and past them
      const z = CART.from - CART.k * local;
      cart.visible = local < 120;
      cart.position.set(LANE, heightAt(LANE, z), z);
      horse.set({ speed: speed * CART.k });
      horse.tick(dt);
      gandalf.tick(dt);
      // the field: dancing whenever it is near enough to see
      const near = local > 70 && local < 190;
      for (const d of dancers) {
        d.group.visible = near;
        if (near) d.tick(dt);
      }
      // the dragon: a trail of sparks up over the field and away, while the beat lasts
      const s = since.dragon;
      if (s != null && s < DRAGON) {
        dragon ??= weather?.kind?.('embers', { count: 600, scale: 7 });
        dragon?.at(...dragonAt(s / DRAGON, heightAt, at).toArray());
      } else if (dragon) {
        dragon.stop();
        dragon = null;
      }
      // Bilbo there before the beat and in its first seconds; gone after (walk back and he is there again)
      bilbo.group.visible = local < 150 || (s != null && s < GONE);
      if (bilbo.group.visible) bilbo.tick(dt);
    },
    dispose() {
      dragon?.stop();
      props.dispose();
      horse.dispose();
      gandalf.dispose();
      bilbo.dispose();
      for (const d of dancers) d.dispose();
      cart.traverse((o) => o.geometry?.dispose());
      material.dispose();
      group.removeFromParent();
    },
  };
}
