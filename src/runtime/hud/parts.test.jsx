import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Prompt from './Prompt';
import Exit from './Exit';
import Objective from './Objective';
import PlayersChip from './PlayersChip';
import QuestList from './QuestList';
import Toast from './Toast';
import MiniMap from './MiniMap';
import { RendererLine, VoicesItem } from './Menu';
import Cluster from './Cluster.jsx'; // (named in full: ./cluster.js is beside it)
import Vitals from './Vitals';
import Arms from './Arms';
import Powers from './Powers';
import { rendererReport } from '../backend';

const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '');

// Tests run in node with no browser to ask what a sheet does to an element,
// so this resolves the cascade itself (as styles/colours.test.js does), for
// one property on the last of a chain of elements, each the parent of the
// next: of the rules whose selector reaches it, the weightiest wins, the
// later on a tie. Enough of Selectors 4 for these sheets: tags, classes,
// attributes, :is, :where and :not, child and descendant; a state the element
// isn’t in, or a selector this doesn’t know, never matches. (Each @media is
// read as if it held: none here touches what these ask.)
const sheets = (...paths) => paths.flatMap((p) => [...readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => [s.split(';').pop().trim(), b]));
const split = (s, at) => {
  const out = [''];
  let depth = 0;
  for (const ch of s) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (!depth && at.includes(ch)) out.push('');
    else out[out.length - 1] += ch;
  }
  return out.map((x) => x.trim()).filter(Boolean);
};
// a complex selector’s compounds, with `>`, `+` or `~` between two where it isn’t a descendant
const compounds = (sel) => split(sel.replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, ' $1 '), ' ');
const closing = (s, i) => {
  let depth = 0;
  for (; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && !--depth) return i + 1;
  }
  return i;
};
// a compound’s simple selectors: a tag, *, .class, #id, [attr], :pseudo(…) or ::element
const simples = (c) => {
  const out = [];
  for (let i = 0; i < c.length; ) {
    let j = c[i] === '[' ? c.indexOf(']', i) + 1 : i + (c.startsWith('::', i) ? 2 : 1);
    if (c[i] !== '[') {
      while (j < c.length && /[\w%-]/.test(c[j])) j++;
      if (c[j] === '(') j = closing(c, j);
    }
    out.push(c.slice(i, j));
    i = j;
  }
  return out;
};
const pseudo = (s) => s.match(/^:([\w-]+)(?:\((.*)\))?$/s) ?? [];
const reaches = (sel, chain, i = chain.length - 1) => {
  const p = compounds(sel);
  const at = (k, n) => {
    if (n < 0 || !matches(p[k], chain, n)) return false;
    if (k === 0) return true;
    if (p[k - 1] === '>') return at(k - 2, n - 1);
    if (/^[+~]$/.test(p[k - 1])) return false; // (no siblings in these chains)
    for (let m = n - 1; m >= 0; m--) if (at(k - 1, m)) return true;
    return false;
  };
  return at(p.length - 1, i);
};
const matches = (compound, chain, i) => {
  const el = chain[i];
  return simples(compound).every((s) => {
    if (s === '*') return true;
    if (s[0] === '.') return el.cls.includes(s.slice(1));
    if (s[0] === '#') return el.attrs.id === s.slice(1);
    if (s[0] === '[') {
      const [, name, value] = s.match(/^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]$/) ?? [];
      return name !== undefined && name in el.attrs && (value === undefined || el.attrs[name] === value);
    }
    if (s.startsWith('::')) return false;
    if (s[0] === ':') {
      const [, name, arg = ''] = pseudo(s);
      if (name === 'is' || name === 'where') return split(arg, ',').some((x) => reaches(x, chain, i));
      if (name === 'not') return !split(arg, ',').some((x) => reaches(x, chain, i));
      return el.states.includes(name);
    }
    return s === el.tag;
  });
};
// specificity as one number: ids, then classes, attributes and pseudo-classes, then tags
const weight = (sel) =>
  compounds(sel)
    .filter((c) => !/^[>+~]$/.test(c))
    .flatMap(simples)
    .reduce((w, s) => {
      if (s === '*') return w;
      if (s[0] === '#') return w + 10000;
      if (s[0] === '.' || s[0] === '[') return w + 100;
      if (s.startsWith('::')) return w + 1;
      if (s[0] !== ':') return w + 1;
      const [, name, arg = ''] = pseudo(s);
      if (name === 'where') return w;
      if (name === 'is' || name === 'not' || name === 'has') return w + Math.max(...split(arg, ',').map(weight));
      return w + 100;
    }, 0);
