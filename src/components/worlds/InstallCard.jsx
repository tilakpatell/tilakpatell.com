import { RiCloseLine, RiDownloadCloud2Line, RiCheckLine } from 'react-icons/ri';
import { leftText, sizeText, timeText } from './usePack';

// The bar of an install in progress, in bytes, with the time left.
export function InstallBar({ progress, pack, label }) {
  const total = progress?.total ?? pack?.bytes ?? 0;
  const done = progress?.done ?? 0;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="install-bar-wrap">
      <div className="install-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="install-bar-text">
        {sizeText(done)} of {sizeText(total)}
        {progress?.eta != null ? ` · ${leftText(progress.eta)}` : ''}
      </p>
    </div>
  );
}

// A world's front door when it holds its 3D (WorldGate): its true size,
// Install, and once it's on this device, Open. Opening without installing
// and keeping the light version stay, as the old gate had them.
export function InstallCard({ name, why, state, pack, progress, error, onInstall, onOpen, onLight, onAlways }) {
  const size = sizeText(pack.bytes);
  const time = timeText(pack.bytes);
  return (
    <aside className="world-gate dialog" role="dialog" aria-modal="false" aria-labelledby="world-gate-title">
      <button type="button" className="world-gate-x" aria-label="Keep it light" onClick={onLight}>
        <RiCloseLine aria-hidden="true" />
      </button>
      <p id="world-gate-title" className="world-gate-title">
        {state === 'open' ? <RiCheckLine aria-hidden="true" /> : <RiDownloadCloud2Line aria-hidden="true" />} {state === 'open' ? `${name} is on this device` : `${name} is built in 3D`}
      </p>
      {state === 'open' ? (
        <p className="world-gate-text">It opens from here, no download. {why}</p>
      ) : (
        <p className="world-gate-text">
          Install it once ({size} of models, textures and sound, {time} on a fair connection) and it opens from this device after. {why} Until then you’re seeing the light version.
        </p>
      )}
      {state === 'installing' && <InstallBar progress={progress} pack={pack} label={`Installing ${name}`} />}
      {state === 'failed' && (
        <p className="world-gate-text world-gate-error" role="alert">
          {error} What’s here is kept: Try again picks up where it stopped.
        </p>
      )}
      <div className="world-gate-actions">
        {state === 'open' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpen}>
            Open
          </button>
        ) : state === 'installing' ? null : (
          <button type="button" className="btn btn-primary btn-sm" onClick={onInstall}>
            {state === 'failed' ? 'Try again' : `Install · ${size} · ${time}`}
          </button>
        )}
        {state !== 'open' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>
            Open without installing
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLight}>
          Keep it light
        </button>
        {onAlways && state !== 'open' && (
          <button type="button" className="world-gate-always" onClick={onAlways}>
            Always load on this device
          </button>
        )}
      </div>
    </aside>
  );
}

// On a device that doesn't hold the world (a desktop), the offer to
// install a heavy one for next time: a pill, out of the way.
export function InstallPill({ state, pack, progress, onInstall, onClose }) {
  if (state === 'installing') {
    const pct = pack.bytes ? Math.round(((progress?.done ?? 0) / pack.bytes) * 100) : 0;
    return (
      <div className="world-gate-pill world-gate-pill-busy" role="progressbar" aria-label="Installing this world" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <RiDownloadCloud2Line aria-hidden="true" /> Installing · {pct}%
      </div>
    );
  }
  return (
    <div className="world-gate-pill-row">
      <button type="button" className="world-gate-pill" onClick={onInstall} title="Install it, and it opens from this device next time">
        <RiDownloadCloud2Line aria-hidden="true" /> {state === 'failed' ? 'Install stopped · Try again' : `Install · ${sizeText(pack.bytes)}`}
      </button>
      <button type="button" className="world-gate-pill-x" aria-label="Not now" onClick={onClose}>
        <RiCloseLine aria-hidden="true" />
      </button>
    </div>
  );
}
