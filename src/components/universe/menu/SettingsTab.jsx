import { useEffect, useState } from 'react';
import { FlightControls } from '../FlightSettings';
import { onSoundChange, onVoicesChange, setSound, setVoicesOn, soundOn, voicesOn } from '../../../lib/audio';
import { openSettings } from '../../../lib/palette';

// The flight menu's Settings tab: the flight settings (FlightSettings.jsx's
// controls, every change live and kept, as from the popover they were),
// sound and the crew's voices, the site's picture and device settings (its
// own dialog), and multiplayer (the corner's card: `onOnline`).

function Switch({ label, on, onChange }) {
  return (
    <label className="fm-toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SettingsTab({ controls, onControls, online = null, onOnline = null, onLeave }) {
  const [sound, setSoundState] = useState(soundOn);
  const [voices, setVoices] = useState(voicesOn);
  useEffect(() => onSoundChange(() => setSoundState(soundOn())), []);
  useEffect(() => onVoicesChange(() => setVoices(voicesOn())), []);
  const on = Boolean(online?.on);
  return (
    <div className="fm-settings">
      <section className="fm-set fm-set-flight" aria-label="Flying">
        <h3 className="fm-h">Flying</h3>
        {controls && onControls ? <FlightControls controls={controls} onChange={onControls} /> : <p className="fm-text fm-muted">With a ship, how it flies.</p>}
      </section>
      <div className="fm-set-side">
        <section className="fm-set" aria-label="Sound and picture">
          <h3 className="fm-h">Sound and picture</h3>
          <Switch label="Sound" on={sound} onChange={setSound} />
          <Switch label="The crew’s voices" on={voices} onChange={setVoicesOn} />
          <button
            type="button"
            className="fm-btn"
            onClick={() => {
              onLeave?.();
              openSettings();
            }}
          >
            Quality, sound levels and this device
          </button>
        </section>
        {onOnline && (
          <section className="fm-set" aria-label="Multiplayer">
            <h3 className="fm-h">Multiplayer</h3>
            <p className="fm-text">{on ? 'You’re online: everyone else here is in their own ship.' : 'Go online and everyone else here right now shows up, in their own ship.'}</p>
            <button
              type="button"
              className="fm-btn"
              onClick={() => {
                onLeave?.();
                onOnline();
              }}
            >
              {on ? 'Who’s online' : 'Go online'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
