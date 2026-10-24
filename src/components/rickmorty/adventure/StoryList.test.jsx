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
    // the next built episode, by its title only
    expect(html).toContain('Arcade money');
    expect(html).not.toContain('Rick bet the next set');
  });

  it('ticks a game won before its step comes up', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 1, step: 0, got: [], wins: ['cabinet'], freeRoam: false }} />);
    expect(html).toContain('Rick bet the next set');
    // episode 1 done, and the cabinet's step, won already; Roy still to play
    expect(done(html)).toBe(2);
  });

  it('ticks a chase won before its step comes up', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 4, step: 0, got: [], wins: ['chase'], freeRoam: false }} />);
    expect(html).toContain('The Federation ship is over the street');
    // episodes 1 to 4 done, and the chase's step, won already; the Gromflomite base still to do
    expect(done(html)).toBe(5);
    expect(done(renderToStaticMarkup(<StoryList state={{ episode: 4, step: 0, got: [], wins: [], freeRoam: false }} />))).toBe(4);
  });

  it('ticks a task done before its step comes up', () => {
    const at = { episode: 2, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['wong']} />);
    // episodes 1 and 2 done, and Dr. Wong's step, seen already; Total Rickall still to do
    expect(done(html)).toBe(3);
    expect(ticked(html, 'Rick won’t go to therapy')).toBe(true);
    expect(ticked(html, 'Somebody new is in the family photos')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(2);
  });

  it('ticks the vat done before its step comes up', () => {
    const at = { episode: 5, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['vat']} />);
    // episodes 1 to 5 done, and the vat's step, done already; Needful Things still to do
    expect(done(html)).toBe(6);
    expect(ticked(html, 'Dial the vat of acid')).toBe(true);
    expect(ticked(html, 'Needful Things has something')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(5);
  });

  it('ticks St. Gloopy Noops done before its step comes up', () => {
    const at = { episode: 6, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['gloopynoops']} />);
    // episodes 1 to 6 done, and St. Gloopy Noops' step, done already; the Jerryboree still to do
    expect(done(html)).toBe(7);
    expect(ticked(html, 'Dial St. Gloopy Noops')).toBe(true);
    expect(ticked(html, 'Dad’s at the Jerryboree')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(6);
  });

  it('ticks Get Schwifty done before its step comes up', () => {
    const at = { episode: 7, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['schwifty']} />);
    // episodes 1 to 7 done, and Get Schwifty's step, done already; the cable studio still to do
    expect(done(html)).toBe(8);
    expect(ticked(html, 'The Cromulons want a hit')).toBe(true);
    expect(ticked(html, 'Dial the cable studio')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(7);
  });

  it('ticks Froopyland done before its step comes up', () => {
    const at = { episode: 8, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['froopyland']} />);
    // episodes 1 to 8 done, and Froopyland's step, done already; Fantasy World still to do
    expect(done(html)).toBe(9);
    expect(ticked(html, 'Dial Froopyland')).toBe(true);
    expect(ticked(html, 'Dial Fantasy World')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(8);
  });

  it('ticks the Citadel’s escape done before its step comes up', () => {
    const at = { episode: 9, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} citadel={['daycare', 'citadelout']} />);
    // episodes 1 to 9 done, and the escape, made already; walking in still to do
    expect(done(html)).toBe(10);
    expect(ticked(html, 'Get through the Citadel')).toBe(true);
    expect(ticked(html, 'Dial the Citadel')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(9);
    // (the Citadel's scenes, not C-137's tasks: a task of the same name doesn't tick it)
    expect(done(renderToStaticMarkup(<StoryList state={at} tasks={['citadelout']} />))).toBe(9);
    // (a save that isn't a list is none)
    expect(done(renderToStaticMarkup(<StoryList state={at} citadel="citadelout" />))).toBe(9);
    expect(done(renderToStaticMarkup(<StoryList state={at} citadel={null} />))).toBe(9);
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

  it('ticks the Vindicators done before Heist-Con comes up', () => {
    const at = { episode: 11, step: 0, got: [], wins: [], freeRoam: false };
    const ticked = (html, text) => new RegExp(`data-done="true"[^>]*>(?:(?!</li>).)*${text}`).test(html);
    const html = renderToStaticMarkup(<StoryList state={at} tasks={['vindicators']} />);
    // episodes 1 to 11 done, and the Vindicators' step, done already; Heist-Con still to do
    expect(done(html)).toBe(12);
    expect(ticked(html, 'Dial the Vindicators')).toBe(true);
    expect(ticked(html, 'Dial Heist-Con')).toBe(false);
    expect(done(renderToStaticMarkup(<StoryList state={at} />))).toBe(11);
  });

  it('ticks every built episode once they’re all done', () => {
    const html = renderToStaticMarkup(<StoryList state={{ episode: 12, step: 0, got: [], wins: [], freeRoam: false }} />);
    expect(done(html)).toBe(12);
    expect(html).toContain('More of the story soon.');
  });
});
