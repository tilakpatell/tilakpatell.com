import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EPISODES } from './episodes';
import EpisodeCard from './EpisodeCard';

describe('the episode card', () => {
  it('names the episode and says its first line', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[0]} n={1} onDone={() => {}} />);
    expect(html).toContain('Episode 1');
    expect(html).toContain('Wiped');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[0].intro[0][1]);
    expect(html).toContain('role="status"');
  });

  it('names episode 2 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[1]} n={2} onDone={() => {}} />);
    expect(html).toContain('Episode 2');
    expect(html).toContain('Arcade money');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[1].intro[0][1]);
  });

  it('names episode 3 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[2]} n={3} onDone={() => {}} />);
    expect(html).toContain('Episode 3');
    expect(html).toContain('House guests');
    expect(html).toContain('<b>Morty</b>');
    expect(html).toContain(EPISODES[2].intro[0][1]);
  });

  it('names episode 4 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[3]} n={4} onDone={() => {}} />);
    expect(html).toContain('Episode 4');
    expect(html).toContain('Small problems');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[3].intro[0][1]);
  });

  it('names episode 5 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[4]} n={5} onDone={() => {}} />);
    expect(html).toContain('Episode 5');
    expect(html).toContain('Heat');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[4].intro[0][1]);
  });
});
