import { describe, expect, it } from 'vitest';
import { lineHold } from './living';
import { TOAST_MS, createToastSlot, readFor } from './toastSlot';

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

describe('the toast slot', () => {
  it('reads a line for its hold, at most as long as it’s up; anything else, not at all', () => {
    expect(lineHold(REVEAL.text)).toBe(6);
    expect(readFor({ ...REVEAL, at: 1000 }, 3000)).toBe(TOAST_MS.say - 2000);
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
    c.to(TOAST_MS.say - 1);
    expect(shown.length).toBe(1);
    c.to(TOAST_MS.say);
    expect(shown.at(-1)).toEqual({ ...DONE, at: TOAST_MS.say });
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
    c.to(TOAST_MS.say);
    expect(shown.map((t) => t.text)).toEqual([REVEAL.text, OUTRO.text]);

    const d = clock();
    const two = slotOn(d);
    two.slot.put(REVEAL);
    d.to(3200);
    two.slot.put(DONE, { after: true });
    d.to(4000);
    two.slot.put({ ...REVEAL, who: 'Evil Rick' });
    d.to(4000 + TOAST_MS.say - 1);
    expect(two.shown.map((t) => t.kind)).toEqual(['say', 'say']);
    d.to(4000 + TOAST_MS.say);
    expect(two.shown.at(-1)).toEqual({ ...DONE, at: 4000 + TOAST_MS.say });
  });

  it('puts what waits up at once with nothing being read: nothing up, a note, a line gone', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(DONE, { after: true });
    slot.put({ kind: 'note', text: '2 of 3 posters read' });
    slot.put(DONE, { after: true });
    slot.put(REVEAL);
    c.to(TOAST_MS.say + 1);
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
    expect(slot.due()).toBe(TOAST_MS.say - 1000);
    c.to(TOAST_MS.say);
    expect(slot.due()).toBe(0);
  });

  it('drops what waits when it’s cleared', () => {
    const c = clock();
    const { slot, shown } = slotOn(c);
    slot.put(REVEAL);
    slot.put(DONE, { after: true });
    slot.clear();
    c.to(20000);
    expect(shown.map((t) => t.kind)).toEqual(['say']);
  });
});
