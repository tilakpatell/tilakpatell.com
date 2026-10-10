import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiFullscreenExitLine, RiStackLine } from 'react-icons/ri';
import { systemLabel } from './warText';
import HoloSide from './HoloSide';
import MapSvg, { Axes } from './MapSvg';
import WarLegend from './WarLegend';
import WarStrip from './WarStrip';
import { Fleets } from './WarLayers';
import { SIDES, WARS } from './sides';
import { badgeOf, opsOf } from './warMap';
import { mine, onWar, warNow } from './warState';
import { jumpTime, routeBetween, routeMid } from './routes';
import { onView } from './mapView';
import { LAYERS, LAYERS_KEY, LAYER_LABEL, readLayers, warForEra } from './mapLayers';
import { estimateWidth, hangOf, placeLabels, sideOf } from './labelPlace';
import { courseOf, findSystems, mapKeyAction, pickAction, seedPick } from './mapKeys';
import { useMapView } from './useMapView';
import { globeUrl } from './globes';
import { local } from '../../lib/hooks';
import './warmap.css';
import { CORE, ERAS, FILMS, FILM_ORDER, RIM, SYSTEMS, eraById, erasOf, filmLabel, filmShort, lightYears, systemById, yearLabel } from './systems';

// The galaxy map, the way a holotable shows it: the galaxy's disc (its
// spiral arms, the glow of the Deep Core), the regions in rings out from the
// middle (they reach further to the south), the Unknown Regions off to the
// west, the atlas's grid (A to U across, 1 to 21 down), the great hyperspace
// routes, and every system you can jump to, in its own colour. Pick one and
// the panel leads with the jump, then how far it is and the course the jump
// takes along the lanes (routes.js), how long it takes, and, folded, its era
// and films and who's flying there now (online); the course is drawn on the
// map with its length and time tagged at its middle, and the one you're at
// wears a YOU tag. The eras and the films filter what's lit (the rest dim),
// so it doubles as a timeline: the prequels' worlds, the originals', the New
// Republic's (The Mandalorian's and Ahsoka's); the films are folded into one
// chip after the eras.
//
// And the galaxy's wars' table, Helldivers' galactic map (gcw.js, as the page
// knows it: warState.js), one war at a time (the era you pick shows its war,
// for looking: with every era lit, the war you fight in, your oath's): each
// power's territory round the systems it holds, hatched where it's fought over, the borders
// where powers meet and the lanes the war runs along, each offensive an
// arrow with its fleet closing in (WarLayers.jsx), each system ringed in its
// holder's colour with the attacker's share of the ring growing (+ a front,
// − an attack, a dashed ring cut off from supply), its battle on now marked,
// the major order starred, and a dot where you fought; who holds what over the map's empty north (WarStrip.jsx)
// and a key (WarLegend.jsx); the war's own card when nothing's picked
// (WarCard.jsx: its phase, orders, news, battles and the nearest to join),
// and the war's part of a system's card.
//
// Drawn once into a canvas (the stars of the disc), with an SVG over it for
// the lines and the names (MapSvg.jsx; it, the war's layers and the side panel,
// HoloSide.jsx, are memos, so a pan doesn't draw them again), and buttons over
// that for the systems (so the
// keyboard and screen readers have them: Tab through, Enter to pick, Enter
// again to jump). It renders into <body>, over the nav (the page's <main>
// is its own stacking context).
//
// It has its own keys (mapKeys.js, taken at the window's capture): M or
// Escape close it (Escape shuts the innermost open thing first: the find's
// list, the films' panel, the key, a phone's layers), / goes to the find
// field in its header (a system by name: it picks it and frames the course),
// J jumps to the course, + − 0 zoom (a held M acts once: its repeats neither
// close the map nor open it again). The mouse over a system shows a card for
// it, to the dot's left where the right would run out of the map; onCourse
// tells the page which system is the course when it changes, and `course`,
// the one the page kept, is the pick the map opens with.
//
// It zooms and pans (useMapView.js, on mapView.js's view): the wheel zooms
// about the pointer, a drag pans, two fingers pinch, the buttons zoom about
// the middle, and picking a system with an end of its course off the view
// zooms to show the course. The canvas, SVG, fleets, grid letters and systems
// are one stage that's scaled and moved (their names, dots and crests keep
// their size, through the 0.18 s the zoom eases in too: the view's k, x and y
// are registered custom properties, galaxy.css, so the stage and the
// counter-scale of everything in it ease together); the war's strip and key, the layers' switches (mapLayers.js:
// territory, fronts, lanes, regions, grid, each kept in this browser) and the
// zoom buttons stay put. Each system's name goes in
// the place round its dot where it covers least (labelPlace.js, in screen
// pixels, from the names' measured sizes), so at any zoom they keep clear of
// one another, the dots, the controls and the course's tag as far as there's
// room (on a phone's map a few dots are too close for it: a graze of a pixel
// or two is what's left); the map's own text is no
// smaller than 0.7 rem, and the regions' names (11.5 px on screen at any
// zoom) are spread round their rings, each shown once its ring has the room
// (regionNames.js: the inner ones come in as you zoom).
//
// What's new in the war since you last looked is marked on its card: the
// newest event's time each war, kept in this browser (SEEN_KEY) for you
// alone, read when the map opens.

