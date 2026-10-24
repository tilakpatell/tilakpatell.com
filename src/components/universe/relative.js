// Drawn round the camera, always. What goes to the graphics chip goes in
// 32-bit floats: a few thousandths of a unit apart at the Rick and Morty
// sector, 40,000 off (layout.js's SECTORS), and 64 units apart a billion
// out, so the figures' bones and the shaders' world positions shake and tear
// out there. The map keeps its positions in doubles (the ship, the camera,
// every place: millimetres past 10^12). So for the drawing only, the camera
// is put at the middle and the map moved round it, every frame, near home as
// well as far; both are put back after, exactly, for the names, the picks
// and the next frame, which all go by the map as it is.
//
// (No three.js import: it moves what it's handed, the camera, the map and
// the scene they hang in, and keeps nothing of its own but their places.)

export const createRelativeDraw = ({ camera, map, scene }) => {
  const camWas = camera.position.clone();
  const mapWas = map.position.clone();
  // draw (the renderer's call) with the camera at nought and the map round
  // it; whatever the draw gives back comes back
  const drawn = (draw) => {
    camWas.copy(camera.position);
    mapWas.copy(map.position);
    map.position.sub(camWas);
    camera.position.set(0, 0, 0);
    try {
      return draw();
    } finally {
      // (copied back, not added back: a sum and a difference lose the last bits)
      map.position.copy(mapWas);
      camera.position.copy(camWas);
      scene.updateMatrixWorld();
    }
  };
  // the near plane, moved only for a change of 2% or more (a new projection costs)
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
};
