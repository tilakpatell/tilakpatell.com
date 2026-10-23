import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiDownloadCloud2Line } from 'react-icons/ri';
import { gpu, Hold3D } from '../../lib/gpu';
import { device, storageFree, worldCheck } from '../../lib/device';
import { local, storage } from '../../lib/hooks';
import { byPath } from '../universe/universes';
import { WORLD_MB, needsGpu, wayOut, worldAt } from './worlds';
import { FIT_KEY, readTry, starWarsFit } from '../../lib/fit';
import UnfitCard from './UnfitCard';
import { GpuHint } from './GpuHint';
import { browserOf, gpuHint, HINT_KEY, osOf } from '../../lib/gpuHint';
import { cardState, sizeText, usePack } from './usePack';
import { InstallCard, InstallPill } from './InstallCard';
import './worldgate.css';

// Before a world downloads its 3D on a device that would feel it (a phone
// and a heavy world, a weak device, Data Saver on, too little room left), it
// asks. Until the visitor says, the 3D is held (lib/gpu's Hold3D): the page
// shows its 2D versions and fetches no models or textures, and a card at the
// bottom says what loading would cost. "Load" lets the 3D in; "Keep it
// light" keeps the 2D for this visit, with a small button to change your
// mind; "Always load" remembers it on this device. Each world's weight is
// in worlds.js.
//
// Where the build made the world a pack (scripts/packs.mjs), the card is the
// install's front door (src/runtime/install.js): the pack's true size and
// time, Install with its bar, then Open, and Open at once when it's on this
// device already. A desktop isn't held: for a heavy world it's offered the
// install in a pill, for next time. Without packs (in development, or no
// Cache API) the card is the old one.

const ALWAYS = 'tp-worlds'; // 'load': never ask on this device
const choiceKey = (to) => `tp-world:${to}`; // 'load' | 'light', this visit
const offerKey = (to) => `tp-world-offer:${to}`; // 'no': the install pill closed, this visit

// the device with its graphics chip looked at, so a weak chip or software
// WebGL counts before anything starts downloading
const look = () => {
  gpu();
  return device();
};

const WHY = {
  phone: 'It works a phone’s graphics chip hard, and it’s a big download.',
  weak: 'This device may find it slow going, and it’s a big download.',
  software: 'This browser is drawing without the graphics chip, so it would be slow.',
  data: 'Data Saver is on, so it waits for you.',
  storage: 'This device is short on space, so it waits for you.',
};

// (a Star Wars world on a device lib/fit says cannot run it: the card
// instead of the page, so nothing of the world is fetched; ?software=on, or
// the card's Try anyway, kept for the visit, lets it in)
const fitFor = (pathname) => {
  if (!needsGpu(pathname)) return { ok: true, why: null };
  const { search, hash } = typeof window !== 'undefined' ? window.location : { search: '', hash: '' };
  return starWarsFit({ gpu: gpu(), device: look(), tryAnyway: readTry(search, hash, local.get(FIT_KEY) ?? storage.get(FIT_KEY)) });
};

// (the system and the browser, for the graphics hint's steps)
const where = () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = nav.userAgent ?? '';
  return { os: osOf({ ua, platform: nav.userAgentData?.platform ?? '' }), browser: browserOf(ua) };
};

// (lib/gpuHint: a built-in chip drawing on Windows or Linux)
const hintFor = () => {
  const g = gpu();
  return gpuHint({ renderer: g.renderer, software: g.software, phone: device().phone, os: where().os });
};

