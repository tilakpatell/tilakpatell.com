import { describe, expect, it } from 'vitest';
import { REPLIES, noticeOf, replyFor, send, sleep, waiting } from './post';
import { blank } from './save';

describe('the post', () => {
  it('answers what the letter says, and anything at all with the last reply', () => {
    expect(replyFor('I got sorted into Hufflepuff!').text).toBe(REPLIES[0].text);
    expect(replyFor('I miss you all').text).toBe(REPLIES[1].text);
    expect(replyFor('The stairs MOVE').from).toBe('your gran');
    expect(replyFor('hello').text).toBe(REPLIES.at(-1).text);
    expect(replyFor('hello')).toEqual(replyFor('hello'));
  });

  it('writes every reply in the site’s own, curly-quoted words', () => {
    for (const r of REPLIES) {
      expect(r.text).not.toMatch(/['"]/);
      expect(r.text.length).toBeLessThan(170);
    }
  });

  it('sends a letter into the save, keeping the rest of it', () => {
    const s = send({ ...blank(), house: 'ravenclaw', points: { ravenclaw: 3 } }, '  Dear Gran, the food is wonderful.  ', 100);
    expect(s.house).toBe('ravenclaw');
    expect(s.points).toEqual({ ravenclaw: 3 });
    expect(s.post).toMatchObject({ text: 'Dear Gran, the food is wonderful.', sent: 100, read: false });
    expect(s.post.reply.text).toBe(REPLIES[2].text);
    expect(waiting(s)).toBe(true);
    expect(send(blank(), '   ', 1)).toEqual(blank());
  });

  it('puts the reply on the board only after a night’s sleep', () => {
    const s = send(blank(), 'I saw a ghost today', 5);
    expect(noticeOf(s)).toBeNull();
    const morning = sleep(s);
    expect(waiting(morning)).toBe(false);
    expect(noticeOf(morning)).toEqual({ title: 'By owl, from your cousin', text: REPLIES.find((r) => r.when.includes('ghost')).text });
    expect(sleep(morning)).toBe(morning);
    expect(sleep(blank())).toEqual(blank());
    expect(noticeOf(null)).toBeNull();
  });
});