const resolve = (rules, chain, read) => {
  let best = null;
  for (const [sel, body] of rules) {
    const hits = split(sel, ',').filter((s) => reaches(s, chain));
    if (!hits.length) continue;
    const w = Math.max(...hits.map(weight));
    for (const decl of body.split(';')) {
      const [, name, value] = decl.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/s) ?? [];
      const v = name && read(name, value);
      if (v !== undefined && (!best || w >= best.w)) best = { w, v };
    }
  }
  return best?.v;
};
const cursor = (name, v) => (name === 'cursor' ? v : undefined);
// (the border shorthand sets the style too: to none when it names none)
const borderStyle = (name, v) => (name === 'border-style' ? v : name === 'border' ? (v.match(/\b(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)\b/)?.[1] ?? (v.includes('var(') ? v : 'none')) : undefined);
const box = (...cls) => ({ tag: 'div', cls, attrs: {}, states: [] });
// an element as React draws it, from its markup: its tag, classes and attributes
const chipEl = (el, states = []) => {
  const [, tag, rest] = renderToStaticMarkup(el).match(/^<(\w+)([^>]*)>/);
  const attrs = Object.fromEntries([...rest.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, k, v]) => [k, v ?? '']));
  return { tag, cls: (attrs.class ?? '').split(' ').filter(Boolean), attrs, states };
};

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

  describe('once you’re in', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is a button that opens the party, its words as they were', () => {
      const html = renderToStaticMarkup(<PlayersChip count={3} allies={1} />);
      expect(html).toMatch(/^<button type="button"[^>]*aria-haspopup="dialog"/);
      expect(html).toContain('aria-label="3 others here · 1 ally"');
      expect(text(<PlayersChip count={0} />)).toBe('No one else here');
      expect(renderToStaticMarkup(<PlayersChip count={0} />)).toMatch(/^<button[^>]*aria-label="No one else here"/);
    });

    it('is a button in the Menu too', () => {
      const html = renderToStaticMarkup(<PlayersChip count={2} item className="menu-entry" />);
      expect(html).toMatch(/^<button type="button" class="menu-entry"/);
      expect(text(<PlayersChip count={2} item />)).toBe('2 others here');
    });

    it('opens the party dialog (lib/palette’s openParty) on its own tab', () => {
      const win = new EventTarget();
      const got = [];
      win.addEventListener('tp:party', (e) => got.push(e.detail));
      vi.stubGlobal('window', win);
      // (a function component with no hooks: what it returns is the button)
      PlayersChip({ count: 3 }).props.onClick({ type: 'click' });
      expect(got).toEqual([null]);
    });

    it('calls a world’s own onOpen instead, given one', () => {
      const onOpen = vi.fn();
      PlayersChip({ count: 1, onOpen }).props.onClick({ type: 'click' });
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith(); // (not the click: it isn't a tab)
    });

    it('stays a plain status where a world opens nothing', () => {
      const html = renderToStaticMarkup(<PlayersChip count={3} onOpen={null} />);
      expect(html).toMatch(/^<span[^>]*role="status"/);
      expect(html).not.toContain('<button');
    });
  });

  // Both forms wear `data-on` (a world styles the count’s figures through
  // it), so a sheet’s rule for the plain count reaches the button too unless
  // it names the span: these ask each sheet that draws the chip what it ends
  // up wearing, in the ancestors it’s drawn in.
  describe('as the stylesheets draw it', () => {
    const party = (props) => chipEl(<PlayersChip count={2} {...props} />, ['hover']);
    const status = (props) => chipEl(<PlayersChip count={2} onOpen={null} {...props} />, ['hover']);

    it('in the kit’s Menu, the way to your party shows a hand, the plain count an arrow', () => {
      const rules = sheets('./hud.css');
      const menu = [box('hud'), box('hud-row', 'hud-top'), box('hud-tools'), box('hud-menu'), box('hud-menu-list')];
      expect(resolve(rules, [...menu, party({ item: true })], cursor)).toBe('pointer');
      expect(resolve(rules, [...menu, status({ item: true })], cursor)).toBe('default');
    });

    it('in Invincible’s Menu (its own skin of the list) the same', () => {
      const rules = sheets('./hud.css', '../../components/invincible/world/world.css');
      const menu = [box('hud', 'iw-hud'), box('hud-row', 'hud-top'), box('hud-tools'), box('hud-menu', 'iw-menu'), box('hud-menu-list')];
      expect(resolve(rules, [...menu, party({ item: true })], cursor)).toBe('pointer');
      expect(resolve(rules, [...menu, status({ item: true })], cursor)).toBe('default');
    });

    it('in Dead Man’s Tide, only the way in is dashed: the count online is a solid chip, a hand over it', () => {
      const rules = sheets('./hud.css', '../../components/caribbean/tide/tide.css');
      const tools = [box('dt-screen'), box('g3-tools')];
      const join = chipEl(<PlayersChip on={false} onJoin={() => {}} className="dt-players" />);
      expect(resolve(rules, [...tools, join], borderStyle)).toBe('dashed');
      expect(resolve(rules, [...tools, party({ className: 'dt-players' })], borderStyle)).toBe('solid');
      expect(resolve(rules, [...tools, party({ className: 'dt-players' })], cursor)).toBe('pointer');
    });
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

describe('the flight cluster', () => {
  const count = (html, cls) => (html.match(new RegExp(`class="([^"]* )?${cls}( [^"]*)?"`, 'g')) ?? []).length;
  it('holds its row and what goes over it', () => {
    const html = renderToStaticMarkup(
      <Cluster label="Flight" over={<i id="o" />}>
        <b id="c" />
      </Cluster>,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Flight"');
    expect(html).toMatch(/class="hud-cluster-over"><i id="o">/);
    expect(html).toMatch(/class="hud-cluster-row"><b id="c">/);
  });
  it('draws the vitals with their label, keeping a world’s extra lines', () => {
    const el = (
      <Vitals label="Deflectors">
        <span className="x" />
      </Vitals>
    );
    const html = renderToStaticMarkup(el);
    expect(text(el)).toContain('Deflectors');
    expect(html).toContain('class="x"');
    expect(count(html, 'hud-vitals')).toBe(1);
    expect(count(html, 'hud-vitals-n')).toBe(1);
  });
  it('draws the arms: three lines and eight pips, the keys when asked', () => {
    const html = renderToStaticMarkup(<Arms keys />);
    expect(count(html, 'hud-arms-line')).toBe(3);
    expect(count(html, 'hud-arms-pip')).toBe(8);
    expect(text(<Arms keys />)).toMatch(/R.*1 2 3/);
    expect(text(<Arms />)).not.toContain('1 2 3');
  });
  it('draws a power tile per slot, its name and key in its label', () => {
    const slots = [
      { slot: 'primary', id: 'focus', name: 'Force Focus', short: 'Force', about: 'Time slows.', key: 'G', icon: <circle r="2" /> },
      { slot: 'ultimate', id: 'salvo', name: 'Torpedo salvo', short: 'Torpedoes', about: 'Four away.', key: 'X', icon: <path d="M0 0" /> },
    ];
    const html = renderToStaticMarkup(<Powers slots={slots} data={{ ship: 'xwing' }} placement="cluster" />);
    expect(count(html, 'hud-power')).toBe(2);
    expect(html).toContain('aria-label="Force Focus (G)"');
    expect(html).toMatch(/data-slot="primary"[^>]*data-phase="ready"/);
    expect(html).toMatch(/data-slot="ultimate"[^>]*data-phase="charging"/);
    expect(html).toContain('data-ship="xwing"');
    expect(html).toContain('data-place="cluster"');
    expect(renderToStaticMarkup(<Powers slots={[]} />)).toBe('');
  });
});
