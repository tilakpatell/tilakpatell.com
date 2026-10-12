import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiCloseLine } from 'react-icons/ri';
import { BUDGETS, LEVELS, clearCap, quality, setQuality } from '../../lib/device';
import { setMode3D } from '../../lib/gpu';
import { setSound, setVoicesOn, setVolumes } from '../../lib/audio';
import { applyMotion, heldLine, read, write } from './settings.js';
import DeviceReadout from './DeviceReadout';
import Video from './Video.jsx';
import { useVideo } from './useVideo.js';
import { Row, Segmented, Slider } from './parts.jsx';
import { write as writeVideo } from '../../lib/video.js';
import '../../styles/lazy/settings.css';

// The settings panel: one for the whole site (in the spirit of Bruno
// Simon's folio, a calm sheet with a few plain controls and a live readout
// of what the machine is doing). Opened by the gear beside the colours,
// ⌘K's "Settings" and lib/palette's openSettings(); Escape, the close button
// or a press outside closes it. A dialog on a desktop, a sheet from the
// bottom on a phone (settings.css). Each change is kept (settings.js) and
// heard at once: the quality by the world that's up (it retunes, or asks to
// be reloaded), the sound by lib/audio, 3D by lib/gpu.

const LABEL = { auto: 'Auto', low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };

// the focusable things in the sheet, for keeping Tab inside it
const focusables = (el) => [...el.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);

