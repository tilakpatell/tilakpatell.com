import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EPISODES } from './episodes';
import EpisodeCard from './EpisodeCard';
import { STORY_DONE } from './hud';

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

  it('names episode 6 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[5]} n={6} onDone={() => {}} />);
    expect(html).toContain('Episode 6');
    expect(html).toContain('Bad deals');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[5].intro[0][1]);
  });

  it('names episode 7 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[6]} n={7} onDone={() => {}} />);
    expect(html).toContain('Episode 7');
    expect(html).toContain('The Jerry problem');
    expect(html).toContain('<b>Morty</b>');
    expect(html).toContain(EPISODES[6].intro[0][1]);
  });

  it('names episode 8 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[7]} n={8} onDone={() => {}} />);
    expect(html).toContain('Episode 8');
    expect(html).toContain('Prime time');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[7].intro[0][1]);
  });

  it('names episode 9 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[8]} n={9} onDone={() => {}} />);
    expect(html).toContain('Episode 9');
    expect(html).toContain('Fairy tales');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[8].intro[0][1]);
  });

  it('names episode 10 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[9]} n={10} onDone={() => {}} />);
    expect(html).toContain('Episode 10');
    expect(html).toContain('The Citadel');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[9].intro[0][1]);
  });

  it('names episode 11 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[10]} n={11} onDone={() => {}} />);
    expect(html).toContain('Episode 11');
    expect(html).toContain('The sector');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[10].intro[0][1]);
  });

  it('names episode 12 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[11]} n={12} onDone={() => {}} />);
    expect(html).toContain('Episode 12');
    expect(html).toContain('Big score');
    expect(html).toContain('<b>Rick</b>');
    expect(html).toContain(EPISODES[11].intro[0][1]);
  });

  it('names episode 13 too', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={EPISODES[12]} n={13} onDone={() => {}} />);
    expect(html).toContain('Episode 13');
    expect(html).toContain('Evil Rick');
    expect(html).toContain('<b>Morty</b>');
    expect(html).toContain(EPISODES[12].intro[0][1]);
  });

  it('after the last episode, is the story’s end', () => {
    const html = renderToStaticMarkup(<EpisodeCard episode={null} n={EPISODES.length + 1} onDone={() => {}} />);
    expect(html).toContain('data-end');
    expect(html).toContain('The end');
    expect(html).toContain(STORY_DONE);
    expect(html).not.toContain('Episode 14');
  });
});
