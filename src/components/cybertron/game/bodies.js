// What each of a Decepticon's states looks like on its figure: lib/ai/body's
// table (cover crouched and up to fire, strafing with the chest on its aim,
// searching with the head sweeping), and the rows only Cybertron has.
// scene.js hands it to bodyFrom with every Decepticon's step; the actor's
// own body (tactics.js: on its feet while it runs to cover, down once
// there) is put over it.

import { MODE_BODY } from '../../../lib/ai/body';

export const MODE_BODY_CY = {
  ...MODE_BODY,
  // walking at him, gun up, looking down it
  advance: { look: 'aim' },
  // round to his other side, its eyes on him
  flank: { look: 'aim' },
  // the instant of a shot (tactics.js goes straight back to what it was doing)
  fire: { look: 'aim' },
  // Megatron's tank and Barricade's car, and the change to and from them: the model's own clip
  charge: {},
  shift: {},
  // down
  dead: {},
};
