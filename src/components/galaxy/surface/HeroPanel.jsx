import { useEffect, useRef, useState } from 'react';
import { HEROES, HILTS, SABER_COLORS, heroById, heroSpec, leanText, loadoutLine, skinsOf } from '../heroes';
import { STANCES, STANCE_IDS } from './combatRules';
import { MAX_MODS, MODS, MOD_IDS, PICKABLE, WEAPONS, withMods } from './weaponRules';
import { MAX_PERKS, PERKS, PERK_IDS } from '../perks';
import { ABILITIES, abilitiesOf } from './abilityRules';
import { GameIcon } from '../../../runtime/hud';
import { gameName } from '../../../lib/bf2017/strings';
import HeroStage from './HeroStage.jsx'; // (named in full: ./heroStage.js is beside it)

// Who you play as down here, and what's in your hand: the roster
// (heroes.js) as cards; for a Jedi the blade's colour, the hilt and the
// stance (combatRules.js); a 2017 hero's outfit, the game's own (heroes.js's
// SKINS); for the others the gun (weaponRules.js, the
// galaxy's and the ones from elsewhere, with their numbers) and up to two
// mods on it. Equip keeps the choice (pages/GalaxySurface.jsx writes it) and
// the world puts it on there and then (scene.js's setHero): no reload, you
// stay where you are. The tabs stay at the top and Equip at the bottom, the
// choice so far spelt out by it, however far down the list you are. The
// 2017 game's own icons for the guns, the heroes' weapons and their
// abilities, and its names for its heroes (src/lib/bf2017/), where it has them.

const ARM = { saber: 'Lightsaber', bowcaster: 'Bowcaster', rifle: 'Blaster rifle', ee3: 'EE-3 carbine', blaster: 'DL-44', portal: 'Portal gun', laser: 'Laser pistol', revolver: 'Revolver', pistol: 'Pistol' };
const SIDES = [
  ['galaxy', 'From the galaxy'],
  ['elsewhere', 'From elsewhere'],
];
const num = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toString();

