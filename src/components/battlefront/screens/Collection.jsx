import { useState } from 'react';
import { FACTION_NAMES, SLOTS, character, factionsOf, label, picksFor, picksOf, portraitOf, skinsFor, stageSpec } from '../../../lib/bf2017/collection';
import { word } from '../../../lib/bf2017/ui/screens';
import { useCollection } from './useCollection';
import CollectionCards from './CollectionCards.jsx';
import CollectionCharacters from './CollectionCharacters.jsx';
import CollectionCustomize from './CollectionCustomize.jsx';
import CollectionList from './CollectionList.jsx';
import './collection.css';

// The 2017 game's Collection, as its front end walks it (the main menu's
// COLLECTION tab): the characters → one character's customisation → its
// appearances, star cards, emotes, victory poses or voice lines, each on the
// game's own screen tree, with the character on the hero-select stage
// wearing what is picked. The picks are kept (`bf-collection`) and the
// Battlefront world's deploy dresses the player in the skin picked for the
// class or hero it deploys as (BattlefrontWorld's appearance).
//
// <Collection onBack={…} />

// (a list screen's tree, as the game names it for each kind of pick)
const SCREENS = { appearance: 'AppearanceHeroSkinsScreen', emotes: 'AppearanceEmotesCommoRoseScreen', poses: 'VictoryPoseScreen', voiceLines: 'AppearanceVoiceLinesCommoRose' };
const TITLES = { appearance: 'ID_CUSTOMIZATION_CHANGE_APPEARANCE', emotes: 'ID_CUSTOMIZATION_CHANGE_EMOTES', poses: 'ID_CUSTOMIZATION_CHANGE_VICTORY_POSE', voiceLines: 'ID_CUSTOMIZATION_CHANGE_VOICE_LINES' };

export default function Collection({ onBack }) {
  const { store, pick } = useCollection();
  const [at, setAt] = useState({ screen: 'characters', id: null, faction: null });
  const [look, setLook] = useState(null); // (the skin the appearances' list has in focus)
  const [shown, setShown] = useState({ play: null, key: 0 });
  const go = (screen) => {
    setLook(null);
    setShown({ play: null, key: 0 });
    setAt((a) => ({ ...a, screen }));
  };

  if (at.screen === 'characters' || !at.id) return <CollectionCharacters onOpen={(id) => setAt({ screen: 'customize', id, faction: factionsOf(id)[0] ?? null })} onBack={onBack} />;

  const { id, faction } = at;
  const p = picksOf(store, id, { faction });
  const opts = { faction: p.faction };
  if (at.screen === 'customize') return <CollectionCustomize id={id} store={store} faction={p.faction} onFaction={(f) => setAt((a) => ({ ...a, faction: f }))} onOpen={go} onBack={() => setAt({ screen: 'characters', id: null, faction: null })} />;
  if (at.screen === 'cards') return <CollectionCards id={id} store={store} onToggle={(k) => pick(id, 'cards', k)} onBack={() => go('customize')} />;

  const book = at.screen;
  const c = character(id);
  const back = () => go('customize');
  const hero = c?.kind === 'hero';
  if (book === 'appearance') {
    const skins = skinsFor(id, opts);
    // (a clone legion's look comes in each phase's armour; a look the site
    // has no body for yet says so)
    const tagOf = (s) => [s.look?.phase ? `PHASE ${s.look.phase === 1 ? 'I' : 'II'}` : null, s.body ? null : s.stand ? 'Stand-in figure' : 'Figure coming'].filter(Boolean).join(' · ') || null;
    const items = skins.map((s) => ({ id: s.id, name: s.name, rarity: s.rarity, about: s.description, tag: tagOf(s) }));
    const focus = look ?? p.skin;
    const tabs = factionsOf(id).map((f) => ({ id: f, label: FACTION_NAMES[f], on: f === p.faction }));
    return (
      <CollectionList
        key={`${id}.${p.faction}`}
        screen={SCREENS.appearance}
        label={`${c?.title ?? id} · ${word(TITLES.appearance)}`}
        title={word(TITLES.appearance)}
        items={items}
        chosen={(i) => i.id === p.skin}
        onChoose={(i) => pick(id, 'skin', i.id, opts)}
        onFocus={(i) => setLook(i.id)}
        stage={{ spec: stageSpec(id, focus), still: portraitOf(id, p.faction) }}
        tabs={tabs.length ? tabs : null}
        onTab={(f) => (setLook(null), setAt((a) => ({ ...a, faction: f })))}
        onBack={back}
      />
    );
  }
  // the emotes, poses and voice lines: an emote or a pose plays on the stage
  // as it is focused (the hero's own clips: emote.<n>, victory.<n>)
  const items = picksFor(id, book).map((x) => ({ ...x, about: null }));
  const chosen = book === 'poses' ? (i) => i.id === p.pose : (i) => p[book].includes(i.id);
  const clipOf = (i) => (!hero || i.n == null ? null : book === 'emotes' ? `emote.${i.n}` : book === 'poses' ? `victory.${i.n}` : null);
  return (
    <CollectionList
      key={`${id}.${book}`}
      screen={SCREENS[book]}
      label={`${c?.title ?? id} · ${word(TITLES[book])}`}
      title={word(TITLES[book])}
      items={items}
      chosen={chosen}
      onChoose={(i) => pick(id, book === 'poses' ? 'pose' : book, i.id, opts)}
      onFocus={(i) => setShown((s) => ({ play: clipOf(i), key: s.key + 1 }))}
      stage={{ spec: stageSpec(id, p.skin), still: portraitOf(id, p.faction), play: shown.play, playKey: shown.key }}
      note={SLOTS[book] ? `${label('equipped')} ${p[book].length} / ${SLOTS[book]}` : null}
      onBack={back}
    />
  );
}
