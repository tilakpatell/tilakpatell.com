import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StoryList from './StoryList';

const BOOK = [
  { id: 'one', title: 'One', intro: [], outro: [], unlocks: [], steps: [{ type: 'task', id: 'a', text: 'Do the first thing.' }] },
  {
    id: 'two',
    title: 'Two',
    intro: [],
    outro: [],
    unlocks: [],
    steps: [{ type: 'all', text: 'Do both of the others.', steps: [{ type: 'task', id: 'b', text: 'The other thing.' }, { type: 'task', id: 'c', text: 'The last thing.' }] }],
  },
  { id: 'three', title: 'Three', intro: [], outro: [], unlocks: [], steps: [{ type: 'task', id: 'd', text: 'Do the fourth thing.' }] },
];
const done = (html) => (html.match(/data-done="true"/g) ?? []).length;

describe('the Story tab', () => {
  it('shows the current episode’s steps and ticks what’s done', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 0, step: 2, got: [], wins: [], freeRoam: false }} />);
    expect(html).toContain('Wiped');
    expect(html).toContain('Find the hatch in the floor');
    expect(done(html)).toBe(2);
    expect(html).toContain('More of the story soon.');
  });

  it('ticks a finished episode, lists an `all`’s parts, and names a later one by its title', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 1, step: 0, got: [1], wins: [], freeRoam: false }} episodes={BOOK} ready={3} />);
    expect(done(html)).toBe(2); // episode one, and the `all`'s second part
    expect(html).toContain('Do both of the others.');
    expect(html).toContain('The other thing.');
    expect(html).toContain('The last thing.');
    expect(html).toContain('Three');
    expect(html).not.toContain('Do the fourth thing.');
    expect(html).not.toContain('Do the first thing.');
    expect(html).not.toContain('More of the story soon.');
  });

  it('ticks every built episode once they’re all done', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 1, step: 0, got: [], wins: [], freeRoam: false }} />);
    expect(done(html)).toBe(1);
    expect(html).toContain('More of the story soon.');
  });
});
