import { describe, expect, it } from 'vitest';
import { CHAT, PHRASES, cleanText, phrase } from './text';

describe('what may be said', () => {
  it('has the values the design gives', () => {
    expect(CHAT).toEqual({ everyone: true, squadMax: 200, everyoneMax: 160, log: 50, repeatMs: 30000 });
  });

  it('has the sixteen phrases, in order, each by its id', () => {
    expect(PHRASES).toEqual(['Hello', 'Follow me', 'On my way', 'Need help', 'Attack my target', 'Cover me', 'Regroup', 'Nice shot', 'Thanks', 'Sorry', 'Yes', 'No', 'Watch out', 'Truce?', 'Let’s go', 'Good game']);
    expect(phrase(0)).toBe('Hello');
    expect(phrase(15)).toBe('Good game');
    for (const junk of [16, -1, 1.5, '1', null, undefined, NaN, {}]) expect(phrase(junk)).toBeNull();
  });

  it('is a string, or nothing', () => {
    for (const junk of [null, undefined, 42, {}, ['hi'], true]) expect(cleanText(junk, 200)).toBeNull();
  });

  it('looks no further than eight times the cap, and cuts to the cap last', () => {
    expect(cleanText('a'.repeat(5000), 160)).toBe('a'.repeat(160));
    expect(cleanText(`${'b'.repeat(1600)} c`, 200)).toBe('b'.repeat(200)); // (the tail past 1,600 is never read)
    // the cap is in characters, not in halves of them
    expect([...cleanText('🚀'.repeat(300), 200)]).toHaveLength(200);
    // and it's the cap of what's shown: a link counts as its [link]
    expect(cleanText(`${'x'.repeat(150)} https://example.com/${'p'.repeat(400)}`, 160)).toBe(`${'x'.repeat(150)} [link]`);
  });

  it('never ends on part of a [link] or a •••: the cap falling in one, all of it goes', () => {
    for (let max = 5; max <= 9; max++) expect(cleanText('see https://bad.example now', max)).toBe('see');
    expect(cleanText('see https://bad.example now', 10)).toBe('see [link]');
    for (const max of [5, 6]) expect(cleanText('you sh1t, then', max)).toBe('you');
    expect(cleanText('you sh1t, then', 7)).toBe('you •••');
    // in any script before it, and whoever typed it
    expect(cleanText('🚀🚀 [link] ok', 6)).toBe('🚀🚀');
    expect(cleanText('ok ••• fine', 4)).toBe('ok');
    // nor on a joiner, a sequence cut short
    expect(cleanText('👩‍🚀'.repeat(3), 5)).toBe('👩‍🚀👩');
    expect(cleanText('ب\u200cب\u200cب', 4)).toBe('ب\u200cب');
  });

  it('takes out control and direction characters', () => {
    expect(cleanText('abc‮def', 200)).toBe('abcdef'); // (a right-to-left override, which would flip what follows)
    expect(cleanText('a\u0000b​c⁦d﻿e\u0007', 200)).toBe('abcde');
    // before anything else is looked at: a link or a word split by one is still found
    expect(cleanText('example​.com', 200)).toBe('[link]');
    expect(cleanText('sh​1t', 200)).toBe('•••');
  });

  it('keeps the joiners that join, and still finds a link or a word split by one', () => {
    const [ZWNJ, ZWJ] = ['\u200c', '\u200d'];
    for (const fine of ['gg 👩‍🚀', `می${ZWNJ}خواهم بیایم`]) expect(cleanText(fine, 200)).toBe(fine);
    expect(cleanText(`exam${ZWJ}ple.com`, 200)).toBe('[link]');
    expect(cleanText(`پارسی${ZWNJ}نامه.ایران`, 200)).toBe('[link]');
    expect(cleanText(`نامه.ای${ZWNJ}ران ok`, 200)).toBe('[link] ok');
    expect(cleanText(`you sh${ZWJ}1t`, 200)).toBe('you •••');
    // and a pile of marks is three at most
    expect(cleanText('Z\u0351\u0352\u0353\u0354o', 200)).toBe('Z\u0351\u0352\u0353o');
  });

  it('collapses spaces and trims', () => {
    expect(cleanText('  hello \n\t  there  ', 200)).toBe('hello there');
  });

  it('turns anything that reads as a link into [link]', () => {
    expect(cleanText('https://x.io/a', 200)).toBe('[link]');
    expect(cleanText('go to example . com now', 200)).toBe('go to [link] now');
    expect(cleanText('see https://bad.example now', 200)).toBe('see [link] now');
    expect(cleanText('www.example.org', 200)).toBe('[link]');
    expect(cleanText('try example.co.uk/path?x=1 ok', 200)).toBe('try [link] ok');
    expect(cleanText('it’s at example.com.', 200)).toBe('it’s at [link].');
    expect(cleanText('FTP://FILES.EXAMPLE', 200)).toBe('[link]');
    expect(cleanText('пример.рф', 200)).toBe('[link]');
    // and leaves alone what doesn't
    for (const fine of ['v2.0 is out', 'Hello. How are you?', 'e.g. this, i.e. that', 'pi is 3.14', 'wait . . . what']) expect(cleanText(fine, 200)).toBe(fine);
  });

  it('turns a rude word into •••, digits and all', () => {
    expect(cleanText('you sh1t', 200)).toBe('you •••');
    expect(cleanText('Nice shot', 200)).toBe('Nice shot');
  });

  it('gives markup back as the same characters, to be shown as text', () => {
    expect(cleanText('<img src=x onerror=1>', 200)).toBe('<img src=x onerror=1>');
  });

  it('is nothing when nothing is left', () => {
    expect(cleanText('     ', 200)).toBeNull();
    expect(cleanText('‮​', 200)).toBeNull();
    expect(cleanText('', 200)).toBeNull();
  });
});
