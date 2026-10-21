// Drawn round the camera, every frame. What goes to the graphics chip goes
// in 32-bit floats: a few thousandths of a unit apart at the Rick and Morty
// sector, 40,000 off (layout.js's SECTORS), whole units past 10^7, and 64
// units apart at 10^9, where the universe reaches; the figures' bones and
// the shaders' world positions shake and tear long before that. So the
// state stays absolute, in doubles (the ship, the camera, every place),
// and for the drawing alone the camera is put at nought and the map moved
// round it by the same amount: everything reaches the chip relative to the
// camera, small and exact. Both are put back after, to the bit, for the
// names, the picks and the next frame, which all go by the map as it is.
// Unconditional: a frame near home gains nothing by it and loses nothing,
// and one rule means one path to get right (the spec's call over a floating
// origin, which would have every system of the scene re-anchor in the same
// frame).
//
// A uniform that holds a world position must be set inside the draw, in
// its mesh's onBeforeRender, where the matrices are the moved ones; set
// before the draw it is absolute, and wrong against the shader's
// cameraPosition (galaxy/bodies.js, lib/three/atmosphere.js, deepspace.js).
//
// The camera and the map are both the scene's own children, so their
// positions share a frame and the one shift moves both.
//
// createRelativeDraw({ camera, map, scene }) → { drawn(draw), lens(near), reach(far), FAR }
//   drawn(draw): runs draw() with the camera at nought and the map moved by
//     −camera, then puts both back and refreshes the scene's matrices
//   lens(near): the near plane, when it has moved by over 2% (a new projection costs)
//   reach(far): the far plane; FAR: the camera's far as it was made

import * as THREE from 'three';

export function createRelativeDraw({ camera, map, scene }) {
  // where the camera and the map were, kept whole: a position undone by
  // arithmetic (sub then add) is not always the same bits again
  const camAt = new THREE.Vector3();
  const mapAt = new THREE.Vector3();
  const drawn = (draw) => {
    camAt.copy(camera.position);
    mapAt.copy(map.position);
    map.position.sub(camAt);
    camera.position.set(0, 0, 0);
    try {
      draw();
    } finally {
      map.position.copy(mapAt);
      camera.position.copy(camAt);
      scene.updateMatrixWorld();
    }
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
  return { drawn, lens, reach, FAR };
}
