import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeployPanel from './DeployPanel';
import { readHero } from '../heroes';

const render = (props) => renderToStaticMarkup(<DeployPanel hero={readHero({ id: 'luke' })} onChange={() => {}} onClose={() => {}} system="hoth" era="empire" {...props} />);

describe('the deploy screen', () => {
  it('asks the side first, then shows that side’s troopers in the world’s kit and its heroes', () => {
    const html = render();
    expect(html).toContain('Rebellion');
    expect(html).toContain('Empire');
    expect(html).toContain('From elsewhere');
    expect(html).toContain('Rebellion Assault');
    expect(html).toContain('Luke Skywalker');
    expect(html).not.toContain('Darth Vader');
  });
  it('a villain opens on the dark side, and a Clone Wars world on its own war', () => {
    expect(render({ hero: readHero({ id: 'vader' }) })).toContain('Darth Vader');
    const clone = render({ system: 'kamino', era: 'republic', hero: readHero({ id: 'obiwan' }) });
    expect(clone).toContain('Republic Assault');
    expect(clone).toContain('Obi-Wan Kenobi');
  });
  it('says when another body stands in, and Equip is never held back by it', () => {
    const html = render({ stoodIn: 'meshy' });
    expect(html).toContain('in the site’s own figure');
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Equip</);
  });
});
