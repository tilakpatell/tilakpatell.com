import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FOV } from './flight';
import { createRelativeDraw } from './relative';

// The chip works in 32-bit floats; the map's positions are doubles. These
// measure a point the way a shader that takes world positions sees it.
const H = 1080;
const W = 1920;
const PX = (FOV * Math.PI) / 180 / H; // one pixel, as an angle
const f = Math.fround;
const f32 = (m) => Array.from(Float32Array.from(m.elements));
// a 4 × 4 (column-major) times a point, every product and sum rounded as the chip does
const mul32 = (e, [x, y, z, w = 1]) => [0, 1, 2, 3].map((r) => f(f(f(f(e[r] * x) + f(e[4 + r] * y)) + f(f(e[8 + r] * z) + f(e[12 + r] * w)))));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => a.map((v) => v / Math.sqrt(dot(a, a)));
const pxAngle = (a, b) => Math.acos(Math.min(1, dot(unit(a), unit(b)))) / PX;

// the shader's world position for p (modelMatrix · p) less the camera's
// (cameraPosition), both in 32 bits: a body's air, its rim light, its glow
const shaderView = (obj, cam, p) => {
  const w = mul32(f32(obj.matrixWorld), p);
  const c = cam.getWorldPosition(new THREE.Vector3());
  return [f(w[0] - f(c.x)), f(w[1] - f(c.y)), f(w[2] - f(c.z))];
};
// p on the canvas in px, as a shader projects it: projection · view · model, in 32 bits
const shaderPx = (obj, cam, p) => {
  const clip = mul32(f32(cam.projectionMatrix), mul32(f32(cam.matrixWorldInverse), mul32(f32(obj.matrixWorld), p)));
  return [((clip[0] / clip[3] + 1) / 2) * W, ((clip[1] / clip[3] + 1) / 2) * H];
};
// the same in doubles: where it truly is
const truePx = (obj, cam, p) => {
  const v = new THREE.Vector3(...p).applyMatrix4(obj.matrixWorld).project(cam);
  return [((v.x + 1) / 2) * W, ((v.y + 1) / 2) * H];
};

const AT = [1e9, 2e8, -7e8];
// 120 behind it, up and to one side, at no round number
const BEHIND = unit([0.31, 0.22, 1]).map((v) => v * 120);

// the universe's tree: a scene, the map in it, a body in the map, the camera
const world = ({ at = AT, from = BEHIND, mapAt = [0, 0, 0] } = {}) => {
  const scene = new THREE.Scene();
  const map = new THREE.Group();
  map.position.set(...mapAt);
  scene.add(map);
  const body = new THREE.Object3D();
  body.position.set(at[0] - mapAt[0], at[1] - mapAt[1], at[2] - mapAt[2]);
  map.add(body);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.08, 45000);
  scene.add(camera);
  camera.position.set(at[0] + from[0], at[1] + from[1], at[2] + from[2]);
  camera.lookAt(...at);
  scene.updateMatrixWorld();
  return { scene, map, body, camera, rel: createRelativeDraw({ camera, map, scene }) };
};
// what the renderer does first as it draws: brings every matrix up to date
const render = (scene, look) => () => {
  scene.updateMatrixWorld();
  return look();
};

describe('drawing camera-relative', () => {
  it('draws a body 10^9 out within a pixel of where it is', () => {
    const { scene, body, camera, rel } = world();
    const want = BEHIND.map((v) => -v); // from the camera to the body
    const sure = truePx(body, camera, [0, 0, 0]);
    // and a point on its skin, 40 out, too
    const skin = [40, 0, 0];
    const skinSure = truePx(body, camera, skin);
    let seen = null;
    rel.drawn(
      render(scene, () => {
        seen = { view: shaderView(body, camera, [0, 0, 0]), px: shaderPx(body, camera, [0, 0, 0]), skin: shaderPx(body, camera, skin) };
      }),
    );
    expect(pxAngle(seen.view, want)).toBeLessThan(1);
    expect(Math.hypot(seen.px[0] - sure[0], seen.px[1] - sure[1])).toBeLessThan(1);
    expect(Math.hypot(seen.skin[0] - skinSure[0], seen.skin[1] - skinSure[1])).toBeLessThan(1);
  });

  it('would not without it', () => {
    const { body, camera } = world();
    const want = BEHIND.map((v) => -v);
    const sure = truePx(body, camera, [0, 0, 0]);
    const px = shaderPx(body, camera, [0, 0, 0]);
    expect(pxAngle(shaderView(body, camera, [0, 0, 0]), want)).toBeGreaterThan(1);
    expect(Math.hypot(px[0] - sure[0], px[1] - sure[1])).toBeGreaterThan(1);
  });

  it('draws camera-relative near home too: the camera at nought and the map round it', () => {
    const { scene, map, camera, rel } = world({ at: [120, 40, -300] });
    const was = camera.position.clone();
    rel.drawn(() => {
      expect(camera.position.toArray()).toEqual([0, 0, 0]);
      expect(map.position.toArray()).toEqual(was.clone().negate().toArray());
      scene.updateMatrixWorld();
      expect(camera.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 0, 0]);
    });
  });

  it('puts everything back after the draw, exactly, and the matrices with them', () => {
    const mapAt = [0.1, -3.7, 12345.678];
    const { scene, map, body, camera, rel } = world({ mapAt });
    const cam = camera.position.toArray();
    const bodyAt = body.getWorldPosition(new THREE.Vector3()).toArray();
    const out = rel.drawn(render(scene, () => 'drawn'));
    expect(map.position.toArray()).toEqual(mapAt);
    expect(camera.position.toArray()).toEqual(cam);
    expect(body.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(bodyAt);
    expect(camera.matrixWorld.elements.slice(12, 15)).toEqual(cam);
    expect(out).toBe('drawn');
  });

  it('puts everything back when the draw throws', () => {
    const { scene, map, camera, rel } = world();
    const cam = camera.position.toArray();
    expect(() =>
      rel.drawn(
        render(scene, () => {
          throw new Error('lost');
        }),
      ),
    ).toThrow('lost');
    expect(map.position.toArray()).toEqual([0, 0, 0]);
    expect(camera.position.toArray()).toEqual(cam);
    expect(camera.matrixWorld.elements.slice(12, 15)).toEqual(cam);
  });
});

describe('the lens and the reach', () => {
  it('moves the near plane, but not for a change under 2%', () => {
    const { camera, rel } = world();
    const proj = camera.projectionMatrix.clone();
    rel.lens(0.0801);
    expect(camera.near).toBe(0.08);
    expect(camera.projectionMatrix.equals(proj)).toBe(true);
    rel.lens(6);
    expect(camera.near).toBe(6);
    expect(camera.projectionMatrix.equals(proj)).toBe(false);
  });

  it('moves the far plane, and keeps the camera’s first as FAR', () => {
    const { camera, rel } = world();
    expect(rel.FAR).toBe(45000);
    const proj = camera.projectionMatrix.clone();
    rel.reach(45000);
    expect(camera.projectionMatrix.equals(proj)).toBe(true);
    rel.reach(900);
    expect(camera.far).toBe(900);
    expect(camera.projectionMatrix.equals(proj)).toBe(false);
    rel.reach(rel.FAR);
    expect(camera.far).toBe(45000);
    expect(rel.FAR).toBe(45000);
  });
});
