import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Prompt from './Prompt';
import Exit from './Exit';
import Objective from './Objective';
import PlayersChip from './PlayersChip';
import QuestList from './QuestList';
import Toast from './Toast';
import { VoicesItem } from './Menu';

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
