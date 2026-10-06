import { describe, expect, it } from 'vitest';
import { newTalk, talkNode, talkOn } from '../talk';
import { CONVOS, QUESTS, SPEAKERS, edorasProgress } from './story';

describe('the story', () => {
  it('goes where each step is, at its time of day', () => {
    const at = QUESTS.map((q, i) => edorasProgress(QUESTS.slice(0, i).map((x) => x.id)));
    expect(at.map((p) => p.zone)).toEqual(['hill', 'hall', 'hill', 'hall', 'terrace', 'muster']);
    expect(at.map((p) => p.time)).toEqual(['day', 'day', 'day', 'evening', 'night', 'dawn']);
    const end = edorasProgress(QUESTS.map((q) => q.id));
    expect(end.finished).toBe(true);
    expect(end.zone).toBe('hill');
  });
  it('cannot skip ahead', () => {
    expect(edorasProgress(['feast', 'muster']).done).toEqual([]);
  });
});

describe('the talk', () => {
  it('every conversation can be walked to its end, by every choice', () => {
    for (const [id, convo] of Object.entries(CONVOS)) {
      const walk = (talk, depth = 0) => {
        expect(depth, id).toBeLessThan(30);
        const node = talkNode(convo, talk);
        expect(node, `${id}:${talk.at}`).toBeTruthy();
        expect(Object.keys(SPEAKERS), `${id}:${talk.at}`).toContain(node.who);
        if (node.end) return expect(talkOn(convo, talk).end).toBe('won');
        if (node.choices) return node.choices.forEach((_, i) => walk(talkOn(convo, talk, i), depth + 1));
        return walk(talkOn(convo, talk), depth + 1);
      };
      walk(newTalk(convo));
    }
  });
});
