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
import { VALAR } from '../components/middleearth/redbook/valar';
import { hush, sauronSays } from '../components/middleearth/redbook/sauronVoice';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '../styles/lazy/redbook.css';

const sfx = () => import('../lib/sfx');
const clips = () => import('../lib/clips');
const MOVED = 6; // px before a press is a drag
const SWIPE = 60; // px a finger’s sideways swipe turns a page
const MUSIC_KEY = 'tp-redbook-music';
// the characters as the back pages name them
const WHO = { gandalf: 'Gandalf', pippin: 'Pippin', butterbur: 'Barliman Butterbur', strider: 'Strider', sam: 'Sam', arwen: 'Arwen', elrond: 'Elrond', bilbo: 'Bilbo', gimli: 'Gimli', galadriel: 'Galadriel', aragorn: 'Aragorn', gollum: 'Sméagol', frodo: 'Frodo' };
const TOY_BY_WHO = Object.fromEntries(PAGES.flatMap((p) => p.toys.filter((t) => t.who).map((t) => [t.who, { ...t, page: p.id }])).reverse());
// what each act sounds like
const SOUND = { knock: 'knock', thud: 'drum', burst: 'boom', sniff: 'wraith', swing: 'creak', tear: 'zip', fly: 'flyby', rise: 'splash', shine: 'ding', light: 'pop' };
// what each view’s card says when nothing has been touched in it
const VIEW_LINE = {
  look: 'Bilbo’s study. Drag to look round, and touch anything: the fire, the pipe, Sting, the books, the door.',
  window: 'The night over Hobbiton, Gandalf at the gate, and the Valar in the stars over him. Point at them.',
};
const readMusic = () => {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch {
    return true;
  }
};

