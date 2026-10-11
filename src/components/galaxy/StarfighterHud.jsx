import { useEffect, useState } from 'react';
import { loadFamily } from '../../lib/bf2017/strings';
import { GameIcon } from '../../runtime/hud';
import { panelOf } from './surface/missions/starfighterHud';
import { playerKit } from './surface/missions/starfighterKits';

// Starfighter Assault's objective panel as the game draws it, over the
// galaxy's view while one is flown here (the sixth design's lane fighters,
// task 6): the phase's words in the game's own (its `spacebattles` strings),
// the remaining-objectives bar of the attacker or the defender with its
// phase health and a dot an objective, placed where the game's widget tree
// places them on the screen (missions/starfighterHud.js), your kit's
// abilities as the game's icons, and the last bot you shot down by name.
// WarHud.jsx keeps its line under it.
export default function StarfighterHud({ front = null }) {
  const [, tick] = useState(0);
  const [strings, setStrings] = useState({});
  const [viewport, setViewport] = useState(() => ({ width: globalThis.innerWidth ?? 1920, height: globalThis.innerHeight ?? 1080 }));
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    const size = () => setViewport({ width: innerWidth, height: innerHeight });
    addEventListener('resize', size);
    return () => (clearInterval(id), removeEventListener('resize', size));
  }, []);
  const info = front?.() ?? null;
  const flying = info?.laid?.kind === 'starfighter';
  useEffect(() => {
    if (!flying) return undefined;
    let live = true;
    loadFamily('spacebattles')
      .then((s) => live && setStrings(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [flying]);
  if (!flying) return null;
  const kit = playerKit(info.on?.starfighter?.level?.kits?.[info.team] ?? []);
  const p = panelOf(info, { viewport, strings, kit });
  if (!p) return null;
  const at = (b) => ({ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
  return (
    <div className="galaxy-sfhud" role="status" aria-label="Starfighter Assault objectives" data-attacking={p.attacking || undefined}>
      {p.text && (
        <p className="galaxy-sfhud-words" style={{ ...at(p.text), height: 'auto', color: p.text.colour ?? undefined, fontFamily: p.text.font.family, fontWeight: p.text.font.weight, fontSize: `${p.text.font.size * p.k}px` }}>
          {p.text.words}
        </p>
      )}
      <div className="galaxy-sfhud-bar" style={at(p.bar)} aria-label={`Phase ${p.phase}: ${p.percent}% of its objectives left`}>
        <span className="galaxy-sfhud-fill" style={{ '--k': p.k }} />
      </div>
      <span className="galaxy-sfhud-health" style={{ ...at(p.health), fontFamily: p.healthFont.family, fontWeight: p.healthFont.weight, fontSize: `${p.healthFont.size * p.k}px` }}>
        {p.percent}%
      </span>
      <span className="galaxy-sfhud-dots" role="list" style={at(p.dots)}>
        {p.dots.list.map((d) => (
          <span key={d.id} role="listitem" className="galaxy-sfhud-dot" data-down={d.down || undefined} title={d.name} aria-label={`${d.name}${d.down ? ': down' : ''}`} />
        ))}
      </span>
      {p.abilities.length > 0 && (
        <span className="galaxy-sfhud-abilities" aria-label="Your abilities">
          {p.abilities.map((a) => (
            <GameIcon key={a.id} name={a.icon} title={a.id.replace(/^(VehicleWeaponAbility_|Ability_)/, '').replace(/_/g, ' ')} />
          ))}
        </span>
      )}
      {p.downed && (
        <p className="galaxy-sfhud-downed">
          Shot down: {p.downed.name}
        </p>
      )}
    </div>
  );
}
