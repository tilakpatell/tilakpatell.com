import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAdventure } from './useAdventure';

function Probe() {
  const story = useAdventure();
  return <p data-open={String(story.dialOpen('customs'))}>{story.objective?.text}</p>;
}

describe('the adventure’s hook', () => {
  it('renders on the server, a new visitor at the first step', () => {
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('A Federation agent is in a booth at Shoney’s');
    expect(html).toContain('data-open="true"');
  });
});
