import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import cameras from '../../../data/bf2017/cameras.json';
import { SHAKE_DECAY, SHAKE_FALLOFF, createCameraRig, knock, shakeDecay, shakeNoise } from './rig';

const row = cameras.rows.soldier;
const pose = { at: [0, 2, -5], lookAt: [0, 2, -4], fov: 70, roll: 0 };
const DT = 1 / 60;

describe('createCameraRig', () => {
  it('puts the pose on the camera: the place, the view, the field', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 100);
    const rig = createCameraRig(cam);
    rig.set(pose);
    rig.update(DT);
    expect(cam.position.toArray()).toEqual(pose.at);
    expect(cam.fov).toBe(70);
    const f = cam.getWorldDirection(new Vector3());
    expect(f.z).toBeCloseTo(1, 6);
  });

  it('the recoil throws the view up and springs back to nothing', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 100);
    const rig = createCameraRig(cam);
    rig.set(pose);
    rig.kick(0.05);
    let peak = 0;
    let up = 0;
    for (let i = 0; i < 60; i++) {
      rig.update(DT);
      peak = Math.max(peak, rig.state().recoil);
      up = Math.max(up, cam.getWorldDirection(new Vector3()).y);
    }
    expect(peak).toBeGreaterThan(0.025);
    expect(peak).toBeLessThan(0.065);
    expect(up).toBeGreaterThan(0.02);
    expect(Math.abs(rig.state().recoil)).toBeLessThan(1e-3);
  });

  it('the shake decays to nothing and moves the camera only while it lasts', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 100);
    const rig = createCameraRig(cam, { shake: { factor: row.shake } });
    rig.set(pose);
    rig.shake(1);
    expect(rig.state().trauma).toBe(1);
    rig.update(DT);
    let moved = cam.position.distanceTo(new Vector3(...pose.at));
    expect(moved).toBeGreaterThan(0);
    for (let i = 0; i < Math.ceil(60 / SHAKE_DECAY); i++) rig.update(DT);
    expect(rig.state().trauma).toBe(0);
    rig.update(DT);
    moved = cam.position.distanceTo(new Vector3(...pose.at));
    expect(moved).toBe(0);
  });

  it('a far blast knocks less', () => {
    expect(knock(1, SHAKE_FALLOFF)).toBeCloseTo(0.5, 9);
    expect(knock(1, 0, row.shake)).toBe(row.shake);
    expect(shakeDecay(0.5, 1)).toBe(Math.max(0, 0.5 - SHAKE_DECAY));
    for (let t = 0; t < 3; t += 0.01) expect(Math.abs(shakeNoise(t, 2))).toBeLessThanOrEqual(1);
  });

  it('hands the listener the record’s field and radius', () => {
    const cam = new PerspectiveCamera(60, 1, 0.1, 100);
    const rig = createCameraRig(cam, { listener: row.listener });
    rig.set(pose);
    rig.update(DT);
    const l = rig.listener();
    expect(l.fov).toBe(55);
    expect(l.radius).toBe(0.5);
    expect(l.forward).toEqual([0, 0, 1]);
  });
});