export default function HeroPanel({ hero, onChange, onClose }) {
  const [pick, setPick] = useState(hero);
  const [tab, setTab] = useState('hero');
  const h = heroById(pick.id);
  const saber = h?.weapon === 'saber';
  const choose = (id) => {
    const next = heroById(id);
    setPick({ ...pick, id, skin: skinsOf(id)[0]?.id ?? null, color: next?.saber?.color ?? pick.color, hilt: next?.saber?.hilt ?? pick.hilt, stance: next?.saber?.stance ?? pick.stance ?? 'single', gun: next?.weapon === 'saber' ? 'saber' : next?.weapon, mods: [] });
  };
  const toggleMod = (id) => {
    const has = pick.mods?.includes(id);
    const mods = has ? pick.mods.filter((m) => m !== id) : [...(pick.mods ?? []), id].slice(-MAX_MODS);
    setPick({ ...pick, mods });
  };
  const togglePerk = (id) => {
    const has = pick.perks?.includes(id);
    const perks = has ? pick.perks.filter((m) => m !== id) : [...(pick.perks ?? []), id].slice(-MAX_PERKS);
    setPick({ ...pick, perks });
  };
  const changed = JSON.stringify(pick) !== JSON.stringify(hero);
  const guns = [h?.weapon, ...PICKABLE].filter((g, i, a) => g && g !== 'saber' && a.indexOf(g) === i);
  const stats = !saber && pick.gun ? withMods(pick.gun, pick.mods) : null;
  const looks = skinsOf(pick.id);
  // (the middle tab is the blade or the gun, whichever the pick carries; a
  // hero with outfits has a tab for them after their card)
  const tabs = [
    ['hero', 'Hero'],
    ...(looks.length > 1 ? [['look', 'Outfit']] : []),
    ['arms', saber ? 'Lightsaber' : 'Weapon'],
    ['perks', 'Perks'],
  ];
  const tabAt = (id) => tabs.findIndex(([t]) => t === id);
  // back to the top of the list on another tab
  const body = useRef(null);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [tab]);
  // Escape shuts it
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // ← and → along the tabs
  const tabKey = (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(tabAt(tab) + step + tabs.length) % tabs.length][0];
    setTab(next);
    e.currentTarget.parentNode?.querySelector(`#surface-tab-${next}`)?.focus();
  };
  return (
    <div className="surface-list surface-heroes" role="dialog" aria-label="Loadout">
      <div className="surface-heroes-head">
        <p className="surface-list-title">Loadout</p>
        <div className="surface-tabs" role="tablist" aria-label="Loadout">
          {tabs.map(([id, name]) => (
            <button key={id} id={`surface-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="surface-heroes-body" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={tabKey}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="surface-heroes-body" id="surface-heroes-body" role="tabpanel" aria-labelledby={`surface-tab-${tab}`} ref={body}>
        {tab === 'hero' && (
          <>
            {SIDES.map(([side, title]) => (
              <div key={side}>
                <p className="surface-weapon-side">{title}</p>
                <ul className="surface-hero-cards">
                  {HEROES.filter((x) => x.side === side).map((x) => {
                    const ab = abilitiesOf(x);
                    return (
                      <li key={x.id}>
                        <button type="button" className={x.id === pick.id ? 'surface-hero is-picked' : 'surface-hero'} onClick={() => choose(x.id)} aria-pressed={x.id === pick.id}>
                          <span className="surface-hero-top">
                            <span className="surface-hero-name">{gameName(`hero:${x.id}`, x.name)}</span>
                            {x.id === hero.id && <span className="surface-hero-on">On</span>}
                          </span>
                          <span className="surface-hero-arm">
                            <GameIcon name={`hero:${x.id}`} className="surface-game-icon is-arm" />
                            {ARM[x.weapon] ?? 'Blaster'}
                          </span>
                          <span className="surface-hero-powers">
                            <span><kbd>G</kbd> <GameIcon name={`ability:${ab.power}`} className="surface-game-icon" /> {ABILITIES[ab.power].name}</span>
                            <span><kbd>V</kbd> <GameIcon name={`ability:${ab.second}`} className="surface-game-icon" /> {ABILITIES[ab.second].name}</span>
                          </span>
                          <span className="surface-hero-blurb">{x.blurb}</span>
                          {leanText(x.lean) && (
                            <span className="surface-hero-lean" data-lean={x.lean}>
                              {leanText(x.lean)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
        {tab === 'look' && looks.length > 1 && (
          <div className="surface-saber">
            <HeroStage spec={heroSpec(pick)} />
            <p className="surface-list-title">Outfit</p>
            <ul className="surface-hilts">
              {looks.map((l) => (
                <li key={l.id}>
                  <button type="button" className={l.id === pick.skin ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, skin: l.id })} aria-pressed={l.id === pick.skin}>
                    <span className="surface-hero-name">{l.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="surface-hero-keys">The game’s own outfits for {h?.name}, on the same skeleton and moving the same way.</p>
          </div>
        )}
        {tab === 'arms' && saber && (
          <div className="surface-saber">
            <p className="surface-list-title">Blade</p>
            <div className="surface-swatches" role="radiogroup" aria-label="Blade colour">
              {SABER_COLORS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === pick.color} aria-label={c.name} title={c.name} className={c.id === pick.color ? 'surface-swatch is-picked' : 'surface-swatch'} style={{ '--blade': c.hex }} onClick={() => setPick({ ...pick, color: c.id })} />
              ))}
            </div>
            <p className="surface-list-title">Stance</p>
            <ul className="surface-hilts">
              {STANCE_IDS.map((id) => (
                <li key={id}>
                  <button type="button" className={id === pick.stance ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, stance: id })} aria-pressed={id === pick.stance}>
                    <span className="surface-hero-name">{STANCES[id].name}</span>
                    <span className="surface-hero-blurb">{STANCES[id].about}</span>
                    <span className="surface-stats">
                      <i>{STANCES[id].strokes.length} strokes</i>
                      <i>reach {num(STANCES[id].reach, 1)} m</i>
                      <i>{STANCES[id].strokes.reduce((a, s) => a + s.damage, 0)} hits a combo</i>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="surface-list-title">Hilt</p>
            <ul className="surface-hilts">
              {HILTS.map((x) => (
                <li key={x.id}>
                  <button type="button" className={x.id === pick.hilt ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, hilt: x.id })} aria-pressed={x.id === pick.hilt}>
                    <span className="surface-hero-name">{x.name}</span>
                    <span className="surface-hero-blurb">{x.about}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="surface-hero-keys">F a stroke (strokes chain; hold F for the heavy one, which breaks shields), hold C to block (a block as a swipe lands is a parry), X to dodge, R to throw, G {ABILITIES[abilitiesOf(h).power].name.toLowerCase()}: {ABILITIES[abilitiesOf(h).power].about} V {ABILITIES[abilitiesOf(h).second].name.toLowerCase()}: {ABILITIES[abilitiesOf(h).second].about}</p>
          </div>
        )}
        {tab === 'arms' && !saber && (
          <div className="surface-saber">
            {['galaxy', 'elsewhere'].map((side) => (
              <div key={side}>
                <p className="surface-weapon-side">{side === 'galaxy' ? 'From the galaxy' : 'From elsewhere'}</p>
                <ul className="surface-hilts">
                  {guns
                    .filter((g) => WEAPONS[g]?.side === side)
                    .map((g) => {
                      const w = WEAPONS[g];
                      return (
                        <li key={g}>
                          <button type="button" className={g === pick.gun ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => setPick({ ...pick, gun: g })} aria-pressed={g === pick.gun}>
                            <span className="surface-hero-name">
                              <GameIcon name={`weapon:${g}`} className="surface-game-icon is-arm" />
                              {w.name}
                              {g === h?.weapon ? ' · their own' : ''}
                            </span>
                            <span className="surface-hero-blurb">{w.about}</span>
                            <span className="surface-stats">
                              <i>{w.damage}{w.pellets ? `×${w.pellets}` : w.burst ? `×${w.burst}` : ''} dmg</i>
                              <i>{num(60 / w.every)} /min</i>
                              <i>{num(w.range)} m</i>
                              <i>{num(w.zoom, 1)}× sights</i>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
            <p className="surface-list-title">Mods (up to {MAX_MODS})</p>
            <ul className="surface-mods">
              {MOD_IDS.map((id) => (
                <li key={id}>
                  <button type="button" className={pick.mods?.includes(id) ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => toggleMod(id)} aria-pressed={Boolean(pick.mods?.includes(id))}>
                    <span className="surface-hero-name">{MODS[id].name}</span>
                    <span className="surface-hero-blurb">{MODS[id].about}</span>
                  </button>
                </li>
              ))}
            </ul>
            {stats && (
              <p className="surface-stats">
                <i>With mods:</i>
                <i>{stats.damage} dmg</i>
                <i>{num(60 / stats.every)} /min</i>
                <i>{num(stats.range)} m</i>
                <i>{num(stats.zoom, 1)}× sights</i>
                <i>heat {num(stats.heat * 100)}% a shot</i>
              </p>
            )}
            <p className="surface-hero-keys">
              F fires (bursts and pellets as the gun has them), hold the right button to aim down the sights, R vents the heat (overheated, hit the blue band for a perfect vent), X to dodge. G {ABILITIES[abilitiesOf(h).power].name.toLowerCase()}: {ABILITIES[abilitiesOf(h).power].about} V {ABILITIES[abilitiesOf(h).second].name.toLowerCase()}: {ABILITIES[abilitiesOf(h).second].about}
            </p>
          </div>
        )}
        {tab === 'perks' && (
          <div className="surface-saber">
            <p className="surface-list-title">Perks (up to {MAX_PERKS})</p>
            <ul className="surface-mods">
              {PERK_IDS.map((id) => (
                <li key={id}>
                  <button type="button" className={pick.perks?.includes(id) ? 'surface-hilt is-picked' : 'surface-hilt'} onClick={() => togglePerk(id)} aria-pressed={Boolean(pick.perks?.includes(id))}>
                    <span className="surface-hero-name">{PERKS[id].name}</span>
                    <span className="surface-hero-blurb">{PERKS[id].about}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="surface-hero-keys">Three cards, as a Battlefront hero carries: each bends one number of the fight.</p>
          </div>
        )}
      </div>
      <div className="surface-hero-actions">
        <p className="surface-hero-summary" aria-live="polite">
          <b>{h?.name}</b>
          <span>{loadoutLine(pick)}</span>
        </p>
        <button type="button" className="surface-help-btn" onClick={onClose}>
          {changed ? 'Cancel' : 'Close'}
        </button>
        <button type="button" className="surface-help-btn surface-hero-play" onClick={() => onChange(pick)} disabled={!changed}>
          {changed ? 'Equip' : 'Equipped'}
        </button>
      </div>
    </div>
  );
}
