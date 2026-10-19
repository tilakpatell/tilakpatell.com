import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle, useMediaQuery, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { WorldHost, useWorld } from '../runtime';
import { Hud, Menu, MenuItem, Toast, TouchButton } from '../runtime/hud';
import { wayOut } from '../components/worlds/worlds';
import { useAchievements } from '../components/Achievements';
import redbook from '../components/middleearth/redbook/module';
import { BACK, PAGES } from '../components/middleearth/redbook/pages';
import { MAP, playTo, walkTo } from '../components/middleearth/redbook/routes';
import { LAST } from '../components/middleearth/redbook/book';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '../styles/lazy/redbook.css';

const sfx = () => import('../lib/sfx');
const clips = () => import('../lib/clips');
const MOVED = 6; // px before a press is a drag
const SWIPE = 60; // px a finger’s sideways swipe turns a page
// the characters as the back pages name them
const WHO = { gandalf: 'Gandalf', pippin: 'Pippin', butterbur: 'Barliman Butterbur', strider: 'Strider', sam: 'Sam', arwen: 'Arwen', elrond: 'Elrond', bilbo: 'Bilbo', gimli: 'Gimli', galadriel: 'Galadriel', aragorn: 'Aragorn', gollum: 'Sméagol', frodo: 'Frodo' };
const TOY_BY_WHO = Object.fromEntries(PAGES.flatMap((p) => p.toys.filter((t) => t.who).map((t) => [t.who, { ...t, page: p.id }])).reverse());
// what each act sounds like
const SOUND = { knock: 'knock', thud: 'drum', burst: 'boom', sniff: 'wraith', swing: 'creak', tear: 'zip', fly: 'flyby', rise: 'splash', shine: 'ding', light: 'pop' };

