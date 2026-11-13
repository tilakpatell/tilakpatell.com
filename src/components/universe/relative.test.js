import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FOV } from './flight';
import { createRelativeDraw } from './relative';

const H = 1080; // (a tall screen's pixels)
const PX = (FOV * Math.PI) / 180 / H; // one pixel, as an angle
const f = Math.fround;
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const angle = (a, b) => {
  const [x, y] = [unit(a), unit(b)];
  return Math.acos(Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2]));
};
// a point the way the chip sees it: the shader's world position and the
// camera's, each in 32 bits, the one less the other
const chipView = (obj, cam, p) => {
  const w = new THREE.Vector3(...p).applyMatrix4(new THREE.Matrix4().fromArray(Float32Array.from(obj.matrixWorld.elements)));
  const c = cam.getWorldPosition(new THREE.Vector3());
  return [f(w.x) - f(c.x), f(w.y) - f(c.y), f(w.z) - f(c.z)];
};

// a body far out under the map, a camera 120 behind it looking at it, and
// a point on its skin 5 units to its side
const far = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.08, 45000);
  scene.add(camera);
  const map = new THREE.Group();
  map.rotation.y = 0.7; // (turned, as a drag turns it)
  scene.add(map);
  const body = new THREE.Mesh(new THREE.SphereGeometry(5));
  body.position.set(1e9, 2e8, -7e8);
  map.add(body);
  scene.updateMatrixWorld(true);
  const at = body.getWorldPosition(new THREE.Vector3());
  camera.position.copy(at).add(new THREE.Vector3(0, 0, 120));
  camera.lookAt(at);
  scene.updateMatrixWorld(true);
  const skin = [5, 0, 0]; // (in the body's own space)
  const skinW = new THREE.Vector3(...skin).applyMatrix4(body.matrixWorld);
  const truth = skinW.clone().sub(camera.position).toArray(); // (in doubles)
  return { scene, camera, map, body, skin, truth };
};

describe('drawing round the camera', () => {
  it('draws a body 10^9 out within a pixel of where it is', () => {
    const { scene, camera, map, body, skin, truth } = far();
    const { drawn } = createRelativeDraw({ camera, map });
    let off = Infinity;
    drawn(() => {
      scene.updateMatrixWorld(true); // (as the renderer does, first thing)
      off = angle(chipView(body, camera, skin), truth) / PX;
    });
    expect(off).toBeLessThan(1);
  });

  it('would not without it', () => {
    const { camera, body, skin, truth } = far();
    expect(angle(chipView(body, camera, skin), truth) / PX).toBeGreaterThan(1);
  });

  it('puts everything back after the draw, exactly', () => {
    const { scene, camera, map, body } = far();
    map.position.set(0.1, -3.3e-7, 17.25); // (somewhere a sum back would round)
    scene.updateMatrixWorld(true);
    const mapAt = map.position.toArray();
    const camAt = camera.position.toArray();
    const bodyW = body.matrixWorld.elements.slice();
    const camW = camera.matrixWorld.elements.slice();
    const { drawn } = createRelativeDraw({ camera, map });
    drawn(() => scene.updateMatrixWorld(true));
    expect(map.position.toArray()).toEqual(mapAt);
    expect(camera.position.toArray()).toEqual(camAt);
    expect(camera.matrixWorld.elements).toEqual(camW);
    body.matrixWorld.elements.forEach((v, i) => expect(v).toBeCloseTo(bodyW[i], 3));
  });

  it('puts them back when the draw throws', () => {
    const { camera, map } = far();
    const camAt = camera.position.toArray();
    const { drawn } = createRelativeDraw({ camera, map });
    expect(() =>
      drawn(() => {
        throw new Error('lost context');
      }),
    ).toThrow('lost context');
    expect(camera.position.toArray()).toEqual(camAt);
    expect(map.position.toArray()).toEqual([0, 0, 0]);
  });

  it('draws round the camera near home too, where it used not to', () => {
    const { camera, map } = far();
    camera.position.set(12, -4, 900);
    const { drawn } = createRelativeDraw({ camera, map });
    let seen = null;
    drawn(() => (seen = { cam: camera.position.toArray(), map: map.position.toArray() }));
    expect(seen.cam).toEqual([0, 0, 0]);
    expect(seen.map).toEqual([-12, 4, -900]);
  });

  it('hands each hook the step the world moved by, inside the draw only', () => {
    const { camera, map } = far();
    const { drawn, atDraw } = createRelativeDraw({ camera, map });
    const steps = [];
    const off = atDraw((s) => steps.push(s.toArray()));
    drawn(() => {});
    expect(steps).toEqual([camera.position.toArray()]);
    off();
    drawn(() => {});
    expect(steps).toHaveLength(1);
  });
});

describe('the lens and the reach', () => {
  it('sets the near and far planes only on a real change', () => {
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.08, 45000);
    const { lens, reach, FAR } = createRelativeDraw({ camera, map: new THREE.Group() });
    expect(FAR).toBe(45000);
    let made = 0;
    const was = camera.updateProjectionMatrix.bind(camera);
    camera.updateProjectionMatrix = () => {
      made++;
      was();
    };
    lens(0.0801); // (within 2%: left)
    reach(45000);
    expect(made).toBe(0);
    lens(6);
    reach(900);
    expect([camera.near, camera.far, made]).toEqual([6, 900, 2]);
  });
});