// The Red Book (/middle-earth, ?page=bree): Bag End’s study at night, the
// book open on the desk, the Palantír and the Ring beside it
// (docs/superpowers/specs/2026-10-19-the-red-book-design.md). The world is
// the module’s; this page is its HUD from the kit: the caption on glass, the
// turns, Play it and Walk it, the room and the window, the Ring and the
// stone, the back pages and the toasts. The map hub is a stone’s throw away
// (/middle-earth/map).
export default function RedBook() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [musicOn, setMusicOn] = useState(readMusic);
  const [props] = useState(() => ({ page: params.get('page'), reduced, music: musicOn }));
  const [at, setAt] = useState({ index: -1, id: null });
  const [said, setSaid] = useState(null);
  const [toast, setToast] = useState(null);
  const [hover, setHover] = useState(null);
  const [ring, setRing] = useState({ worn: false, cooling: false, held: false, fire: false });
  const [stone, setStone] = useState({ held: false, eye: 0, seen: 0 });
  const [view, setView] = useState('book');
  const [dark, setDark] = useState(null); // the Eye’s words, burning on the screen
  const [asking, setAsking] = useState(false);
  const [word, setWord] = useState('');
  const [open, setOpen] = useState(!touch);
  const [keep, setKeep] = useState({ met: [], found: [], toys: [] });
  const { unlock } = useAchievements();
  const tip = useRef(null);
  const press = useRef(null);
  const said$ = useRef(null);
  const named = useRef(new Set());
  const fell = useRef(false);

  const note = useCallback((text, bad = false) => setToast({ key: `${Date.now()}-${text}`, text, bad }), []);
  const play = useCallback((name) => sfx().then((s) => s[name]?.()).catch(() => {}), []);
  const clip = useCallback((id) => id && clips().then((c) => c.playClip(id)).catch(() => {}), []);

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'page') {
        setAt({ index: e.index, id: e.id });
        setSaid(null);
        setAsking(false);
        setParams(e.index === 0 ? {} : { page: e.id }, { replace: true });
      } else if (e.type === 'toy') {
        setSaid({ name: e.name, say: e.say });
        for (const a of e.acts ?? []) if (SOUND[a]) play(SOUND[a]);
        if (e.toy === 'bell') play('ding');
        clip(e.clip);
        if (e.acts?.includes('speak')) setAsking(true);
      } else if (e.type === 'room') {
        setSaid({ name: e.name, say: e.say });
        if (e.sound) play(e.sound);
        clip(e.clip);
        if (e.id === 'ring-fire') unlock('fireletters');
      } else if (e.type === 'outside') {
        setSaid({ name: e.title ? `${e.name}, ${e.title}` : e.name, say: e.say });
        clip(e.clip);
        if (e.kind === 'vala') {
          named.current.add(e.id);
          if (named.current.size === VALAR.length) {
            note('All the Valar named, under the light of the One.');
            unlock('ainur');
          }
        }
      } else if (e.type === 'view') {
        setView(e.view);
        setSaid(null);
      } else if (e.type === 'hover') setHover(e.name);
      else if (e.type === 'met') note(`Met: ${WHO[e.who] ?? e.name}. They are in the back of the book now.`);
      else if (e.type === 'found') {
        note(`Found: ${e.name}.`);
        play('ring');
        if (e.all) unlock('redbook');
      } else if (e.type === 'ring') setRing({ worn: e.worn, cooling: e.cooling, held: e.held, fire: e.fire });
      else if (e.type === 'torn') {
        note('A cry from the dark, and the Ring is torn from your finger.', true);
        clip('nazgul');
        unlock('wraithworld');
      } else if (e.type === 'stone') {
        setStone({ held: e.held, eye: e.eye, seen: e.seen });
        // (put down, the Eye is quiet at once; fallen, its last words stay a moment)
        if (!e.held && !fell.current) {
          hush();
          setDark(null);
        }
        if (e.held) fell.current = false;
      } else if (e.type === 'sauron') {
        setDark({ key: e.n, text: e.text, loud: e.loud });
        sauronSays(e.text, { loud: e.loud });
        if (e.n === 0) play('wraith');
      } else if (e.type === 'dropped') {
        fell.current = true;
        note('The Eye has seen you. The stone falls from your hands.', true);
        setTimeout(() => {
          fell.current = false;
          setDark(null);
        }, 2200);
        play('stinger');
        clip('nazgul');
        unlock('palantir');
      } else if (e.type === 'go') navigate(e.to);
      else if (e.type === 'opened') {
        setAsking(false);
        setSaid({ name: 'The Doors of Durin', say: 'Mellon. The doors swing slowly open.' });
        play('stone');
        unlock('mellon');
      } else if (e.type === 'menu') document.querySelector('.redbook-menu .hud-btn')?.click();
    },
    [clip, navigate, note, play, setParams, unlock],
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
  useEffect(() => () => (said$.current?.stop?.(), hush()), []);
  const toggleMusic = () => {
    const on = !musicOn;
    setMusicOn(on);
    api()?.setMusic(on);
    try {
      window.localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
    } catch {
      /* private window: the switch holds for this visit */
    }
  };

  // the pointer on the stage: a press is a tap, a drag turns the view (or
  // the Eye’s gaze), a finger’s quick sideways swipe turns a page
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
    if (p.moved && p.type !== 'mouse' && view === 'book' && !stone.held && Math.abs(dx) > SWIPE && performance.now() - p.t < 600 && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
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
    if (toy.clip) clip(toy.clip);
    else
      import('../lib/voiced').then((v) => {
        said$.current?.stop?.();
        said$.current = v.sayVoiced(who, toy.say, { mode: 'cut' });
      });
    setSaid({ name: WHO[who], say: toy.say });
  };
  const go = (v) => (audioContext(), api()?.setView(v));

  const ringLabel = ring.cooling ? 'Not yet' : ring.worn ? 'Take it off' : 'The Ring';
  const object = (key, { on, disabled, label, aria, icon, onClick }) => (
    <button key={key} type="button" className="redbook-object" data-on={on || undefined} disabled={disabled} onClick={() => (audioContext(), onClick())} aria-pressed={on} aria-label={aria}>
      <span className={`redbook-object-icon ${icon}`} aria-hidden="true" />
      <span className="redbook-object-label">{label}</span>
    </button>
  );
  const objects = [
    object('ring', { on: ring.worn, disabled: ring.cooling, label: ringLabel, aria: ring.worn ? 'Take off the Ring' : 'Put on the Ring', icon: 'redbook-ring-icon', onClick: () => api()?.wearRing() }),
    object('stone', { on: stone.held, label: stone.held ? 'Look away' : 'The Palantír', aria: stone.held ? 'Look away from the Palantír' : 'Look into the Palantír', icon: 'redbook-stone-icon', onClick: () => api()?.holdStone() }),
    object('look', { on: view === 'look', label: view === 'look' ? 'The book' : 'Look round', aria: view === 'look' ? 'Back to the book' : 'Look round the study', icon: 'redbook-look-icon', onClick: () => go(view === 'look' ? 'book' : 'look') }),
    object('window', { on: view === 'window', label: view === 'window' ? 'The book' : 'The window', aria: view === 'window' ? 'Back to the book' : 'Look out of the window', icon: 'redbook-window-icon', onClick: () => go(view === 'window' ? 'book' : 'window') }),
  ];

  // the card: the Palantír, the Ring in hand, a view of the room, or the page
  let card;
  if (stone.held)
    card = (
      <div className="redbook-card redbook-stone-card" role="status" data-eye={stone.eye >= 1 || undefined}>
        <p className="redbook-eyebrow">The Palantír</p>
        <p className="redbook-title">{stone.eye < 1 ? 'The smoke parts' : stone.seen > 0.5 ? 'It knows you are there' : 'The Eye of Sauron'}</p>
        <p className="redbook-line">{stone.eye < 1 ? 'Something is waiting in the dark of the stone.' : stone.seen > 0 ? 'It turns to you, and it speaks. Look away, before it sees you.' : 'Lidless, wreathed in flame, over the Dark Tower. It follows where you look. Do not hold it long.'}</p>
        <span className="redbook-meter" role="meter" aria-label="How near the Eye is to seeing you" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(stone.seen * 100) / 100}>
          <span style={{ transform: `scaleX(${stone.seen})` }} />
        </span>
        <div className="redbook-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => api()?.holdStone(false)}>
            {!touch && <kbd>Esc</kbd>} Look away
          </button>
        </div>
      </div>
    );
  else if (ring.held)
    card = (
      <div className="redbook-card redbook-ring-card" role="status">
        <p className="redbook-eyebrow">In your hand</p>
        <p className="redbook-title">The One Ring</p>
        <p className="redbook-line">{said?.say ?? 'Plain gold, and heavier than it should be. It is warm, as if it had been held a long time.'}</p>
        <div className="redbook-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={ring.cooling} onClick={() => api()?.wearRing(true)}>
            {!touch && <kbd>R</kbd>} Put it on
          </button>
          <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => api()?.ringToFire()}>
            {!touch && <kbd>F</kbd>} Into the fire
          </button>
          <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => api()?.holdRing(false)}>
            Put it down
          </button>
        </div>
      </div>
    );
  else if (view !== 'book')
    card = (
      // (on a phone, the title and the ways on until something is touched)
      <div className="redbook-card" data-open={!touch || said ? true : undefined}>
        <p className="redbook-eyebrow">{view === 'window' ? 'Out of the round window' : 'Bag End'}</p>
        <h1 className="redbook-title">{said?.name ?? (view === 'window' ? 'The night over Hobbiton' : 'Bilbo’s study')}</h1>
        <p className="redbook-line" aria-live="polite">
          {said?.say ?? VIEW_LINE[view]}
        </p>
        <div className="redbook-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => go('book')}>
            {!touch && <kbd>B</kbd>} Back to the book
          </button>
          {view === 'look' ? (
            <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => go('window')}>
              {!touch && <kbd>W</kbd>} The window
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm redbook-btn" onClick={() => go('look')}>
              {!touch && <kbd>L</kbd>} Look round the study
            </button>
          )}
        </div>
      </div>
    );
  else
    card = (
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
              ) : ring.worn ? (
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
    );

  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="redbook-stage" data-worn={ring.worn || undefined} data-stone={stone.held || undefined} data-eye={(stone.held && stone.eye >= 1) || undefined} data-view={view} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => api()?.hover(null)}>
        {status !== 'on' && <p className="redbook-loading">The candles are being lit…</p>}
        <div className="redbook-wraith" aria-hidden="true" />
        <div className="redbook-eye-veil" aria-hidden="true" style={{ '--seen': stone.seen }} />
        {dark && (
          <p key={dark.key} className="redbook-dark" role="status" style={{ '--loud': dark.loud }}>
            {dark.text}
          </p>
        )}
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
              <span className="redbook-brand-name">{view === 'window' ? 'The round window' : view === 'look' ? 'Bilbo’s study' : (page?.title ?? back?.title ?? 'Bag End')}</span>
            </p>
          }
          tools={
            <Menu className="redbook-menu" way={wayOut(pathname)}>
              <MenuItem keep aria-pressed={musicOn} onClick={toggleMusic}>
                Music {musicOn ? 'on' : 'off'}
              </MenuItem>
              <MenuItem onClick={() => go('look')}>Look round the study</MenuItem>
              <MenuItem onClick={() => go('window')}>Look out of the window</MenuItem>
              <MenuItem onClick={() => api()?.goTo('met')}>Those you met</MenuItem>
              <MenuItem onClick={() => api()?.goTo('kept')}>Things kept</MenuItem>
              <MenuItem onClick={() => navigate(MAP)}>Middle-earth’s map</MenuItem>
              <MenuItem onClick={() => navigate('/middle-earth/road')}>The Road</MenuItem>
              <MenuItem onClick={() => api()?.goTo(0)}>Start the book again</MenuItem>
            </Menu>
          }
          foot={
            <div className="redbook-foot">
              {card}
              {!touch && <div className="redbook-objects">{objects}</div>}
            </div>
          }
          thumbs={
            <div className="redbook-thumbs">
              <TouchButton size={52} onPress={() => (audioContext(), api()?.wearRing())} aria-label={ring.worn ? 'Take off the Ring' : 'Put on the Ring'} aria-pressed={ring.worn} className="redbook-touch" data-on={ring.worn || undefined}>
                <span className="redbook-object-icon redbook-ring-icon" aria-hidden="true" />
              </TouchButton>
              <TouchButton size={52} onPress={() => (audioContext(), api()?.holdStone())} aria-label={stone.held ? 'Look away from the Palantír' : 'Look into the Palantír'} aria-pressed={stone.held} className="redbook-touch" data-on={stone.held || undefined}>
                <span className="redbook-object-icon redbook-stone-icon" aria-hidden="true" />
              </TouchButton>
              <TouchButton size={52} onPress={() => go(view === 'look' ? 'book' : 'look')} aria-label={view === 'look' ? 'Back to the book' : 'Look round the study'} aria-pressed={view === 'look'} className="redbook-touch" data-on={view === 'look' || undefined}>
                <span className="redbook-object-icon redbook-look-icon" aria-hidden="true" />
              </TouchButton>
              <TouchButton size={52} onPress={() => go(view === 'window' ? 'book' : 'window')} aria-label={view === 'window' ? 'Back to the book' : 'Look out of the window'} aria-pressed={view === 'window'} className="redbook-touch" data-on={view === 'window' || undefined}>
                <span className="redbook-object-icon redbook-window-icon" aria-hidden="true" />
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