// The Red Book (/middle-earth, ?page=bree): Bag End’s study at night, the
// book open on the desk, the Palantír and the Ring beside it
// (docs/superpowers/specs/2026-10-19-the-red-book-design.md). The world is
// the module’s; this page is its HUD from the kit: the caption on glass,
// the turns, Play it and Walk it, the Ring and the stone, the back pages
// and the toasts. The map hub is a stone’s throw away (/middle-earth/map).
export default function RedBook() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [props] = useState(() => ({ page: params.get('page'), reduced }));
  const [at, setAt] = useState({ index: -1, id: null });
  const [said, setSaid] = useState(null);
  const [toast, setToast] = useState(null);
  const [hover, setHover] = useState(null);
  const [worn, setWorn] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [stone, setStone] = useState({ held: false, looked: null });
  const [asking, setAsking] = useState(false);
  const [word, setWord] = useState('');
  const [open, setOpen] = useState(!touch);
  const [keep, setKeep] = useState({ met: [], found: [], toys: [] });
  const { unlock } = useAchievements();
  const tip = useRef(null);
  const press = useRef(null);
  const said$ = useRef(null);

  const note = useCallback((text, bad = false) => setToast({ key: `${Date.now()}-${text}`, text, bad }), []);
  const play = useCallback((name) => sfx().then((s) => s[name]?.()).catch(() => {}), []);

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'page') {
        setAt({ index: e.index, id: e.id });
        setSaid(null);
        setAsking(false);
        setParams(e.index === 0 ? {} : { page: e.id }, { replace: true });
        if (e.index > 0) play('shutter');
      } else if (e.type === 'toy') {
        setSaid({ name: e.name, say: e.say });
        for (const a of e.acts ?? []) if (SOUND[a]) play(SOUND[a]);
        if (e.toy === 'bell') play('ding');
        if (e.clip) clips().then((c) => c.playClip(e.clip)).catch(() => {});
        if (e.acts?.includes('speak')) setAsking(true);
      } else if (e.type === 'hover') setHover(e.name);
      else if (e.type === 'met') note(`Met: ${WHO[e.who] ?? e.name}. They are in the back of the book now.`);
      else if (e.type === 'found') {
        note(`Found: ${e.name}.`);
        play('ring');
        if (e.all) unlock('redbook');
      } else if (e.type === 'ring') {
        setWorn(e.worn);
        setCooling(e.cooling);
      } else if (e.type === 'torn') {
        note('A cry from the dark, and the Ring is torn from your finger.', true);
        clips().then((c) => c.playClip('nazgul')).catch(() => {});
        unlock('wraithworld');
      } else if (e.type === 'stone') setStone({ held: e.held, looked: e.looked });
      else if (e.type === 'dropped') {
        note('The Eye has seen you. You let go of the stone.', true);
        play('stinger');
        unlock('palantir');
      } else if (e.type === 'go') navigate(e.to);
      else if (e.type === 'opened') {
        setAsking(false);
        setSaid({ name: 'The Doors of Durin', say: 'Mellon. The doors swing slowly open.' });
        play('stone');
        unlock('mellon');
      } else if (e.type === 'menu') document.querySelector('.redbook-menu .hud-btn')?.click();
    },
    [navigate, note, play, setParams, unlock],
  );
  const { host, status, rt } = useWorld(redbook, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === redbook ? rt.current.world : null), [rt]);

  const page = PAGES[at.index] ?? null;
  const back = at.index >= PAGES.length ? BACK[at.index - PAGES.length] : null;
  useDocumentTitle(page ? `${page.title} · The Red Book` : 'The Red Book · Middle-earth');
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (back) setKeep({ ...(api()?.keep ?? { met: [], found: [], toys: [] }) });
  }, [back, api]);
  useEffect(() => () => said$.current?.stop?.(), []);

  // the pointer on the stage: a press is a tap, a drag turns the view (or
  // the stone’s map), a finger’s quick sideways swipe turns a page
  const ndc = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  };
  const onPointerDown = (e) => {
    if (e.target.closest('.hud, button, input, a')) return;
    audioContext();
    press.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, t: performance.now(), type: e.pointerType };
  };
  const onPointerMove = (e) => {
    const p = press.current;
    if (p) {
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVED) p.moved = true;
      if (p.moved) api()?.drag(e.clientX - p.lx, e.clientY - p.ly);
      p.lx = e.clientX;
      p.ly = e.clientY;
      return;
    }
    if (e.pointerType !== 'mouse' || e.target.closest('.hud')) return;
    const [x, y] = ndc(e);
    api()?.hover(x, y);
    if (tip.current) tip.current.style.transform = `translate(${e.clientX - e.currentTarget.getBoundingClientRect().left + 14}px, ${e.clientY - e.currentTarget.getBoundingClientRect().top + 14}px)`;
  };
  const onPointerUp = (e) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    if (p.moved && p.type !== 'mouse' && !stone.held && Math.abs(dx) > SWIPE && performance.now() - p.t < 600 && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      api()?.turn(dx < 0 ? 1 : -1);
      return;
    }
    if (p.moved) return;
    const [x, y] = ndc(e);
    api()?.tap(x, y);
  };

  const speak = (e) => {
    e.preventDefault();
    audioContext();
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return;
    if (api()?.say(w)) return setWord('');
    if (w === 'friend') return setSaid({ name: 'The Doors of Durin', say: 'Close. Now say it in Elvish.' });
    setSaid({ name: 'The Doors of Durin', say: 'Nothing happens. Read the arch again: it is a riddle.' });
    return undefined;
  };
  const hear = (who) => {
    const toy = TOY_BY_WHO[who];
    if (!toy) return;
    audioContext();
    if (toy.clip) clips().then((c) => c.playClip(toy.clip)).catch(() => {});
    else
      import('../lib/voiced').then((v) => {
        said$.current?.stop?.();
        said$.current = v.sayVoiced(who, toy.say, { mode: 'cut' });
      });
    setSaid({ name: WHO[who], say: toy.say });
  };

  const ringButton = (
    <button type="button" className="redbook-object" data-on={worn || undefined} disabled={cooling} onClick={() => (audioContext(), api()?.wearRing(), play('wraith'))} aria-pressed={worn} aria-label={worn ? 'Take off the Ring' : 'Put on the Ring'}>
      <span className="redbook-object-icon redbook-ring-icon" aria-hidden="true" />
      <span className="redbook-object-label">{cooling ? 'Not yet' : worn ? 'Take it off' : 'The Ring'}</span>
    </button>
  );
  const stoneButton = (
    <button type="button" className="redbook-object" data-on={stone.held || undefined} onClick={() => (audioContext(), api()?.holdStone())} aria-pressed={stone.held} aria-label={stone.held ? 'Put the Palantír down' : 'Look into the Palantír'}>
      <span className="redbook-object-icon redbook-stone-icon" aria-hidden="true" />
      <span className="redbook-object-label">{stone.held ? 'Put it down' : 'The Palantír'}</span>
    </button>
  );

  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="redbook-stage" data-worn={worn || undefined} data-stone={stone.held || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => api()?.hover(null)}>
        {status !== 'on' && <p className="redbook-loading">The candles are being lit…</p>}
        <div className="redbook-wraith" aria-hidden="true" />
        {hover && !touch && (
          <p ref={tip} className="redbook-tip" aria-hidden="true">
            {hover}
          </p>
        )}
        <Hud
          className="redbook-hud"
          touch={touch}
          brand={
            <p className="redbook-brand">
              <span className="redbook-brand-eyebrow">The Red Book</span>
              <span className="redbook-brand-name">{page?.title ?? back?.title ?? 'Bag End'}</span>
            </p>
          }
          tools={
            <Menu className="redbook-menu" way={wayOut(pathname)}>
              <MenuItem onClick={() => api()?.goTo('met')}>Those you met</MenuItem>
              <MenuItem onClick={() => api()?.goTo('kept')}>Things kept</MenuItem>
              <MenuItem onClick={() => navigate(MAP)}>Middle-earth’s map</MenuItem>
              <MenuItem onClick={() => navigate('/middle-earth/road')}>The Road</MenuItem>
              <MenuItem onClick={() => api()?.goTo(0)}>Start the book again</MenuItem>
            </Menu>
          }
          foot={
            <div className="redbook-foot">
              {stone.held ? (
                <div className="redbook-card redbook-stone-card" role="status">
                  <p className="redbook-eyebrow">The Palantír</p>
                  <p className="redbook-title">{stone.looked ? stone.looked.name : 'Turn the stone to look about'}</p>
                  <p className="redbook-line">{stone.looked ? (stone.looked.page ? 'Go there, and the book opens at its page.' : 'Go there, and its game begins.') : 'Drag the map inside it. Do not look too long.'}</p>
                  <div className="redbook-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={!stone.looked} onClick={() => api()?.stoneGo()}>
                      Go there
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => navigate(MAP)}>
                      Middle-earth’s map
                    </button>
                  </div>
                </div>
              ) : (
                <div className="redbook-card" data-open={open || undefined} data-tour="redbook">
                  {touch && (
                    <button type="button" className="redbook-card-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                      {open ? 'Less' : 'Read the page'}
                    </button>
                  )}
                  {page && (
                    <>
                      <p className="redbook-eyebrow">
                        {at.index + 1} of {PAGES.length} · {page.date}
                      </p>
                      <h1 className="redbook-title">{page.title}</h1>
                      {open && <p className="redbook-tale">{page.tale}</p>}
                      <p className="redbook-line" aria-live="polite">
                        {said ? (
                          <>
                            <b>{said.name}.</b> {said.say}
                          </>
                        ) : worn ? (
                          'The world is grey and cold. Look for what shows only now.'
                        ) : (
                          `Touch the page: ${page.toys.length} things on it answer.`
                        )}
                      </p>
                      {asking && (
                        <form className="redbook-word" onSubmit={speak}>
                          <label htmlFor="redbook-word" className="sr-only">
                            Say the word
                          </label>
                          <input id="redbook-word" className="fun-input" placeholder="Say the word" value={word} maxLength={32} autoComplete="off" onChange={(e) => setWord(e.target.value)} />
                          <button type="submit" className="btn btn-primary btn-sm">
                            Speak
                          </button>
                        </form>
                      )}
                    </>
                  )}
                  {back && <BackPage id={back.id} title={back.title} keep={keep} onHear={hear} />}
                  {!page && !back && <h1 className="redbook-title">The Red Book</h1>}
                  <div className="redbook-actions">
                    <button type="button" className="btn btn-ghost btn-sm redbook-btn" disabled={at.index <= 0} onClick={() => api()?.turn(-1)}>
                      <span aria-hidden="true">←</span> Back
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm redbook-btn" disabled={at.index >= LAST} onClick={() => api()?.turn(1)}>
                      Turn the page <span aria-hidden="true">→</span>
                    </button>
                    {playTo(page) && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(playTo(page))}>
                        Play it
                      </button>
                    )}
                    {walkTo(page) && (
                      <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => navigate(walkTo(page))}>
                        Walk it
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!touch && (
                <div className="redbook-objects">
                  {ringButton}
                  {stoneButton}
                </div>
              )}
            </div>
          }
          thumbs={
            <div className="redbook-thumbs">
              <TouchButton size={52} onPress={() => (audioContext(), api()?.wearRing())} aria-label={worn ? 'Take off the Ring' : 'Put on the Ring'} aria-pressed={worn} className="redbook-touch" data-on={worn || undefined}>
                <span className="redbook-object-icon redbook-ring-icon" aria-hidden="true" />
              </TouchButton>
              <TouchButton size={52} onPress={() => (audioContext(), api()?.holdStone())} aria-label={stone.held ? 'Put the Palantír down' : 'Look into the Palantír'} aria-pressed={stone.held} className="redbook-touch" data-on={stone.held || undefined}>
                <span className="redbook-object-icon redbook-stone-icon" aria-hidden="true" />
              </TouchButton>
            </div>
          }
        >
          <Toast toast={toast} className="redbook-toast" />
        </Hud>
      </WorldHost>
    </div>
  );
}

// the back pages: the characters met, with their lines again; what was found
function BackPage({ id, title, keep, onHear }) {
  if (id === 'met')
    return (
      <>
        <p className="redbook-eyebrow">The back pages</p>
        <h1 className="redbook-title">{title}</h1>
        {keep.met.length ? (
          <ul className="redbook-list">
            {keep.met.map((who) => (
              <li key={who}>
                <button type="button" className="chip" onClick={() => onHear(who)}>
                  {WHO[who] ?? who}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="redbook-line">Nobody yet. Touch the people on the pages, and they will be written in here.</p>
        )}
      </>
    );
  const found = PAGES.filter((p) => keep.found.includes(p.id));
  return (
    <>
      <p className="redbook-eyebrow">The back pages</p>
      <h1 className="redbook-title">{title}</h1>
      <p className="redbook-line">
        {found.length} of {PAGES.length} found under the Ring. {found.length < PAGES.length ? 'Put it on, turn the pages, and look for what shows only then.' : 'All of them. Bilbo would be proud, and a little worried.'}
      </p>
      {found.length > 0 && (
        <ul className="redbook-list">
          {found.map((p) => (
            <li key={p.id} className="chip">
              {p.find.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
