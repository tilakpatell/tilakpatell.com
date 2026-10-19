import { describe, expect, it } from 'vitest';
import { quipEl, setQuip } from './quipBubble';

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
});
