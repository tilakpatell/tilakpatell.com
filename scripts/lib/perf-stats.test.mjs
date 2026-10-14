import { describe, expect, it } from 'vitest';
import { DROP_MS, F, frameStdev, late, mdRow, median, playOf, summarise, worstShare } from './perf-stats.mjs';

describe('the spread of frame-to-frame times', () => {
  it('is 0 for an even pace', () => {
    expect(frameStdev([16.7, 16.7, 16.7, 16.7])).toBe(0);
  });

  it('is the population standard deviation of the deltas: 16 and 18 alternating is 1 ms', () => {
    expect(frameStdev([16, 18, 16, 18])).toBeCloseTo(1, 12);
  });

  it('drops a pause (a tab in the background): deltas over 250 ms are not frames, as lib/three/pace drops them', () => {
    expect(DROP_MS).toBe(250);
    expect(frameStdev([16, 18, 4000, 16, 18])).toBeCloseTo(1, 12);
    expect(frameStdev([16, 18, 250, 16, 18])).toBeGreaterThan(1);
  });

  it('is null with fewer than two frames to compare', () => {
    expect(frameStdev([])).toBeNull();
    expect(frameStdev([16])).toBeNull();
    expect(frameStdev([16, 900])).toBeNull();
  });
});

describe('the median', () => {
  it('is the middle value, or the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('is null with nothing to take it of, and leaves out what was not measured', () => {
    expect(median([])).toBeNull();
    expect(median([null, null])).toBeNull();
    expect(median([null, 5, 7, null])).toBe(6);
  });
});

describe('the worst 1 %', () => {
  it('is the mean of the slowest hundredth of the frames', () => {
    const ms = [...Array(198).fill(10), 40, 60];
    expect(worstShare(ms)).toBe(50);
  });

  it('is the slowest frame alone when there are fewer than a hundred', () => {
    expect(worstShare([...Array(98).fill(10), 50])).toBe(50);
    expect(worstShare([12])).toBe(12);
  });

  it('is null with no frames', () => {
    expect(worstShare([])).toBeNull();
  });
});

// a frame record as the page's recorder writes it (F names the fields)
const frame = (t, o = {}) => {
  const f = Array(16).fill(0);
  f[F.t] = t;
  f[F.slow] = '';
  f[F.gpu] = null;
  f[F.progs] = null;
  for (const [k, v] of Object.entries(o)) f[F[k]] = v;
  return f;
};

describe('a journey summed up phase by phase', () => {
  const frames = [frame(1000), frame(1010, { draws: 100, main: 4, gpu: 2, progs: 30 }), frame(1030, { draws: 300, main: 6, gpu: null, pipes: 2, progs: 32 }), frame(1040, { draws: 200, main: 5, gpu: 4, links: 1, progs: 33 })];
  const marks = [
    ['idle', 999],
    ['empty', 1041],
    ['end', 2000],
  ];

  it('gives each phase its frame times, its worst 1 % and its means a frame', () => {
    const [idle] = summarise({ frames, marks, loaf: [] });
    expect(idle.phase).toBe('idle');
    expect(idle.frames).toBe(4);
    expect(idle.p50).toBe(10);
    expect(idle.w1).toBe(20);
    expect(idle.draws).toBe(150);
  });

  it('takes the main thread’s and the chip’s medians over the frames that measured them', () => {
    const [idle] = summarise({ frames, marks, loaf: [] });
    expect(idle.main).toBe(4.5);
    expect(idle.gpu).toBe(3);
  });

  it('counts the shaders linked and the pipelines made, and keeps the live programs at the phase’s end', () => {
    const [idle] = summarise({ frames, marks, loaf: [] });
    expect(idle.links).toBe(1);
    expect(idle.pipes).toBe(2);
    expect(idle.progs).toBe(33);
  });

  it('counts the long animation frames and their blocking time inside the phase', () => {
    const loaf = [
      { t: 1005, ms: 80, block: 30, scripts: [] },
      { t: 1500, ms: 60, block: 10, scripts: [] },
    ];
    const [idle, empty] = summarise({ frames, marks, loaf });
    expect(idle.loafs).toBe(1);
    expect(idle.block).toBe(30);
    expect(empty.loafs).toBe(1);
  });

  it('gives a phase with no frames zeros and nulls, never NaN', () => {
    const [, empty] = summarise({ frames, marks, loaf: [] });
    expect(empty.frames).toBe(0);
    expect(empty.fps).toBe(0);
    expect(empty.w1).toBeNull();
    expect(empty.main).toBeNull();
    expect(empty.gpu).toBeNull();
    expect(empty.progs).toBeNull();
    for (const v of Object.values(empty)) if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
  });

  it('says the chip was not measured when no frame had its clock', () => {
    const [idle] = summarise({ frames: [frame(1000), frame(1016)], marks: [['idle', 999], ['end', 2000]], loaf: [] });
    expect(idle.gpu).toBeNull();
  });
});

describe('the part of a journey that is play', () => {
  it('starts at the mark after the settle and runs to the last', () => {
    expect(
      playOf([
        ['load', 0],
        ['settle', 100],
        ['idle', 200],
        ['move', 300],
        ['end', 400],
      ]),
    ).toEqual([200, 400]);
  });

  it('starts at the first mark when there is no settle', () => {
    expect(
      playOf([
        ['dive', 10],
        ['walk', 20],
        ['end', 30],
      ]),
    ).toEqual([10, 30]);
  });

  it('is null with fewer than two marks', () => {
    expect(playOf([['end', 5]])).toBeNull();
  });
});

describe('the pipelines made late', () => {
  it('counts the links and pipelines made more than a second after the world settled', () => {
    const frames = [frame(150, { links: 5, pipes: 5 }), frame(1050, { links: 1 }), frame(1150, { pipes: 2 }), frame(1300, { links: 1, pipes: 1 })];
    const marks = [
      ['load', 0],
      ['settle', 100],
      ['idle', 500],
      ['end', 2000],
    ];
    expect(late(frames, marks)).toBe(4);
    expect(late(frames, marks, 1150)).toBe(2);
  });

  it('is null when the world never settled', () => {
    expect(late([frame(10, { links: 3 })], [['load', 0], ['end', 50]])).toBeNull();
  });
});

describe('a markdown row for the evidence table', () => {
  it('puts the play part’s numbers in the table’s order, a dash for what was not measured', () => {
    const row = mdRow('universe', { route: '/universe', machine: 'RTX 5090', drawnOn: 'webgl', quality: 'low', readyS: 6.2, late: 0, play: { fps: 120.4, p50: 8.1, w1: 21.3, main: 3.2, gpu: null, draws: 412, progs: 88 } });
    expect(row).toBe('| /universe | RTX 5090 | webgl | low | 6.2 | 120.4 | 8.1 | 21.3 | 3.2 | - | 412 | 88 | 0 |');
  });

  it('marks a journey with no play as stopped', () => {
    expect(mdRow('fly', { route: '/fly', machine: 'x', drawnOn: null, quality: '', readyS: null, late: null, play: null, failed: 'timeout' })).toBe('| /fly | x | - | - | - | stopped: timeout | | | | | | | |');
  });
});
