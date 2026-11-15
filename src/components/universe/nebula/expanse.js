// The Expanse's nebulae, handed to the nebula renderer: the hook lane 2's
// createExpanse calls for each nebula wonder while its sector holds a far
// slot (expanse/scene/expanse.js's drawNebula), and gives back when the
// sector lets the slot go. The wonder keeps an empty group at its place,
// named by expanse.js, for its name and picks; its cloud is the renderer's.
//
// nebulaOf(w) → desc: the generator's wonder ({ id, at (absolute), size, seed }) as a nebula;
//   lane 4a's list rows too: a pocket a cloud in its own two colours, a supernova remnant a
//   shell, an ion storm a dark cloud of steel and electric blue (it drifts: move)
// expanseNebulae(nebulae) → drawNebula(w) → { object, dispose(), move(at) }

import * as THREE from 'three';
import { seedOf } from './rules';

// the Expanse's nebula violet (sectors.js drew its puffs from it), and a
// second colour a nebula of its own, seeded
const VIOLET = '#b48cff';

const STORM = ['#141d33', '#2f5089', '#86b4f0']; // (dark at heart, electric at its edges)

export function nebulaOf(w) {
  if (w.kind === 'pocket') return { id: w.id, at: [w.at[0], w.at[1], w.at[2]], r: w.size, colors: w.colors, seed: w.seed, form: 'cloud' };
  if (w.kind === 'remnant') return { id: w.id, at: [w.at[0], w.at[1], w.at[2]], r: w.size, colors: w.colors, seed: w.seed, form: 'shell' };
  if (w.kind === 'storm') return { id: w.id, at: [w.at[0], w.at[1], w.at[2]], r: w.size, colors: STORM, seed: w.seed, form: 'cloud' };
  const second = new THREE.Color().setHSL(seedOf(w.seed)[1], 0.7, 0.55);
  return { id: w.id, at: [w.at[0], w.at[1], w.at[2]], r: w.size, colors: [VIOLET, `#${second.getHexString()}`], seed: w.seed, form: 'cloud' };
}

export const expanseNebulae = (nebulae) => (w) => {
  const handle = nebulae.add(nebulaOf(w));
  const object = new THREE.Group();
  return { object, dispose: () => nebulae.remove(handle), move: (at) => nebulae.move?.(handle, at) };
};
