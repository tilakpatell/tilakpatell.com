import { describe, expect, it } from 'vitest';
import { lineHold } from './living';
import { TOAST_MS, createToastSlot, readFor, readMs, toastLife } from './toastSlot';

// a clock and its timers, run by hand
function clock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  return {
    now: () => now,
    later: (fn, ms) => {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    cancel: (k) => timers.delete(k),
    to(t) {
      for (;;) {
        const due = [...timers].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = t;
    },
  };
}
const slotOn = (c) => {
  const shown = [];
  const slot = createToastSlot({ show: (t) => shown.push(t), now: c.now, later: c.later, cancel: c.cancel });
  return { slot, shown };
};
const REVEAL = { kind: 'say', who: 'The Morty with the eyepatch', text: 'He takes the eyepatch off. Behind it, a perfectly good eye. “He was a puppet. They all are.” A yellow portal opens behind him. “Tell your Rick I’m not done.” He steps through, and the chair is empty.' };
const SHORT = { kind: 'say', who: 'Rick', text: 'Don’t touch anything else, Morty. Ever.' };
const DONE = { kind: 'done', who: 'Find the one behind him', text: '40 of 60 done' };
const OUTRO = { kind: 'say', who: 'Rick', text: 'Every coordinate home.' };
const READ = 11745; // the reveal's read: 0.8 s and 55 ms a character, its 199

describe('the toast slot', () => {
  it('a 199-character line stays up for its read, and only fades once it’s been read', () => {
    expect(REVEAL.text.length).toBe(199);
    expect(readMs(REVEAL.text)).toBe(READ);
    expect(toastLife(REVEAL)).toBeGreaterThanOrEqual(199 * 55);
    // (the fade starts at 88% of its life: world.css's rm-toast)
    expect(toastLife(REVEAL) * 0.88).toBeGreaterThanOrEqual(READ);
    expect(toastLife(SHORT)).toBe(TOAST_MS.say);
    expect(toastLife({ kind: 'say', text: 'x'.repeat(400) })).toBe(TOAST_MS.sayMost);
    expect(toastLife(DONE)).toBe(TOAST_MS.other);
    expect(toastLife({ kind: 'note', bad: true })).toBe(TOAST_MS.bad);
  });

  it('reads a line for its time, at most as long as it’s up; anything else, not at all', () => {
    expect(readFor({ ...REVEAL, at: 1000 }, 3000)).toBe(READ - 2000);
    expect(readFor({ kind: 'say', text: 'x'.repeat(400), at: 0 }, 0)).toBe(TOAST_MS.sayMost);
    expect(readFor({ ...SHORT, at: 0 }, 1000)).toBeCloseTo(lineHold(SHORT.text) * 1000 - 1000, 6);
    expect(readFor({ ...DONE, at: 0 }, 0)).toBe(0);
    expect(readFor(null, 0)).toBe(0);
  });

  it('puts a toast up at once, stamped when it went up', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    c.to(250);
    slot.put(DONE);
    expect(shown).toEqual([{ ...DONE, at: 250 }]);
  });

  it('holds what follows a line till the line’s been read, then puts it up', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(REVEAL);
    c.to(3200);
    slot.put(DONE, { after: true });
    expect(shown.map((t) => t.kind)).toEqual(['say']);
    c.to(READ - 1);
    expect(shown.length).toBe(1);
    c.to(READ);
    expect(shown.at(-1)).toEqual({ ...DONE, at: READ });
    // (a short line's read by the time the tick comes)
    const d = clock();
    const short = slotOn(d);
    short.slot.put(SHORT);
    d.to(3200);
    short.slot.put(DONE, { after: true });
    expect(short.shown.map((t) => t.kind)).toEqual(['say', 'done']);
  });

  it('lets what Morty does himself cover a line at once: a talk, a catch', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(REVEAL);
    c.to(1000);
    slot.put(SHORT);
    c.to(1500);
    slot.put({ kind: 'note', bad: true, text: 'A Death Stalker drags you out of the ring.' });
    expect(shown.map((t) => [t.kind, t.at])).toEqual([
      ['say', 0],
      ['say', 1000],
      ['note', 1500],
    ]);
  });

  it('puts up the latest of what waits, and waits on behind a line said meanwhile', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(REVEAL);
    c.to(3200);
    slot.put(DONE, { after: true });
    slot.put(OUTRO, { after: true });
    c.to(READ);
    expect(shown.map((t) => t.text)).toEqual([REVEAL.text, OUTRO.text]);

    const d = clock();
    const two = slotOn(d);
    two.slot.put(REVEAL);
    d.to(3200);
    two.slot.put(DONE, { after: true });
    d.to(4000);
    two.slot.put({ ...REVEAL, who: 'Evil Rick' });
    d.to(4000 + READ - 1);
    expect(two.shown.map((t) => t.kind)).toEqual(['say', 'say']);
    d.to(4000 + READ);
    expect(two.shown.at(-1)).toEqual({ ...DONE, at: 4000 + READ });
  });

  it('puts what waits up at once with nothing being read: nothing up, a note, a line gone', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(DONE, { after: true });
    slot.put({ kind: 'note', text: '2 of 3 posters read' });
    slot.put(DONE, { after: true });
    slot.put(REVEAL);
    c.to(toastLife(REVEAL) + 1);
    slot.put(DONE, { after: true });
    expect(shown.map((t) => t.kind)).toEqual(['done', 'note', 'done', 'say', 'done']);
  });

  it('says how long till what waits goes up: nought with nothing waiting', () => {
    const c = clock();
    const { slot } = slotOn(c);
    expect(slot.due()).toBe(0);
    slot.put(REVEAL);
    expect(slot.due()).toBe(0);
    c.to(1000);
    slot.put(OUTRO, { after: true });
    expect(slot.due()).toBe(READ - 1000);
    c.to(READ);
    expect(slot.due()).toBe(0);
  });

  it('tells what waits that it’s gone up only once it has, and once', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    const told = [];
    slot.put(REVEAL);
    c.to(3200);
    slot.put(OUTRO, { after: true, onShow: () => told.push(c.now()) });
    c.to(READ - 1);
    expect(told).toEqual([]);
    c.to(READ + 20000);
    expect(told).toEqual([READ]);
    expect(shown.at(-1).text).toBe(OUTRO.text);
    // (with nothing being read, at once; one put straight up, at once too)
    const d = clock();
    const now = slotOn(d);
    const said = [];
    now.slot.put(OUTRO, { after: true, onShow: () => said.push('after') });
    now.slot.put(SHORT, { onShow: () => said.push('now') });
    expect(said).toEqual(['after', 'now']);
  });

  it('tells one that waited, and was put behind by a later one, when that one goes up', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    const told = [];
    slot.put(REVEAL);
    c.to(1000);
    slot.put(OUTRO, { after: true, onShow: () => told.push('outro') });
    slot.put(DONE, { after: true });
    c.to(READ);
    expect(shown.map((t) => t.kind)).toEqual(['say', 'done']);
    expect(told).toEqual(['outro']);
  });

  it('says whether a line is still being read (a passer-by’s bark waits its turn)', () => {
    const c = clock();
    const { slot } = slotOn(c);
    expect(slot.reading()).toBe(false);
    slot.put(REVEAL);
    c.to(READ - 1);
    expect(slot.reading()).toBe(true);
    c.to(READ);
    expect(slot.reading()).toBe(false);
    slot.put(DONE);
    expect(slot.reading()).toBe(false);
  });

  it('takes a toast down at the end of its own life, and never the one put up after it', () => {
    const c = clock();
    const hid = [];
    const slot = createToastSlot({ show: () => {}, hide: (t) => hid.push([t.text, c.now()]), now: c.now, later: c.later, cancel: c.cancel });
    slot.put(SHORT);
    c.to(TOAST_MS.say);
    expect(hid).toEqual([[SHORT.text, TOAST_MS.say]]);
    // (a line that went up a moment before the one before it ends stays its own life)
    slot.put(SHORT);
    c.to(TOAST_MS.say + 5599);
    slot.put(OUTRO, { after: true });
    c.to(TOAST_MS.say * 4);
    expect(hid).toEqual([
      [SHORT.text, TOAST_MS.say],
      [OUTRO.text, TOAST_MS.say + 5599 + toastLife(OUTRO)],
    ]);
  });

  it('drops what waits when it’s cleared', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    let told = 0;
    slot.put(REVEAL);
    slot.put(DONE, { after: true, onShow: () => (told += 1) });
    slot.clear();
    c.to(20000);
    expect(shown.map((t) => t.kind)).toEqual(['say']);
    expect(told).toBe(0);
  });
});
