import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiEyeLine, RiFlashlightFill, RiLinkM, RiRocket2Fill, RiRouteLine, RiSearchLine, RiSpeedUpFill } from 'react-icons/ri';
import { CHART_VIEWS, DESTINATIONS, DRIVES, KINDS, chartAt, chartHeading, chartRadius, destinationById, distanceTo, driveById, findDestinations, formatDistance, formatTime, goalOf, onChart, portalBetween, shortDistance, speedWord, tripTime, viewFor } from './nav';
import { BELT, HOME_RADIUS, SECTORS, SUN, mapSectorOf } from './layout';
import { EDGE } from './ship';
import { declutter } from './chart/declutter';
import { FLY_PAST, JAMMED, NAV, PICK_A_SHIP, jumpState } from './words';
import './navmap.css';

// The nav map: the whole universe from straight above, the way the galaxy's
// holotable shows the galaxy (galaxy/HoloMap.jsx). Every station, world and
// wonder, where you are and which way you're pointing, the other pilots
// online, and the course to wherever's picked. Pick a place (on the chart,
// or from the list: filter it, or search it by name), then a drive, each
// with how long it'd take from here, run on the ship's own physics (nav.js):
//   Hyperspeed   a jump to lightspeed, out parked at it
//   Super speed  the autopilot on 3× the pulse drive
//   Cruise       the pulse drive as it comes
// and go. The drive picked is kept, and it's how picking a place anywhere
// on the map goes too. A world or a station can be gone straight into, too.
// With no ship, the camera takes you to a station or a world (the trip
// times need a ship). The whole universe on a root scale (the home system
// opens up, the far worlds still fit), or the home system alone; or
// the Rick and Morty sector, round its own middle (it opens on the sector the
// ship's in). A place in the other sector is gone to through the portal
// between them, and its course is drawn to that portal.
//
// Kept calm on purpose: the header holds only the charts and the ways out,
// the list's search and filters live with the list, and the drives come up
// with a place picked, beside the button that uses them. On the chart a
// world reads as a lit planet and a wonder as a small diamond, and only the
// names with room show (chart/declutter.js, in priority order: the place
// picked, where you are, where you're going, the worlds, the wonders); the
// rest come up on hover and focus, and the list has them all.
//
// Drawn into <body> over everything, as a dialog: a canvas of stars under
// an SVG of the rings, the wonders and the course, with a button per place
// over that (Tab through, Enter to pick, Enter again to go). `where()` is
// the scene's (scene.js), read a few times a second while it's open.

const V = 1000; // the SVG's units across
const ICONS = { hyper: RiFlashlightFill, super: RiSpeedUpFill, cruise: RiRocket2Fill };
const WHY = { interdicted: JAMMED.short, charging: 'Charging' };
// which names keep theirs first when there isn't room for all
const PRIORITY = { pick: 100, home: 95, here: 90, going: 85, front: 80, world: 50, station: 50, portal: 40, wonder: 30, fight: 10 };
const LABEL_H = 20; // (a name's line: the button is 24 high, and two may graze)
const DOT_W = 16 + 5 + 7; // (the dot, the gap after it and the button's padding past the name: navmap.css)
const WONDER_FS = 0.92; // (a wonder's name, of the chart's font size: navmap.css)
// the far fights (farFights.js) the scene says are on, on this chart: [{ id, x, z, label, xy }]
const fightsOn = (now, sector, P) =>
  (Array.isArray(now?.farFights) ? now.farFights : [])
    .filter((f) => Number.isFinite(f?.x) && Number.isFinite(f?.z) && mapSectorOf(f.x, 0, f.z) === sector)
    .map((f) => ({ ...f, xy: P([f.x, 0, f.z]) }))
    .filter((f) => onChart([f.xy[0] / V, f.xy[1] / V]));

function paintStars(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  g.fillStyle = '#03050d';
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
  glow.addColorStop(0, 'rgba(255,200,130,0.14)');
  glow.addColorStop(0.2, 'rgba(110,140,255,0.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  // the stars: fewer and fainter than a sky, so the places are what reads
  let s = 271828;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const b = 0.08 + rand() * rand() * 0.5;
    g.fillStyle = `rgba(${200 + Math.round(rand() * 55)},${210 + Math.round(rand() * 40)},255,${b.toFixed(3)})`;
    const r = rand() < 0.04 ? 1.1 : 0.6;
    g.fillRect(rand() * w, rand() * h, r, r);
  }
}

