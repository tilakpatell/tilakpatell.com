import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCapitalShadows, fitShadow, focusOf, shadowSize, shadowed } from './capitalShadow';

// a capital's slot as models.js hands it over: its holder out in the scene,
// `size` long
const scene = new THREE.Scene();
const slotAt = (kind, z, size = 10, { real = true } = {}) => {
  const holder = new THREE.Group();
  holder.position.set(0, 0, z);
  holder.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 1), new THREE.MeshStandardMaterial()));
  scene.add(holder);
  return { kind, size, holder, real };
};
const eye = () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  return camera;
};

describe('capitalShadow', () => {
  it('is on for a computer with shadows, at its map’s size up to 3,072, and never on a phone', () => {
    expect(shadowSize({ phone: false }, { shadows: true, shadowMap: 1024 })).toBe(1024);
    expect(shadowSize({ phone: false }, { shadows: true, shadowMap: 2048 })).toBe(2048);
    expect(shadowSize({ phone: false }, { shadows: true, shadowMap: 4096 })).toBe(3072);
    expect(shadowSize({ phone: false }, { shadows: false, shadowMap: 512 })).toBe(0);
    expect(shadowSize({ phone: true }, { shadows: true, shadowMap: 1024 })).toBe(0);
  });

  it('fits a box round the ship, square on the sun’s way, clear of it on both sides', () => {
    const centre = new THREE.Vector3(10, 20, 30);
    const way = new THREE.Vector3(1, 2, 0.5).normalize();
    const fit = fitShadow(centre, 5, way, 2048);
    expect(fit.target.toArray()).toEqual(centre.toArray());
    // (the light along the sun's way from it)
    expect(fit.position.clone().sub(centre).normalize().dot(way)).toBeCloseTo(1, 6);
    const d = fit.position.distanceTo(centre);
    expect(fit.near).toBeLessThan(d - 5);
    expect(fit.far).toBeGreaterThan(d + 5);
    expect(fit.half).toBe(5);
    // (the biases a texel or so: 10 m over 2,048)
    expect(fit.normalBias).toBeCloseTo((10 / 2048) * 1.5, 8);
    expect(fit.bias).toBeLessThan(0);
    expect(-fit.bias * (fit.far - fit.near)).toBeCloseTo((10 / 2048) * 0.5, 8);
  });

  it('takes the capital that fills most of the view, and holds it until another fills 1.3 times as much', () => {
    const camera = eye();
    const far = slotAt('destroyer', -100);
    const near = slotAt('destroyer', -50);
    expect(focusOf(camera, [far, near])).toBe(near);
    // (held: a little more of the view isn't enough to take it over)
    const close = slotAt('venator', -45);
    expect(focusOf(camera, [far, near, close], near)).toBe(near);
    expect(focusOf(camera, [far, near, close], far)).toBe(close);
  });

  it('skips what isn’t a loaded capital out there in the view, and one too small in it', () => {
    const camera = eye();
    expect(focusOf(camera, [slotAt('xwing', -20)])).toBeNull();
    expect(focusOf(camera, [slotAt('destroyer', -20, 10, { real: false })])).toBeNull();
    expect(focusOf(camera, [slotAt('destroyer', 60)])).toBeNull(); // (behind)
    expect(focusOf(camera, [slotAt('destroyer', -2000)])).toBeNull(); // (a speck)
    const hidden = slotAt('destroyer', -20);
    hidden.holder.visible = false;
    expect(focusOf(camera, [hidden])).toBeNull();
    const gone = slotAt('destroyer', -20);
    gone.holder.removeFromParent();
    expect(focusOf(camera, [gone])).toBeNull();
  });

  it('has a capital’s meshes cast and take it, but its glass and its glows', () => {
    const root = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ transparent: true }));
    const glows = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    glows.userData.glows = true;
    root.add(hull, glass, glows);
    expect(shadowed(root)).toBe(root);
    expect([hull.castShadow, hull.receiveShadow]).toEqual([true, true]);
    expect([glass.castShadow, glass.receiveShadow]).toEqual([false, false]);
    expect([glows.castShadow, glows.receiveShadow]).toEqual([false, false]);
  });

  it('moves the sun onto the ship for the frame, its way kept, and back after; off the map with none', () => {
    const renderer = { shadowMap: { enabled: false, type: THREE.VSMShadowMap, autoUpdate: true, needsUpdate: false } };
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(30, 60, 20);
    expect(createCapitalShadows({ renderer, sun, size: 0 })).toBeNull();
    const shadows = createCapitalShadows({ renderer, sun, size: 2048 });
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(false);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(2048);
    // (nothing to fit yet: every point reads off the map)
    const off = new THREE.Vector4(5, 5, 5, 1).applyMatrix4(sun.shadow.matrix);
    expect(off.x).toBeGreaterThan(1);
    const camera = eye();
    const ship = slotAt('destroyer', -40);
    const way = sun.position.clone().normalize();
    shadows.place(camera, [ship]);
    expect(shadows.focus).toBe(ship);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
    expect(sun.target.position.toArray()).toEqual([0, 0, -40]);
    expect(sun.position.clone().sub(sun.target.position).normalize().dot(way)).toBeCloseTo(1, 6);
    expect(sun.shadow.camera.right).toBeCloseTo(10 * 0.62, 6);
    shadows.home();
    expect(sun.position.toArray()).toEqual([30, 60, 20]);
    expect(sun.target.position.toArray()).toEqual([0, 0, 0]);
    // (out of the view: not drawn again, and off the map)
    renderer.shadowMap.needsUpdate = false;
    ship.holder.position.set(0, 0, 500);
    shadows.place(camera, [ship]);
    expect(shadows.focus).toBeNull();
    expect(renderer.shadowMap.needsUpdate).toBe(false);
    expect(sun.position.toArray()).toEqual([30, 60, 20]);
    expect(new THREE.Vector4(0, 0, 500, 1).applyMatrix4(sun.shadow.matrix).x).toBeGreaterThan(1);
    shadows.dispose();
    // (the runtime's renderer as the scene found it, for the world after)
    expect(renderer.shadowMap).toMatchObject({ enabled: false, type: THREE.VSMShadowMap, autoUpdate: true });
    expect(sun.castShadow).toBe(false);
  });
});