const SIZE = 21; // the map is GRID squares across, in its own units
const TAU = Math.PI * 2;
const HOVER_GAP = 14; // (the hover card's distance from its dot, screen px: galaxy.css's)
const TAG_GUESS = { w: 130, h: 24 }; // (the course tag's size on screen before it's been measured)
const SEEN_KEY = 'tp-gcw-seen';
const NO_OATH = { war: 'gcw', side: null, sworn: 0, turncoat: false }; // (the defaults of the oath props, one object each: a new one every render would draw the side panel again)
const NO_OATHS = {};
const readSeen = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

// the disc's stars: two arms wound out from the core, a bulge, dust (at
// `zoom` times the pixels, up to 2.5, when the map's zoomed in, so they
// stay sharp)
function paintGalaxy(canvas, zoom = 1) {
  const dpr = Math.min(2, window.devicePixelRatio || 1) * Math.min(zoom, 2.5);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  const k = Math.min(w, h) / SIZE;
  const ox = (w - SIZE * k) / 2;
  const oy = (h - SIZE * k) / 2;
  const X = (x) => ox + x * k;
  const Y = (z) => oy + z * k;
  g.fillStyle = '#020611';
  g.fillRect(0, 0, w, h);
  // the glow of the disc and its core
  const disc = g.createRadialGradient(X(CORE[0]), Y(CORE[1]), 0, X(CORE[0]), Y(CORE[1]), RIM * k);
  disc.addColorStop(0, 'rgba(255,226,170,0.55)');
  disc.addColorStop(0.08, 'rgba(255,205,150,0.28)');
  disc.addColorStop(0.3, 'rgba(120,160,255,0.12)');
  disc.addColorStop(0.75, 'rgba(70,110,220,0.05)');
  disc.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = disc;
  g.fillRect(0, 0, w, h);
  // the arms: stars along two log spirals, scattered
  let s = 12345;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5200; i++) {
    const arm = i % 2;
    const t = rand() ** 0.7;
    const r = 0.4 + t * RIM;
    const a = arm * Math.PI + Math.log(r + 0.6) * 2.6 + (rand() - 0.5) * (0.9 - t * 0.4) + 0.6;
    const spread = (rand() - 0.5) * (0.6 + t * 1.3);
    const x = CORE[0] + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * spread;
    const z = CORE[1] + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * spread;
    const b = 0.25 + rand() * 0.6;
    const warm = t < 0.25 ? 1 : 0.3;
    g.fillStyle = `rgba(${Math.round(170 + 85 * warm)},${Math.round(190 + 40 * warm)},255,${(b * (1 - t * 0.55)).toFixed(3)})`;
    const rr = rand() < 0.04 ? 1.3 : 0.6;
    g.fillRect(X(x), Y(z), rr, rr);
  }
  // and a scatter everywhere, thinner further out
  for (let i = 0; i < 1600; i++) {
    const r = Math.sqrt(rand()) * RIM * 1.05;
    const a = rand() * TAU;
    g.fillStyle = `rgba(200,215,255,${(0.15 + rand() * 0.35).toFixed(3)})`;
    g.fillRect(X(CORE[0] + Math.cos(a) * r), Y(CORE[1] + Math.sin(a) * r), 0.7, 0.7);
  }
  g.globalCompositeOperation = 'source-over';
}

