// What a sprite or a decal writes into the scene pass's velocity (GPU-first
// lane N2), so a temporal pass (TRAA, TAAU) leaves no trail behind it.
//
// three r186 writes velocity for everything whose motion it knows: a
// mesh's matrix, an InstancedMesh's and a BatchedMesh's per-instance
// matrices, a skinned mesh's bones (each keeps last frame's beside this
// one's once velocity is in the MRT). What it cannot know is a vertex
// stage of the material's own: the particles' corners are placed from the
// pool's storage (sprites.js's positionNode), and three's velocity then
// compares this frame's corner with the quad's bare geometry. And the
// scene pass's extra targets are never blended: a transparent sprite or
// decal writes its velocity whole over what is behind it, alpha or none.
//
// (A decal is a static mesh on a static surface: three's own velocity for
// it is already the camera's reprojection of the surface under it, so it
// needs nothing here.)
//
// So the particles hold themselves out of the history: they write the still
// velocity, where their world position was on the screen a frame ago by
// the camera's motion alone, which is the motion of what lies behind
// them. TRAA's neighbourhood clamp then takes their own motion as new
// colour (its rejection) rather than reprojecting the background by it.
// (A per-target blend that keeps the destination would be the cleaner
// mask, but r186's WebGPU pipeline reads the pass's MRT blend modes, not
// the material's merged ones: WebGPUPipelineUtils.)
//
// stillVelocity({ THREE, tsl }) → vec2 node, in NDC as three's VelocityNode
//   writes it (this frame's position less last frame's)
// previousViewProjection({ THREE, tsl }) → the uniform: each camera's
//   view-projection of the frame before (its own on its first frame)
// holdOut(material, { THREE, tsl }) → material, its mrtNode writing the
//   colour and the still velocity; material.userData.history = 'still'

const shared = new WeakMap(); // tsl → { prev, still }

function parts({ THREE, tsl }) {
  let p = shared.get(tsl);
  if (p) return p;
  const cameras = new WeakMap(); // camera → { id, cur, prev }
  const prev = tsl.uniform(new THREE.Matrix4()).onRenderUpdate(({ camera, frameId }) => {
    if (!camera) return undefined;
    let d = cameras.get(camera);
    const now = () => new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!d) {
      d = { id: frameId, cur: now() };
      d.prev = d.cur.clone();
      cameras.set(camera, d);
    } else if (d.id !== frameId) {
      d.id = frameId;
      d.prev.copy(d.cur);
      d.cur.copy(now());
    }
    return d.prev;
  });
  const { positionWorld, cameraProjectionMatrix, cameraViewMatrix, vec4, Fn } = tsl;
  const still = Fn(() => {
    const at = vec4(positionWorld, 1);
    const cur = cameraProjectionMatrix.mul(cameraViewMatrix).mul(at);
    const was = prev.mul(at);
    return cur.xy.div(cur.w).sub(was.xy.div(was.w));
  })();
  p = { prev, still };
  shared.set(tsl, p);
  return p;
}

export const stillVelocity = (three) => parts(three).still;
export const previousViewProjection = (three) => parts(three).prev;

export function holdOut(material, three) {
  const { tsl } = three;
  const own = tsl.mrt({ output: tsl.output, velocity: stillVelocity(three) });
  material.mrtNode = material.mrtNode ? material.mrtNode.merge(own) : own;
  material.userData.history = 'still';
  return material;
}
