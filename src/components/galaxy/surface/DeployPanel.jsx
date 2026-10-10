import { useEffect, useRef, useState } from 'react';
import { HEROES, HILTS, SABER_COLORS, heroById, heroSpec, leanText, loadoutLine, skinsOf } from '../heroes';
import { STANCE_NAMES } from './combatRules';
import { MAX_MODS, MODS, MOD_IDS, PICKABLE, WEAPONS, withMods } from './weaponRules';
import { MAX_PERKS, PERKS, PERK_IDS } from '../perks';
import { ABILITIES, abilitiesOf } from './abilityRules';
import { GameIcon } from '../../../runtime/hud';
import { gameName } from '../../../lib/bf2017/strings';
import HeroStage from './HeroStage.jsx'; // (named in full: ./heroStage.js is beside it)
import { sidesOf, troopersFor } from './troopers';
import { standInLine } from './standIn';
import './flow.css';

// The deploy screen (the flow design's decision 2): which side of this
// world's war (its era's two: troopers.js's sidesOf) or the crews from
// elsewhere, then who: that side's heroes and the game's four trooper
// classes in the world's own kit (troopers.js), as cards; for a Jedi the blade's colour and the hilt
// (the strokes are the hero's own, the game's: gameStance.js); a 2017 hero's outfit, the game's own (heroes.js's
// SKINS); for the others the gun (weaponRules.js, the
// galaxy's and the ones from elsewhere, with their numbers) and up to two
// mods on it. Equip keeps the choice (pages/GalaxySurface.jsx writes it) and
// the world puts it on there and then (scene.js's setHero): no reload, you
// stay where you are. The tabs stay at the top and Equip at the bottom, the
// choice so far spelt out by it, however far down the list you are. The
// 2017 game's own icons for the guns, the heroes' weapons and their
// abilities, and its names for its heroes (src/lib/bf2017/), where it has them.
// A hero not on the game's rig yet (heroes.js's `soon`) shows with why, and
// can't be equipped.

const ARM = { saber: 'Lightsaber', bowcaster: 'Bowcaster', rifle: 'Blaster rifle', ee3: 'EE-3 carbine', blaster: 'DL-44', portal: 'Portal gun', laser: 'Laser pistol', revolver: 'Revolver', pistol: 'Pistol' };
const CLASS_ICON = { assault: '/battlefront/icons/UI/SVG/Classes/Class_Troopers_Assault_01.svg', heavy: '/battlefront/icons/UI/SVG/Classes/Class_Troopers_Heavy_01.svg', officer: '/battlefront/icons/UI/SVG/Classes/Class_Troopers_Officer_01.svg', specialist: '/battlefront/icons/UI/SVG/Classes/Class_Troopers_Specialist_01.svg' };
const num = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toString();

export default function DeployPanel({ hero, onChange, onClose, system = null, era = 'empire', stoodIn = null }) {
  const [pick, setPick] = useState(hero);
  const [tab, setTab] = useState('hero');
  const h = heroById(pick.id);
  const saber = h?.weapon === 'saber';
  // (the side the pick is on: a trooper's own, a hero's lean, or elsewhere)
  const sides = sidesOf(era);
  const sideOf = (x) => (x?.trooper ? (sides.find((s) => s.id === x.trooper.side)?.id ?? sides[0].id) : x?.side === 'elsewhere' ? 'elsewhere' : (sides.find((s) => s.stance === x?.lean)?.id ?? sides[0].id));
  const [side, setSide] = useState(() => sideOf(h));
  const here = side === 'elsewhere' ? [] : troopersFor(side, system);
  const roster = side === 'elsewhere' ? HEROES.filter((x) => x.side === 'elsewhere') : HEROES.filter((x) => x.side === 'galaxy' && x.lean === sides.find((s) => s.id === side)?.stance);
  const choose = (id) => {
    const next = here.find((x) => x.id === id) ?? heroById(id);
    setPick({ ...pick, id, skin: skinsOf(id)[0]?.id ?? null, color: next?.saber?.color ?? pick.color, hilt: next?.saber?.hilt ?? pick.hilt, stance: next?.saber?.stance ?? pick.stance ?? 'single', gun: next?.weapon === 'saber' ? 'saber' : next?.weapon, mods: [], ...(next?.trooper ? { kind: next.trooper.kind } : { kind: undefined }) });
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
    ['hero', 'Who'],
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
    <div className="surface-list surface-heroes" role="dialog" aria-label="Deploy">
      <div className="surface-heroes-head">
        <p className="surface-list-title">Deploy</p>
        <div className="surface-tabs" role="tablist" aria-label="Deploy">
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
            <div className="deploy-sides" role="radiogroup" aria-label="Side">
              {[...sides, { id: 'elsewhere', short: 'From elsewhere', icon: null }].map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={side === s.id} className={side === s.id ? 'surface-hilt deploy-side is-picked' : 'surface-hilt deploy-side'} onClick={() => setSide(s.id)}>
                  {s.icon && <img src={s.icon} alt="" width="28" height="28" />}
                  <span className="surface-hero-name">{s.short}</span>
                </button>
              ))}
            </div>
            {here.length > 0 && (
              <>
                <p className="surface-weapon-side">Troopers</p>
                <ul className="surface-hero-cards">
                  {here.map((x) => (
                    <li key={x.id}>
                      <button type="button" className={x.id === pick.id ? 'surface-hero deploy-class is-picked' : 'surface-hero deploy-class'} onClick={() => choose(x.id)} aria-pressed={x.id === pick.id}>
                        <span className="surface-hero-top">
                          <img src={CLASS_ICON[x.trooper.cls]} alt="" width="28" height="28" />
                          <span className="surface-hero-name">{x.name}</span>
                          {x.id === hero.id && <span className="surface-hero-on">On</span>}
                        </span>
                        <span className="surface-hero-arm">{WEAPONS[x.weapon]?.name ?? 'Blaster'}</span>
                        <span className="surface-hero-blurb">{x.blurb}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="surface-weapon-side">{side === 'elsewhere' ? 'From elsewhere' : 'Heroes'}</p>
            <ul className="surface-hero-cards">
              {roster.map((x) => {
                const ab = abilitiesOf(x);
                return (
                  <li key={x.id}>
                    <button type="button" className={x.id === pick.id ? 'surface-hero is-picked' : 'surface-hero'} onClick={() => choose(x.id)} aria-pressed={x.id === pick.id} data-soon={x.soon ? true : undefined} title={x.soon ?? undefined}>
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
                      {x.soon && <span className="surface-hero-soon">{x.soon}</span>}
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
            <p className="surface-list-title">Strokes</p>
            <p className="surface-hero-keys">{STANCE_NAMES[h?.saber?.stance] ?? STANCE_NAMES.single}: {h?.name}’s own strikes, blocks and dodges, the game’s, on its rules (the strike’s reach, the block’s stamina, two dodges a bar).</p>
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
          {/* (the body that came: Equip is never refused for a missing file, standIn.js) */}
          {stoodIn && pick.id === hero.id && <span className="deploy-note">{standInLine(h?.name ?? '', stoodIn)}</span>}
        </p>
        <button type="button" className="surface-help-btn" onClick={onClose}>
          {changed ? 'Cancel' : 'Close'}
        </button>
        <button type="button" className="surface-help-btn surface-hero-play" onClick={() => onChange(pick)} disabled={!changed || Boolean(h?.soon)} title={h?.soon ?? undefined}>
          {h?.soon ? 'Soon' : changed ? 'Equip' : 'Equipped'}
        </button>
      </div>
    </div>
  );
}
