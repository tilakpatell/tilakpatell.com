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
});
