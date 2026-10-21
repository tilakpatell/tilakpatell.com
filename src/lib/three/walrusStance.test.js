import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { withStance } from './walrusStance';

// a figure as withStance sees one: its animator’s restance and actions, and its own clips by name
const figure = (names) => {
  const clips = Object.fromEntries(names.map((n, i) => [n, new THREE.AnimationClip(n, 1 + i, [])]));
  const actions = { idle: { clip: clips.idle } };
  const anim = {
    actions,
    restance(set) {
      for (const [k, c] of Object.entries(set)) actions[k] = { clip: c };
      return Object.keys(set);
    },
  };
  return { fig: { model: new THREE.Group(), clips, anim, act: { idle: actions.idle } }, clips, actions };
};

describe('a 2017 figure’s stance at a phone’s level, where no stance pack is fetched', () => {
  it('stands with a rifle or a pistol in the humanoid pack’s own held pose, its gun in its hands, and gives it back', async () => {
    const { fig, clips, actions } = figure(['idle', 'walk', 'run', 'aim.rifle', 'aim.pistol']);
    withStance(fig, { clips, enabled: false });
    expect(await fig.stance('t')).toBe('t');
    // (a copy of the held pose, named for the idle it stands in for)
    expect(actions.idle.clip).not.toBe(clips['aim.rifle']);
    expect(actions.idle.clip.name).toBe('idle');
    expect(actions.idle.clip.userData.stance).toBe('t');
    expect(fig.act.idle).toBe(actions.idle);
    // (a pistol in the rifle’s pose: the pistol’s own leaves the socket out from the hand)
    expect(await fig.stance('p')).toBe('p');
    expect(actions.idle.clip.userData.stance).toBe('p');
    expect(actions.idle.clip.duration).toBe(clips['aim.rifle'].duration);
    // (the humanoid’s own idle back, for a gun of no class or a saber)
    expect(await fig.stance('humanoid')).toBe('humanoid');
    expect(actions.idle.clip).toBe(clips.idle);
  });

  it('keeps the humanoid’s idle where the pack has no held pose for the weapon, or only the idle standing in for one', async () => {
    const { fig, clips, actions } = figure(['idle', 'walk', 'run']);
    withStance(fig, { clips, enabled: false });
    expect(await fig.stance('t')).toBe('humanoid');
    expect(actions.idle.clip).toBe(clips.idle);
    // (walrus.js's copy of the idle under the pose's name, marked as one)
    clips['aim.rifle'] = Object.assign(clips.idle.clone(), { name: 'aim.rifle', userData: { fallback: 'idle' } });
    expect(await fig.stance('t')).toBe('humanoid');
    expect(actions.idle.clip).toBe(clips.idle);
  });
});
