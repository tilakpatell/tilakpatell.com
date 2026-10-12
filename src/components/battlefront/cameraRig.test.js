import { describe, expect, it } from 'vitest';
import { RECOIL, createCameraRig } from './cameraRig.js';

const DEG = Math.PI / 180;
const fakeCamera = () => {
  const cam = { fov: 55, position: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(cam.position, { x, y, z }); } }, looked: null, lookAt(x, y, z) { cam.looked = [x, y, z]; }, updateProjectionMatrix() {} };
  return cam;
};

describe('the camera rig’s recoil spring (CameraRecoilData 3000 / 0.84)', () => {
  it('climbs to the gun’s amplitude within a tenth of a second and comes back as it decays', () => {
    const rig = createCameraRig(fakeCamera());
    expect(RECOIL).toEqual({ spring: 3000, damping: 0.84 });
    rig.aim([0, 0.7 * DEG]);
    const climb = [];
    for (let i = 0; i < 6; i++) {
      rig.update(1 / 60);
      climb.push(rig.offset().pitch / DEG);
    }
    expect(climb[0]).toBeGreaterThan(0.2);
    expect(climb[5]).toBeGreaterThan(0.65);
    expect(Math.max(...climb)).toBeLessThan(0.75);
    rig.aim([0, 0]);
    for (let i = 0; i < 12; i++) rig.update(1 / 60);
    expect(Math.abs(rig.offset().pitch / DEG)).toBeLessThan(0.02);
  });

  it('turns the camera’s look by the offset, yaw and pitch, about the pose', () => {
    const cam = fakeCamera();
    const rig = createCameraRig(cam);
    rig.set({ at: [0, 1.6, 0], lookAt: [0, 1.6, 30], fov: 55 });
    rig.update(1 / 60);
    expect(cam.looked).toEqual([0, 1.6, 30]);
    rig.aim([10 * DEG, 5 * DEG]);
    for (let i = 0; i < 30; i++) rig.update(1 / 60);
    const { yaw, pitch } = rig.offset();
    expect(yaw / DEG).toBeCloseTo(10, 1);
    expect(pitch / DEG).toBeCloseTo(5, 1);
    expect(cam.looked[0]).toBeCloseTo(Math.sin(yaw) * 30, 6);
    expect(cam.looked[1]).toBeCloseTo(1.6 + Math.tan(pitch) * 30, 6);
  });
});
