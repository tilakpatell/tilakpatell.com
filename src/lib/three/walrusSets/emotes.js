// The heroes' own emotes, end-of-round victories and stage poses from the
// game: each hero's four emotes (`E_<Hero>_*`, five to nine seconds of the
// hero being themselves), its victory poses (`EoR_*`, the end screen's,
// one held frame each), its defeat, and the idle it stands in on the
// game's hero-select stage (`UI_FrontEnd_*`). Packed a hero at a time as
// `emotes-<hero>` (scripts/bf2017-clips.mjs emotes-luke…), loaded with the
// hero at the levels that load the extras (walrus.js's packUrls). The
// surface's emote wheel plays `emote.1` to `emote.4` (lib/emote.js's
// GAME_EMOTE), the battle's end the victories and the defeat, the
// loadout's stage `frontend.idle` (lane M). The soldiers' victories go in
// the soldiers' pack (npc). Pure.
//
//   EMOTE_HEROES             the heroes with a set (crewList.js's packs)
//   EMOTE_SET(hero)          → { 'emote.1'…'emote.4', 'victory.1'…, defeat, 'frontend.idle' } ({} for any other kind)
//   FRONTEND_IDLE            { hero: gameName | [gameName…] } the stage's idle alone
//   SOLDIER_VICTORY          { 'victory.1'…'victory.4': … } the soldiers' (assault, officer, specialist)
//   victoryFor(clips, n)     → one of the victories `clips` has (the n-th round), else null

// hero → [its four emotes, its name in EoR_<…>_Victory_0n, how many victories, its stage idles]
const HEROES = {
  luke: [['E_Luke_01_Conflict', 'E_Luke_02_NeverJoin', 'E_Luke_03_Confidence', 'E_Luke_04_Greetings'], 'Luke', 4, ['UI_FrontEnd_Luke_MainMenu_01', 'UI_FrontEnd_Luke_MainFace_01'], 'Luke'],
  vader: [['E_Vader_01_Apology', 'E_Vader_02_Hide', 'E_Vader_03_Clumsy', 'E_Vader_04_Disturbing'], 'DarthVader', 4, ['UI_DarthVader_MainMenu_02', 'UI_FrontEnd_DarthVader_Appearance_01'], 'Vader'],
  obiwan: [['E_ObiWan_01_HelloThere', 'E_ObiWan_02_YourMove', 'E_ObiWan_03_Strongest', 'E_ObiWan_08_Absolutes'], 'ObiWan', [1, 2, 5, 7], ['UI_FrontEnd_ObiWan_MainMenu_01', 'UI_FrontEnd_ObiWan_MainFace_01'], 'ObiWan'],
  anakin: [['E_Anakin_01_FunBegins', 'E_Anakin_02_DiplomaticSolution', 'E_Anakin_03_ObiWanKill', 'E_Anakin_04_AWiseJedi'], 'Anakin', 4, ['UI_FrontEnd_Anakin_MainMenu_01', 'UI_FrontEnd_Anakin_MainFace_01'], 'Anakin'],
  maul: [['E_Maul_01_NoMatch', 'E_Maul_02_Revenge', 'E_Maul_03_Fear', 'E_Maul_04_Sith'], 'DarthMaul', 4, ['UI_FrontEnd_Maul_Appearance_01'], 'Maul'],
  dooku: [['E_Dooku_01_BraveBut', 'E_Dooku_02_LookingForward', 'E_Dooku_03_MorePowerful', 'E_Dooku_04_SithControl'], 'Dooku', 4, ['UI_FrontEnd_Dooku_MainMenu_01', 'UI_FrontEnd_Dooku_Main_Face_01'], 'Dooku'],
  palpatine: [[], 'Palpatine', 4, ['UI_FrontEnd_Palpatine_MainMenu_01', 'UI_FrontEnd_Palpatine_Appearance_01'], 'Palpatine'],
  chewie: [['E_Chewbacca_01_Angry', 'E_Chewbacca_02_BattleRoar', 'E_Chewbacca_03_Laugh', 'E_Chewbacca_04_Sad'], 'Chewbacca', 4, ['UI_FrontEnd_Chewbacca_MainMenu_f90_01', 'UI_FrontEnd_Chewbacca_Appearance_01'], 'Chewbacca'],
  bobafett: [['E_Boba_01_Price', 'E_Boba_02_HitThem', 'E_Boba_03_Escape', 'E_Boba_04_Cargo'], 'BobbaFett', 4, ['UI_BobaFett_MainMenu_02', 'UI_FrontEnd_BobaFett_Appearance_01'], 'Bobafett'],
  bossk: [['E_Bossk_01_Hide', 'E_Bossk_02_Price', 'E_Bossk_03_Fun', 'E_Bossk_04_Target'], 'Bossk', 4, ['UI_Bossk_MainMenu_02', 'UI_FrontEnd_Bossk_Appearance_01'], 'Bossk'],
  han: [['E_Han_01_Junior', 'E_Han_03_Delusion', 'E_Han_04_Blaster', 'E_Han_05_Kid'], 'HanSolo', 4, ['UI_FrontEnd_HanSolo_Appearance_01'], 'Han'],
  leia: [['E_Leia_02_Jittery', 'E_Leia_03_LaserBrain', 'E_Leia_04_Moments'], 'Leia', 4, ['UI_FrontEnd_Leia_MainMenu_f150_01', 'UI_FrontEnd_Leia_Appearance_01'], 'Leia'],
  lando: [['E_Lando_01_Guts', 'E_Lando_03_Pirate', 'E_Lando_04_Interrupting', 'E_Lando_06_Responsible'], 'Lando', 4, ['UI_FrontEnd_Lando_MainFace_01', 'UI_FrontEnd_Lando_Starcard_01'], 'Lando'],
};
export const EMOTE_HEROES = Object.keys(HEROES);

const one = (xs) => (xs.length === 1 ? xs[0] : xs);
export const FRONTEND_IDLE = Object.fromEntries(Object.entries(HEROES).map(([h, row]) => [h, one(row[3])]));

export function EMOTE_SET(hero) {
  const row = HEROES[hero];
  if (!row) return {};
  const [emotes, eor, victories, stage, prefix] = row;
  const out = {};
  emotes.forEach((g, i) => (out[`emote.${i + 1}`] = g));
  const ns = Array.isArray(victories) ? victories : Array.from({ length: victories }, (_, i) => i + 1);
  ns.forEach((n, i) => (out[`victory.${i + 1}`] = `EoR_${eor}_Victory_0${n}`));
  // (its defeat: the game's own fall, as the hero's set has it for `die`)
  out.defeat = [`A_${prefix}_Defeated_01`, `A_${prefix}_Defeated_Fwd_01`];
  out['frontend.idle'] = one(stage);
  return out;
}

export const SOLDIER_VICTORY = {
  'victory.1': ['EoR_Assault_Victory_01', 'EoR_Assault_Victory_02'],
  'victory.2': ['EoR_Officer_Victory_01', 'EoR_Officer_Victory_02'],
  'victory.3': ['EoR_Specialist_Victory_01', 'EoR_Specialist_Victory_02'],
  'victory.4': ['EoR_Assault_Victory_04', 'EoR_Officer_Victory_04'],
};

export function victoryFor(clips, n = 0) {
  const have = Object.keys(clips ?? {}).filter((k) => /^victory\.\d+$/.test(k));
  return have.length ? have.sort()[Math.abs(Math.floor(n)) % have.length] : null;
}
