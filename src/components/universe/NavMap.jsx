import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiEyeLine, RiFlashlightFill, RiLinkM, RiRocket2Fill, RiRouteLine, RiSearchLine, RiSpeedUpFill } from 'react-icons/ri';
import { CHART_VIEWS, DESTINATIONS, DRIVES, KINDS, chartAt, chartHeading, chartRadius, destinationById, distanceTo, driveById, findDestinations, formatDistance, formatTime, goalOf, onChart, portalBetween, speedWord, tripTime, viewFor } from './nav';
import { BELT, HOME_RADIUS, SECTORS, SUN, mapSectorOf } from './layout';
import { EDGE } from './ship';
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
// Drawn into <body> over everything, as a dialog: a canvas of stars under
// an SVG of the rings, the wonders and the course, with a button per place
// over that (Tab through, Enter to pick, Enter again to go). `where()` is
// the scene's (scene.js), read a few times a second while it's open.

const V = 1000; // the SVG's units across
const ICONS = { hyper: RiFlashlightFill, super: RiSpeedUpFill, cruise: RiRocket2Fill };
// names that'd sit on a neighbour's (on the universe chart): under their dot instead
const UNDER = new Set(['maw', 'glacia']);
const WHY = { interdicted: JAMMED.short, charging: 'Charging' };
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
  glow.addColorStop(0, 'rgba(255,200,130,0.16)');
  glow.addColorStop(0.18, 'rgba(120,150,255,0.07)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  let s = 271828;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const b = 0.15 + rand() * 0.55;
    g.fillStyle = `rgba(${200 + Math.round(rand() * 55)},${210 + Math.round(rand() * 40)},255,${b.toFixed(3)})`;
    const r = rand() < 0.05 ? 1.2 : 0.6;
    g.fillRect(rand() * w, rand() * h, r, r);
  }
}

// how big a thing `reach` across, `d` out from the middle, looks on the chart (SVG units)
const sizeOn = (d, reach, view) => ((chartRadius(d + reach, view) - chartRadius(Math.max(0, d - reach), view)) / 2) * V;

// which sector's chart the ship's on (the main map's, with no ship, and out
// in the Expanse)
const sectorAt = (ship) => (ship ? mapSectorOf(ship.x, ship.y ?? 0, ship.z) : 'main');

