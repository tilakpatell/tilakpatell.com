import { describe, expect, it } from 'vitest';
import { NPC_SET } from './npc';

describe('the soldiers’ set', () => {
  it('names cover low and high, awareness, the arrivals, the patrol’s turns and the officer’s signals', () => {
    for (const n of ['cover.low.idle', 'cover.low.peek', 'cover.low.fire', 'cover.low.into', 'cover.low.out', 'cover.low.flinch', 'cover.high.idle', 'cover.high.peek', 'cover.high.fire', 'cover.high.into', 'cover.high.out', 'aware.alert', 'aware.look', 'aware.relax', 'aware.search', 'spawn.drop', 'spawn.runin', 'spawn.deploy', 'loco.start', 'loco.stop', 'loco.patrol', 'loco.turn.right', 'officer.signal', 'officer.attack']) expect(NPC_SET[n], n).toBeTruthy();
    expect([].concat(NPC_SET['cover.low.idle'])).toContain('Cover_Left_Crouch_Idle_Search');
  });
  it('takes none of the humanoid pack’s names (a soldier keeps its crouch and its look round)', () => {
    for (const n of Object.keys(NPC_SET)) expect(['crouch', 'idle', 'walk', 'run', 'look.around', 'idle.patrol', 'talk'], n).not.toContain(n);
  });
});