export default function WorldGate({ pathname, children }) {
  const [fit, setFit] = useState(() => fitFor(pathname));
  // (looked at after the first paint: gpu() makes a throwaway context; the
  // chip told is kept, so the hint floats over a world once a chip, while
  // the weak card below gives its steps whenever it is shown)
  const [chipHint, setChipHint] = useState(null);
  const [told, setTold] = useState(() => local.get(HINT_KEY));
  useEffect(() => setChipHint(hintFor()), []);
  const hint = chipHint && chipHint.chip !== told ? chipHint : null;
  const closeHint = () => {
    if (!chipHint) return;
    local.set(HINT_KEY, chipHint.chip);
    setTold(chipHint.chip);
  };
  useEffect(() => setFit(fitFor(pathname)), [pathname]);
  // (let in at once: the write is for the rest of the visit, and a blocked
  // storage keeps nothing, which must not keep the card up)
  const tryAnyway = () => {
    storage.set(FIT_KEY, 'on');
    setFit({ ok: true, why: null });
  };
  const world = worldAt(pathname);
  const to = world?.to ?? null;
  const mb = to ? WORLD_MB[to] ?? 1 : 0;
  // (a Rick and Morty planet, /c-137/<moon>, is C-137's world but goes by its own name)
  const moon = byPath(pathname);
  const name = moon?.kind === 'moon' ? moon.place : world?.label;
  // the check: at once from what the browser says (so nothing starts
  // downloading first), then again once it says how much room is left
  const [check, setCheck] = useState(() => (to ? worldCheck(mb, look()) : { ask: false }));
  const [choice, setChoice] = useState(() => (to ? (local.get(ALWAYS) === 'load' ? 'load' : storage.get(choiceKey(to))) : null));

  useEffect(() => {
    if (!to) {
      setCheck({ ask: false });
      return undefined;
    }
    let live = true;
    setCheck(worldCheck(mb, look()));
    setChoice(local.get(ALWAYS) === 'load' ? 'load' : storage.get(choiceKey(to)));
    storageFree().then((free) => {
      if (live) setCheck(worldCheck(mb, look(), free));
    });
    return () => {
      live = false;
    };
  }, [to, mb]);

  const load = useCallback(
    (always = false) => {
      if (!to) return;
      storage.set(choiceKey(to), 'load');
      if (always === true) local.set(ALWAYS, 'load');
      setChoice('load');
    },
    [to],
  );
  const light = () => {
    storage.set(choiceKey(to), 'light');
    setChoice('light');
  };

  const held = Boolean(to) && choice !== 'load' && check.ask;
  const p = usePack(to);
  const state = cardState({ held, pack: p.pack, installed: p.installed, busy: p.busy, error: p.error });
  const [offer, setOffer] = useState(true);
  useEffect(() => setOffer(storage.get(offerKey(to)) !== 'no'), [to]);
  const noOffer = () => {
    storage.set(offerKey(to), 'no');
    setOffer(false);
  };
  const hold = useMemo(() => (held ? { held: true, load: () => load(), mb, name } : null), [held, load, mb, name]);

  // outside <main>, so it sits over the page's own fixed buttons
  let prompt = null;
  if (held && choice === 'light') {
    prompt = (
      <button type="button" className="world-gate-pill" onClick={() => load()}>
        <RiDownloadCloud2Line aria-hidden="true" /> Load 3D · {p.pack ? sizeText(p.pack.bytes) : `${mb} MB`}
      </button>
    );
  } else if (held && p.pack) {
    prompt = <InstallCard name={name} why={WHY[check.why] ?? WHY.phone} state={state} pack={p.pack} progress={p.progress} error={p.error} onInstall={p.install} onOpen={() => load()} onLight={light} onAlways={() => load(true)} />;
  } else if (held) {
    prompt = (
      <aside className="world-gate dialog" role="dialog" aria-modal="false" aria-labelledby="world-gate-title">
        <button type="button" className="world-gate-x" aria-label="Keep it light" onClick={light}>
          <RiCloseLine aria-hidden="true" />
        </button>
        <p id="world-gate-title" className="world-gate-title">
          <RiDownloadCloud2Line aria-hidden="true" /> {name} is built in 3D
        </p>
        <p className="world-gate-text">
          About {mb} MB of models and textures. {WHY[check.why] ?? WHY.phone} Until then you’re seeing the light version.
        </p>
        <div className="world-gate-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => load()}>
            Load the 3D
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={light}>
            Keep it light
          </button>
          <button type="button" className="world-gate-always" onClick={() => load(true)}>
            Always load on this device
          </button>
        </div>
      </aside>
    );
  } else if (p.pack && offer && state !== 'open' && local.get(ALWAYS) !== 'load') {
    prompt = <InstallPill state={state} pack={p.pack} progress={p.progress} onInstall={p.install} onClose={noOffer} />;
  }

  if (!fit.ok) return <UnfitCard name={name ?? 'This world'} why={fit.why} way={wayOut(pathname)} onTry={tryAnyway} steps={fit.why === 'weak' && chipHint ? where() : null} />;
  // (over a world only, once a chip: the classic pages draw little)
  const gpuNote = world && hint ? <GpuHint chip={hint.chip} os={hint.os} browser={where().browser} onClose={closeHint} /> : null;
  return (
    <Hold3D.Provider value={hold}>
      {children}
      {prompt && createPortal(prompt, document.body)}
      {gpuNote && createPortal(gpuNote, document.body)}
    </Hold3D.Provider>
  );
}
