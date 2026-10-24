import { describe, expect, it } from 'vitest';
import { EPISODES } from '../adventure/episodes';
import { fresh } from '../adventure/story';
import { ENTER, asksCard, atDoor, storyLead } from './storyline';

const at = (episode, step, more = {}) => ({ ...fresh(), episode, step, ...more });

describe('what the Citadel tells of the story', () => {
  it('knows the story’s at the Citadel’s door', () => {
    expect(ENTER).toEqual({ type: 'enter', area: EPISODES[9].steps[0].area });
    expect(atDoor(at(9, 0))).toBe(true);
    for (const s of [at(9, 1), fresh(), at(10, 0)]) expect(atDoor(s)).toBe(false);
    // (an episode that isn't built isn't waiting anywhere)
    expect(atDoor(at(9, 0), { ready: 9 })).toBe(false);
  });

  it('asks for the visit’s card only in an episode with a step here', () => {
    // (asking takes it: a new visitor's first card waits for C-137)
    for (const s of [fresh(), at(8, 0), at(8, 1), at(10, 0)]) expect(asksCard(s)).toBe(false);
    expect(asksCard(at(9, 0))).toBe(true);
    expect(asksCard(at(9, 1))).toBe(true);
    expect(asksCard(at(9, 0), { ready: 9 })).toBe(false);
  });

  it('puts the story’s step over the Citadel’s line only while it’s played here', () => {
    expect(storyLead(at(9, 1))).toBe(EPISODES[9].steps[1].text);
    // Mortytown's the Locos': its own line alone
    expect(storyLead(at(9, 1), { town: true })).toBe(null);
    // the door (being here passes it), another episode's step, none
    for (const s of [at(9, 0), at(8, 1), fresh(), at(10, 0)]) expect(storyLead(s)).toBe(null);
    // free roam doesn't change the line, as in C-137
    expect(storyLead(at(9, 1, { freeRoam: true }))).toBe(EPISODES[9].steps[1].text);
  });
});
