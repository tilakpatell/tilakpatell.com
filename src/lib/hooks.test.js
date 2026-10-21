import { describe, expect, it } from 'vitest';
import { prefersReducedMotion, watchAskedOnSite, watchVisible } from './hooks';

// a document as far as page visibility goes
function page(hidden = false) {
  const doc = new EventTarget();
  doc.hidden = hidden;
  doc.flip = (h) => {
    doc.hidden = h;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  return doc;
}

describe('watching whether the page is showing', () => {
  it('says so at once, and again each time the tab is hidden or shown', () => {
    const doc = page(false);
    const seen = [];
    watchVisible(doc, (v) => seen.push(v));
    doc.flip(true);
    doc.flip(false);
    expect(seen).toEqual([true, false, true]);
  });
  it('starts hidden in a tab opened in the background', () => {
    const seen = [];
    watchVisible(page(true), (v) => seen.push(v));
    expect(seen).toEqual([false]);
  });
  it('stops when it’s let go', () => {
    const doc = page(false);
    const seen = [];
    const stop = watchVisible(doc, (v) => seen.push(v));
    stop();
    doc.flip(true);
    expect(seen).toEqual([true]);
  });
});

describe('reduced motion', () => {
  // (tests run with no browser: a page is a stand-in <html>)
  const withPage = (dataset, fn) => {
    globalThis.document = { documentElement: { dataset } };
    try {
      fn();
    } finally {
      delete globalThis.document;
    }
  };

  it('follows the visitor’s own setting on the site as well as the system’s', () => {
    withPage({ motion: 'reduced' }, () => expect(prefersReducedMotion()).toBe(true));
    withPage({}, () => expect(prefersReducedMotion()).toBe(false));
  });

  it('is off with no page at all', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('lets a watcher go', () => {
    const stop = watchAskedOnSite(() => {});
    expect(typeof stop).toBe('function');
    stop();
  });
});
