import { describe, expect, it } from 'vitest';
import { COMPASS, DETAIL_PAUSED, GUIDE_RESERVE, detailToast, MINIMAP, STICK, far, layoutCompass, layoutRows, markerSize, minimapSize, objectiveText, othersText, padFor, promptText, stackUnder, stickRead, titleMode } from './hud';

const W = 420;
// a mark at x px along the strip (bearing back from x)
const at = (id, x) => ({ id, label: id, bearing: ((x - W / 2) / W) * COMPASS.span });

describe('the edge pad (--hud-pad)', () => {
  it('is 12 px on a phone, 20 px on a wide screen, 2vw between', () => {
    expect(padFor(390)).toBe(12);
    expect(padFor(1440)).toBe(20);
    expect(padFor(800)).toBe(16);
  });
  it('keeps the guide’s “?” its corner: 16 + 42 + 0.9 rem', () => {
    expect(GUIDE_RESERVE).toBeCloseTo(72.4, 5);
  });
});

describe('the rows', () => {
  it('starts what’s under the top row below the buttons, however they wrap', () => {
    expect(layoutRows({ width: 1280, buttonsBottom: 0 }).top).toBe(Math.round(20 + 2.45 * 16));
    expect(layoutRows({ width: 390, buttonsBottom: 140 }).top).toBe(146);
  });
  it('keeps the thumbs off the phone’s home bar', () => {
    expect(layoutRows({ width: 390 }).thumbs).toBe(12);
    expect(layoutRows({ width: 390, safeBottom: 34 }).thumbs).toBe(34);
  });
  it('puts the foot over the measured thumbs on touch, at the pad without', () => {
    expect(layoutRows({ width: 390, touch: true, thumbsHeight: 120 }).foot).toBe(12 + 120 + 8);
    expect(layoutRows({ width: 390, touch: false, thumbsHeight: 120 }).foot).toBe(12);
    expect(layoutRows({ width: 390, touch: true, thumbsHeight: 0 }).foot).toBe(12);
  });
  it('puts the thumbs over the measured foot when the foot is an instrument', () => {
    const rows = layoutRows({ width: 390, touch: true, order: 'thumbs-over', footHeight: 100, thumbsHeight: 200, safeBottom: 34 });
    expect(rows).toMatchObject({ foot: 34, thumbs: 34 + 100 + 8 });
  });
});

describe('stacking down a column', () => {
  it('puts each under the last, a gap apart', () => {
    expect(stackUnder([40, 20, 30], { from: 10 })).toEqual([10, 58, 86]);
  });
  it('treats a hidden one (no height) as nothing but its gap', () => {
    expect(stackUnder([40, 0, 30], { gap: 4 })).toEqual([0, 44, 48]);
  });
});

describe('the compass layout', () => {
  it('puts a mark where its bearing is, on the first row', () => {
    const [m] = layoutCompass([at('gda', 100)], W);
    expect(m.x).toBeCloseTo(100, 6);
    expect(m.row).toBe(0);
    expect(m.clipped).toBe(false);
  });
  it('stacks a mark within 72 px of another on the second row', () => {
    expect(layoutCompass([at('a', 100), at('b', 160)], W).map((m) => m.row)).toEqual([0, 1]);
  });
  it('keeps marks 72 px or more apart on one row', () => {
    expect(layoutCompass([at('a', 40), at('b', 112)], W).map((m) => m.row)).toEqual([0, 0]);
  });
  it('labels nothing in the right-hand 220 px the buttons sit over: clipped right', () => {
    const [m] = layoutCompass([at('x', W - 100)], 600);
    expect(m).toMatchObject({ clipped: true, side: 'right' });
  });
  it('clips a mark off either end of the strip to that side', () => {
    const out = layoutCompass([at('l', -50), at('r', W + 50)], W, { reserve: 0 });
    expect(out.map((m) => [m.clipped, m.side, m.x])).toEqual([
      [true, 'left', 0],
      [true, 'right', W],
    ]);
  });
  it('drops a third mark crowding both rows (clipped, its side “crowd”)', () => {
    expect(layoutCompass([at('a', 100), at('b', 130), at('c', 160)], W)[2]).toMatchObject({ clipped: true, side: 'crowd' });
  });
  it('keeps a name half a gap clear of a heading on the first row', () => {
    expect(layoutCompass([at('a', 120)], W, { taken: [100] })[0].row).toBe(1);
    expect(layoutCompass([at('a', 140)], W, { taken: [100] })[0].row).toBe(0);
  });
  it('keeps the order it was given (nearest first wins the first row)', () => {
    expect(layoutCompass([at('near', 160), at('far', 100)], W).find((m) => m.id === 'near').row).toBe(0);
  });
});

