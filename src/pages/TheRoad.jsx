import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { WorldHost, useWorld } from '../runtime';
import roadModule from '../components/middleearth/road/module';
import '../styles/lazy/road.css';

// The Road through Middle-earth (/middle-earth/road, ?at=moria): one ride
// from Bag End to the Grey Havens on the world runtime, the HUD over it.
export default function TheRoad() {
  useDocumentTitle('The Road · Middle-earth');
  const [params] = useSearchParams();
  const reduced = useReducedMotion();
  // (the address is read once: the world keeps the ride after that)
  const [props] = useState(() => ({ at: params.get('at'), reduced }));
  const onEvent = useCallback(() => {}, []);
  const { host, status } = useWorld(roadModule, { props, onEvent });
  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="road-stage">
        <h1 className="sr-only">The Road</h1>
        {status !== 'on' && <p className="road-loading">The Road goes ever on…</p>}
      </WorldHost>
    </div>
  );
}
