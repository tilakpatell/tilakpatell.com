import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle, useMediaQuery } from '../lib/hooks';
import { PLANETS, planetSpecOf } from '../components/expanse/flight/planets';
import { WorldHost, useWorld } from '../runtime';
import { useInWorld, useOnline } from '../components/universe/online/useOnline';
import { wayOut } from '../components/worlds/worlds';
import FlightHud from '../components/expanse/flight/FlightHud';
import flightModule from '../components/expanse/flight/module';
import NotFound from './NotFound';
import '../components/expanse/flight/flight.css';

// The planets to fly to from the Menu: a spread of the fifty (expanse/flight/planets.js's PLANETS), one of each kind of ground
const NEXT_IDS = ['hoth', 'tatooine', 'endor', 'coruscant', 'bespin', 'mustafar', 'middle-earth', 'dot-matrix', 'gazorpazorp', 'cybertron'];
const NEXT = NEXT_IDS.map((id) => PLANETS.find((p) => p.id === id));

// A planet from low over its ground (/fly/hoth): the ship over an endless,
// streamed land, Echo Base flat among Hoth's ridges; /fly alone is Hoth.
// An unknown planet is the site's 404.
export default function Fly() {
  const { planet } = useParams();
  // (/fly alone is Hoth: where the tours and the map send you)
  const spec = useMemo(() => planetSpecOf(planet ?? 'hoth'), [planet]);
  if (!spec) return <NotFound />;
  // (a new planet is a new world: the key builds it again)
  return <Flight key={spec.id} spec={spec} />;
}

function Flight({ spec }) {
  useDocumentTitle(`${spec.name} · Planet flight`);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [toast, setToast] = useState(null);
  const numbers = useRef({});
  const [props] = useState(() => ({ spec }));

  const onEvent = useCallback((e) => {
    if (e.type === 'hud') {
      const n = numbers.current;
      if (n.speed) n.speed.textContent = String(Math.round(e.speed));
      if (n.alt) n.alt.textContent = String(Math.max(0, Math.round(e.alt)));
    } else if (e.type === 'toast') setToast({ key: Date.now(), text: e.text, bad: true });
    // (the shared world's prompt: a render only when what it says changes)
    else if (e.type === 'shared') setShared((was) => (was && was.build === e.build && was.unbuild === e.unbuild && was.others === e.others ? was : e));
  }, []);
  const { host, status, rt } = useWorld(flightModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === flightModule ? rt.current.world : null), [rt]);
  const [shared, setShared] = useState(null);
  // the other pilots, while you're online (the site's switch and callsign, as the towns'); the roster's blocks aren't shown
  const online = useOnline();
  useInWorld(); // (the other pilots are ships over the planet: no page pointers over the canvas)
  const callsign = online?.on ? (online.name ?? null) : null;
  const blocked = useRef(null);
  blocked.current = (id) => online?.client?.peers?.get(id)?.blocked === true || Boolean(online?.isBlocked?.(id));
  useEffect(() => {
    if (status === 'on') api()?.shared?.join(callsign, (id) => blocked.current(id));
  }, [status, callsign, api]);
  const mapProps = useMemo(() => ({ spec, source: api }), [spec, api]);

  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="fly-stage">
        {status !== 'on' && <p className="fly-loading">Coming down over {spec.name}…</p>}
        <FlightHud
          name={spec.name}
          way={wayOut(pathname)}
          planets={NEXT.filter((p) => p.id !== spec.id)}
          onPlanet={(id) => navigate(`/fly/${id}`)}
          toast={toast}
          numbers={numbers}
          touch={touch}
          onStick={(x, y) => rt?.input?.setStick(x, y)}
          onThrottle={(v) => api()?.throttle?.(v)}
          shared={shared}
          onShared={(what) => {
            const w = api();
            if (w) w.shared[what](w.ship);
          }}
          online={online ? { on: Boolean(callsign), onJoin: () => online.goOnline(online.suggest()) } : null}
          map={mapProps}
        />
      </WorldHost>
    </div>
  );
}
