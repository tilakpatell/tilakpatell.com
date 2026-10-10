// Who you play down on the galaxy's worlds, and how their lightsaber's
// made: the roster (each a rigged figure the site already has, with the
// weapon they carry), the blade colours and hilts to pick from, and the
// choice kept in the browser. Pure data and parsing, so it's tested in
// Node; DeployPanel.jsx offers it, pages/GalaxySurface.jsx reads it, and
// surface/scene.js walks the hero in the lead of the party.
//
//   HEROES                   the roster, in order: { id, fallback (the site's committed figure of a 2017 hero, worn when the game's body can't be fetched: surface/standIn.js), name, tall, src, weapon ('saber' | a gun kind), bolt, saber?, abilities { power, second } (surface/abilityRules.js's kinds, on G and V), blurb, film, side ('galaxy' | 'elsewhere': the crews from other universes walk here too), lean ('light' | 'dark' | null: the side of the galaxy's wars they'd pick, allegiance.js), lines { ours, theirs } (said as a ground assault starts on their side, or against it) }
//   SABER_COLORS, HILTS      what a saber can be: { id, name, hex } and { id, name, ... }
//   SKINS, skinsOf(id)       a 2017 hero's outfits, the one they wear first and then the game's others: { id, name, kind (surface/crewList.js's CREW row) }
//   HERO_KEY                 the localStorage key
//   readHero(raw, ship)      the choice, made good: { id, skin, color, hilt, stance, gun, mods, perks, kind? (a trooper class's body: surface/troopers.js) } (skin null for a hero with no outfits) (the ship's own lead when nothing's kept or it's nonsense; the stance is combatRules.js's, the gun and mods weaponRules.js's)
//   heroSpec(hero, ship)     the party spec for them (universe/footScene.js's PARTY shape), the saber (with its stance) on it where they carry one, else the gun they picked with its mods
//   partyFor(spec, crew)     the two who walk: the hero, and the ship's crewmate who isn't them (the crew as it is with no hero)
//   loadoutLine(hero)        the choice in a line: a Jedi's blade, hilt and stance, or the gun and its mods; the perks counted
//   refitOf(was, next)       what a figure needs for a change of spec: 'same', 'arms' (another gun, blade or mods in the same hands) or 'body' (another person)
//   defaultHeroId(ship)      who flies that ship
//   leanText(lean)           a hero's lean, for their card (or null)

import { STANCES } from './surface/combatRules';
import { MODS, MAX_MODS, PICKABLE, WEAPONS } from './surface/weaponRules';
import { readPerks } from './perks';
import { CREW, fileOf } from './surface/crewList';
import { TROOPERS } from './surface/troopers';

export const HERO_KEY = 'tp-galaxy-hero';

// (the crew's own files; the 2017 game's heroes, on the game's skeleton, `rig: 'walrus'`, theirs)
const crew = (name) => `/models/galaxy/crew/${name}.glb`;
const bf2017 = (name) => `/models/galaxy/bf2017/crew/${name}.glb`;

export const SABER_COLORS = [
  { id: 'blue', name: 'Blue', hex: '#4aa8ff' },
  { id: 'green', name: 'Green', hex: '#5cff6a' },
  { id: 'purple', name: 'Purple', hex: '#b36aff' },
  { id: 'yellow', name: 'Yellow', hex: '#ffe066' },
  { id: 'white', name: 'White', hex: '#f4f8ff' },
  { id: 'orange', name: 'Orange', hex: '#ff9a3c' },
  { id: 'red', name: 'Red', hex: '#ff3b3b' },
];

