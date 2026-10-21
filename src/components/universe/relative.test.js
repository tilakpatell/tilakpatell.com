import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRelativeDraw } from './relative';
import { FOV } from './flight';

// The spec's “Far and long”: a body 10^9 units out draws within a pixel of
// where it is. The chip works in 32-bit floats, 64 units apart at 10^9, so
// what reaches it must be small: the camera at nought, the map moved round it.

const H = 1080; // a screen's height in pixels
const BODY = [1e9, 2e8, -7e8];
// the camera 120 off the body, a little above and to one side: along an axis
// the chip's rounding would fall along the line of sight and show nothing
const OFF = (() => {
  const d = new THREE.Vector3(0.6, 0.3, 0.74).normalize().multiplyScalar(120);
  return [d.x, d.y, d.z];
})();
const f32 = (m) => Float32Array.from(m.elements);
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// the angle between two directions from the eye, in pixels of a screen H tall
const pxAngle = (a, b) => Math.acos(Math.min(1, dot(unit(a), unit(b)))) / ((FOV * Math.PI) / 180 / H);
// a point the way the chip sees it: the shader's world position and the camera's, in 32 bits
const shaderView = (obj, cam, p) => {
  const w = new THREE.Vector3(...p).applyMatrix4(new THREE.Matrix4().fromArray(f32(obj.matrixWorld)));
  const c = cam.getWorldPosition(new THREE.Vector3());
  return [Math.fround(w.x) - Math.fround(c.x), Math.fround(w.y) - Math.fround(c.y), Math.fround(w.z) - Math.fround(c.z)];
};
// the object's centre on the screen, in pixels, through the chip's 32-bit matrices
const px32 = (obj, cam) => {
  const m = new THREE.Matrix4().fromArray(f32(obj.matrixWorld));
  const v = new THREE.Matrix4().fromArray(f32(cam.matrixWorldInverse));
  const p = new THREE.Matrix4().fromArray(f32(cam.projectionMatrix));
  const c = new THREE.Vector4(0, 0, 0, 1).applyMatrix4(m).applyMatrix4(v).applyMatrix4(p);
  return [((c.x / c.w) * H) / 2, ((c.y / c.w) * H) / 2];
};
// and in doubles, as the state has it
const px64 = (at, cam) => {
  const c = new THREE.Vector3(...at).project(cam);
  return [(c.x * H) / 2, (c.y * H) / 2];
};

const rig = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.08, 45000);
  scene.add(camera);
  const map = new THREE.Group();
  map.position.set(0.1, -0.2, 0.3); // (not nought: a sum that would round if it were undone by arithmetic)
  map.rotation.y = 0.37;
  scene.add(map);
  const body = new THREE.Mesh();
  // (in the map's own frame, so the body sits at BODY in the world)
  body.position.copy(map.worldToLocal(new THREE.Vector3(...BODY)));
  map.add(body);
  camera.position.set(BODY[0] + OFF[0], BODY[1] + OFF[1], BODY[2] + OFF[2]);
  camera.lookAt(BODY[0], BODY[1], BODY[2]);
  scene.updateMatrixWorld();
  return { scene, camera, map, body, truth: [-OFF[0], -OFF[1], -OFF[2]] };
};

describe('createRelativeDraw', () => {
  it('draws a body 10^9 out within a pixel of where it is', () => {
    const { scene, camera, map, body, truth } = rig();
    const want = px64(BODY, camera);
    const { drawn } = createRelativeDraw({ camera, map, scene });
    let seen = null;
    let px = null;
    drawn(() => {
      scene.updateMatrixWorld(); // (the renderer's first step)
      expect(camera.position.toArray()).toEqual([0, 0, 0]);
      seen = shaderView(body, camera, [0, 0, 0]);
      px = px32(body, camera);
    });
    expect(pxAngle(seen, truth)).toBeLessThan(1);
    expect(Math.hypot(px[0] - want[0], px[1] - want[1])).toBeLessThan(1);
  });

  it('would not without it', () => {
    const { camera, body, truth } = rig();
    const want = px64(BODY, camera);
    const seen = shaderView(body, camera, [0, 0, 0]);
    const px = px32(body, camera);
    expect(pxAngle(seen, truth)).toBeGreaterThan(1);
    expect(Math.hypot(px[0] - want[0], px[1] - want[1])).toBeGreaterThan(1);
  });

  it('puts everything back after the draw, exactly', () => {
    const { scene, camera, map, body } = rig();
    const camWas = camera.position.toArray();
    const mapWas = map.position.toArray();
    const bodyWas = [...body.matrixWorld.elements];
    const camMatWas = [...camera.matrixWorld.elements];
    const { drawn } = createRelativeDraw({ camera, map, scene });
    drawn(() => scene.updateMatrixWorld());
    expect(camera.position.toArray()).toEqual(camWas);
    expect(map.position.toArray()).toEqual(mapWas);
    expect([...body.matrixWorld.elements]).toEqual(bodyWas);
    expect([...camera.matrixWorld.elements]).toEqual(camMatWas);
    // and after a draw that fails, too
    expect(() => drawn(() => { throw new Error('lost context'); })).toThrow('lost context');
    expect(camera.position.toArray()).toEqual(camWas);
    expect(map.position.toArray()).toEqual(mapWas);
  });

  it('moves the near and far planes only when asked to, by enough', () => {
    const { scene, camera, map } = rig();
    const { lens, reach, FAR } = createRelativeDraw({ camera, map, scene });
    expect(FAR).toBe(45000);
    const was = [...camera.projectionMatrix.elements];
    lens(0.08 * 1.01); // (within 2%: not worth a new projection)
    expect(camera.near).toBe(0.08);
    expect([...camera.projectionMatrix.elements]).toEqual(was);
    lens(6);
    expect(camera.near).toBe(6);
    expect([...camera.projectionMatrix.elements]).not.toEqual(was);
    reach(FAR);
    expect(camera.far).toBe(45000);
    reach(20000);
    expect(camera.far).toBe(20000);
  });
});
