import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { LINES } from '../../voicelines';

describe('Caradhras’ beats', () => {
  sweepBeats('caradhras', BEATS);

  it('the brief’s moments: Hollin, the crebain over the ridge, the snow with Saruman on the wind, the slide, the Walls, the Doors held for the word, the Watcher', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['hollin', 'crebain', 'snow', 'avalanche', 'walls', 'doors', 'watcher']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.crebain).toMatchObject({ rig: 'wide' });
    expect(by.crebain.hold).toBeGreaterThanOrEqual(6);
    expect(by.snow).toMatchObject({ rig: 'wide' });
    expect(by.snow.lines.map((l) => LINES[l].who)).toEqual(['saruman']);
    expect(by.avalanche).toMatchObject({ rig: 'follow', cut: 0 });
    expect(by.doors).toMatchObject({ rig: 'low' });
    expect(by.doors.hold).toBeGreaterThanOrEqual(12);
    expect(by.doors.lines.map((l) => LINES[l].who)).toEqual(['gandalf']);
    expect(by.watcher).toMatchObject({ rig: 'seat', cut: 0 });
  });
});