// a hilt: its length (metres), the emitter's shape, the grip's look, and
// `model`: the 2017 game's own hilt (catalog/bf2017.js) at `modelLength`,
// which the saber of a figure on the game's skeleton wears in place of the
// built one; a Meshy hand holds the built one at `length`, as it always
// has, and the built one, dressed by the rest, stands in where there's no
// model or until it comes
export const HILTS = [
  { id: 'skywalker', name: 'Skywalker', about: 'Anakin’s, then Luke’s: a plain steel hilt with a black ribbed grip.', model: 'hiltanakin', modelLength: 0.274, length: 0.28, emitter: 'cup', grip: 'ribbed', metal: '#b8bcc4', trim: '#2a2c30' },
  { id: 'luke', name: 'Luke’s own', about: 'The one he built on Tatooine: slimmer, a black sleeve and a thin emitter.', model: 'hiltluke', modelLength: 0.286, length: 0.26, emitter: 'thin', grip: 'sleeve', metal: '#9a9ea6', trim: '#141518' , lean: 'light', lines: { ours: 'We hold this line. Nobody gets past while I’m standing.', theirs: 'I’m on the wrong side of this one. I’ll do what I have to.' } },
  { id: 'ahsoka', name: 'Ahsoka’s', about: 'A curved white hilt, the way she carries two.', length: 0.24, emitter: 'shroud', grip: 'curved', metal: '#e8e6e0', trim: '#5a5c60' , lean: 'light', lines: { ours: 'Stay close and trust each other. That’s how we win.', theirs: 'I’ve fought for the wrong people before. Never again. Except today.' } },
  { id: 'dooku', name: 'Curved', about: 'A fencer’s hilt, bent for the wrist.', model: 'hiltdooku', modelLength: 0.324, length: 0.27, emitter: 'cup', grip: 'curved', metal: '#8a7a5a', trim: '#2a2420' },
  { id: 'temple', name: 'Temple guard', about: 'A long hilt in Jedi gold and bronze.', model: 'hiltobiwan', modelLength: 0.27, length: 0.3, emitter: 'shroud', grip: 'ribbed', metal: '#c8a860', trim: '#4a3a20' },
  { id: 'lukehoth', name: 'Luke’s first', about: 'His father’s, the one he carried on Hoth and to Bespin.', model: 'hiltlukehoth', modelLength: 0.284, length: 0.284, emitter: 'cup', grip: 'ribbed', metal: '#b8bcc4', trim: '#2a2c30' },
  { id: 'vader', name: 'Vader’s', about: 'Black and steel, a ribbed grip and a shrouded emitter.', model: 'hiltvader', modelLength: 0.268, length: 0.268, emitter: 'shroud', grip: 'ribbed', metal: '#9a9ea6', trim: '#141518' },
  { id: 'maul', name: 'Maul’s staff', about: 'Two hilts joined at the pommel: a blade at each end.', model: 'hiltmaul', modelLength: 0.567, length: 0.567, emitter: 'cup', grip: 'ribbed', metal: '#5a5c60', trim: '#141518' },
  { id: 'yoda', name: 'Yoda’s', about: 'A short hilt for a small hand.', model: 'hiltyoda', modelLength: 0.158, length: 0.158, emitter: 'thin', grip: 'sleeve', metal: '#9a9ea6', trim: '#2a2c30' },
  // (built, not the game's: the drop has no hilt of his)
  { id: 'sidious', name: 'Sidious’s', about: 'Slim, in electrum and black, kept out of sight until it’s needed.', length: 0.25, emitter: 'thin', grip: 'sleeve', metal: '#c9a85a', trim: '#141518' },
];