// how wide a name is, in px, at the chart's font (a canvas measures it: the
// names hidden for want of room aren't laid out to be measured)
let ruler = null;
function textWidth(text, font) {
  if (typeof document === 'undefined') return text.length * 7;
  ruler ??= document.createElement('canvas').getContext('2d');
  if (!ruler) return text.length * 7;
  ruler.font = font;
  return ruler.measureText(text).width;
}

// how big a thing `reach` across, `d` out from the middle, looks on the chart (SVG units)
const sizeOn = (d, reach, view) => ((chartRadius(d + reach, view) - chartRadius(Math.max(0, d - reach), view)) / 2) * V;

// which sector's chart the ship's on (the main map's, with no ship, and out
// in the Expanse)
const sectorAt = (ship) => (ship ? mapSectorOf(ship.x, ship.y ?? 0, ship.z) : 'main');

// the bezel round the chart's rim: a tick every 5°, a longer one every 45°
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2;
  const major = i % 9 === 0;
  const r0 = major ? 476 : 481;
  const r1 = 488;
  return { d: `M${V / 2 + Math.cos(a) * r0} ${V / 2 + Math.sin(a) * r0} L${V / 2 + Math.cos(a) * r1} ${V / 2 + Math.sin(a) * r1}`, major };
});

export default function NavMap({ where, drive, onDrive, selected = null, live = false, onTravel, onEnter, onWhole, onTour, onClose }) {
  const [now, setNow] = useState(() => where?.() ?? null);
  const [view, setView] = useState(() => viewFor(sectorAt(now?.ship)));
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  // (what the page has picked, unless that's where the ship is already)
  const [pick, setPick] = useState(() => (selected && destinationById(selected) && selected !== now?.at ? selected : null));
  const [times, setTimes] = useState({});
  const [copied, setCopied] = useState(null); // the place whose link was just copied
  const [px, setPx] = useState(0); // the chart's width on the screen
  const [font, setFont] = useState('500 12px sans-serif'); // its names' font
  const canvas = useRef(null);
  const chartEl = useRef(null);
  const placesEl = useRef(null);
  const close = useRef(null);
  const search = useRef(null);
  const chart = CHART_VIEWS[view];
  const sector = chart.sector;
  const shipSector = sectorAt(now?.ship);
  // (how far out from the chart's middle)
  const out = (at3) => Math.hypot(at3[0] - chart.origin[0], at3[2] - chart.origin[2]);
  // where a course to a place is drawn to on this chart: the place, or the portal on the way to it
  const toward = (d) => (d.sector === sector ? d.at : (portalBetween(sector, d.sector)?.at ?? null));
  const picked = pick ? destinationById(pick) : null;
  const flying = Boolean(now?.ship);
  const list = useMemo(() => findDestinations(kind, query), [kind, query]);
  const shown = useMemo(() => new Set(list.map((d) => d.id)), [list]);

  // the stars, once (and again on a resize); the chart's size and its names' font with them
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => {
      paintStars(c);
      setPx(chartEl.current?.clientWidth ?? 0);
      const cs = placesEl.current && window.getComputedStyle(placesEl.current);
      if (cs) setFont(`500 ${cs.fontSize} ${cs.fontFamily}`);
    };
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
    document.fonts?.ready?.then(draw, () => {});
    return () => ro?.disconnect();
  }, []);
  // the focus in, and back where it was on the way out; Escape closes
  useEffect(() => {
    const was = document.activeElement;
    close.current?.focus();
    return () => {
      if (was instanceof HTMLElement && document.contains(was)) was.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // the ship, a few times a second
  useEffect(() => {
    if (!where) return undefined;
    const t = setInterval(() => setNow(where()), 250);
    return () => clearInterval(t);
  }, [where]);

  // how long each drive takes to the place picked, from where the ship is
  // now (run on its physics: a few milliseconds each), and again every
  // couple of seconds as it moves
  const shipRef = useRef(null);
  shipRef.current = now?.ship ?? null;
  useEffect(() => {
    if (!pick) return undefined;
    const time = () => {
      const s = shipRef.current;
      setTimes(s ? Object.fromEntries(DRIVES.map((d) => [d.id, tripTime(s, pick, d.id)])) : {});
    };
    time();
    const t = setInterval(time, 2000);
    return () => clearInterval(t);
  }, [pick, flying]);

  // where you are: at a place (within a little of its edge), or nearest one
  const here = useMemo(() => {
    const s = now?.ship;
    if (!s) return null;
    let best = null;
    for (const d of DESTINATIONS) {
      const gap = distanceTo(s, d.id);
      if (!best || gap < best.gap) best = { d, gap };
    }
    return best;
  }, [now?.ship]);
  const atId = now?.at ?? (here && here.gap < 40 ? here.d.id : null);

  const choose = (id) => {
    if (pick === id) go(id);
    else setPick(id);
  };
  const hyper = now?.hyper ?? { ready: true, wait: 0, why: null };
  const fallsBack = drive === 'hyper' && !hyper.ready;
  const canFly = flying && !now?.foot && !now?.crashed;
  const at = (id) => goalOf(id) === atId; // (a star system: at its gate)
  // can the place picked be gone to, and how (with a ship, by its drive;
  // without one, the camera goes to a station or a world; a system at whose
  // gate you already are goes straight in)
  const goable = (d) => d && !(at(d.id) && !d.via) && (canFly || (!flying && d.kind !== 'wonder'));
  const go = (id = pick) => {
    const d = destinationById(id);
    if (!goable(d)) return;
    if (d.via && at(d.id)) {
      onEnter?.(d.id);
      return;
    }
    onTravel(id, drive);
  };
  // pick from the list (or the search's Enter): the chart turns to where it is
  const pickFromList = (d) => {
    setPick(d.id);
    if (d.kind === 'station' && view !== 'home') setView('home');
    else if (d.kind !== 'station') setView(viewFor(d.sector));
  };

  const P = (at3) => chartAt(at3[0], at3[2], chart).map((v) => v * V);
  const pct = ([u, v]) => ({ left: `${(u / V) * 100}%`, top: `${(v / V) * 100}%` });
  const shipAt = now?.ship && shipSector === sector ? P([now.ship.x, 0, now.ship.z]) : null;
  const goingTo = now?.going ? destinationById(now.going.id) : null;
  const course = picked && !at(picked.id) ? picked : goingTo;
  const courseAt = course ? toward(course) : null;
  const homeR = chartRadius(HOME_RADIUS, chart) * V;
  const unit = px ? V / px : 1; // (SVG units a screen pixel: marks drawn at one size on any screen)
  const fights = fightsOn(now, sector, P);

  // the places on this chart, with their spots
  const marks = DESTINATIONS.filter((d) => !(view === 'all' && d.kind === 'station') && d.kind !== 'system' && d.sector === sector)
    .map((d) => ({ d, xy: P(d.at) }))
    .filter((m) => onChart([m.xy[0] / V, m.xy[1] / V]));

  // which names show, and on which side (chart/declutter.js: a few dozen
  // boxes, cheap enough to place afresh each time the ship's read)
  const sides = (() => {
    if (!px) return new Map();
    const k = px / V;
    const fontPx = parseFloat(/(\d+(\.\d+)?)px/.exec(font)?.[1] ?? '12');
    const label = (id, xy, name, priority, extra = {}) => ({ id, x: xy[0] * k, y: xy[1] * k, w: textWidth(name, extra.small ? font.replace(/[\d.]+px/, `${fontPx * WONDER_FS}px`) : font) + DOT_W, h: LABEL_H, priority, ...extra });
    const labels = [];
    for (const { d, xy } of marks) {
      const mine = d.id === pick ? PRIORITY.pick : at(d.id) ? PRIORITY.here : goingTo?.id === d.id ? PRIORITY.going : null;
      if (!mine && !shown.has(d.id)) continue; // (filtered out: its dot alone, greyed)
      const wonder = d.kind === 'wonder';
      labels.push(label(d.id, xy, d.name, mine ?? (wonder ? (d.type === 'Portal' ? PRIORITY.portal : PRIORITY.wonder) : PRIORITY[d.kind]), { small: wonder }));
    }
    if (view === 'all') labels.push(label('home', [V / 2, V / 2 + homeR], 'Home system', PRIORITY.home, { sides: ['under'] }));
    if (view === 'all' && now?.front) labels.push(label('front', P(now.front.at), `The front · ${now.front.name}`, PRIORITY.front, { sides: ['left', 'right'] }));
    for (const f of fights) labels.push(label(`fight:${f.id}`, f.xy, f.label, PRIORITY.fight, { sides: ['under', 'over'], small: true }));
    const dots = marks.map(({ xy }) => ({ x: xy[0] * k, y: xy[1] * k }));
    if (shipAt) dots.push({ x: shipAt[0] * k, y: shipAt[1] * k });
    return declutter(labels, { bounds: { x0: 0, y0: 0, x1: px, y1: px }, round: true, dots });
  })();
  // a place's side, or none (its name on hover and focus); the place picked and where you are always say theirs
  const sideOf = (id, always = false) => sides.get(id) ?? (always ? 'right' : null);

  const verb = (d) => {
    if (!d) return '';
    if (!flying) return d.kind === 'wonder' ? PICK_A_SHIP.replace(/\.$/, '') : d.via ? `Show me the gate` : `Show me ${d.name}`;
    if (now?.foot) return 'Back in the ship first (G)';
    if (at(d.id)) return d.via ? `Through the gate to ${d.name}` : `You’re at ${d.name}`;
    if (d.sector !== shipSector) return `${driveById(fallsBack ? 'super' : drive).verb} through the portal to ${d.name}`;
    return d.via ? `${driveById(fallsBack ? 'super' : drive).verb} to the gate, then ${d.name}` : `${driveById(fallsBack ? 'super' : drive).verb} to ${d.name}`;
  };
  // a link to a place (a universe, a wonder) that opens the map there
  const linkTo = (d) => (d.via ? null : `${window.location.origin}${window.location.pathname}#/universe/${d.id}`);
  const copy = (d) => {
    const url = linkTo(d);
    if (!url) return;
    const fail = () => setCopied(`fail:${d.id}`); // (no clipboard here, or no leave to use it: the link shows instead)
    if (!navigator.clipboard?.writeText) return fail();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(d.id);
      setTimeout(() => setCopied(null), 1800);
    }, fail);
  };

  // the list, in sections by kind while it's every place
  const groups = kind === 'all' && !query.trim() ? KINDS.filter((k) => k.id !== 'all').map((k) => ({ k, items: list.filter((d) => d.kind === k.id) })).filter((g) => g.items.length) : [{ k: null, items: list }];
  const jumpLine = hyper.ready || hyper.why === 'charging' ? jumpState(hyper.ready, hyper.wait) : WHY[hyper.why];

  return createPortal(
    <div className="navmap dark-scope" role="dialog" aria-modal="true" aria-labelledby="navmap-title" style={{ '--pick': picked?.color ?? '#9fd8ff' }}>
      <div className="navmap-frame">
        <header className="navmap-head">
          <div className="navmap-headline">
            <p className="navmap-kicker">{NAV.kicker}</p>
            <h2 id="navmap-title" className="navmap-title">
              Where to?
            </h2>
          </div>
          <div className="navmap-views" role="group" aria-label={NAV.view}>
            {Object.values(CHART_VIEWS).map((c) => (
              <button key={c.id} type="button" aria-pressed={view === c.id} onClick={() => setView(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="navmap-head-tools">
            {live && flying && onWhole && (
              <button type="button" className="navmap-tool" onClick={onWhole} title="Pull back over the map in 3D">
                <RiEyeLine className="h-4 w-4" aria-hidden="true" /> <span>{NAV.back}</span>
              </button>
            )}
            {live && canFly && onTour && (
              <button type="button" className="navmap-tool" onClick={onTour} title={FLY_PAST.title} aria-label={FLY_PAST.name}>
                <RiRouteLine className="h-4 w-4" aria-hidden="true" /> <span>{FLY_PAST.short}</span>
              </button>
            )}
            <button ref={close} type="button" className="navmap-close" onClick={onClose} aria-label="Close the nav map">
              <RiCloseLine className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="navmap-body">
          <div className="navmap-stage">
            <div ref={chartEl} className="navmap-chart" data-view={view}>
              <canvas ref={canvas} className="navmap-canvas" aria-hidden="true" />
              <svg className="navmap-svg" viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
                <defs>
                  <radialGradient id="navmap-cloud">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.42" />
                    <stop offset="0.6" stopColor="currentColor" stopOpacity="0.14" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="navmap-sun">
                    <stop offset="0" stopColor="#fff4d6" />
                    <stop offset="0.3" stopColor="#ffc56e" />
                    <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="navmap-homeglow">
                    <stop offset="0" stopColor="#ffcf8a" stopOpacity="0.1" />
                    <stop offset="1" stopColor="#ffcf8a" stopOpacity="0.02" />
                  </radialGradient>
                  <linearGradient id="navmap-cone" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#cfe9ff" stopOpacity="0.32" />
                    <stop offset="1" stopColor="#cfe9ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* the bezel */}
                <g className="navmap-bezel">
                  {TICKS.map((t, i) => (
                    <path key={i} d={t.d} data-major={t.major || undefined} />
                  ))}
                </g>
                {/* range rings, and the edge of the map */}
                {view !== 'home' ? (
                  <>
                    {[1000, 2000, 3000, 4000, 5000, 6000].filter((r) => r < SECTORS[sector].edge).map((r) => (
                      <circle key={r} cx={V / 2} cy={V / 2} r={chartRadius(r, chart) * V} className="navmap-ring" />
                    ))}
                    <circle cx={V / 2} cy={V / 2} r={chartRadius(sector === 'main' ? EDGE : SECTORS[sector].edge, chart) * V} className="navmap-edge" />
                    {sector === 'main' && <circle cx={V / 2} cy={V / 2} r={homeR} className="navmap-home-ring" fill="url(#navmap-homeglow)" />}
                  </>
                ) : (
                  <>
                    <circle cx={V / 2} cy={V / 2} r={chartRadius((BELT.inner + BELT.outer) / 2, chart) * V} className="navmap-belt" strokeWidth={(chartRadius(BELT.outer, chart) - chartRadius(BELT.inner, chart)) * V} />
                    <circle cx={V / 2} cy={V / 2} r={homeR} className="navmap-edge" />
                  </>
                )}
                {sector === 'main' && <circle cx={V / 2} cy={V / 2} r={Math.max(9, chartRadius(SUN.r, chart) * V * 1.8)} fill="url(#navmap-sun)" />}
                {/* the wonders, as they are */}
                {view !== 'home' &&
                  DESTINATIONS.filter((d) => d.kind === 'wonder' && d.sector === sector).map((d) => {
                    const [x, y] = P(d.at);
                    const r = Math.max(6, sizeOn(out(d.at), d.reach, chart));
                    const dim = !shown.has(d.id);
                    if (d.type === 'Nebula') return <circle key={d.id} cx={x} cy={y} r={r} fill="url(#navmap-cloud)" style={{ color: d.color }} opacity={dim ? 0.3 : 1} />;
                    if (d.type === 'Black hole')
                      return (
                        <g key={d.id} opacity={dim ? 0.3 : 1}>
                          <circle cx={x} cy={y} r={r} className="navmap-pull" />
                          <ellipse cx={x} cy={y} rx={r * 0.55} ry={r * 0.22} fill="none" stroke="#ffb070" strokeWidth="2" strokeOpacity="0.8" />
                          <circle cx={x} cy={y} r={r * 0.22} fill="#000" stroke="#ffd9a8" strokeWidth="1" />
                        </g>
                      );
                    if (d.type === 'Star') return <circle key={d.id} cx={x} cy={y} r={r} className="navmap-system" style={{ color: d.color }} opacity={dim ? 0.3 : 1} />;
                    if (d.type === 'Portal') return <circle key={d.id} cx={x} cy={y} r={Math.max(9, r)} className="navmap-portal" style={{ color: d.color }} opacity={dim ? 0.3 : 1} />;
                    return null;
                  })}
                {/* the crew's war (front.js): its sectors in a line, each in the colour of the side
                    that holds it, and the front where they meet, a battle going on there */}
                {view === 'all' && now?.front && (
                  <g className="navmap-war">
                    <polyline points={now.front.sectors.map((sec) => P(sec.at).join(',')).join(' ')} className="navmap-war-line" />
                    {now.front.sectors.map((sec, i) => {
                      const [x, y] = P(sec.at);
                      return <circle key={sec.id} cx={x} cy={y} r={(i === now.front.contested ? 6 : 4) * unit} fill={now.front.colours[sec.owner]} className="navmap-war-sector" />;
                    })}
                    <circle cx={P(now.front.at)[0]} cy={P(now.front.at)[1]} r={11 * unit} className="navmap-war-front" />
                  </g>
                )}
                {/* the course: where it's going (and how), or to the place picked, and a sight on its end */}
                {shipAt && courseAt && (
                  <>
                    {/* (drawn in screen pixels, so its dashes and weight are the same on a phone as on a desk) */}
                    <g transform={`scale(${unit})`}>
                      <line x1={shipAt[0] / unit} y1={shipAt[1] / unit} x2={P(courseAt)[0] / unit} y2={P(courseAt)[1] / unit} className="navmap-course" data-drive={goingTo && course === goingTo ? now.going.drive : 'plot'} />
                    </g>
                    {/* (not over the place picked itself: its name's chip marks it already) */}
                    {!(course === picked && courseAt === picked.at) && (
                      <g className="navmap-target" transform={`translate(${P(courseAt)[0]} ${P(courseAt)[1]}) scale(${unit})`}>
                        <circle r="13" />
                        <path d="M0 -19 V-14 M0 14 V19 M-19 0 H-14 M14 0 H19" />
                      </g>
                    )}
                  </>
                )}
                {/* the other pilots online */}
                {(now?.pilots ?? []).map((p) => {
                  if (mapSectorOf(p.x, 0, p.z) !== sector) return null;
                  const [x, y] = P([p.x, 0, p.z]);
                  return onChart([x / V, y / V]) ? <rect key={p.id} x={-4} y={-4} width="8" height="8" className="navmap-pilot" transform={`translate(${x} ${y}) scale(${unit}) rotate(45)`} /> : null;
                })}
                {/* someone's fight out in deep space (farFights.js), seen from afar: a burst, named beside it */}
                {fights.map((f) => (
                  <g key={f.id} transform={`translate(${f.xy[0]} ${f.xy[1]}) scale(${unit})`} className="navmap-fight">
                    <circle r="8" className="navmap-fight-ring" />
                    <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" />
                  </g>
                ))}
                {/* you */}
                {shipAt && onChart([shipAt[0] / V, shipAt[1] / V]) && (
                  <g transform={`translate(${shipAt[0]} ${shipAt[1]}) scale(${unit}) rotate(${chartHeading(now.ship.heading)})`} className="navmap-ship">
                    <path d="M0 0 L64 -20 A67 67 0 0 1 64 20 Z" className="navmap-ship-cone" />
                    <circle r="14" className="navmap-ship-halo" />
                    <path d="M11 0 L-7 -7 L-3.5 0 L-7 7 Z" className="navmap-ship-mark" />
                  </g>
                )}
              </svg>
              {/* the places, as buttons over the chart */}
              <ul ref={placesEl} className="navmap-places" aria-label="Places">
                {view === 'all' && (
                  <li style={pct([V / 2, V / 2 + homeR])} data-kind="home" data-side="under" data-label={sideOf('home') ? undefined : 'off'}>
                    <button type="button" className="navmap-place navmap-homebtn" onClick={() => setView('home')}>
                      <span className="navmap-dot" aria-hidden="true" />
                      <span className="navmap-name">Home system</span>
                    </button>
                  </li>
                )}
                {marks.map(({ d, xy }) => {
                  const mine = pick === d.id || at(d.id);
                  const side = sideOf(d.id, mine);
                  return (
                    <li key={d.id} style={{ ...pct(xy), '--c': d.color }} data-dim={!shown.has(d.id) || undefined} data-kind={d.kind} data-type={d.kind === 'wonder' ? d.type.toLowerCase().replace(/\s+/g, '-') : undefined} data-side={side ?? undefined} data-label={side ? undefined : 'off'}>
                      <button
                        type="button"
                        className="navmap-place"
                        aria-pressed={pick === d.id}
                        aria-current={at(d.id) ? 'location' : undefined}
                        aria-label={`${d.name}, ${d.type}${at(d.id) ? ', you’re here' : ''}`}
                        onClick={() => choose(d.id)}
                        onDoubleClick={() => go(d.id)}
                      >
                        <span className="navmap-dot" aria-hidden="true" />
                        <span className="navmap-name">{d.name}</span>
                      </button>
                    </li>
                  );
                })}
                {/* the war's front, beside its ring */}
                {view === 'all' && now?.front && (
                  <li style={{ ...pct(P(now.front.at)), '--c': '#ffb347' }} data-kind="front" data-side={sideOf('front', true)}>
                    <button type="button" className="navmap-place navmap-frontbtn" disabled={!canFly} onClick={() => onTravel('front', drive)} title={canFly ? `${driveById(fallsBack ? 'super' : drive).verb} to the front` : 'Pick a ship to fly to the front'}>
                      <span className="navmap-dot" aria-hidden="true" />
                      <span className="navmap-name">The front · {now.front.name}</span>
                    </button>
                  </li>
                )}
                {/* the far fights' names, under or over their bursts where there's room */}
                {fights.map((f) =>
                  sideOf(`fight:${f.id}`) ? (
                    <li key={f.id} style={{ ...pct(f.xy), '--c': '#ff8a5c' }} data-kind="fight" data-side={sideOf(`fight:${f.id}`)}>
                      <span className="navmap-place navmap-fightname">
                        <span className="navmap-dot" aria-hidden="true" />
                        <span className="navmap-name">{f.label}</span>
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
              {view === 'home' && (
                <button type="button" className="navmap-out" onClick={() => setView('all')}>
                  <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> {NAV.out}
                </button>
              )}
              {/* in the Rick and Morty sector: the way home */}
              {view === 'rickmorty' && (
                <button type="button" className="navmap-out" onClick={() => (canFly && shipSector === 'rickmorty' ? onTravel('rmportal-back', drive) : setView('all'))}>
                  <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> {canFly && shipSector === 'rickmorty' ? 'Back through the portal' : NAV.out}
                </button>
              )}
            </div>
          </div>

          <aside className="navmap-side">
            {/* the ship */}
            <div className="navmap-status" aria-live="polite">
              {flying ? (
                <>
                  <div className="navmap-status-top">
                    <p className="navmap-kicker">Your ship</p>
                    <p className="navmap-jump" data-warn={!hyper.ready || undefined}>
                      {jumpLine}
                    </p>
                  </div>
                  <p className="navmap-where">{atId ? `At ${destinationById(atId).name}` : here ? `${formatDistance(here.gap)} from ${here.d.name}` : 'Deep space'}</p>
                  <p className="navmap-meta">
                    {now.foot ? 'You’re out on foot' : speedWord(now.ship.speed)}
                    {goingTo && !now.foot ? `, ${now.going.drive === 'hyper' ? 'jumping' : 'on the way'} to ${goingTo.name}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="navmap-kicker">No ship</p>
                  <p className="navmap-meta">The camera takes you to a station or a world. Pick a ship in the panel to fly yourself, anywhere, by any drive.</p>
                </>
              )}
            </div>

            {picked ? (
              <div className="navmap-pick" aria-live="polite" style={{ '--c': picked.color }}>
                <button type="button" className="navmap-back" onClick={() => setPick(null)}>
                  <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> All places
                </button>
                <div className="navmap-pick-head">
                  <span className="navmap-orb" data-kind={picked.kind} aria-hidden="true" />
                  <div>
                    <p className="navmap-kicker">{picked.type}</p>
                    <h3 className="navmap-place-name">{picked.name}</h3>
                  </div>
                </div>
                <p className="navmap-about">{picked.about}</p>
                {flying && (
                  <dl className="navmap-stats">
                    <div>
                      <dt>Distance</dt>
                      <dd>{formatDistance(distanceTo(now.ship, picked.id))}</dd>
                    </div>
                    <div>
                      <dt>By {driveById(fallsBack ? 'super' : drive).name.toLowerCase()}</dt>
                      <dd>{at(picked.id) ? 'You’re here' : formatTime(times[fallsBack ? 'super' : drive])}</dd>
                    </div>
                  </dl>
                )}
                {/* the drives, beside the button that goes by them */}
                {flying && (
                  <>
                    <div className="navmap-drives" role="radiogroup" aria-label="Drive">
                      {DRIVES.map((d) => {
                        const Icon = ICONS[d.id];
                        const t = !at(picked.id) ? times[d.id] : undefined;
                        return (
                          <button key={d.id} type="button" role="radio" aria-checked={drive === d.id} className="navmap-drive" data-drive={d.id} onClick={() => onDrive(d.id)} title={d.about}>
                            <Icon className="navmap-drive-icon" aria-hidden="true" />
                            <span className="navmap-drive-name">{d.name}</span>
                            <span className="navmap-drive-time">{t === undefined ? (d.id === 'hyper' ? 'instant' : d.id === 'super' ? '3×' : '1×') : t === null ? '—' : formatTime(t)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="navmap-drive-about">{driveById(drive).about}</p>
                    {fallsBack && <p className="navmap-note">{hyper.why === 'charging' ? `The jump is charging (${Math.ceil(hyper.wait)} s)` : JAMMED.long.replace(/\.[^.]*\.$/, '')}: till it’s ready, you’ll go at super speed.</p>}
                  </>
                )}
                <button type="button" className="btn btn-primary navmap-go" onClick={() => go()} disabled={!goable(picked)}>
                  {verb(picked)} {goable(picked) && <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />}
                </button>
                {picked.to && onEnter && (
                  <button type="button" className="btn btn-ghost navmap-enter" onClick={() => onEnter(picked.id)}>
                    {picked.via ? `Jump straight to ${picked.name}` : at(picked.id) ? 'Go in' : 'Skip the trip: straight in'}
                  </button>
                )}
                {linkTo(picked) && (
                  <button type="button" className="navmap-copy" onClick={() => copy(picked)} title={linkTo(picked)}>
                    <RiLinkM className="h-3.5 w-3.5" aria-hidden="true" /> {copied === picked.id ? 'Link copied' : copied === `fail:${picked.id}` ? `Couldn’t copy: ${linkTo(picked)}` : 'Copy a link here'}
                  </button>
                )}
              </div>
            ) : (
              <div className="navmap-list-box">
                <div className="navmap-find">
                  <label className="navmap-search">
                    <RiSearchLine className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Find a place</span>
                    <input
                      ref={search}
                      type="search"
                      value={query}
                      placeholder={NAV.find}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && list[0]) {
                          e.preventDefault();
                          pickFromList(list[0]);
                        }
                      }}
                    />
                  </label>
                  <div className="navmap-kinds" role="group" aria-label="Show">
                    {KINDS.map((k) => (
                      <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                        {k.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="navmap-list-head">
                  <p className="navmap-kicker">{list.length === DESTINATIONS.length ? 'Every place' : `${list.length} ${list.length === 1 ? 'place' : 'places'}`}</p>
                  {flying && list.length > 0 && <p className="navmap-kicker navmap-unit">{NAV.lengths}</p>}
                </div>
                {list.length ? (
                  groups.map(({ k, items }) => (
                    <section key={k?.id ?? 'found'} className="navmap-group" aria-label={k?.name}>
                      {k && <p className="navmap-group-name">{k.name}</p>}
                      <ul className="navmap-list">
                        {items.map((d) => (
                          <li key={d.id} data-kind={d.kind}>
                            <button type="button" onClick={() => pickFromList(d)} style={{ '--c': d.color }} aria-current={at(d.id) ? 'location' : undefined}>
                              <span className="navmap-dot" aria-hidden="true" />
                              <span className="navmap-list-name">{d.name}</span>
                              <span className="navmap-list-meta">{at(d.id) ? 'Here' : flying ? shortDistance(distanceTo(now.ship, d.id)) : d.type}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                ) : (
                  <p className="navmap-meta">Nothing by that name. Try a world (Marvel), a page (Projects) or a kind of thing (nebula).</p>
                )}
              </div>
            )}
            <p className="navmap-keys">
              <kbd className="kbd" data-size="sm">
                M
              </kbd>{' '}
              opens and closes the nav map. Flying,{' '}
              <kbd className="kbd" data-size="sm">
                J
              </kbd>{' '}
              jumps to the place picked
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
