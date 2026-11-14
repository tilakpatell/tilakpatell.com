// The universe drawn round the camera, every frame.
//
// What goes to the graphics chip goes in 32-bit floats: a few thousandths
// of a unit apart 40,000 out, a whole unit at ten million, and the figures'
// bones and the shaders' world positions shake and tear long before the
// endless space ends. So for the drawing only, the camera is put at the
// middle and the map moved round it; both are put back after, for the
// names, the picks and the next frame, which all go by the map as it is.
// The sum is done here in doubles, so a body 10^9 out is drawn within a
// pixel of where it is (relative.test.js).
//
// It was done only past 3,000 out; now it is every frame, so a uniform that
// holds a place in the world must be set in the draw, not before it: by the
// mesh's own onBeforeRender (lib/three/atmosphere.js, galaxy/bodies.js), or
// by a hook here that's handed the step the world moved by (deepspace.js).
//
// createRelativeDraw({ camera, map }) → {
//   drawn(draw): draw() with the map moved by −camera and the camera at
//     nought; both put back after, exactly, the map's world matrices moved
//     back by the step (reworldMoved) rather than composed again,
//   atDraw(hook) → off: hook(shift) runs in every draw, once the map has
//     moved, `shift` the step everything in the world moved by (read-only),
//   lens(near), reach(far): the camera's near and far planes, set only on a
//     real change, FAR: the far plane it was made with }
import * as THREE from 'three';
import { reworldMoved } from '../../lib/three/reworld';

export function createRelativeDraw({ camera, map }) {
  const shift = new THREE.Vector3();
  const mapWas = new THREE.Vector3(); // (put back as they were, to the bit: a sum back can round)
  const hooks = [];
  const drawn = (draw) => {
    shift.copy(camera.position);
    mapWas.copy(map.position);
    map.position.sub(shift);
    camera.position.set(0, 0, 0);
    try {
      for (let i = 0; i < hooks.length; i++) hooks[i](shift);
      return draw();
    } finally {
      map.position.copy(mapWas);
      camera.position.copy(shift);
      // (only the map's place changed: its world matrices are moved back
      // after it, not composed again, which was a second whole update a frame)
      reworldMoved(map);
      camera.updateMatrixWorld();
      shift.set(0, 0, 0);
    }
  };
  const atDraw = (hook) => {
    hooks.push(hook);
    return () => {
      const i = hooks.indexOf(hook);
      if (i >= 0) hooks.splice(i, 1);
    };
  };
  const lens = (near) => {
    if (Math.abs(camera.near - near) < near * 0.02) return;
    camera.near = near;
    camera.updateProjectionMatrix();
  };
  // how far the camera draws: out to deep space's far side, but on foot
  // under a full day's sky only as far as the sky (footScene's far(): it
  // hides the rest of the universe), so nothing past it is drawn, nor any
  // place's own motion worked out there (it's out of view)
  const FAR = camera.far;
  const reach = (far) => {
    if (camera.far === far) return;
    camera.far = far;
    camera.updateProjectionMatrix();
  };
  return { drawn, atDraw, lens, reach, FAR };
}