// (each hero's own two abilities, G then V: what the films give them, and
// for the 2017 game's heroes the two of its kit that are most theirs, its
// numbers (abilityRules.js, from src/data/bf2017Abilities.json). The kit's
// third, which the two keys leave out: Luke's rush; Obi-Wan's restrictive
// mind trick; Anakin's impassionate strike and retribution; Dooku's
// duelist; the Emperor's electrocute and dark aura; Han's shoulder charge;
// Leia's bubble shield and E-11; Lando's smoke grenade and disruptor (G
// is the site's detonator); Bossk's mines and predator instincts (V is the
// site's medpack, for his kind's healing); Chewie's stun grenade; Boba Fett's ping
// and rocket barrage. Vader's and Maul's saber throws are R, as every
// saber's is, at the game's numbers.)
export const HEROES = [
  { id: 'luke', fallback: crew('luke'), name: 'Luke Skywalker', tall: 1.72, src: { url: bf2017('luke') }, rig: 'walrus', weapon: 'saber', bolt: '#5cff6a', saber: { color: 'green', hilt: 'luke', stance: 'single' }, abilities: { power: 'lukePush', second: 'lukeRepulse' }, blurb: 'A farm boy from Tatooine, a Jedi by the end.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'We hold this line. Nobody gets past while I’m standing.', theirs: 'I’m on the wrong side of this one. I’ll do what I have to.' } },
  { id: 'leia', fallback: crew('leia'), name: 'Leia Organa', tall: 1.5, src: { url: bf2017('leia') }, rig: 'walrus', weapon: 'blaster', bolt: '#ff3b30', abilities: { power: 'leiaDetonator', second: 'medpack' }, blurb: 'A princess, a senator, a general. Shoots better than the boys.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'Hold your positions. They’ve never beaten us when we stand together.', theirs: 'This isn’t my cause. I’ll fight it anyway, and remember who I am.' } },
  { id: 'han', fallback: crew('han'), name: 'Han Solo', tall: 1.85, src: { url: bf2017('han') }, rig: 'walrus', weapon: 'blaster', bolt: '#ff4a3d', abilities: { power: 'hanDetonator', second: 'hanSharpshooter' }, blurb: 'Captain of the Millennium Falcon. Shot first, with the DL-44.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: 'All right, let’s show these guys how it’s done.', theirs: 'I’m only here for the money. Remember that when it goes bad.' } },
  { id: 'chewie', name: 'Chewbacca', tall: 2.28, src: { url: bf2017('chewie') }, rig: 'walrus', weapon: 'bowcaster', bolt: '#ff4a3d', abilities: { power: 'chewieLeap', second: 'chewieBowcaster' }, blurb: 'Two hundred years old and still winning arguments.', film: 'The Original Trilogy', side: 'galaxy' , lean: 'light', lines: { ours: '[a battle roar, ready for anything]', theirs: '[an unhappy growl: he doesn’t like whose side this is]' } },
  { id: 'ahsoka', name: 'Ahsoka Tano', tall: 1.85, src: { url: crew('ahsoka') }, weapon: 'saber', bolt: '#f4f8ff', saber: { color: 'white', hilt: 'ahsoka', stance: 'dual' }, abilities: { power: 'push', second: 'pull' }, blurb: 'No longer a Jedi. Still the best of them.', film: 'The Clone Wars, Ahsoka', side: 'galaxy' , lean: 'light', lines: { ours: 'Stay close and trust each other. That’s how we win.', theirs: 'I’ve fought for the wrong people before. Never again. Except today.' } },
  { id: 'bobafett', name: 'Boba Fett', tall: 1.83, src: { url: bf2017('bobafett') }, rig: 'walrus', weapon: 'ee3', bolt: '#ff6a3d', abilities: { power: 'jetpack', second: 'bobaRocket' }, blurb: 'The best bounty hunter in the galaxy, and he knows it. Flies.', film: 'The Original Trilogy, The Book of Boba Fett', side: 'galaxy' , lean: 'dark', lines: { ours: 'The contract’s good. Nobody gets through.', theirs: 'Different employer, same result. They’ll pay double.' } },
  // (the rest of the 2017 game's heroes on its skeleton, with its clips and its kits)
  { id: 'obiwan', name: 'Obi-Wan Kenobi', tall: 1.82, src: { url: bf2017('obiwan') }, rig: 'walrus', weapon: 'saber', bolt: '#4aa8ff', saber: { color: 'blue', hilt: 'temple', stance: 'single' }, abilities: { power: 'obiwanPush', second: 'obiwanRush' }, blurb: 'A Jedi Master of the old Order: patient, wry and very hard to get past.', film: 'The Prequels, The Original Trilogy', side: 'galaxy', lean: 'light', lines: { ours: 'Steady, all of you. We hold here, together.', theirs: 'I have a bad feeling about which side I’m on.' } },
  { id: 'anakin', name: 'Anakin Skywalker', tall: 1.85, src: { url: bf2017('anakin') }, rig: 'walrus', weapon: 'saber', bolt: '#4aa8ff', saber: { color: 'blue', hilt: 'skywalker', stance: 'single' }, abilities: { power: 'anakinPull', second: 'anakinImpact' }, blurb: 'The Chosen One, a general of the Clone Wars. Reckless, and very good.', film: 'The Prequels, The Clone Wars', side: 'galaxy', lean: 'light', lines: { ours: 'Stay with me and nobody gets past. I’ve done harder.', theirs: 'This isn’t where I should be. I’ll fight anyway.' } },
  { id: 'vader', fallback: crew('vader'), name: 'Darth Vader', tall: 2.02, src: { url: bf2017('vader') }, rig: 'walrus', weapon: 'saber', bolt: '#ff3b3b', saber: { color: 'red', hilt: 'vader', stance: 'single' }, abilities: { power: 'vaderChoke', second: 'vaderRage' }, blurb: 'The Emperor’s fist, in black. Chokes, throws his blade, and does not stop.', film: 'The Original Trilogy', side: 'galaxy', lean: 'dark', lines: { ours: 'Hold this position. I will not accept failure.', theirs: 'An unusual alliance. It will serve, for now.' } },
  { id: 'palpatine', fallback: crew('palpatine'), name: 'The Emperor', tall: 1.73, src: { url: bf2017('palpatine') }, rig: 'walrus', weapon: 'saber', bolt: '#ff3b3b', saber: { color: 'red', hilt: 'sidious', stance: 'single' }, abilities: { power: 'palpatineLightning', second: 'palpatineChain' }, blurb: 'Sidious himself. He fights with lightning, and keeps a blade for when it matters.', film: 'The Prequels, The Original Trilogy', side: 'galaxy', lean: 'dark', lines: { ours: 'Everything is proceeding as I have foreseen. Hold.', theirs: 'How curious, to stand on this side. I shall find it useful.' } },
  { id: 'maul', name: 'Darth Maul', tall: 1.75, src: { url: bf2017('maul') }, rig: 'walrus', weapon: 'saber', bolt: '#ff3b3b', saber: { color: 'red', hilt: 'maul', stance: 'double' }, abilities: { power: 'maulChoke', second: 'maulSpin' }, blurb: 'A Sith with a blade at each end and a very long memory.', film: 'The Prequels, The Clone Wars', side: 'galaxy', lean: 'dark', lines: { ours: 'Let them come. I want them to try.', theirs: 'Sides mean nothing to me. Only the fight does.' } },
  { id: 'dooku', name: 'Count Dooku', tall: 1.93, src: { url: bf2017('dooku') }, rig: 'walrus', weapon: 'saber', bolt: '#ff3b3b', saber: { color: 'red', hilt: 'dooku', stance: 'single' }, abilities: { power: 'dookuStun', second: 'dookuWeaken' }, blurb: 'A count, a fencer of the old school, a Sith. The blade first, then the lightning.', film: 'The Prequels', side: 'galaxy', lean: 'dark', lines: { ours: 'Hold your ground, and do it with some dignity.', theirs: 'A temporary arrangement. I have made worse ones.' } },
  { id: 'lando', name: 'Lando Calrissian', tall: 1.78, src: { url: bf2017('lando') }, rig: 'walrus', weapon: 'blaster', bolt: '#ff4a3d', abilities: { power: 'detonator', second: 'landoSharpShot' }, blurb: 'Baron Administrator of Cloud City, gambler, general. Charming throughout.', film: 'The Original Trilogy', side: 'galaxy', lean: 'light', lines: { ours: 'Here goes nothing. Let’s make this look easy.', theirs: 'This deal’s getting worse all the time. I’m still in it.' } },
  { id: 'bossk', name: 'Bossk', tall: 1.9, src: { url: bf2017('bossk') }, rig: 'walrus', weapon: 'rifle', bolt: '#ff6a3d', abilities: { power: 'bosskGrenade', second: 'medpack' }, blurb: 'A Trandoshan bounty hunter who heals as he hunts.', film: 'The Empire Strikes Back', side: 'galaxy', lean: 'dark', lines: { ours: '[a hiss: this ground is his, and no one takes it]', theirs: '[a low growl: the pay had better be worth it]' } },
  // (the crews from elsewhere, as the universe's foot party has them: universe/footScene.js's PARTY)
  { id: 'rick', name: 'Rick Sanchez', tall: 1.88, src: { meshy: 'rick' }, weapon: 'portal', bolt: '#8dff5a', abilities: { power: 'hop', second: 'overcharge' }, blurb: 'The smartest man in the multiverse, with a portal gun and no patience.', film: 'Rick and Morty', side: 'elsewhere' , lean: null, lines: { ours: 'Sure, whatever, I’ll defend the thing. Wubba lubba dub dub.', theirs: 'Switching sides mid-war is a Tuesday for me, Morty.' } },
  { id: 'morty', name: 'Morty Smith', tall: 1.6, src: { meshy: 'morty' }, weapon: 'laser', bolt: '#8dff5a', abilities: { power: 'sprint', second: 'medpack' }, blurb: 'Fourteen, nervous, and still here after everything.', film: 'Rick and Morty', side: 'elsewhere' , lean: 'light', lines: { ours: 'Okay, okay, we’re the good guys this time, right? Right?', theirs: 'Oh geez, are we the bad guys? I think we’re the bad guys.' } },
  { id: 'walt', name: 'Walter White', tall: 1.79, src: { url: '/models/albuquerque/walt.glb' }, weapon: 'revolver', bolt: '#ffd36b', abilities: { power: 'fulminate', second: 'overcharge' }, blurb: 'A chemistry teacher. The one who knocks.', film: 'Breaking Bad', side: 'elsewhere' , lean: 'dark', lines: { ours: 'This is our territory now. We hold it, with discipline.', theirs: 'Loyalty is for amateurs. I chose the better organisation.' } },
  { id: 'jesse', name: 'Jesse Pinkman', tall: 1.73, src: { url: '/models/albuquerque/jesse.glb' }, weapon: 'pistol', bolt: '#ffd36b', abilities: { power: 'sprint', second: 'overcharge' }, blurb: 'Yeah, science. Quick on his feet, quicker to run.', film: 'Breaking Bad', side: 'elsewhere' , lean: null, lines: { ours: 'Yo, let’s hold this place! Science, yeah!', theirs: 'Yo, I don’t even know whose side we’re on anymore.' } },
];

// A 2017 hero's outfits: their kit's visual unlocks in the game (Kit_Hero_*'s
// VUR_* assets), the sequel trilogy's left out (Chewbacca's and Palpatine's
// EP7 and EP9 looks), each its own file on the same skeleton, moved by the
// hero's own clip pack (their CREW rows: scripts/bf2017-import.mjs --crew,
// lab/probe/skins.tsv says how each was made). The first is the one they
// wear unless another's picked.
const outfit = (kind, name) => ({ id: kind, name, kind });
export const SKINS = {
  luke: [outfit('luke', 'Return of the Jedi'), outfit('lukehoth', 'Hoth'), outfit('lukefarmboy', 'Tatooine'), outfit('lukeyavin', 'Yavin')],
  obiwan: [outfit('obiwan', 'Revenge of the Sith'), outfit('obiwan2', 'Jedi robe'), outfit('obiwan3', 'Clone Wars')],
  anakin: [outfit('anakin', 'Revenge of the Sith'), outfit('anakin2', 'Jedi robe'), outfit('anakin3', 'Clone Wars')],
  maul: [outfit('maul', 'The Phantom Menace'), outfit('maullegs', 'Cybernetic legs')],
  dooku: [outfit('dooku', 'Attack of the Clones'), outfit('dooku2', 'Geonosis'), outfit('dooku3', 'Jedi Master')],
  han: [outfit('han', 'Bespin'), outfit('hanendor', 'Endor'), outfit('hanhoth', 'Hoth'), outfit('hanrotj', 'Return of the Jedi'), outfit('hanyavin', 'Yavin'), outfit('hanyoung', 'Young, Corellia'), outfit('hanyoung2', 'Young, Kessel')],
  leia: [outfit('leia', 'Hoth'), outfit('leiaboushh', 'Boushh'), outfit('leiaendor', 'Endor'), outfit('leiagoldvest', 'Gold vest'), outfit('leiaprincess', 'Princess')],
  lando: [outfit('lando', 'Bespin'), outfit('landorotj', 'Return of the Jedi'), outfit('landoskiff', 'Skiff guard'), outfit('landoyoung', 'Young'), outfit('landoyoung2', 'Young, Kessel')],
  chewie: [outfit('chewie', 'Bandolier'), outfit('chewiegoggles', 'Goggles')],
};
// (only the outfits whose files are in: a row the import hasn't made yet isn't offered)
export const skinsOf = (id) => (SKINS[id] ?? []).filter((l) => CREW[l.kind]);

// (and the trooper classes, surface/troopers.js: a class picked on the deploy screen is read back as any hero is)
const BY_ID = Object.fromEntries([...HEROES, ...TROOPERS].map((h) => [h.id, h]));
export const heroById = (id) => BY_ID[id] ?? null;

// which side of the galaxy's wars a hero leans to (allegiance.js suggests it;
// `lean`, since `stance` is how a Jedi holds a saber), in a line for their card
export const leanText = (lean) => (lean === 'light' ? 'Fights for the Republic and the Rebellion' : lean === 'dark' ? 'Takes the Empire’s contracts' : null);

// who flies which ship, as the party has it: you walk in as them until you
// pick someone else
const LEADS = { xwing: 'luke', falcon: 'han', cruiser: 'rick', rv: 'walt' };
export const defaultHeroId = (ship) => LEADS[ship] ?? 'luke';

// the choice, from what's kept (a JSON string, an object, or nothing)
export function readHero(raw, ship = 'xwing') {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const hero = BY_ID[v?.id] ?? BY_ID[defaultHeroId(ship)];
  const color = SABER_COLORS.some((c) => c.id === v?.color) ? v.color : (hero.saber?.color ?? 'blue');
  const hilt = HILTS.some((h) => h.id === v?.hilt) ? v.hilt : (hero.saber?.hilt ?? 'skywalker');
  const stance = STANCES[v?.stance] ? v.stance : (hero.saber?.stance ?? 'single');
  // (a gun hero carries their own, or one of the pickable ones; a Jedi's gun is their saber)
  const gun = hero.weapon !== 'saber' && (v?.gun === hero.weapon || PICKABLE.includes(v?.gun)) && WEAPONS[v.gun] ? v.gun : hero.weapon;
  const mods = Array.isArray(v?.mods) ? [...new Set(v.mods.filter((m) => MODS[m]))].slice(0, MAX_MODS) : [];
  const looks = skinsOf(hero.id);
  const skin = looks.some((l) => l.id === v?.skin) ? v.skin : (looks[0]?.id ?? null);
  // (a trooper's body, the world's own kit of their side: a snowtrooper on Hoth)
  const kind = hero.trooper && CREW[v?.kind] ? v.kind : (hero.trooper?.kind ?? null);
  return { id: hero.id, skin, color, hilt, stance, gun, mods, perks: readPerks(v?.perks), ...(hero.trooper ? { kind } : {}) };
}
export const writeHero = (hero) => JSON.stringify({ id: hero.id, skin: hero.skin ?? null, color: hero.color, hilt: hero.hilt, stance: hero.stance, gun: hero.gun, mods: hero.mods ?? [], perks: hero.perks ?? [], ...(hero.kind ? { kind: hero.kind } : {}) });

// the spec the scene walks: a saber hero carries no gun (the saber's its
// own thing, surface/saber.js), the others their gun
export function heroSpec(hero) {
  const h = BY_ID[hero.id] ?? BY_ID.luke;
  const saber = h.weapon === 'saber' ? { color: SABER_COLORS.find((c) => c.id === hero.color)?.hex ?? '#4aa8ff', hilt: HILTS.find((x) => x.id === hero.hilt) ?? HILTS[0], stance: STANCES[hero.stance] ? hero.stance : (h.saber?.stance ?? 'single') } : null;
  const gun = saber ? 'saber' : WEAPONS[hero.gun] && hero.gun !== 'saber' ? hero.gun : h.weapon;
  // (a gun from elsewhere fires yellow; the galaxy's keep the hero's own colour)
  const bolt = saber ? saber.color : WEAPONS[gun]?.side === 'elsewhere' ? '#ffd36b' : h.bolt;
  // (another outfit is another file, on the same skeleton with the same clips)
  const look = skinsOf(h.id).find((l) => l.id === hero.skin && l.kind !== h.id);
  const body = h.trooper && CREW[hero.kind] ? CREW[hero.kind] : null;
  const src = look ? { url: fileOf(CREW[look.kind]) } : body ? { url: fileOf(body) } : h.src;
  const rig = body ? (body.rig === 'walrus' ? 'walrus' : null) : h.rig;
  return { id: h.id, name: h.trooper ? h.name : h.name.split(' ')[0], tall: body?.tall ?? h.tall, src, ...(rig ? { rig, pack: h.trooper ? null : (h.pack ?? h.id) } : {}), gun, bolt, saber, abilities: h.abilities, mods: saber ? [] : (hero.mods ?? []).filter((m) => MODS[m]).slice(0, MAX_MODS), perks: readPerks(hero.perks), hero: true };
}

// the two who walk down here: the hero in the lead, and the ship's
// crewmate who isn't them (its second, or its first when the hero is the second)
export const partyFor = (spec, crew) => (spec ? [spec, crew[1].id === spec.id ? crew[0] : crew[1]] : crew);

// what a change of choice asks of a figure already walking (surface/scene.js
// swaps it there and then): another person is a new body; another gun, its
// mods or the blade (colour, hilt, stance) is new arms in the same hands;
// anything else (perks, abilities) is only numbers
const armsOf = (s) => JSON.stringify([s.gun ?? null, s.saber ? [s.saber.color, s.saber.hilt?.id ?? null, s.saber.stance] : null, s.mods ?? []]);
export function refitOf(was, next) {
  if (!was || was.id !== next.id || JSON.stringify(was.src) !== JSON.stringify(next.src)) return 'body';
  return armsOf(was) === armsOf(next) ? 'same' : 'arms';
}

// the choice in a line, for the panel's summary and the note as it goes on
export function loadoutLine(hero) {
  const h = BY_ID[hero.id] ?? BY_ID.luke;
  const parts =
    h.weapon === 'saber'
      ? [`${SABER_COLORS.find((c) => c.id === hero.color)?.name ?? 'Blue'} blade`, `${HILTS.find((x) => x.id === hero.hilt)?.name ?? HILTS[0].name} hilt`, STANCES[hero.stance]?.name ?? STANCES.single.name]
      : [[WEAPONS[hero.gun]?.name ?? WEAPONS[h.weapon]?.name, (hero.mods ?? []).filter((m) => MODS[m]).map((m) => MODS[m].name).join(', ')].filter(Boolean).join(' · ')];
  const n = (hero.perks ?? []).length;
  const look = skinsOf(h.id).find((l) => l.id === hero.skin && l.kind !== h.id);
  return [...(look ? [look.name] : []), ...parts, ...(n ? [`${n} perk${n === 1 ? '' : 's'}`] : [])].join(' · ');
}