export default function Settings({ onClose }) {
  const [s, setS] = useState(read);
  const [q, setQ] = useState(quality);
  const [reload, setReload] = useState(null); // { level, world } when the world that's up can't retune
  const sheet = useRef(null);
  const qualityHint = useId();

  // focus in, kept in, and given back on the way out; Escape closes
  useEffect(() => {
    const back = document.activeElement;
    const into = requestAnimationFrame(() => sheet.current?.querySelector('[aria-checked="true"], button')?.focus({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && sheet.current) {
        const all = focusables(sheet.current);
        if (!all.length) return;
        const [first, last] = [all[0], all.at(-1)];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!sheet.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(into);
      window.removeEventListener('keydown', onKey, true);
      html.style.overflow = overflow;
      if (back instanceof HTMLElement) back.focus({ preventScroll: true });
    };
  }, [onClose]);

  // the world that's up couldn't retune: offer to build it again
  useEffect(() => {
    const onReload = (e) => setReload(e.detail);
    window.addEventListener('tp:quality-reload', onReload);
    return () => window.removeEventListener('tp:quality-reload', onReload);
  }, []);

  // (a video control that is not live: the world is built once, as a quality
  // change on a world that cannot retune; the same reload offer)
  const needsReload = () => setReload({ level: q.level, world: null, video: true });

  const change = (patch) => {
    const next = write(patch);
    setS(next);
    if ('quality' in patch) {
      setReload(null);
      setQuality(next.quality);
      setQ(quality());
      // (a preset is a whole row of the picture's controls: the overrides go, lane V1)
      writeVideo({ preset: next.quality === 'auto' ? null : next.quality });
    }
    if ('three' in patch) setMode3D(next.three);
    if ('sound' in patch) setSound(next.sound);
    if ('voicesOn' in patch) setVoicesOn(next.voicesOn);
    if ('volume' in patch || 'music' in patch || 'voices' in patch) setVolumes({ master: next.volume, music: next.music, voices: next.voices });
    if ('sharpness' in patch) window.dispatchEvent(new CustomEvent('tp:sharpness', { detail: next.sharpness }));
    if ('motion' in patch) applyMotion(next.motion);
  };

  const video = useVideo();
  const ceiling = BUDGETS[q.level]?.ratio ?? 2;
  const qualityOptions = [['auto', `Auto · ${LABEL[q.auto]}`], ...LEVELS.map((l) => [l, LABEL[l]])];

  return (
    <div className="settings-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheet} className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            <RiCloseLine aria-hidden="true" />
          </button>
        </header>

        <div className="settings-body">
          <section aria-labelledby="settings-graphics">
            <h3 id="settings-graphics">Graphics</h3>
            <Row
              title="Quality"
              badge={video.custom ? 'Custom' : null}
              id={qualityHint}
              hint={
                q.pinned
                  ? `The address (?quality=${q.level}) pins ${LABEL[q.level]} for this visit; take it out of the address to choose here.`
                  : q.mode === 'auto'
                  ? `Auto picks ${LABEL[q.auto]} on this machine${q.capped ? '. A level you pick yourself is never held down.' : '.'}`
                  : `${LABEL[q.level]}, picked by you: never lowered on its own. Auto would pick ${LABEL[q.auto]}.`
              }
            >
              <Segmented label="Quality" value={q.mode} options={qualityOptions} onChange={(v) => change({ quality: v })} describedBy={qualityHint} disabled={q.pinned} />
              {q.capped && heldLine(q.capped) && (
                <p className="settings-reload" role="status">
                  {heldLine(q.capped)}{' '}
                  <button type="button" className="settings-link" onClick={() => {
                      clearCap();
                      setQ(quality());
                    }}>
                    Try ultra again
                  </button>
                </p>
              )}
              {reload && (
                <p className="settings-reload" role="status">
                  This world builds its detail once.{' '}
                  <button type="button" className="settings-link" onClick={() => {
                      setReload(null);
                      window.dispatchEvent(new Event('tp:world-reload'));
                    }}>
                    {reload.video ? 'Reload it with these settings' : `Reload it at ${LABEL[reload.level]}`}
                  </button>
                </p>
              )}
            </Row>
            <Row title="3D" hint="Auto draws in 3D wherever the browser can. Off keeps every page flat.">
              <Segmented label="3D" value={s.three} options={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]} onChange={(v) => change({ three: v })} />
            </Row>
            <Row title="Render resolution" hint={`The picture drawn at this share of the screen’s pixels, up to ${LABEL[q.level]}’s ${ceiling}×.`}>
              <Slider label="Render resolution" value={s.sharpness} min={0.5} max={2} step={0.25} onChange={(v) => change({ sharpness: v })} show={(v) => `${Math.round(v * 100)}%`} />
            </Row>
            <Row title="Motion" hint="Auto follows your system’s setting. Reduced calms the page’s animations.">
              <Segmented label="Motion" value={s.motion === 'reduced' ? 'reduced' : 'auto'} options={[['auto', 'Auto'], ['reduced', 'Reduced']]} onChange={(v) => change({ motion: v })} />
            </Row>
          </section>

          <Video onNeedsReload={needsReload} />

          <section aria-labelledby="settings-sound">
            <h3 id="settings-sound">Sound</h3>
            <Row title="Sound">
              <Segmented label="Sound" value={s.sound ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={(v) => change({ sound: v === 'on' })} />
            </Row>
            <Slider label="Everything" value={s.volume} disabled={!s.sound} onChange={(v) => change({ volume: v })} />
            <Slider label="Music" value={s.music} disabled={!s.sound} onChange={(v) => change({ music: v })} />
            <Row title="Voices" hint="Off, nobody speaks aloud: what they say still shows.">
              <Segmented label="Voices" value={s.voicesOn ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={(v) => change({ voicesOn: v === 'on' })} disabled={!s.sound} />
            </Row>
            <Slider label="Voices" value={s.voices} disabled={!s.sound || !s.voicesOn} onChange={(v) => change({ voices: v })} />
          </section>

          <section aria-labelledby="settings-controls">
            <h3 id="settings-controls">Controls</h3>
            <ul className="settings-links">
              <li>
                <Link to="/universe" onClick={onClose}>
                  Flight settings
                </Link>
                <span>on the universe map, press <kbd>O</kbd></span>
              </li>
              <li>
                <Link to="/avengers" onClick={onClose}>
                  The compound’s settings
                </Link>
                <span>in the Avengers compound, press <kbd>O</kbd></span>
              </li>
            </ul>
          </section>

          <section aria-labelledby="settings-data">
            <h3 id="settings-data">Data</h3>
            <Row title="Ask before a big download" hint="On a phone, with Data Saver on or on a weak device, a heavy world waits for you to say. It always asks when storage is short.">
              <Segmented label="Ask before a big download" value={s.askBigDownload ? 'ask' : 'load'} options={[['ask', 'Ask'], ['load', 'Just load']]} onChange={(v) => change({ askBigDownload: v === 'ask' })} />
            </Row>
          </section>

          <section aria-labelledby="settings-device">
            <h3 id="settings-device">About this device</h3>
            <DeviceReadout />
          </section>
        </div>
      </div>
    </div>
  );
}