export default function NavMap({ where, drive, onDrive, selected = null, live = false, onTravel, onEnter, onWhole, onTour, onClose }) {
  const [now, setNow] = useState(() => where?.() ?? null);
  const [view, setView] = useState(() => viewFor(sectorAt(now?.ship)));
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  // (what the page has picked, unless that's where the ship is already)
  const [pick, setPick] = useState(() => (selected && destinationById(selected) && selected !== now?.at ? selected : null));
  const [times, setTimes] = useState({});
  const [copied, setCopied] = useState(null); // the place whose link was just copied
  const canvas = useRef(null);
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
  const shown = useMemo(() => new Set(findDestinations(kind, query).map((d) => d.id)), [kind, query]);
  const list = useMemo(() => findDestinations(kind, query), [kind, query]);

  // the stars, once (and again on a resize)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => paintStars(c);
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
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

  const P = (at3) => chartAt(at3[0], at3[2], chart).map((v) => v * V);
  const pct = ([u, v]) => ({ left: `${(u / V) * 100}%`, top: `${(v / V) * 100}%` });
  const shipAt = now?.ship && shipSector === sector ? P([now.ship.x, 0, now.ship.z]) : null;
  const goingTo = now?.going ? destinationById(now.going.id) : null;
  const course = picked && !at(picked.id) ? picked : goingTo;
  const courseAt = course ? toward(course) : null;
  const homeR = chartRadius(HOME_RADIUS, chart) * V;

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

  return createPortal(
    <div className="navmap dark-scope" role="dialog" aria-modal="true" aria-labelledby="navmap-title" style={{ '--pick': picked?.color ?? '#9fd8ff' }}>
      <div className="navmap-frame dialog">
        <header className="navmap-head">
          <div>
            <p className="navmap-kicker">{NAV.kicker}</p>
            <h2 id="navmap-title" className="navmap-title">
              Where to?
            </h2>
          </div>
          <div className="navmap-head-tools">
            <div className="navmap-views" role="group" aria-label={NAV.view}>
              {Object.values(CHART_VIEWS).map((c) => (
                <button key={c.id} type="button" aria-pressed={view === c.id} onClick={() => setView(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
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

        <div className="navmap-filters">
          <div className="navmap-kinds" role="group" aria-label="Show">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.name}
              </button>
            ))}
          </div>
          <label className="navmap-search">
            <RiSearchLine className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Find a place</span>
            <input
              ref={search}
              type="search"
              value={query}
              placeholder="Find a place…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && list[0]) {
                  e.preventDefault();
                  setPick(list[0].id);
                  if (list[0].kind === 'station' && view !== 'home') setView('home');
                  else if (list[0].kind !== 'station') setView(viewFor(list[0].sector));
                }
              }}
            />
          </label>
        </div>

        <div className="navmap-body">
          <div className="navmap-chart">
            <canvas ref={canvas} className="navmap-canvas" aria-hidden="true" />
            <svg className="navmap-svg" viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
              <defs>
                <radialGradient id="navmap-cloud">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
                  <stop offset="0.6" stopColor="currentColor" stopOpacity="0.18" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="navmap-sun">
                  <stop offset="0" stopColor="#fff4d6" />
                  <stop offset="0.35" stopColor="#ffbf5e" />
                  <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* range rings, and the edge of the map */}
              {view !== 'home' ? (
                <>
                  {[1000, 2000, 3000, 4000, 5000, 6000].filter((r) => r < SECTORS[sector].edge).map((r) => (
                    <circle key={r} cx={V / 2} cy={V / 2} r={chartRadius(r, chart) * V} className="navmap-ring" />
                  ))}
                  <circle cx={V / 2} cy={V / 2} r={chartRadius(sector === 'main' ? EDGE : SECTORS[sector].edge, chart) * V} className="navmap-edge" />
                  {sector === 'main' && <circle cx={V / 2} cy={V / 2} r={homeR} className="navmap-home-ring" />}
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
                  if (d.type === 'Nebula') return <circle key={d.id} cx={x} cy={y} r={r} fill="url(#navmap-cloud)" style={{ color: d.color }} opacity={dim ? 0.35 : 1} />;
                  if (d.type === 'Black hole')
                    return (
                      <g key={d.id} opacity={dim ? 0.35 : 1}>
                        <circle cx={x} cy={y} r={r} className="navmap-pull" />
                        <ellipse cx={x} cy={y} rx={r * 0.55} ry={r * 0.22} fill="none" stroke="#ffb070" strokeWidth="2.5" />
                        <circle cx={x} cy={y} r={r * 0.22} fill="#000" stroke="#ffd9a8" strokeWidth="1" />
                      </g>
                    );
                  if (d.type === 'Star') return <circle key={d.id} cx={x} cy={y} r={r} className="navmap-system" style={{ color: d.color }} opacity={dim ? 0.35 : 1} />;
                  if (d.type === 'Portal') return <circle key={d.id} cx={x} cy={y} r={Math.max(9, r)} className="navmap-portal" style={{ color: d.color }} opacity={dim ? 0.35 : 1} />;
                  return null;
                })}
              {/* the crew's war (front.js): its sectors in a line, each in the colour of the side
                  that holds it, and the front where they meet, a battle going on there */}
              {view === 'all' && now?.front && (
                <g className="navmap-war">
                  <polyline points={now.front.sectors.map((sec) => P(sec.at).join(',')).join(' ')} className="navmap-war-line" />
                  {now.front.sectors.map((sec, i) => {
                    const [x, y] = P(sec.at);
                    return <circle key={sec.id} cx={x} cy={y} r={i === now.front.contested ? 7 : 4.5} fill={now.front.colours[sec.owner]} className="navmap-war-sector" />;
                  })}
                  <circle cx={P(now.front.at)[0]} cy={P(now.front.at)[1]} r="14" className="navmap-war-front" />
                </g>
              )}
              {/* the course: where it's going (and how), or to the place picked */}
              {shipAt && courseAt && (
                <line x1={shipAt[0]} y1={shipAt[1]} x2={P(courseAt)[0]} y2={P(courseAt)[1]} className="navmap-course" data-drive={goingTo && course === goingTo ? now.going.drive : 'plot'} />
              )}
              {/* the other pilots online */}
              {(now?.pilots ?? []).map((p) => {
                if (mapSectorOf(p.x, 0, p.z) !== sector) return null;
                const [x, y] = P([p.x, 0, p.z]);
                return onChart([x / V, y / V]) ? <rect key={p.id} x={x - 4} y={y - 4} width="8" height="8" className="navmap-pilot" transform={`rotate(45 ${x} ${y})`} /> : null;
              })}
              {/* someone's fight out in deep space (farFights.js), seen from afar: a burst, named in the list over the chart */}
              {fightsOn(now, sector, P).map((f) => (
                <g key={f.id} transform={`translate(${f.xy[0]} ${f.xy[1]})`} className="navmap-fight">
                  <circle r="9" className="navmap-fight-ring" />
                  <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
                </g>
              ))}
              {/* you */}
              {shipAt && onChart([shipAt[0] / V, shipAt[1] / V]) && (
                <g transform={`translate(${shipAt[0]} ${shipAt[1]}) rotate(${chartHeading(now.ship.heading)})`} className="navmap-ship">
                  <circle r="16" className="navmap-ship-halo" />
                  <path d="M13 0 L-8 -7.5 L-4 0 L-8 7.5 Z" />
                </g>
              )}
            </svg>
            {/* the places, as buttons over the chart */}
            <ul className="navmap-places" aria-label="Places">
              {view === 'all' && (
                <li style={pct([V / 2, V / 2 + homeR])} data-kind="home">
                  <button type="button" className="navmap-place navmap-homebtn" onClick={() => setView('home')}>
                    <span className="navmap-name">Home system</span>
                  </button>
                </li>
              )}
              {DESTINATIONS.map((d) => {
                if (view === 'all' && d.kind === 'station') return null;
                if (d.kind === 'system') return null; // (the galaxy's systems all sit at the gate: the list has them)
                if (d.sector !== sector) return null; // (the other sector's: on its own chart)
                const xy = P(d.at);
                if (!onChart([xy[0] / V, xy[1] / V])) return null;
                return (
                  <li key={d.id} style={{ ...pct(xy), '--c': d.color }} data-dim={!shown.has(d.id) || undefined} data-kind={d.kind} data-side={view === 'all' && UNDER.has(d.id) ? 'under' : xy[0] > V * 0.8 ? 'left' : undefined}>
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
              {/* the war's front: to the left of its dot (the wonders round it have their names to the right) */}
              {view === 'all' && now?.front && (
                <li style={{ ...pct(P(now.front.at)), '--c': '#ffb347' }} data-kind="front" data-side="left">
                  <button type="button" className="navmap-place navmap-frontbtn" disabled={!canFly} onClick={() => onTravel('front', drive)} title={canFly ? `${driveById(fallsBack ? 'super' : drive).verb} to the front` : 'Pick a ship to fly to the front'}>
                    <span className="navmap-name">The front · {now.front.name}</span>
                  </button>
                </li>
              )}
              {/* the far fights' names: under their bursts (a fight at a ramp sits by its place, whose name is to the right) */}
              {fightsOn(now, sector, P).map((f) => (
                <li key={f.id} style={{ ...pct(f.xy), '--c': '#ff8a5c' }} data-kind="fight">
                  <span className="navmap-place navmap-fightname">
                    <span className="navmap-name">{f.label}</span>
                  </span>
                </li>
              ))}
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

          <aside className="navmap-side" aria-live="polite">
            {/* the ship */}
            <div className="navmap-status">
              {flying ? (
                <>
                  <p className="navmap-kicker">Your ship</p>
                  <p className="navmap-where">{atId ? `At ${destinationById(atId).name}` : here ? `${formatDistance(here.gap)} from ${here.d.name}` : 'Deep space'}</p>
                  <p className="navmap-meta">
                    {now.foot ? 'You’re out on foot' : speedWord(now.ship.speed)}
                    {goingTo && !now.foot ? `, ${now.going.drive === 'hyper' ? 'jumping' : 'on the way'} to ${goingTo.name}` : ''}
                  </p>
                  <p className="navmap-meta" data-warn={!hyper.ready || undefined}>
                    {hyper.ready || hyper.why === 'charging' ? jumpState(hyper.ready, hyper.wait) : WHY[hyper.why]}
                  </p>
                </>
              ) : (
                <>
                  <p className="navmap-kicker">No ship</p>
                  <p className="navmap-meta">The camera takes you to a station or a world. Pick a ship in the panel to fly yourself, anywhere, by any drive.</p>
                </>
              )}
            </div>

            {/* the drives */}
            <div className="navmap-drives" role="radiogroup" aria-label="Drive">
              {DRIVES.map((d) => {
                const Icon = ICONS[d.id];
                const t = picked && flying && !at(picked.id) ? times[d.id] : undefined;
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
            {fallsBack && flying && <p className="navmap-note">{hyper.why === 'charging' ? `The jump is charging (${Math.ceil(hyper.wait)} s)` : JAMMED.long.replace(/\.[^.]*\.$/, '')}: till it’s ready, you’ll go at super speed.</p>}

            {picked ? (
              <div className="navmap-pick">
                <button type="button" className="navmap-back" onClick={() => setPick(null)}>
                  <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> All places
                </button>
                <p className="navmap-kicker">{picked.type}</p>
                <h3 className="navmap-place-name" style={{ color: picked.color }}>
                  {picked.name}
                </h3>
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
                <p className="navmap-kicker">{list.length === DESTINATIONS.length ? 'Every place' : `${list.length} ${list.length === 1 ? 'place' : 'places'}`}</p>
                {list.length ? (
                  <ul className="navmap-list">
                    {list.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPick(d.id);
                            if (d.kind === 'station' && view !== 'home') setView('home');
                            else if (d.kind !== 'station') setView(viewFor(d.sector));
                          }}
                          style={{ '--c': d.color }}
                          aria-current={at(d.id) ? 'location' : undefined}
                        >
                          <span className="navmap-dot" aria-hidden="true" />
                          <span className="navmap-list-name">{d.name}</span>
                          <span className="navmap-list-meta">{at(d.id) ? 'Here' : flying ? formatDistance(distanceTo(now.ship, d.id)) : d.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="navmap-meta">Nothing by that name. Try a world (Marvel), a page (Projects) or a kind of thing (nebula).</p>
                )}
              </div>
            )}
            <p className="navmap-keys">
              <kbd>M</kbd> opens and closes the nav map. Flying, <kbd>J</kbd> jumps to the place picked
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

