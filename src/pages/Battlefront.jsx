import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { wayBack } from '../components/battlefront';
import { useDocumentTitle } from '../lib/hooks';
import { useInWorld } from '../components/universe/online/useOnline';
import { engineOnly } from '../components/battlefront/engine.js';
import { engineSupport, probeAdapter, probeBrowser } from '../lib/bf2web/engineSupport.js';
import play from '../data/bf2web/play.json';

// Battlefront is bf2-web's engine and game only (the owner, 2026-10-29): `/battlefront` and `/battlefront/<level>[/<mode>]`
// all open the engine's own page, which has the game's front end, levels and modes (docs/decisions/2026-10-28-hoth-on-
// bf2-web.md). The browser itself opens it, because its headers isolate it for the engine's threads. Where the engine can't
// run, the page says why, and no other world stands in. A galaxy world's ?from= goes on, so the engine's menu and end of
// round lead back there.
export default function Battlefront() {
  const { level } = useParams();
  const { search } = useLocation();
  const back = wayBack(search);
  useDocumentTitle(level ? `Battlefront · ${level[0].toUpperCase()}${level.slice(1)}` : 'Battlefront');
  useInWorld(); // (a full-screen game: no page pointers over it)
  // (the adapter's features and limits, read once, asynchronously, held to what the build's programs need: play.json's needs)
  const [adapter, setAdapter] = useState(null);
  useEffect(() => {
    if (adapter) return undefined;
    let live = true;
    probeAdapter().then((a) => live && setAdapter(a));
    return () => {
      live = false;
    };
  }, [adapter]);
  const support = adapter && engineSupport({ ...probeBrowser(window), ...adapter }, { beforeIsolation: true, needs: play.needs ?? null });
  const engine = engineOnly({ level: level ?? 'hoth', play, support, back });
  useEffect(() => {
    if (engine.go) window.location.assign(engine.go);
  }, [engine.go]);
  if (engine.unavailable)
    return (
      <main className="bf-page">
        <h1>Star Wars Battlefront II</h1>
        <p>This browser can’t run the game’s engine:</p>
        <ul>
          {engine.unavailable.map((why) => (
            <li key={why}>{why}</li>
          ))}
        </ul>
        <p>It needs a desktop browser with WebGPU on a discrete GPU. On Windows, set the browser to High performance under Settings › System › Display › Graphics.</p>
      </main>
    );
  return <main className="bf-page" aria-busy="true" />;
}
