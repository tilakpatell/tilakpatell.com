import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESHY_BONES } from './meshyRig.fixture';
import { FAMILIES, ROLES, checkClip, checkRig, hipsOf, masksFor, plain, rolesFor } from './rigCheck';

// animator.js's MESHY_MASKS as they stand (written out: the animator is mid-change elsewhere)
const MESHY_MASKS = {
  upper: ['Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
  lower: ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
};
const MESHY = MESHY_BONES.map(([n]) => n);
const MIXAMO = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].map((n) => `mixamorig:${n}`);

describe('checkRig', () => {
  it('checkRig names the Meshy family and finds toes', () => {
    const r = checkRig(MESHY);
    expect(r.family).toBe('meshy');
    expect(r.toes).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.roles).toMatchObject({ hips: 'Hips', head: 'Head', armL: 'LeftArm', toeR: 'RightToeBase' });
  });

  it('checkRig names Mixamo and the missing roles', () => {
    const r = checkRig(MIXAMO);
    expect(r.family).toBe('mixamo');
    expect(r.toes).toBe(false);
    expect(r.missing).toEqual(['toeL', 'toeR']);
    expect(r.roles.hips).toBe('mixamorig:Hips');
    // a Sketchfab download's numbered Mixamo bones, and three's colonless names
    expect(checkRig(['mixamorig:Hips_5', 'mixamorig:LeftArm_20']).roles).toMatchObject({ hips: 'mixamorig:Hips_5', armL: 'mixamorig:LeftArm_20' });
    expect(checkRig(['mixamorigHips']).family).toBe('mixamo');
  });

  it('names every family ROLES covers, and none for a rig it doesn’t', () => {
    expect(checkRig(['pelvis', 'upperarm_l', 'ball_r']).family).toBe('unreal');
    expect(checkRig(['CC_Base_Hip', 'CC_Base_L_Upperarm']).family).toBe('cc');
    expect(checkRig(['C_Spine00_Hips_XB', 'L_Arm02_Shoulder_XB', 'L_Leg04_Toes_XL2']).family).toBe('highmoon');
    // the Transformers: Prime game's bones pose by ROLES, but no family is named for them
    const prime = checkRig(['Humerus.l', 'Thigh.l']);
    expect(prime.family).toBeNull();
    expect(prime.roles).toMatchObject({ armL: 'Humerus.l', thighL: 'Thigh.l' });
    const mario = checkRig(['spine', 'upper_armL', 'thighL']);
    expect(mario.family).toBeNull();
    expect(mario.missing).toHaveLength(Object.keys(ROLES).length);
    expect(checkRig([]).family).toBeNull();
  });
});

describe('checkClip', () => {
  it('checkClip reports a track whose bone the figure lacks', () => {
    const tracks = ['Hips.position', 'Hips.quaternion', 'LeftToeBase.quaternion', 'Tail.quaternion'];
    const r = checkClip(tracks, MESHY.filter((n) => n !== 'LeftToeBase'));
    expect(r.unresolved).toEqual(['LeftToeBase.quaternion', 'Tail.quaternion']);
    expect(r.resolved).toEqual(['Hips.position', 'Hips.quaternion']);
    expect(r.root).toBe('Hips');
  });

  it('binds names as three does (a colon gone) and finds the root by role', () => {
    const r = checkClip(['mixamorig:Hips.position', 'mixamorig:LeftArm.quaternion', 'Body.morphTargetInfluences'], ['mixamorigHips', 'mixamorigLeftArm']);
    expect(r.unresolved).toEqual([]);
    expect(r.root).toBe('mixamorig:Hips');
    expect(checkClip(['Hips.quaternion'], ['Hips']).root).toBeNull(); // (no translation, no root)
  });
});

describe('hipsOf', () => {
  it('reads the clip’s, else the bake’s extras, else the Hips node’s rest height, and notes it on the clip', () => {
    expect(hipsOf({ userData: { hips: 90 } }, { position: { y: 95 } })).toBe(90);
    expect(hipsOf({ userData: { extras: { hips: 95.5 } } }, { position: { y: 1 } })).toBe(95.5);
    const c = { userData: {} };
    expect(hipsOf(c, { position: { y: 93.3 } })).toBe(93.3);
    expect(c.userData.hips).toBe(93.3);
    expect(hipsOf(null, null)).toBeNull();
    expect(hipsOf({ userData: {} }, null)).toBeNull();
  });
});

describe('rolesFor and masksFor', () => {
  it('names each role’s bone on every family, matching ROLES', () => {
    for (const f of FAMILIES) {
      const roles = rolesFor(f);
      expect(Object.keys(roles), f).toEqual(Object.keys(ROLES));
      for (const [role, name] of Object.entries(roles)) expect(ROLES[role], `${f} ${role}`).toContain(plain(name));
      const r = checkRig(Object.values(roles));
      expect(r.family, f).toBe(f);
      expect(r.missing, f).toEqual([]);
    }
    expect(Object.values(rolesFor('nope')).every((v) => v === null)).toBe(true);
  });

  it('masksFor(’meshy’) is the animator’s Meshy masks', () => {
    expect(masksFor('meshy')).toEqual(MESHY_MASKS);
  });

  it('masksFor(’mixamo’) lists mixamorig arms in upper', () => {
    const m = masksFor('mixamo');
    expect(m.upper).toEqual(expect.arrayContaining(['mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm']));
    expect(m.lower).toContain('mixamorigHips');
    expect(m.upper).not.toContain('mixamorigHips');
    expect(masksFor(null)).toEqual({ upper: [], lower: [] });
  });

  it('keeps the arms up and the legs down on every family', () => {
    for (const f of FAMILIES) {
      const r = rolesFor(f);
      const m = masksFor(f);
      for (const k of ['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'head']) expect(m.upper, `${f} ${k}`).toContain(r[k]);
      for (const k of ['hips', 'thighL', 'calfL', 'footL', 'toeL', 'thighR', 'calfR', 'footR', 'toeR']) expect(m.lower, `${f} ${k}`).toContain(r[k]);
    }
  });
});

// rig.js keeps its own ROLES and plain() until it imports these; until then
// the two must say the same, or a figure poses by one and is checked by the other
describe('one ROLES', () => {
  const src = readFileSync(new URL('./rig.js', import.meta.url), 'utf8');
  const own = /const ROLES = \{/.test(src);
  it('says what rig.js’s ROLES says (or rig.js takes these)', () => {
    if (!own) return expect(src).toMatch(/import \{[^}]*\bROLES\b[^}]*\} from '\.\/rigCheck'/);
    const block = src.match(/const ROLES = \{([\s\S]*?)\n\};/)?.[1];
    const theirs = {};
    for (const [, role, list] of block.matchAll(/^\s*(\w+): \[([^\]]*)\]/gm)) theirs[role] = [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(ROLES).toEqual(theirs);
  });
  it('strips what rig.js’s plain() strips', () => {
    for (const [n, want] of [
      ['mixamorig:LeftArm', 'leftarm'],
      ['mixamorigLeftArm', 'leftarm'],
      ['CC_Base_L_Thigh', 'l_thigh'],
      ['Hips_5', 'hips'],
      ['L_Leg04_Toes_XL2', 'l_leg04_toes_xl2'],
    ])
      expect(plain(n)).toBe(want);
    if (own) expect(src).toContain(".replace(/^mixamorig:?/i, '')\n    .replace(/^CC_Base_/i, '')\n    .replace(/_\\d+$/, '')\n    .toLowerCase()");
  });
});
