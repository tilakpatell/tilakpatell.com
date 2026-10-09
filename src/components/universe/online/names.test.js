import { describe, expect, it } from 'vitest';
import { NAME_MAX, cleanName, stripControls } from './names';

const ZWNJ = '\u200c';
const ZWJ = '\u200d';

describe('stripControls', () => {
  it('takes out control, zero-width and direction characters', () => {
    expect(stripControls('a\u0000b\u200bc\u200ed\u202ee\u2066f\ufeffg\u007f')).toBe('abcdefg');
    expect(stripControls('a\u061cb')).toBe('ab'); // (the Arabic letter mark: a direction mark too)
  });

  it('keeps a joiner between two characters past ASCII: emoji sequences, Persian and Indic joining', () => {
    for (const kept of ['👩‍🚀', '🏳️‍🌈', '👨‍👩‍👧', `می${ZWNJ}خواهم`, `क्${ZWJ}ष`]) expect(stripControls(kept)).toBe(kept);
    // nowhere else, and one at most: a word split by one is still the word
    expect(stripControls(`sh${ZWJ}it a${ZWNJ}ss ${ZWJ}日 本${ZWJ} 1${ZWJ}🚀`)).toBe('shit ass 日 本 1🚀');
    expect(stripControls(`日${ZWJ}${ZWJ}${ZWNJ}本`)).toBe(`日${ZWJ}本`);
    // (nor one left next to ASCII once what was between them is out)
    expect(stripControls(`a\u200b${ZWJ}日`)).toBe('a日');
  });

  it('takes out the tag characters, which spell out text no one sees', () => {
    expect(stripControls('hi\u{e0001}\u{e0069}\u{e0067}\u{e006e}\u{e007f}!')).toBe('hi!');
  });

  it('lets a character carry three combining marks at most', () => {
    expect(stripControls('Z\u0351\u0352\u0353\u0354\u0355\u0356o')).toBe('Z\u0351\u0352\u0353o');
    // with nothing hidden between them to make two piles of one
    expect(stripControls(`Z\u0351${ZWJ}\u0352\u0353\u0354o`)).toBe('Z\u0351\u0352\u0353o');
    expect(stripControls('Z\u0351\u00ad\u0352\u00ad\u0353\u00ad\u0354o')).toBe('Z\u0351\u0352\u0353o');
    // (a letter with the marks a language gives it is left be)
    for (const fine of ['Vie\u0323\u0302t', 'שָׁלוֹם', '#️⃣']) expect(stripControls(fine)).toBe(fine);
  });
});

describe('cleanName, with what stripControls keeps', () => {
  it('keeps an emoji sequence, and is still NAME_MAX characters at most', () => {
    expect(cleanName('Ace 👩‍🚀')).toBe('Ace 👩‍🚀');
    expect([...cleanName('👩‍🚀'.repeat(20))]).toHaveLength(NAME_MAX);
    expect([...cleanName(`Z${'\u0351'.repeat(40)}`)]).toHaveLength(4);
  });

  it('never ends on a joiner where the cap cut a sequence short', () => {
    expect(cleanName(`ab${'👩‍🚀'.repeat(5)}`)).toBe(`ab${'👩‍🚀'.repeat(4)}👩`);
    expect(cleanName(`ب${ZWNJ}`.repeat(10))).toBe(`${`ب${ZWNJ}`.repeat(7)}ب`);
  });

  it('still catches a rude one split by a joiner', () => {
    for (const bad of [`sh${ZWJ}1t lord`, `a${ZWNJ}ss`, `KK${ZWJ}K`]) expect(cleanName(bad), bad).toBeNull();
  });
});
