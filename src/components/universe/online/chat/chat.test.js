import { describe, expect, it } from 'vitest';
import { createChat } from './chat';
import { CHAT } from './text';

const clock = (t = 1000) => {
  const c = { t, now: () => c.t };
  return c;
};

describe('createChat', () => {
  it('keeps each channel’s lines, newest last, 50 at most', () => {
    const c = clock();
    const chat = createChat({ now: c.now });
    for (let i = 0; i < 60; i++) {
      c.t += 1000;
      expect(chat.add('all', { from: `p${i % 7}`, name: 'Han', text: `line ${i}` })).toBe(true);
    }
    const lines = chat.lines('all');
    expect(lines).toHaveLength(CHAT.log);
    expect(lines[0].text).toBe('line 10');
    expect(lines.at(-1)).toMatchObject({ from: 'p3', name: 'Han', text: 'line 59', at: 61000 });
    expect(new Set(lines.map((l) => l.id)).size).toBe(CHAT.log);
    expect(chat.lines('squad')).toEqual([]);
    expect(chat.lines('here')).toEqual([]);
  });

  it('the same words three times in 30 s: the third is dropped', () => {
    const c = clock();
    const chat = createChat({ now: c.now });
    expect(chat.add('all', { from: 'A', name: 'Han', text: 'gg' })).toBe(true);
    c.t += 5000;
    expect(chat.add('all', { from: 'A', name: 'Han', text: 'GG' })).toBe(true); // (the same words, whatever the case)
    c.t += 5000;
    expect(chat.add('here', { from: 'A', name: 'Han', text: 'gg' })).toBe(false);
    // another pilot's are their own, and other words are other words
    expect(chat.add('all', { from: 'B', name: 'Rick', text: 'gg' })).toBe(true);
    expect(chat.add('all', { from: 'A', name: 'Han', text: 'gg wp' })).toBe(true);
    // 30 s on from the last try, again
    c.t += 30001;
    expect(chat.add('all', { from: 'A', name: 'Han', text: 'gg' })).toBe(true);
    expect(chat.lines('all').map((l) => l.text)).toEqual(['gg', 'GG', 'gg', 'gg wp', 'gg']);
    // the rule on its own
    expect([chat.allow('C', 'hi'), chat.allow('C', 'hi'), chat.allow('C', 'hi')]).toEqual([true, true, false]);
  });

  it('mute hides a pilot’s words, those kept and those to come, till it’s lifted', () => {
    const chat = createChat({ now: clock().now });
    chat.add('squad', { from: 'A', name: 'Han', text: 'hi' });
    chat.add('squad', { from: 'B', name: 'Rick', text: 'yo' });
    chat.mute('A', true);
    expect(chat.muted('A')).toBe(true);
    expect(chat.muted('B')).toBe(false);
    expect(chat.lines('squad').map((l) => l.text)).toEqual(['yo']);
    expect(chat.add('squad', { from: 'A', name: 'Han', text: 'again' })).toBe(false);
    chat.mute('A', false);
    expect(chat.lines('squad').map((l) => l.text)).toEqual(['hi', 'yo']);
  });

  it('a phrase is its words', () => {
    const chat = createChat({ now: clock().now });
    expect(chat.add('here', { from: 'A', name: 'Han', phrase: 3 })).toBe(true);
    expect(chat.lines('here')[0]).toMatchObject({ from: 'A', name: 'Han', text: 'Need help' });
    expect(chat.add('here', { from: 'A', name: 'Han', phrase: 99 })).toBe(false);
    // (the repeat rule is for typed words: a phrase has its rate on the wire)
    expect([3, 3].map((phrase) => chat.add('here', { from: 'A', name: 'Han', phrase }))).toEqual([true, true]);
  });

  it('tells its listeners of each line', () => {
    const chat = createChat({ now: clock().now });
    const got = [];
    const off = chat.on((e) => got.push(e));
    chat.add('squad', { from: 'A', name: 'Han', text: 'on my way' });
    expect(got).toEqual([{ channel: 'squad', line: chat.lines('squad')[0] }]);
    off();
    chat.add('squad', { from: 'A', name: 'Han', text: 'here now' });
    expect(got).toHaveLength(1);
  });

  it('keeps nothing that isn’t a line, and cleans what it keeps', () => {
    const chat = createChat({ now: clock().now });
    for (const [channel, line] of [['everyone', { from: 'A', text: 'hi' }], ['all', { text: 'hi' }], ['all', { from: 'A', text: '   ' }], ['all', { from: 'A', text: 42 }], ['all', null]]) expect(chat.add(channel, line)).toBe(false);
    expect(chat.add('all', { from: 'A', name: 'Han', text: 'see www.example.org‮' })).toBe(true);
    expect(chat.lines('all')[0].text).toBe('see [link]');
    expect(chat.lines('nowhere')).toEqual([]);
  });
});
