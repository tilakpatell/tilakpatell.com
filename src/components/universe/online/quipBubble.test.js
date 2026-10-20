import { describe, expect, it } from 'vitest';
import { QUIP_PAD, quipEl, quipLine, quipShift, setQuip, shiftQuip } from './quipBubble';

// Node has no DOM: an element that keeps what's written to it, and counts
// the writes, stands in for one (a tag sets its bubble every frame, so a
// write that changes nothing is the thing to catch).
function fakeDoc() {
  const made = [];
  return {
    made,
    createElement(tag) {
      const el = {
        tag,
        className: '',
        attrs: {},
        writes: 0,
        _text: '',
        _hidden: false,
        style: {
          props: {},
          setProperty(k, v) {
            el.writes++;
            this.props[k] = v;
          },
        },
        setAttribute(k, v) {
          this.attrs[k] = String(v);
        },
        getAttribute(k) {
          return this.attrs[k] ?? null;
        },
        get textContent() {
          return this._text;
        },
        set textContent(v) {
          this.writes++;
          this._text = String(v);
        },
        get hidden() {
          return this._hidden;
        },
        set hidden(v) {
          this.writes++;
          this._hidden = Boolean(v);
        },
      };
      made.push(el);
      return el;
    },
  };
}

describe('quipEl', () => {
  it('is a hidden span.quip-bubble a screen reader isn’t told about each frame', () => {
    const doc = fakeDoc();
    const el = quipEl(doc);
    expect(doc.made).toEqual([el]);
    expect(el.tag).toBe('span');
    expect(el.className).toBe('quip-bubble');
    expect(el.getAttribute('aria-live')).toBe('off');
    expect(el.hidden).toBe(true);
    expect(el.textContent).toBe('');
  });
});

describe('setQuip', () => {
  it('shows a line', () => {
    const el = quipEl(fakeDoc());
    setQuip(el, 'On my way');
    expect(el.textContent).toBe('On my way');
    expect(el.hidden).toBe(false);
  });

  it('writes nothing when nothing has changed', () => {
    const el = quipEl(fakeDoc());
    setQuip(el, 'Hello');
    const writes = el.writes;
    for (let i = 0; i < 60; i++) setQuip(el, 'Hello');
    expect(el.writes).toBe(writes);
    setQuip(el, null);
    const hid = el.writes;
    for (let i = 0; i < 60; i++) setQuip(el, null);
    expect(el.writes).toBe(hid);
  });

  it('a new line replaces the old one', () => {
    const el = quipEl(fakeDoc());
    setQuip(el, 'Hello');
    setQuip(el, 'Thanks');
    expect(el.textContent).toBe('Thanks');
    expect(el.hidden).toBe(false);
  });

  it('hides on null, keeping the words so it fades out whole', () => {
    const el = quipEl(fakeDoc());
    setQuip(el, 'Good game');
    setQuip(el, null);
    expect(el.hidden).toBe(true);
    expect(el.textContent).toBe('Good game');
    // the same line again: shown, and its words not written twice
    const writes = el.writes;
    setQuip(el, 'Good game');
    expect(el.hidden).toBe(false);
    expect(el.writes).toBe(writes + 1);
  });

  it('takes anything that isn’t a line as none', () => {
    for (const junk of [undefined, '', 0, 42, {}, [], true]) {
      const el = quipEl(fakeDoc());
      setQuip(el, 'Yes');
      setQuip(el, junk);
      expect(el.hidden).toBe(true);
    }
  });

  it('does nothing without an element', () => {
    expect(() => setQuip(null, 'Hello')).not.toThrow();
    expect(() => setQuip(undefined, null)).not.toThrow();
  });

  it('says when it changed the bubble, for a tag that measures itself to measure again', () => {
    const el = quipEl(fakeDoc());
    expect(setQuip(el, 'Hello')).toBe(true);
    expect(setQuip(el, 'Hello')).toBe(false);
    expect(setQuip(el, 'Thanks')).toBe(true);
    expect(setQuip(el, null)).toBe(true);
    expect(setQuip(el, null)).toBe(false);
    expect(setQuip(el, 'Thanks')).toBe(true); // (the same words, shown again)
    expect(setQuip(null, 'Hello')).toBe(false);
  });
});

describe('quipLine', () => {
  it('is the line, or null for anything setQuip would hide', () => {
    expect(quipLine('Watch out')).toBe('Watch out');
    for (const junk of [undefined, null, '', 0, 42, {}, [], true]) expect(quipLine(junk)).toBeNull();
  });
});

describe('quipShift', () => {
  const BOX = 400;
  it('leaves a bubble that fits where it is, centred over its tag', () => {
    expect(quipShift(200, 140, BOX)).toBe(0);
    expect(quipShift(70 + QUIP_PAD, 140, BOX)).toBe(0); // (its start just on the line)
  });

  it('moves one over a tag at the left edge in, its start kept clear of the edge', () => {
    // a phone reader’s marker: the tag’s middle at 48, a 145px line over it
    const shift = quipShift(48, 145, BOX);
    expect(48 - 145 / 2 + shift).toBe(QUIP_PAD);
  });

  it('and one at the right edge back, its end kept clear', () => {
    const shift = quipShift(BOX - 20, 145, BOX);
    expect(BOX - 20 + 145 / 2 + shift).toBe(BOX - QUIP_PAD);
  });

  it('keeps the start of one wider than the box in view', () => {
    const shift = quipShift(30, 500, BOX);
    expect(30 - 250 + shift).toBe(QUIP_PAD);
  });

  it('moves nothing without a box to keep it in', () => {
    expect(quipShift(10, 145, 0)).toBe(0);
    expect(quipShift(10, 145, NaN)).toBe(0);
  });
});

describe('shiftQuip', () => {
  it('writes the shift as --quip-shift, in whole px, and only on a change', () => {
    const el = quipEl(fakeDoc());
    shiftQuip(el, 24.4);
    expect(el.style.props['--quip-shift']).toBe('24px');
    const writes = el.writes;
    for (let i = 0; i < 60; i++) shiftQuip(el, 24.2);
    expect(el.writes).toBe(writes);
    shiftQuip(el, -3);
    expect(el.style.props['--quip-shift']).toBe('-3px');
    shiftQuip(el, 0);
    expect(el.style.props['--quip-shift']).toBe('0px');
    expect(() => shiftQuip(null, 4)).not.toThrow();
  });
});
