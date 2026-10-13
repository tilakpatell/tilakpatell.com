import { GameIcon } from '../../../runtime/hud';
import { FACTION_NAMES, FACTION_SIDE, abilitiesFor, cardsFor, character, factionsOf, iconKey, label, picksFor, picksOf, portraitOf, skinsFor, stageSpec } from '../../../lib/bf2017/collection';
import { word } from '../../../lib/bf2017/ui/screens';
import { between, findBox, OFFLINE, percentOf, prune } from './tree';
import { useTree } from './useTree';
import CollectionStage from './CollectionStage.jsx';
import GameScreen from './GameScreen.jsx';

// One character's customisation, as the game's CustomizationScreen lays it:
// its menu down the left (the star cards for a hero, the appearances, the
// emotes, the victory poses, the voice lines; each with what is picked),
// the character in its picked skin on the hero-select stage, its name, its
// words and its abilities in the CharacterInfo box; a class's faction to
// pick above the menu (a class wears a look on each side).
//
// <CollectionCustomize id="luke" store={…} faction="empire" onFaction={f => …} onOpen={screen => …} onBack={…} />

const DRAWN = /^(CharacterInfo|LoadoutTabsWidget|FooterBar)$/;
const LISTS = new Set(['staticList', 'navigatableElementCollection', 'cell']);

export default function CollectionCustomize({ id, store, faction = null, onFaction, onOpen, onBack }) {
  const raw = useTree('CustomizationScreen');
  const tree = prune(raw, (b) => OFFLINE(b) || LISTS.has(b.type) || DRAWN.test(b.id.split('/').pop()));
  const c = character(id);
  const p = picksOf(store, id, { faction });
  const skins = skinsFor(id, { faction: p.faction });
  const skin = skins.find((s) => s.id === p.skin) ?? skins[0] ?? null;
  const hero = c?.kind === 'hero';
  const nameOf = (book, ids) => {
    const all = picksFor(id, book);
    return ids.map((k) => all.find((x) => x.id === k)?.name).filter(Boolean);
  };
  const rows = [
    hero && { screen: 'cards', head: label('equipCards'), now: `${p.cards.length} / 3` },
    { screen: 'appearance', head: word('ID_CUSTOMIZATION_CHANGE_APPEARANCE'), now: skin?.name ?? '' },
    picksFor(id, 'emotes').length && { screen: 'emotes', head: word('ID_CUSTOMIZATION_CHANGE_EMOTES'), now: nameOf('emotes', p.emotes).join(' · ') || `0 / 4` },
    picksFor(id, 'poses').length && { screen: 'poses', head: word('ID_CUSTOMIZATION_CHANGE_VICTORY_POSE'), now: nameOf('poses', p.pose ? [p.pose] : []).join('') },
    picksFor(id, 'voiceLines').length && { screen: 'voiceLines', head: word('ID_CUSTOMIZATION_CHANGE_VOICE_LINES'), now: nameOf('voiceLines', p.voiceLines).join(' · ') || `0 / 4` },
  ].filter(Boolean);
  const menu = findBox(raw, 'NavigationList');
  const info = findBox(raw, 'CharacterInfo');
  const room = between(raw, menu, info);
  const factions = factionsOf(id);
  return (
    <GameScreen tree={tree} label={c?.title ?? id} onBack={onBack} className="bf-collection" keys={[['Enter', word('ID_CUSTOMIZATION_SELECT')], ['Esc', 'Back']]}>
      {room ? <CollectionStage spec={stageSpec(id, skin?.id)} still={portraitOf(id, p.faction)} label={skin?.name ?? c?.title ?? ''} style={room} /> : null}
      {factions.length ? (
        <div className="bf-collection-tabs" role="tablist" style={menu ? { left: percentOf(raw, menu).left, top: `calc(${percentOf(raw, menu).top} - 3rem)` } : undefined}>
          {factions.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={f === p.faction} className="bf-collection-tab" data-side={FACTION_SIDE[f]} onClick={() => onFaction?.(f)}>
              {FACTION_NAMES[f]}
            </button>
          ))}
        </div>
      ) : null}
      {menu ? (
        <ul className="bf-collection-menu" style={percentOf(raw, menu)}>
          {rows.map((r) => (
            <li key={r.screen}>
              <button type="button" className="bf-collection-menu-row" data-open={r.screen} onClick={() => onOpen?.(r.screen)}>
                <span className="bf-collection-menu-head">{r.head}</span>
                <span className="bf-collection-menu-now">{r.now}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {info ? (
        <aside className="bf-collection-info bf-collection-character" style={percentOf(raw, info)}>
          <h2 className="bf-collection-info-name">{c?.title}</h2>
          {c?.about ? <p className="bf-collection-info-about">{c.about}</p> : null}
          {hero ? (
            <ul className="bf-collection-abilities" aria-label="Abilities">
              {abilitiesFor(id).map((a) => (
                <li key={a.id}>
                  <GameIcon name={iconKey(a.icon)} className="bf-collection-ability-icon" />
                  <span>
                    <b>{a.name}</b> {a.description}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {hero && p.cards.length ? (
            <ul className="bf-collection-equipped-cards" aria-label={label('equippedCards')}>
              {cardsFor(id)
                .filter((k) => p.cards.includes(k.id))
                .map((k) => (
                  <li key={k.id}>{k.art ? <img src={k.art} alt={k.name} title={k.name} /> : k.name}</li>
                ))}
            </ul>
          ) : null}
        </aside>
      ) : null}
    </GameScreen>
  );
}