export default function HoloMap({ current, online, onJump, onClose, onLeave, oath = NO_OATH, oaths = NO_OATHS, suggested = null, onSwear, onTheatre, onCourse, course = null }) {
  const here = systemById(current);
  // the course the page keeps (it stays when the map closes) is the pick when the map opens, unless it's where you are
  const [pick, setPick] = useState(() => seedPick(course, current, SYSTEMS));
  const [era, setEra] = useState('all');
  const [film, setFilm] = useState(null);
  // what the map draws (mapLayers.js), each switch kept in this browser (on a
  // small map they fold behind a chip, so they don't cover the names)
  const [layers, setLayersState] = useState(() => readLayers(local.get(LAYERS_KEY)));
  const [layersOpen, setLayersOpen] = useState(false);
  const toggle = (id) => {
    const next = { ...layers, [id]: !layers[id] };
    local.set(LAYERS_KEY, next); // (not in the state's updater: it can run twice)
    setLayersState(next);
  };
  const [keyOpen, setKeyOpen] = useState(false); // (the war's key)
  // the films' panel: shut by a pick, an era chip, Escape inside it, or a press anywhere outside it (and the find's list the same)
  const films = useRef(null);
  const shutFilms = () => films.current && (films.current.open = false);
  // (a film's pick shuts the panel its button was in: the focus goes to the chip that opened it, not to nothing)
  const pickFilm = (id) => {
    setFilm((f) => (f === id ? null : id));
    shutFilms();
    films.current?.querySelector('summary')?.focus();
  };
  useEffect(() => {
    const away = (e) => {
      const el = films.current;
      if (el?.open && !el.contains(e.target)) el.open = false;
      if (!findBox.current?.contains(e.target)) setListOpen(false); // (and the find's list, with the words left in its field)
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);
  const canvas = useRef(null);
  const box = useRef(null);
  const mv = useMapView(box);
  const close = useRef(null);
  const find = useRef(null);
  const jumpBtn = useRef(null);
  const [q, setQ] = useState('');
  const [listOpen, setListOpen] = useState(false); // (the find's matches: shown while the field has focus and words in it)
  const findBox = useRef(null);
  const [hover, setHover] = useState(null); // (the system the mouse is over: its card)
  const picked = pick ? systemById(pick) : null;
  // the course to it: along the lanes where they join, straight where they don't (and where its tag goes: the middle)
  const route = useMemo(() => (picked && here && picked.id !== here.id ? routeBetween(here.id, picked.id) : null), [picked, here]);
  const mid = useMemo(() => (route ? routeMid(route) : null), [route]);
  // the war the map shows: the picked era's (or film's), and with every era lit
  // the one you fight in; as it stands this second (and when what the players
  // did changes)
  const view = warForEra(film ? FILMS[film].era : era, oath.war);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const off = onWar(() => setNow(Date.now()));
    return () => (clearInterval(id), off());
  }, []);
  const war = useMemo(() => {
    const table = warNow(now, view);
    return { ...table, byId: Object.fromEntries(table.systems.map((r) => [r.id, r])) };
  }, [now, view]);
  const ops = useMemo(() => opsOf(war), [war]);
  // (where each system's + or − goes on its ring, clear of its neighbours and the arrows' ends)
  const badges = useMemo(() => Object.fromEntries(war.systems.map((r) => [r.id, badgeOf(r.id, ops)])), [war, ops]);
  const record = useMemo(() => mine(view, now), [view, now]);
  const fought = useMemo(() => new Set(record.systems.map((x) => x.id)), [record]);
  const pickedWar = picked ? war.byId[picked.id] : null;
  const w = WARS[view];
  // your oath in the war the map shows (the page's oath is for the war you fight in)
  const viewOath = useMemo(() => (view === oath.war ? oath : { war: view, side: oaths[view]?.side ?? null, sworn: oaths[view]?.sworn ?? 0, turncoat: oaths[view]?.turncoat ?? false }), [view, oath, oaths]);
  // what you'd seen of each war when the map opened; what's on it now is seen as of now
  const [seen] = useState(readSeen);
  const newest = war.events?.at(-1)?.at ?? null;
  useEffect(() => {
    if (newest === null) return;
    try {
      const v = readSeen();
      if (!(v[view] >= newest)) window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...v, [view]: newest }));
    } catch {
      // (private browsing: nothing's marked new next time, that's all)
    }
  }, [view, newest]);

  // (the disc's stars are repainted at the zoom's resolution once it settles)
  const zk = mv.view.k;
  const kRef = useRef(zk);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => paintGalaxy(c, kRef.current);
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => {
    const was = kRef.current;
    kRef.current = zk;
    const c = canvas.current;
    if (!c || was === zk) return undefined;
    const id = setTimeout(() => paintGalaxy(c, zk), 200);
    return () => clearTimeout(id);
  }, [zk]);
  useEffect(() => {
    close.current?.focus();
  }, []);

  // who's flying where (online)
  const pilots = useMemo(() => {
    const out = {};
    for (const p of online?.room?.peers ?? []) {
      const m = /^\/galaxy\/([a-z0-9-]+)/.exec(p.where ?? '');
      if (m && !p.blocked) out[m[1]] = (out[m[1]] ?? 0) + 1;
    }
    return out;
  }, [online?.room]);

  // where each system's name goes (labelPlace.js), in screen pixels: from the
  // map's width, the view, and the names' own sizes (measured once drawn,
  // guessed till then). The stage is scaled by k and each system by 1/k, so a
  // name is its own size on screen; its offsetWidth is that, and unlike its
  // bounding box isn't bent by the stage's zoom easing in
  const [boxPx, setBoxPx] = useState(600);
  // (the real width before the first paint, not 600 till the observer's first word)
  useLayoutEffect(() => {
    const w = box.current?.clientWidth;
    if (w) setBoxPx(w);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setBoxPx(e.contentRect.width || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sizes = useRef({}); // id → { w, h } measured px, from the DOM
  const [sized, setSized] = useState({}); // (a copy of it, taken when one changes: what the places are placed from)
  useLayoutEffect(() => {
    let changed = false;
    for (const el of box.current?.querySelectorAll('.holomap-name[data-id]') ?? []) {
      const w = el.offsetWidth + 1; // (it rounds; a pixel to spare)
      const h = el.offsetHeight;
      const was = sizes.current[el.dataset.id];
      if (w > 1 && h > 0 && (was?.w !== w || was?.h !== h)) (sizes.current[el.dataset.id] = { w, h }), (changed = true);
    }
    if (changed) setSized({ ...sizes.current });
  }, [war, boxPx, pilots]);
  // the controls drawn over the map that stay put (the war's board, the Layers chip, the Key chip, the zoom buttons; the layers' own
  // switches where there's no chip), as boxes from the map's top left: a name goes clear of them as of a dot (labelPlace.js's
  // `blocks`). Measured once drawn, and again when the map or any of them changes size (the board with the war)
  const [blocks, setBlocks] = useState([]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => {
      const m = el.getBoundingClientRect();
      const chip = el.querySelector('.holomap-layers-toggle');
      const parts = [el.querySelector('.holomap-strip-board'), chip, el.querySelector('.holomap-legend-toggle'), el.querySelector('.holomap-zoom'), ...(chip?.getClientRects().length ? [] : el.querySelectorAll('.holomap-layers-set button'))];
      const found = [];
      for (const n of parts) {
        if (!n?.getClientRects().length) continue; // (not shown)
        const r = n.getBoundingClientRect();
        found.push({ x0: Math.round(r.left - m.left) - 2, y0: Math.round(r.top - m.top) - 2, x1: Math.round(r.right - m.left) + 2, y1: Math.round(r.bottom - m.top) + 2 });
      }
      setBlocks((was) => (JSON.stringify(was) === JSON.stringify(found) ? was : found));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    for (const n of [el, ...el.querySelectorAll('.holomap-strip-board, .holomap-layers-toggle, .holomap-layers-set, .holomap-legend-toggle, .holomap-zoom')]) ro.observe(n);
    return () => ro.disconnect();
  }, [view]); // (the war's board is another size with another war)
  // the course's tag, drawn over the map at the middle of the course (it keeps its size on screen: measured once drawn, guessed till
  // then): a name goes clear of it as of the controls
  const tag = useRef(null);
  const [tagPx, setTagPx] = useState(null);
  useLayoutEffect(() => {
    const el = tag.current;
    const next = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    setTagPx((was) => (was?.w === next?.w && was?.h === next?.h ? was : next));
  }, [pick, current]);
  const places = useMemo(() => {
    const { k, x, y } = mv.view;
    // (centred on the middle, and raised its own height less a tenth: galaxy.css's translate)
    const t = mid ? { w: tagPx?.w ?? TAG_GUESS.w, h: tagPx?.h ?? TAG_GUESS.h } : null;
    const [tx, ty] = mid ? [(x + (k * mid[0]) / SIZE) * boxPx, (y + (k * mid[1]) / SIZE) * boxPx - 0.9 * t.h] : [0, 0];
    const tagBlock = t ? [{ x0: tx - t.w / 2 - 2, y0: ty - t.h / 2 - 2, x1: tx + t.w / 2 + 2, y1: ty + t.h / 2 + 2 }] : [];
    const items = SYSTEMS.map((s) => {
      const row = war.byId[s.id];
      const prio = s.id === current ? 100 : s.id === pick ? 90 : row?.battle?.fighting ? 50 : row?.major ? 40 : 0;
      const extras = (row?.major ? 14 : 0) + (row?.battle?.fighting ? 14 : 0) + (pilots[s.id] ? 20 : 0) + (s.id === current ? 32 : 0); // (the YOU tag)
      const z = sized[s.id];
      return { id: s.id, x: (x + (k * s.pos[0]) / SIZE) * boxPx, y: (y + (k * s.pos[1]) / SIZE) * boxPx, w: z ? z.w : estimateWidth(s.name, 12.5, extras), h: z ? z.h : 20, prio };
    });
    // (a view gone wrong must not take the map down with it: every name on the right, as it was)
    if (items.some((i) => !Number.isFinite(i.x) || !Number.isFinite(i.y))) return {};
    return placeLabels(items, { bounds: { x0: 0, y0: 0, x1: boxPx, y1: boxPx }, blocks: [...blocks, ...tagBlock] });
  }, [mv.view, boxPx, war, current, pick, pilots, sized, blocks, mid, tagPx]);

  const lit = (s) => (film ? s.films.includes(film) : era === 'all' || erasOf(s).includes(era));
  // plot a course to a system (the war card's picks too); with an end of it
  // off the view, zoom to show all of it
  // (reads the view from a ref, so it's the same function through the pans and the zooms: the side panel is a memo it's handed to)
  const viewNow = useRef(mv.view);
  useLayoutEffect(() => {
    viewNow.current = mv.view;
  });
  const { frame } = mv;
  const plot = useCallback(
    (id) => {
      setPick(id);
      const s = systemById(id);
      if (s && here && (!onView(viewNow.current, s.pos) || !onView(viewNow.current, here.pos))) frame([s.pos, here.pos]);
    },
    [here, frame],
  );
  const back = useCallback(() => setPick(null), []);
  // Tab to a system that's off the view brings it into view, at the zoom the map has (a click on one never does: it's already there)
  const reveal = (sys, e) => {
    if (mv.view.k > 1.01 && e.currentTarget.matches(':focus-visible') && !onView(mv.view, sys.pos)) mv.reveal(sys.pos);
  };
  // pick a system to plot a course to it, then again to jump; the one you're
  // at shows its own card (no course to plot), and again the war's. (A
  // double click is this twice, so it jumps only if the second press lands on
  // the system the first picked: the map can have moved under the pointer.)
  const choose = (id) => {
    const act = pickAction(pick, id, current);
    if (act === 'pick') plot(id);
    else if (act === 'clear') setPick(null);
    else onJump(id);
  };
  // (the page is told which system is the course, or none: its flight HUD can show it. Only when it changes from what it has: the
  // map opening on the course the page keeps tells it nothing, and a kept course that's where you are now is cleared)
  const told = useRef(course);
  const onCourseNow = useRef(onCourse); // (the latest, as viewNow: a page's new handler mustn't tell it the course again)
  useLayoutEffect(() => {
    onCourseNow.current = onCourse;
  });
  useEffect(() => {
    const now = courseOf(pick, current);
    if (now === told.current) return;
    told.current = now;
    onCourseNow.current?.(now);
  }, [pick, current]);

  // a find picks the system (it never jumps: a second find of the one picked would, through choose) and
  // frames the course to it; the focus goes to the jump, so J and Enter work at once
  const matches = findSystems(q, SYSTEMS);
  const go = (s) => {
    setQ('');
    setListOpen(false);
    setPick(s.id);
    mv.frame(here ? [s.pos, here.pos] : [s.pos]);
    setTimeout(() => jumpBtn.current?.focus(), 0);
  };

  // the map's own keys (mapKeys.js): M closes it; Escape shuts the innermost open thing (the find's list, the films' panel, the key, a
  // phone's layers) and then it; / finds, J jumps, + − 0 zoom. They're taken at the window's capture, before the page's and the
  // scene's (which stand down for a modal anyway), so what's open is looked at here
  const onKey = (e) => {
    const el = e.target;
    if (el instanceof Element && el.closest('[aria-modal="true"]:not(.holomap)')) return; // (the guide's or the palette's own)
    const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const chip = box.current?.querySelector('.holomap-layers-toggle'); // (the layers' switches fold behind it on a small map only)
    const act = mapKeyAction(
      { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, repeat: e.repeat },
      { typing, canJump: Boolean(picked && picked.id !== current), findOpen: listOpen && q.trim() !== '', filmsOpen: Boolean(films.current?.open), keyOpen, layersOpen: layersOpen && Boolean(chip?.getClientRects().length) },
    );
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    if (act === 'clearFind') {
      setQ('');
      setListOpen(false);
      find.current?.focus();
    } else if (act === 'closeFilms') {
      shutFilms();
      films.current?.querySelector('summary')?.focus();
    } else if (act === 'closeKey') {
      setKeyOpen(false);
      box.current?.querySelector('.holomap-legend-toggle')?.focus();
    } else if (act === 'closeLayers') {
      setLayersOpen(false);
      chip?.focus();
    } else if (act === 'close') onClose();
    else if (act === 'find') (find.current?.focus(), find.current?.select());
    else if (act === 'jump') {
      if (!e.repeat) onJump(picked.id);
    } else if (act === 'zoomIn') mv.zoomIn();
    else if (act === 'zoomOut') mv.zoomOut();
    else mv.fit();
  };
  // (one listener for the map's life, calling the handler of the latest render: what's open is read there)
  const onKeyNow = useRef(onKey);
  useLayoutEffect(() => {
    onKeyNow.current = onKey;
  });
  useEffect(() => {
    const h = (e) => onKeyNow.current(e);
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  const pct = (v) => `${(v / SIZE) * 100}%`;
  const unitPx = (boxPx * mv.view.k) / SIZE; // (screen px per map unit)
  const wide = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 761px)').matches); // (the panel's rest is open where there's room)
  // (focus leaving the find for another control shuts its list; a press on a button in it has none yet, in Safari, so it's let be)
  const leaveFind = (e) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setListOpen(false);
  };
  const hovered = hover ? systemById(hover) : null;
  const hoveredRow = hovered ? war.byId[hovered.id] : null;
  // the hover card sits to the right of the dot, and to its left where it'd run out of the map
  const card = useRef(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !hovered) return;
    const x = (mv.view.x + (mv.view.k * hovered.pos[0]) / SIZE) * boxPx; // (the dot's, in screen px from the map's left)
    const room = (side) => (side > 0 ? boxPx - 4 - (x + HOVER_GAP) : x - HOVER_GAP - 4) >= el.offsetWidth;
    setFlip(!room(1) && (room(-1) || x > boxPx / 2));
  }, [hovered, mv.view, boxPx]);

  return createPortal(
    <div className="holomap dark-scope" role="dialog" aria-modal="true" aria-labelledby="holomap-title" style={{ '--btn-bg': picked?.accent ?? '#7fd6ff', '--btn-ink': '#03040a', '--accent': picked?.accent ?? '#7fd6ff', '--accent-text': picked?.accent ?? '#7fd6ff' }}>
      <div className="holomap-frame">
        <header className="holomap-head">
          <div>
            <p className="holomap-kicker">Navicomputer · Galactic Standard</p>
            <h2 id="holomap-title" className="holomap-title">
              Plot a course
            </h2>
          </div>
          <div ref={findBox} className="holomap-find" onBlur={leaveFind}>
            <input
              ref={find}
              type="search"
              aria-label="Find a system"
              placeholder="Find a system  /"
              value={q}
              onChange={(e) => (setQ(e.target.value), setListOpen(true))}
              onFocus={() => setListOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches[0]) {
                  e.preventDefault();
                  go(matches[0]);
                }
              }}
            />
            {listOpen && q.trim() !== '' && (
              <div className="holomap-find-list">
                {matches.length > 0 ? (
                  <ul aria-label="Systems found">
                    {matches.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => go(s)} style={{ '--c': s.accent }}>
                          {s.name} <span>{s.region}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="holomap-find-none" role="status">
                    No system called “{q.trim()}”
                  </p>
                )}
              </div>
            )}
          </div>
          <button ref={close} type="button" className="holomap-close" onClick={onClose} aria-label="Close the galaxy map">
            <RiCloseLine className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="holomap-eras" role="group" aria-label="Era">
          <button type="button" aria-pressed={era === 'all' && !film} onClick={() => (setEra('all'), setFilm(null), shutFilms())}>
            Every era
          </button>
          {ERAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={era === e.id && !film} style={{ '--era': e.color }} onClick={() => (setEra(e.id), setFilm(null), shutFilms())} title={e.about}>
              {e.name} <span>{e.span}</span>
            </button>
          ))}
          {/* the films, folded into a chip (a film lights its own world, and the war of its era) */}
          <details
            ref={films}
            className="holomap-filmpick"
            data-active={film || undefined}
            style={film ? { '--era': eraById(FILMS[film].era).color } : undefined}
          >
            <summary title={film ? filmLabel(film) : undefined}>{film ? `Films: ${filmShort(film)}` : 'Films'}</summary>
            <div className="holomap-films" role="group" aria-label="Film">
              {FILM_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={film === id}
                  style={{ '--era': eraById(FILMS[id].era).color }}
                  onClick={() => pickFilm(id)}
                  title={`${filmLabel(id)} · ${yearLabel(FILMS[id].year)}`}
                >
                  {filmShort(id)} <span>{filmLabel(id)}</span>
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="holomap-body">
          <div ref={box} className="holomap-map" data-zoomed={mv.view.k > 1.01 || undefined} data-fronts={layers.fronts || undefined} {...mv.handlers}>
            {/* the war at a glance, and its key (they stay put while the map moves) */}
            <WarStrip table={war} fighting={oath.war} />
            <WarLegend war={view} open={keyOpen} onToggle={setKeyOpen} />
            <div className="holomap-layers" data-open={layersOpen || undefined}>
              <button type="button" className="holomap-layers-toggle" aria-expanded={layersOpen} aria-controls="holomap-layers-set" onClick={() => setLayersOpen((o) => !o)}>
                <RiStackLine aria-hidden="true" /> Layers
              </button>
              <div id="holomap-layers-set" className="holomap-layers-set" role="group" aria-label="Show on the map">
                {LAYERS.map((id) => (
                  <button key={id} type="button" aria-pressed={layers[id]} onClick={() => toggle(id)}>
                    {LAYER_LABEL[id]}
                  </button>
                ))}
              </div>
            </div>
            {/* everything that moves with the map: zoomed and panned as one (galaxy.css) */}
            <div className="holomap-stage" style={{ '--holomap-k': mv.view.k, '--holomap-vx': mv.view.x, '--holomap-vy': mv.view.y }}>
              <canvas ref={canvas} className="holomap-canvas" aria-hidden="true" />
              <MapSvg layers={layers} war={war} ops={ops} route={route} unitPx={unitPx} />
              {layers.fronts && <Fleets ops={ops} />}
              {/* the grid's letters and numbers */}
              {layers.grid && <Axes />}
              {/* the systems */}
              <ul className="holomap-systems" aria-label="Star systems">
                {SYSTEMS.map((s) => {
                  const row = war.byId[s.id];
                  // (fought over: a front still to liberate, or an attack; the ring's the attacker's share and the holder's)
                  const by = row?.attack ? row.attack.by : row?.front && row.owner !== w.liberator ? w.liberator : null;
                  const ring = row ? { '--held': SIDES[row.owner].colour, ...(by && { '--by': SIDES[by].colour, '--take': 1 - row.control }) } : {};
                  const you = row && fought.has(s.id);
                  return (
                  <li key={s.id} style={{ left: pct(s.pos[0]), top: pct(s.pos[1]), '--c': s.accent, ...ring }} data-dim={!lit(s) || undefined} data-place={sideOf(places[s.id])} data-hang={hangOf(places[s.id])} data-badge={row ? badges[s.id] : undefined} data-held={row?.owner} data-front={(by && !row.attack) || undefined} data-attack={row?.attack ? '' : undefined} data-major={row?.major || undefined} data-decisive={row?.decisive || undefined} data-cut={row?.cut || undefined} data-fought={you || undefined}>
                    <button type="button" className="holomap-system" aria-pressed={pick === s.id} aria-current={s.id === current ? 'location' : undefined} onFocus={(e) => reveal(s, e)} onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(s.id)} onPointerLeave={() => setHover(null)} onClick={() => choose(s.id)} aria-label={row ? systemLabel(row, now, you) : undefined}>
                      <span className="holomap-dot" aria-hidden="true" data-globe={globeUrl(s.id) ? '' : undefined} style={globeUrl(s.id) ? { '--globe': `url("${globeUrl(s.id)}")` } : undefined}>
                        {you && <i className="holomap-you" />}
                      </span>
                      <span className="holomap-name" data-id={s.id}>
                        {s.id === current && (
                          <b className="holomap-youtag" aria-hidden="true">
                            YOU
                          </b>
                        )}
                        {s.name}
                        {row?.major && <b className="holomap-star" aria-hidden="true">★</b>}
                        {row?.battle?.fighting && <b className="holomap-fight" aria-hidden="true">⚔</b>}
                        {pilots[s.id] > 0 && (
                          <span className="holomap-pilots" title={`${pilots[s.id]} online`}>
                            {pilots[s.id]}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
              {/* the course's own tag, at its middle, and the card of the system the mouse is over (both keep their size, and never take a press) */}
              {route && (
                <span ref={tag} className="holomap-course-tag" style={{ left: pct(mid[0]), top: pct(mid[1]) }}>
                  {lightYears(here, picked).toLocaleString('en-US')} ly · {jumpTime(route).toFixed(1)} s
                </span>
              )}
              {hovered && hovered.id !== pick && (
                <span ref={card} className="holomap-hover" data-flip={flip || undefined} style={{ left: pct(hovered.pos[0]), top: pct(hovered.pos[1]), '--c': hovered.accent }}>
                  <b>{hovered.name}</b>
                  <span>{[hoveredRow && SIDES[hoveredRow.owner].short, hoveredRow?.battle?.fighting && 'Battle on'].filter(Boolean).join(' · ')}</span>
                  <span>{hovered.id === current ? 'You are here' : `${lightYears(here, hovered).toLocaleString('en-US')} ly`}</span>
                </span>
              )}
            </div>
            <div className="holomap-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={mv.zoomIn} aria-label="Zoom in" title="Zoom in (+)">
                +
              </button>
              <button type="button" onClick={mv.zoomOut} aria-label="Zoom out" title="Zoom out (−)">
                −
              </button>
              <button type="button" onClick={mv.fit} aria-label="Show the whole galaxy" title="The whole galaxy (0)" aria-disabled={mv.view.k <= 1.01 || undefined}>
                <RiFullscreenExitLine aria-hidden="true" />
              </button>
            </div>
          </div>

          <HoloSide picked={picked} here={here} route={route} war={war} pickedWar={pickedWar} view={view} now={now} oath={oath} viewOath={viewOath} pilots={pilots} wide={wide} seen={seen} suggested={suggested} record={record} current={current} jumpBtn={jumpBtn} onJump={onJump} onClose={onClose} onLeave={onLeave} onSwear={onSwear} onTheatre={onTheatre} onPick={plot} onBack={back} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
