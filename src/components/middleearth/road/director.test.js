import { describe, expect, it } from 'vitest';
import { FOV, LOOK_LIMIT, RIGS, ease, pose, settleLook } from './director';

// a lead at the origin walking +z, the land flat at 0
const base = (o = {}) => ({ rig: 'follow', params: {}, lead: { at: [0, 0, 0], heading: 0 }, tangent: [0, 0, 1], metres: 0, look: { yaw: 0, pitch: 0 }, mode: 'walk', reduced: false, heightAt: () => 0, t: 0, ...o });
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('the director: the film’s grammar as camera rigs', () => {
  it('knows its eight rigs', () => {
    expect(RIGS).toEqual(['follow', 'lead', 'side', 'low', 'crane', 'wide', 'seat', 'ride']);
  });

  it('follow: over the lead’s left shoulder, 3.4 m back and 1.6 m up, looking 7 m ahead along the road', () => {
    const p = pose(base());
    // (the left of a lead walking +z is +x)
    expect(near(p.at, [0.75, 1.6, -3.4])).toBe(true);
    expect(near(p.lookAt, [0.35, 1.35, 7])).toBe(true);
    // (the lead to one side of the frame's middle, not in it)
    const aim = Math.atan2(p.lookAt[0] - p.at[0], p.lookAt[2] - p.at[2]);
    const lead = Math.atan2(0 - p.at[0], 0 - p.at[2]);
    expect(Math.abs(lead - aim)).toBeGreaterThan(0.15);
    expect(p.fov).toBe(FOV.walk);
    expect(p.dof).toBe(false);
  });

  it('lead: 4 m ahead at 1.5 m, looking back at the walkers', () => {
    const p = pose(base({ rig: 'lead' }));
    expect(near(p.at, [0, 1.5, 4])).toBe(true);
    expect(near(p.lookAt, [0, 1, 0])).toBe(true);
  });

  it('side: 4 m to the right of the road at 1.4 m', () => {
    const p = pose(base({ rig: 'side' }));
    expect(near(p.at, [-4, 1.4, 0])).toBe(true);
    expect(near(p.lookAt, [0, 1, 0])).toBe(true);
  });

  it('low: 0.5 m up, 2 m back beside the lead’s left knee, looking up 20°, the depth of field on', () => {
    const p = pose(base({ rig: 'low' }));
    expect(near(p.at, [0.9, 0.5, -2])).toBe(true);
    const d = p.lookAt.map((v, i) => v - p.at[i]);
    expect(Math.atan2(d[1], Math.hypot(d[0], d[2]))).toBeCloseTo((20 * Math.PI) / 180, 6);
    expect(p.dof).toBe(true);
  });

  it('crane: from follow up to 30 m over its seconds', () => {
    expect(near(pose(base({ rig: 'crane', t: 0 })).at, [0.75, 1.6, -3.4])).toBe(true);
    expect(pose(base({ rig: 'crane', t: 8 })).at[1]).toBeCloseTo(30, 6);
    expect(pose(base({ rig: 'crane', t: 2, params: { seconds: 2 } })).at[1]).toBeCloseTo(30, 6);
    const half = pose(base({ rig: 'crane', t: 4 })).at[1];
    expect(half).toBeGreaterThan(1.6);
    expect(half).toBeLessThan(30);
  });

  it('wide and seat stand where the beat puts them; seat closes the lens to 38°', () => {
    const params = { at: [10, 3, 20], lookAt: [0, 1, 30] };
    expect(pose(base({ rig: 'wide', params }))).toMatchObject({ at: [10, 3, 20], lookAt: [0, 1, 30], fov: 50 });
    const seat = pose(base({ rig: 'seat', params }));
    expect(seat.fov).toBe(FOV.seat);
    expect(seat.dof).toBe(true);
  });

  it('ride: the offset in the mount’s frame, turned with it', () => {
    const p = pose(base({ rig: 'ride', params: { offset: [0, 2, -1] }, lead: { at: [5, 0, 5], heading: Math.PI / 2 } }));
    expect(near(p.at, [4, 2, 5])).toBe(true);
    expect(pose(base({ rig: 'ride', mode: 'eagle', params: { offset: [0, 2, -1] } })).fov).toBe(FOV.eagle);
  });

  it('turns with the lead: follow behind a lead heading +x is at −x, over its left shoulder (−z)', () => {
    const p = pose(base({ lead: { at: [0, 0, 0], heading: Math.PI / 2 }, tangent: [1, 0, 0] }));
    expect(near(p.at, [-3.4, 1.6, -0.75])).toBe(true);
  });

  it('the visitor’s look turns the frame about the rig’s, clamped; a seat’s closer', () => {
    const dir = (p) => Math.atan2(p.lookAt[0] - p.at[0], p.lookAt[2] - p.at[2]);
    const straight = dir(pose(base()));
    expect(dir(pose(base({ look: { yaw: 0.5, pitch: 0 } }))) - straight).toBeCloseTo(0.5, 6);
    expect(pose(base({ look: { yaw: 2, pitch: 0 } }))).toEqual(pose(base({ look: { yaw: LOOK_LIMIT.yaw, pitch: 0 } })));
    expect(pose(base({ look: { yaw: 0, pitch: -1 } }))).toEqual(pose(base({ look: { yaw: 0, pitch: -LOOK_LIMIT.pitch } })));
    const params = { at: [0, 2, 0], lookAt: [0, 2, 10] };
    expect(pose(base({ rig: 'seat', params, look: { yaw: 1, pitch: 0 } }))).toEqual(pose(base({ rig: 'seat', params, look: { yaw: LOOK_LIMIT.seat, pitch: 0 } })));
  });

  it('never puts the camera under the ground: 0.4 m over it at least', () => {
    for (const rig of RIGS) {
      const p = pose(base({ rig, heightAt: () => 5, params: { at: [0, 0, 0], lookAt: [0, 0, 10], offset: [0, 0, 0] } }));
      expect(p.at[1]).toBeGreaterThanOrEqual(5.4 - 1e-9);
    }
  });

  it('but for a placed shot down in the land (a chamber under the plain), stood where it says', () => {
    const p = pose(base({ rig: 'seat', heightAt: () => 24, params: { at: [-2.6, -198, 127], lookAt: [0, -199, 133], under: true } }));
    expect(p.at[1]).toBeCloseTo(-198, 9);
  });

  it('eases between two rigs’ poses', () => {
    const a = pose(base());
    const b = pose(base({ rig: 'lead' }));
    expect(ease(a, b, 0)).toEqual(a);
    expect(ease(a, b, 1)).toEqual(b);
    expect(ease(a, b, 0.5).at[2]).toBeCloseTo((a.at[2] + b.at[2]) / 2, 9);
  });

  it('a look let go settles back to the middle over two seconds', () => {
    const l = settleLook({ yaw: 1, pitch: 0.4 }, 2);
    expect(Math.abs(l.yaw)).toBeLessThan(0.05);
    expect(Math.abs(l.pitch)).toBeLessThan(0.05);
    let m = { yaw: 1, pitch: 0 };
    for (let i = 0; i < 120; i++) m = settleLook(m, 1 / 60);
    expect(Math.abs(m.yaw)).toBeLessThan(0.05);
  });

  it('the lens: 50° walking, 38° in a seat, 62° on the eagle', () => {
    expect(FOV).toEqual({ walk: 50, seat: 38, eagle: 62 });
  });

  it('a crane may be given what to look at and how high to rise', () => {
    const p = pose(base({ rig: 'crane', params: { seconds: 4, top: 12, lookAt: [20, 3, 30] }, t: 4 }));
    expect(p.lookAt).toEqual([20, 3, 30]);
    expect(p.at[1]).toBeCloseTo(12, 5);
  });
});
