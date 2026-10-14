import { describe, expect, it } from 'vitest';
import { indexMachine, movesFor, pathOf, pickMove, summary } from './bf2017-moves.mjs';

// A machine of Luke's push as the export has it (DefaultSoldierStateMachine: A.Luke.ForcePush.SEQ.Player0, its
// keyed channels and its root), its air variant, and a two-node flow of Han's charge (Enter → Loop), cut down.
const ch = (type, name) => ({ $type: type, Name: name });
const track = (t, n, v) => ({ Keyframes: [{ Time: t, Length: n, Value: v }] });
function machine() {
  const o = [];
  const put = (x) => o.push(x) - 1;
  const CUR = put(ch('IntChannelData', 'CurrentAbility'));
  const TRIG = put(ch('IntChannelData', 'TriggerAffectorEnum'));
  const UNST = put(ch('BoolChannelData', 'Unstaggerable'));
  const ABR = put(ch('BoolChannelData', 'CharacterState.Ability.Branch'));
  const ints = (tracks) => put({ $type: 'CharacterStateKeyframedIntChannelControllerData', Tracks: tracks.map((t) => t[1]), Channels: tracks.map((t) => ({ $ref: t[0] })) });
  const bools = (tracks) => put({ $type: 'CharacterStateKeyframedBoolChannelControllerData', Tracks: tracks.map((t) => t[1]), Channels: tracks.map((t) => ({ $ref: t[0] })) });
  const keyed = (i, b) => put({ $type: 'CharacterStateKeyframedChannelControllerData', IntChannelController: { $ref: i }, BoolChannelController: b != null ? { $ref: b } : null });
  const root = (n, metres) => put({ $type: 'CharacterStateKeyframedTransformChannelControllerData', Tracks: [{ Keyframes: Array.from({ length: n + 1 }, (_, t) => ({ Time: t, Value: { trans: { x: 0, y: 0, z: (metres * t) / n } } })) }] });
  const clip = (name, length, kc, r, infos = []) => put({ $type: 'CharacterStateClipControllerData', Name: name, Length: length, ChannelController: { $ref: kc }, TransformChannelController: { $ref: r }, ClipInfos: infos });
  const push = clip('A.Luke.ForcePush.SEQ.Player0', 76, keyed(ints([[CUR, track(0, 56, 4)], [TRIG, track(10, 4, 1)]]), bools([[UNST, { Keyframes: [{ Time: 0, Length: 13, Value: true }] }], [ABR, { Keyframes: [{ Time: 42, Length: 14, Value: true }] }]])), root(76, 0.65), [{ Length: 109, StartTime: -18, StartInTime: 18 }]);
  clip('A.Luke.ForcePush.AirAttack.SEQ.Player0', 60, keyed(ints([[CUR, track(0, 50, 4)], [TRIG, track(10, 7, 1)]])), root(60, 0));
  const loopClip = clip('Player', 159, keyed(ints([])), root(159, 20));
  const loop = put({ $type: 'CharacterStateStateFlowNodeControllerData', Name: 'Loop', Transitions: [], ChannelControllers: [{ $ref: keyed(ints([[CUR, track(0, 159, 11)], [TRIG, track(0, 159, 10)]])) }], Subjects: [{ $ref: loopClip }] });
  const enterClip = clip('Player', 84, keyed(ints([])), root(84, 6));
  const enter = put({ $type: 'CharacterStateStateFlowNodeControllerData', Name: 'Enter', Transitions: [{ Target: { $ref: loop }, StartTick: 74, Length: 10 }], ChannelControllers: [{ $ref: keyed(ints([[CUR, track(0, 84, 11)], [TRIG, track(0, 84, 10)]])) }], Subjects: [{ $ref: enterClip }] });
  put({ $type: 'CharacterStateStateFlowControllerData', Name: 'A.HanSolo.ShoulderCharge.SeqFLOW (Actor0)', Subjects: [{ $ref: enter }] });
  const names = [];
  o.forEach((x) => x.$type === 'CharacterStateClipControllerData' && names.push(x.ClipInfos.length ? ['A_Luke_Stand_ForceAttack_Push_01'] : []));
  return { m: indexMachine(o, names), push };
}

describe('the moves from the soldier state machine', () => {
  it('reads Luke’s push: Active while CurrentAbility is 4, the affectors at tick 10, the clip 18 ticks in', () => {
    const { m, push } = machine();
    const cands = movesFor(m, 4, ['Luke']);
    expect(cands).toHaveLength(2);
    const pick = pickMove(cands);
    expect(pick.index).toBe(push);
    const s = summary(m, pick);
    expect(s).toMatchObject({ node: 'A.Luke.ForcePush.SEQ.Player0', length: 1.267, active: 0.933, unstaggerable: [[0, 0.217]], branches: { ability: 0.7 } });
    expect(s.triggers).toEqual([{ at: 0.167, length: 0.067, value: 1, node: 'A.Luke.ForcePush.SEQ.Player0' }]);
    expect(s.clip).toEqual({ name: 'A_Luke_Stand_ForceAttack_Push_01', offset: 0.3, length: 1.817 });
    expect(s.root.at(-1)).toEqual([1.267, 0, 0, 0.65]);
  });

  it('follows a flow from its entry through the node it holds on to, the travel carried on', () => {
    const { m } = machine();
    const pick = pickMove(movesFor(m, 11, ['Han']));
    expect(pick.name).toBe('Enter');
    expect(pathOf(m, pick).map((n) => n.name)).toEqual(['Enter', 'Loop']);
    const s = summary(m, pick);
    expect(s.active).toBeCloseTo((84 + 159) / 60, 3);
    expect(s.triggers.map((t) => [t.at, t.value])).toEqual([
      [0, 10],
      [1.4, 10],
    ]);
    expect(s.root.at(-1)[3]).toBeCloseTo(26, 3);
    expect(movesFor(m, 11, ['Luke'])).toEqual([]);
  });
});