// (these two, and the compass and marker tests above and below, are
// Invincible's, moved here verbatim with its rules)
describe('the title', () => {
  it('is full until he moves, then a chip 2.5 s after', () => {
    expect(titleMode(10, null, false)).toBe('full');
    expect(titleMode(1, 0, false)).toBe('full');
    expect(titleMode(3, 0, false)).toBe('chip');
  });
  it('is a chip at once when a mission starts', () => {
    expect(titleMode(0, null, true)).toBe('chip');
  });
});

describe('the objective line', () => {
  it('reads metres under a kilometre, and kilometres to a decimal over it', () => {
    expect(objectiveText({}, 1234)).toBe('1.2 km');
    expect(objectiveText({}, 640.4)).toBe('640 m');
    expect(objectiveText({ text: 'Get to the bank' }, 250)).toBe('Get to the bank · 250 m');
  });
  it('is the step alone without a distance, and nothing without a step', () => {
    expect(objectiveText({ text: 'Talk to Allen' }, null)).toBe('Talk to Allen');
    expect(objectiveText(null, 100)).toBe('');
  });
  it('rounds metres and gives kilometres to a decimal', () => {
    expect(far(640.4)).toBe('640 m');
    expect(far(1234)).toBe('1.2 km');
  });
});

describe('the prompt', () => {
  it('puts the key first, then the verb and the thing', () => {
    expect(promptText({ key: 'E', verb: 'Go in', thing: 'Burger Mart' })).toBe('E Go in · Burger Mart');
    expect(promptText({ key: 'E', thing: 'Burger Mart' })).toBe('E Burger Mart');
  });
  it('drops the key on touch, where the prompt is the button', () => {
    expect(promptText({ key: 'E', verb: 'Go in', thing: 'Burger Mart', touch: true })).toBe('Go in · Burger Mart');
  });
});

describe('the players chip', () => {
  it('says “N others here”, and nothing alone', () => {
    expect(othersText(0)).toBe(null);
    expect(othersText(1)).toBe('1 other here');
    expect(othersText(4)).toBe('4 others here');
    // allies among them (the roster's: the same key in every room)
    expect(othersText(4, 1)).toBe('4 others here · 1 ally');
    expect(othersText(3, 2)).toBe('3 others here · 2 allies');
    expect(othersText(1, 1)).toBe('1 other here · your ally');
    expect(othersText(2, 0)).toBe('2 others here');
  });
});

describe('the marker over a target', () => {
  it('is never smaller than 24 px', () => {
    expect(markerSize(5000, 540)).toBe(24);
  });
  it('grows nearer, and is capped', () => {
    expect(markerSize(40, 540)).toBeGreaterThan(markerSize(400, 540));
    expect(markerSize(1, 540)).toBe(COMPASS.markerMax);
  });
});

describe('the stick', () => {
  it('is 116 px round with a 46 px knob', () => {
    expect([STICK.ring, STICK.knob]).toEqual([116, 46]);
  });
  it('reads straight on to full over 44 px, the knob 26 px at most', () => {
    expect(stickRead(100, 100, 144, 100)).toEqual({ x: 1, y: 0, knob: [26, 0] });
    const half = stickRead(100, 100, 122, 100);
    expect(half.x).toBeCloseTo((0.5 - 0.1) / 0.9, 6);
    expect(half.knob).toEqual([13, 0]);
  });
  it('is no faster on a diagonal, and keeps the knob in the ring', () => {
    const r = stickRead(100, 100, 0, 300);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(...r.knob)).toBeCloseTo(26, 1);
  });
  it('ignores a resting thumb’s jitter', () => {
    expect(stickRead(100, 100, 102, 101)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('the minimap’s disc', () => {
  it('is 240 px on a wide screen, 160 on a phone or a narrow one, redrawn ten times a second', () => {
    expect(minimapSize(1280)).toBe(240);
    expect(minimapSize(1280, true)).toBe(160);
    expect(minimapSize(390)).toBe(160);
    expect(MINIMAP.hz).toBe(10);
  });
});

describe('detailToast (lane N4)', () => {
  it('says the detail paused once, as the pause begins, and nothing as it lifts', () => {
    expect(detailToast(false, true)).toBe(DETAIL_PAUSED);
    expect(detailToast(true, true)).toBeNull();
    expect(detailToast(true, false)).toBeNull();
    expect(DETAIL_PAUSED.text).toMatch(/^Detail paused by the data budget; a higher quality level raises it\.$/);
  });
});
