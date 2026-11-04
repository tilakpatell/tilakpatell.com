// A branch moved as a whole, its world matrices brought after it without
// composing each one again.
//
// The universe map draws far out with the map moved round the camera
// (scene.js's `drawn`: 32-bit floats tear 40,000 units out) and puts it
// back after for the names and the picks, which read the world matrices.
// Put back with a whole scene.updateMatrixWorld(), every object's own
// matrix was composed a second time in the frame: as much again as the
// frame's own update, for a move that changed nothing but where the branch
// sits. Only its place changed, so each world matrix under it moves by the
// same step and no other way: the step is added to its place.
//
// reworldMoved(root): `root`'s position (and nothing else under it) has
// changed since its world matrices were last worked out; its own matrix and
// world matrix are worked out again, and every world matrix that follows
// from it (three's updateMatrixWorld: down the objects whose world matrix
// it keeps, matrixWorldAutoUpdate) moves by the step root's did. An object
// that works out its world matrix its own way (an updateMatrixWorld of its
// own, not three's: a camera, whose view leaves its scale out, a skinned
// mesh) is updated as a whole update would update it, with what's under it.
import { Object3D } from 'three';

const OWN = Object3D.prototype.updateMatrixWorld;

export function reworldMoved(root) {
  const e = root.matrixWorld.elements;
  const ox = e[12];
  const oy = e[13];
  const oz = e[14];
  if (root.matrixAutoUpdate) root.updateMatrix();
  if (root.matrixWorldAutoUpdate) {
    if (root.parent === null) root.matrixWorld.copy(root.matrix);
    else root.matrixWorld.multiplyMatrices(root.parent.matrixWorld, root.matrix);
  }
  root.matrixWorldNeedsUpdate = false;
  const dx = e[12] - ox;
  const dy = e[13] - oy;
  const dz = e[14] - oz;
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) step(kids[i], dx, dy, dz);
}

function step(o, dx, dy, dz) {
  if (o.updateMatrixWorld !== OWN) {
    o.updateMatrixWorld(true);
    return;
  }
  // (one whose world matrix its owner keeps: it stays where it is, and so
  // does everything worked out from it)
  if (!o.matrixWorldAutoUpdate) return;
  const e = o.matrixWorld.elements;
  e[12] += dx;
  e[13] += dy;
  e[14] += dz;
  const kids = o.children;
  for (let i = 0; i < kids.length; i++) step(kids[i], dx, dy, dz);
}
