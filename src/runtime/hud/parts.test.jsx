import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Prompt from './Prompt';
import Exit from './Exit';
import Objective from './Objective';
import PlayersChip from './PlayersChip';
import QuestList from './QuestList';
import Toast from './Toast';
import MiniMap from './MiniMap';
import { RendererLine, VoicesItem } from './Menu';
import { rendererReport } from '../backend';

const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '');

describe('the prompt', () => {
  it('reads key first: “E Go in · Burger Mart”', () => {
    expect(text(<Prompt k="E" verb="Go in" thing="Burger Mart" />)).toBe('E Go in · Burger Mart');
  });
  it('shows no key on touch, where it’s the button', () => {
    expect(text(<Prompt k="E" verb="Go in" thing="Burger Mart" touch />)).toBe('Go in · Burger Mart');
  });
  it('says what it promises in data-prompt, key first, on touch too', () => {
    expect(renderToStaticMarkup(<Prompt k="E" verb="Talk" thing="Gandalf" />)).toMatch(/<button[^>]*data-prompt="E Talk · Gandalf"/);
    expect(renderToStaticMarkup(<Prompt k="E" verb="Talk" thing="Gandalf" touch />)).toContain('data-prompt="E Talk · Gandalf"');
    expect(renderToStaticMarkup(<Prompt k="X" verb="Read" />)).toContain('data-prompt="X Read"');
  });
  it('is a real button, and can’t be pressed while closed', () => {
    const html = renderToStaticMarkup(<Prompt verb="Go in" thing="Los Pollos" sub="Opens at noon" closed />);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('Opens at noon');
  });
});

describe('the way out', () => {
  it('is “Leave” and Esc by default, the world’s verb when it has one', () => {
    expect(text(<Exit />)).toBe('Leave Esc');
    expect(text(<Exit label="Get up" />)).toBe('Get up Esc');
    expect(text(<Exit label="Get up" touch />)).toBe('Get up ');
  });
});

describe('the objective line', () => {
  it('carries a world’s own glyph, hidden from a screen reader', () => {
    const html = renderToStaticMarkup(<Objective glyph="◆" text="Find Walt" />);
    expect(html).toContain('aria-hidden="true">◆');
    expect(text(<Objective glyph="◆" text="Find Walt" />)).toBe('◆ Find Walt');
  });
});

describe('the players chip', () => {
  it('offers a way in with the world’s noun', () => {
    expect(text(<PlayersChip on={false} onJoin={() => {}} noun="drivers" />)).toBe('See other drivers');
  });
  it('says “N others here” once you’re in', () => {
    expect(text(<PlayersChip count={3} noun="drivers" />)).toBe('3 others here');
    expect(text(<PlayersChip count={1} />)).toBe('1 other here');
  });
  it('counts your allies among them, and says so on the chip', () => {
    expect(text(<PlayersChip count={3} allies={1} />)).toBe('3 others here · 1 ally');
    expect(text(<PlayersChip count={1} allies={1} />)).toBe('1 other here · your ally');
    expect(renderToStaticMarkup(<PlayersChip count={3} allies={1} />)).toContain('data-allies="1"');
    expect(renderToStaticMarkup(<PlayersChip count={3} />)).not.toContain('data-allies');
  });
  it('is nothing where there’s no going online', () => {
    expect(renderToStaticMarkup(<PlayersChip available={false} />)).toBe('');
  });
});

describe('the list of things to do', () => {
  it('is “Things to do” with a Close, the world’s flavour under it', () => {
    const html = renderToStaticMarkup(<QuestList sub="This week at Dunder Mifflin" quests={[{ id: 'a', name: 'Pretzel day', open: true, where: 'Kitchen', blurb: 'Get one' }]} next="a" onClose={() => {}} />);
    expect(html).toContain('aria-label="Things to do"');
    expect(renderToStaticMarkup(<QuestList label="Places in Albuquerque" quests={[]} onClose={() => {}} />)).toContain('aria-label="Places in Albuquerque"');
    expect(html).toContain('>Close<');
    expect(html).toContain('This week at Dunder Mifflin');
    expect(html).toContain('Kitchen. Get one');
    expect(html).toContain('data-next="true"');
    expect(renderToStaticMarkup(<QuestList quests={[{ id: 'b', name: 'Cover reception', open: true, blurb: 'Erin needs a break.' }]} onClose={() => {}} />)).toContain('>Erin needs a break.<');
  });
});

describe('a toast', () => {
  it('is a status, red when bad, and nothing without words', () => {
    expect(renderToStaticMarkup(<Toast toast={{ key: 1, text: 'Saved', bad: true }} />)).toBe('<p class="hud-toast" role="status" data-bad="true">Saved</p>');
    expect(renderToStaticMarkup(<Toast toast={null} />)).toBe('');
  });
});

describe('the voices switch in the Menu', () => {
  it('says whether anyone speaks, and stays open when pressed', () => {
    const html = renderToStaticMarkup(<VoicesItem />);
    expect(text(<VoicesItem />)).toBe('Voices on');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-keep');
  });
});

describe('the minimap', () => {
  it('is a disc that opens the map, its size in --hud-minimap, no key of its own (the guide says it)', () => {
    const html = renderToStaticMarkup(
      <MiniMap size={160} draw={() => 'Cell 0,0'} onOpen={() => {}} label="Open the map">
        <p>under</p>
      </MiniMap>,
    );
    expect(html).toContain('--hud-minimap:160px');
    // (hidden until its first draw says there's something to show)
    expect(html).toContain('data-empty="true"');
    expect(html).toMatch(/<button[^>]*aria-label="Open the map"/);
    expect(html).toContain('<canvas aria-hidden="true"></canvas>');
    expect(html).not.toContain('<kbd');
    expect(html).toMatch(/hud-minimap-caption"><\/p><p>under<\/p>/);
  });
});

describe('the Menu’s renderer line', () => {
  it('says the picture is the best on WebGPU, and why not and what to do otherwise', () => {
    const best = renderToStaticMarkup(<RendererLine report={rendererReport({ backend: 'webgpu' })} />);
    expect(best).toContain('Picture: <b>WebGPU</b> · the best');
    expect(best).toContain('data-best');
    const slower = renderToStaticMarkup(<RendererLine report={rendererReport({ backend: 'nodes-webgl', gpu: false })} />);
    expect(slower).toContain('WebGL 2, node renderer');
    expect(slower).toContain('Chrome, Edge or Safari 26');
    expect(slower).not.toContain('the best');
  });

  it('says nothing with no world up', () => {
    expect(renderToStaticMarkup(<RendererLine />)).toBe('');
  });
});
