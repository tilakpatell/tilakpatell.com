// Birds over a stage (lib/three/birds: a flock, two draws of wings), the
// crebain over Hollin black and many.
//
//   createBirds({ at: [x, y, z], count, radius, height, size, colour, speed, seed }) → { mesh, update(dt), dispose }
//     at: the flock’s middle in the stage’s frame, y over the ground there
//   flight(bird, t) → { x, y, z, yaw, bank, flap } (pure: where a bird is at t)

import { createBirds as birds } from '../../../lib/three/birds';

export { flight } from '../../../lib/three/birds';
export const createBirds = (o = {}) => birds({ name: 'road:birds', ...o });
