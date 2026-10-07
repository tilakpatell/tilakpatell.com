// Every clip a figure on the Meshy skeleton can play, by what it is. Every
// figure the site has made with Meshy (Portal panic's cast, Albuquerque's
// people, the cockpits' crews, the galaxy's, the troopers) is rigged on the
// same 24-bone skeleton, so a clip made on one plays on any of them: the
// bones' turns as they are, and the hips' height scaled to the figure's (no
// other bone's length, since a turn doesn't care how long the bone is).
// This was rickmorty/portal/clips.js, Rick's clips lent to the figures
// without their own; it re-exports from here, so its callers (meshyCast.js,
// universe/footScene.js, the cockpits, saberBody.js) are as they were.
//
//   CLIPS: { name: { url, take?, hips?, loop?, mask? } }   the registry: the
//     GLB, the clip's name in it (else its first), the hips' height it was
//     made for (else read from the file), whether it repeats, and the bones
//     it may move when played as a layer ('upper', 'lower', 'full'; full
//     when it doesn't say)
//   loadClip(name, { loader }) → Promise<clip | null>   fetched once, for
//     everyone, with clip.userData.hips; a file that won't load is null
//   forFigure(name, { hipsY, up, key, ahead }) → Promise<clip | null>   a
//     copy for a figure whose hips stand hipsY high, turned about `up` to
//     face where its walk does (`ahead`, else Rick's walk's heading), kept
//     per name and `key` (the figure's template) so copies of one figure
//     share it
//   preload(names) → Promise<void>   a world's clips fetched up front, so
//     the first wave isn't late
//   borrowClips(names) → { name: clip | null }   Rick's own (rick-<name>.glb)
//   retarget(clip, hipsY, from) → a copy for a figure whose hips stand hipsY high
//   faceAhead(clips, up)                       every clip turned to face where the walk does
//   heading(clip, up), faceForward(clip, up, target)   a clip's hips' heading, and turning it

import * as THREE from 'three';
import { gltfLoader } from './gltf';
import { checkRig } from './rigCheck';

const BASE = '/games/meshy';
const TROOPS = '/models/galaxy/troops';
// how high the hips stand in the clips' rig units, as the crews out of the
// ship have always scaled them (a clip that says, as every loaded one does,
// is scaled from its own)
export const RICK_HIPS = 90.233;

export const CLIPS = {
  // Rick's, for any figure without its own
  idle: { url: `${BASE}/rick-idle.glb`, loop: true },
  walk: { url: `${BASE}/rick-walk.glb`, loop: true },
  run: { url: `${BASE}/rick-run.glb`, loop: true },
  sit: { url: `${BASE}/rick-sit.glb`, loop: true },
  // Meshy's animation library, made once on one Meshy skeleton
  // (scripts/meshy-rm-local.mjs's `clips`): the thirteen meshyCast's
  // SHARED_CLIPS plays over a figure's idle, walk and run
  drink: { url: `${BASE}/clips-drink.glb` },
  cheer: { url: `${BASE}/clips-cheer.glb` },
  wave: { url: `${BASE}/clips-wave.glb` },
  happy: { url: `${BASE}/clips-happy.glb` },
  hit: { url: `${BASE}/clips-hit.glb` },
  fall: { url: `${BASE}/clips-fall.glb` },
  scared: { url: `${BASE}/clips-scared.glb` },
  shoot: { url: `${BASE}/clips-shoot.glb` },
  dance: { url: `${BASE}/clips-dance.glb`, loop: true },
  punch: { url: `${BASE}/clips-punch.glb` },
  taunt: { url: `${BASE}/clips-taunt.glb` },
  shot: { url: `${BASE}/clips-shot.glb` },
  sitcross: { url: `${BASE}/clips-sitcross.glb`, loop: true },
  // the troopers', made on the clone's rig (scripts/meshy-troopers.mjs's
  // CLIPS, Meshy's library by number), its hips 100.4 high
  'die.back': { url: `${TROOPS}/clip-die.glb` }, // Shot_and_Fall_Backward
  'die.fwd': { url: `${TROOPS}/clip-dieFwd.glb` }, // Shot_and_Fall_Forward
  'die.blown': { url: `${TROOPS}/clip-dieBlown.glb` }, // Shot_and_Blown_Back
  kneel: { url: `${TROOPS}/clip-kneel.glb` }, // Kneeling_Reload
  'taunt.trooper': { url: `${TROOPS}/clip-taunt.glb` }, // Chest_Pound_Taunt
  'hit.trooper': { url: `${TROOPS}/clip-hit.glb` }, // Gunshot_Reaction
  // ── Quaternius's Universal Animation Library ──
  // Each clip baked onto Luke's rest skeleton by scripts/ual-bake.mjs into
  // its own /games/meshy/ual-<name>.glb, full body (the mask applied at play
  // time), its hips read off the file's (Luke's). UAL's name for each after it.
  talk: { url: `${BASE}/ual-talk.glb`, loop: true }, // Idle_Talking_Loop
  'sit.enter': { url: `${BASE}/ual-sit.enter.glb` }, // Sitting_Enter
  'sit.idle': { url: `${BASE}/ual-sit.idle.glb`, loop: true }, // Sitting_Idle_Loop
  'sit.talk': { url: `${BASE}/ual-sit.talk.glb`, loop: true }, // Sitting_Talking_Loop
  'sit.exit': { url: `${BASE}/ual-sit.exit.glb` }, // Sitting_Exit
  crouch: { url: `${BASE}/ual-crouch.glb`, loop: true }, // Crouch_Idle_Loop
  'crouch.walk': { url: `${BASE}/ual-crouch.walk.glb`, loop: true }, // Crouch_Fwd_Loop
  interact: { url: `${BASE}/ual-interact.glb` }, // Interact
  pickup: { url: `${BASE}/ual-pickup.glb` }, // PickUp_Table
  'kneel.fix': { url: `${BASE}/ual-kneel.fix.glb` }, // Fixing_Kneeling
  'hit.chest': { url: `${BASE}/ual-hit.chest.glb` }, // Hit_Chest
  'hit.head': { url: `${BASE}/ual-hit.head.glb` }, // Hit_Head
  die: { url: `${BASE}/ual-die.glb` }, // Death01
  'aim.pistol': { url: `${BASE}/ual-aim.pistol.glb` }, // Pistol_Aim_Neutral
  'aim.pistol.up': { url: `${BASE}/ual-aim.pistol.up.glb` }, // Pistol_Aim_Up
  'aim.pistol.down': { url: `${BASE}/ual-aim.pistol.down.glb` }, // Pistol_Aim_Down
  'shoot.pistol': { url: `${BASE}/ual-shoot.pistol.glb` }, // Pistol_Shoot
  reload: { url: `${BASE}/ual-reload.glb` }, // Pistol_Reload
  jab: { url: `${BASE}/ual-jab.glb` }, // Punch_Jab
  cross: { url: `${BASE}/ual-cross.glb` }, // Punch_Cross
  roll: { url: `${BASE}/ual-roll.glb` }, // Roll
  'jump.start': { url: `${BASE}/ual-jump.start.glb` }, // Jump_Start
  'jump.loop': { url: `${BASE}/ual-jump.loop.glb`, loop: true }, // Jump_Loop
  'jump.land': { url: `${BASE}/ual-jump.land.glb` }, // Jump_Land
  push: { url: `${BASE}/ual-push.glb`, loop: true }, // Push_Loop
  'cast.enter': { url: `${BASE}/ual-cast.enter.glb` }, // Spell_Simple_Enter
  'cast.idle': { url: `${BASE}/ual-cast.idle.glb`, loop: true }, // Spell_Simple_Idle_Loop
  cast: { url: `${BASE}/ual-cast.glb` }, // Spell_Simple_Shoot
  sprint: { url: `${BASE}/ual-sprint.glb`, loop: true }, // Sprint_Loop
  'walk.formal': { url: `${BASE}/ual-walk.formal.glb`, loop: true }, // Walk_Formal_Loop
  torch: { url: `${BASE}/ual-torch.glb`, loop: true }, // Idle_Torch_Loop
  'dance.ual': { url: `${BASE}/ual-dance.ual.glb`, loop: true }, // Dance_Loop
  swim: { url: `${BASE}/ual-swim.glb`, loop: true }, // Swim_Fwd_Loop
  'swim.idle': { url: `${BASE}/ual-swim.idle.glb`, loop: true }, // Swim_Idle_Loop
  drive: { url: `${BASE}/ual-drive.glb`, loop: true }, // Driving_Loop
  'idle.calm': { url: `${BASE}/ual-idle.calm.glb`, loop: true }, // Idle_Loop
  // ── end of the UAL's ──
  // ── Meshy's animation library, the rest of it (scripts/meshy-actions.mjs):
  // walking backward and sideways, talking, phoning, looking round, sitting
  // to drink or doze, sleeping, picking up, blocks, dodges, kicks, the gym,
  // dances; made once on Luke's rig, as the UAL's are baked onto him ──
  'walk.back': { url: `${BASE}/act-walk.back.glb`, loop: true }, // Walk_Backward
  'walk.back.gun': { url: `${BASE}/act-walk.back.gun.glb`, loop: true }, // Walk_Backward_with_Gun
  'walk.left.gun': { url: `${BASE}/act-walk.left.gun.glb`, loop: true }, // Walk_Left_with_Gun
  'walk.fight': { url: `${BASE}/act-walk.fight.glb`, loop: true }, // Walk_Fight_Forward
  'walk.fight.back': { url: `${BASE}/act-walk.fight.back.glb`, loop: true }, // Walk_Fight_Back
  'run.left': { url: `${BASE}/act-run.left.glb`, loop: true }, // ForwardLeft_Run_Fight
  'run.right': { url: `${BASE}/act-run.right.glb`, loop: true }, // ForwardRight_Run_Fight
  'run.back.left': { url: `${BASE}/act-run.back.left.glb`, loop: true }, // BackLeft_run
  'run.back.right': { url: `${BASE}/act-run.back.right.glb`, loop: true }, // BackRight_Run
  'crouch.back': { url: `${BASE}/act-crouch.back.glb`, loop: true }, // Cautious_Crouch_Walk_Backward
  'crouch.left': { url: `${BASE}/act-crouch.left.glb`, loop: true }, // Cautious_Crouch_Walk_Left
  'crouch.right': { url: `${BASE}/act-crouch.right.glb`, loop: true }, // Cautious_Crouch_Walk_Right
  'turn.left': { url: `${BASE}/act-turn.left.glb` }, // Idle_Turn_Left
  'turn.right': { url: `${BASE}/act-turn.right.glb` }, // Idle_Turn_Right
  'walk.sneak': { url: `${BASE}/act-walk.sneak.glb`, loop: true }, // Sneaky_Walk
  'walk.injured': { url: `${BASE}/act-walk.injured.glb`, loop: true }, // Injured_Walk
  'walk.limp': { url: `${BASE}/act-walk.limp.glb`, loop: true }, // Limping_Walk
  'walk.phone': { url: `${BASE}/act-walk.phone.glb`, loop: true }, // Walking_with_Phone
  'walk.text': { url: `${BASE}/act-walk.text.glb`, loop: true }, // Texting_Walk
  'walk.talk': { url: `${BASE}/act-walk.talk.glb`, loop: true }, // Discuss_While_Moving
  'walk.search': { url: `${BASE}/act-walk.search.glb`, loop: true }, // Walk_Slowly_and_Look_Around
  'walk.scan': { url: `${BASE}/act-walk.scan.glb`, loop: true }, // Walking_Scan_with_Sudden_Look_Back
  'walk.carry': { url: `${BASE}/act-walk.carry.glb`, loop: true }, // Carry_Heavy_Object_Walk
  'walk.casual': { url: `${BASE}/act-walk.casual.glb`, loop: true }, // Casual_Walk
  'walk.proud': { url: `${BASE}/act-walk.proud.glb`, loop: true }, // Proud_Strut
  'walk.shoot': { url: `${BASE}/act-walk.shoot.glb`, loop: true }, // Walk_Forward_While_Shooting
  'walk.back.shoot': { url: `${BASE}/act-walk.back.shoot.glb`, loop: true }, // Walk_Backward_While_Shooting
  'run.shoot': { url: `${BASE}/act-run.shoot.glb`, loop: true }, // Run_and_Shoot
  charge: { url: `${BASE}/act-charge.glb`, loop: true }, // Rifle_Charge
  'talk.passion': { url: `${BASE}/act-talk.passion.glb`, loop: true }, // Talk_Passionately
  'talk.open': { url: `${BASE}/act-talk.open.glb`, loop: true }, // Talk_with_Hands_Open
  'talk.hip': { url: `${BASE}/act-talk.hip.glb`, loop: true }, // Talk_with_Left_Hand_on_Hip
  'talk.raised': { url: `${BASE}/act-talk.raised.glb`, loop: true }, // Talk_with_Left_Hand_Raised
  'talk.right': { url: `${BASE}/act-talk.right.glb`, loop: true }, // Talk_with_Right_Hand_Open
  'talk.angry': { url: `${BASE}/act-talk.angry.glb`, loop: true }, // Stand_Talking_Angry
  chat: { url: `${BASE}/act-chat.glb`, loop: true }, // Stand_and_Chat
  listen: { url: `${BASE}/act-listen.glb`, loop: true }, // Listening_Gesture
  agree: { url: `${BASE}/act-agree.glb` }, // Agree_Gesture
  phone: { url: `${BASE}/act-phone.glb`, loop: true }, // Phone_Conversation
  call: { url: `${BASE}/act-call.glb` }, // Phone_Call_Gesture
  beckon: { url: `${BASE}/act-beckon.glb` }, // Call_Gesture
  shrug: { url: `${BASE}/act-shrug.glb` }, // Shrug
  bow: { url: `${BASE}/act-bow.glb` }, // Formal_Bow
  'bow.gent': { url: `${BASE}/act-bow.gent.glb` }, // Gentlemans_Bow
  shout: { url: `${BASE}/act-shout.glb` }, // Shouting_Angrily
  stomp: { url: `${BASE}/act-stomp.glb` }, // Angry_Stomp
  confused: { url: `${BASE}/act-confused.glb` }, // Confused_Scratch
  scheme: { url: `${BASE}/act-scheme.glb` }, // Scheming_Hand_Rub
  headache: { url: `${BASE}/act-headache.glb` }, // Headache_Relief
  hip: { url: `${BASE}/act-hip.glb` }, // Hand_on_Hip_Gesture
  nope: { url: `${BASE}/act-nope.glb` }, // Finger_Wag_No
  sway: { url: `${BASE}/act-sway.glb`, loop: true }, // Happy_Sway_Standing
  'look.around': { url: `${BASE}/act-look.around.glb`, loop: true }, // Long_Breathe_and_Look_Around
  'look.short': { url: `${BASE}/act-look.short.glb`, loop: true }, // Short_Breathe_and_Look_Around
  'look.dumb': { url: `${BASE}/act-look.dumb.glb` }, // Look_Around_Dumbfounded
  alert: { url: `${BASE}/act-alert.glb` }, // Alert
  'cheer.up': { url: `${BASE}/act-cheer.up.glb` }, // Cheer_with_Both_Hands_Up
  'cheer.one': { url: `${BASE}/act-cheer.one.glb` }, // Cheer_with_One_Hand_Up
  victory: { url: `${BASE}/act-victory.glb` }, // Victory_Cheer
  'fist.pump': { url: `${BASE}/act-fist.pump.glb` }, // Victory_Fist_Pump
  'jump.happy': { url: `${BASE}/act-jump.happy.glb` }, // happy_jump_m
  'wave.one': { url: `${BASE}/act-wave.one.glb` }, // Wave_One_Hand
  'wave.help': { url: `${BASE}/act-wave.help.glb` }, // Wave_for_Help
  'sit.down': { url: `${BASE}/act-sit.down.glb` }, // Stand_to_Sit_Transition_M
  'sit.up': { url: `${BASE}/act-sit.up.glb` }, // Sit_to_Stand_Transition_M
  'sit.drink': { url: `${BASE}/act-sit.drink.glb` }, // Sit_and_Drink
  'sit.clap': { url: `${BASE}/act-sit.clap.glb` }, // Sitting_Clap
  'sit.cheer': { url: `${BASE}/act-sit.cheer.glb` }, // Seated_Fist_Pump
  'sit.answer': { url: `${BASE}/act-sit.answer.glb`, loop: true }, // Sitting_Answering_Questions
  'sit.doze': { url: `${BASE}/act-sit.doze.glb`, loop: true }, // Sit_and_Doze_Off
  'sit.thumbs': { url: `${BASE}/act-sit.thumbs.glb` }, // Sit_Thumbs_Up_Right
  'sit.nope': { url: `${BASE}/act-sit.nope.glb` }, // Sit_Finger_Wag_No
  'sit.lean': { url: `${BASE}/act-sit.lean.glb` }, // Sit_Hands_on_Head_Lean_Back
  'sit.floor': { url: `${BASE}/act-sit.floor.glb`, loop: true }, // Sit_Cross_Legged_on_Floor
  sleep: { url: `${BASE}/act-sleep.glb`, loop: true }, // Sleep_Normally
  'sleep.desk': { url: `${BASE}/act-sleep.desk.glb`, loop: true }, // Sleep_on_Desk
  lie: { url: `${BASE}/act-lie.glb`, loop: true }, // Lie_Down_Hands_Spread
  wake: { url: `${BASE}/act-wake.glb` }, // Wake_Up_and_Look_Up
  'pickup.bend': { url: `${BASE}/act-pickup.bend.glb` }, // Male_Bend_Over_Pick_Up
  collect: { url: `${BASE}/act-collect.glb` }, // Collect_Object
  door: { url: `${BASE}/act-door.glb` }, // open_door
  'push.walk': { url: `${BASE}/act-push.walk.glb`, loop: true }, // Push_and_Walk_Forward
  stance: { url: `${BASE}/act-stance.glb`, loop: true }, // Combat_Stance
  block: { url: `${BASE}/act-block.glb` }, // Block1
  parry: { url: `${BASE}/act-parry.glb` }, // Sword_Parry
  dodge: { url: `${BASE}/act-dodge.glb` }, // Stand_Dodge
  'dodge.roll': { url: `${BASE}/act-dodge.roll.glb` }, // Roll_Dodge
  kick: { url: `${BASE}/act-kick.glb` }, // Simple_Kick
  'kick.round': { url: `${BASE}/act-kick.round.glb` }, // Roundhouse_Kick
  uppercut: { url: `${BASE}/act-uppercut.glb` }, // Right_Uppercut_from_Guard
  'jab.guard': { url: `${BASE}/act-jab.guard.glb` }, // Left_Jab_from_Guard
  boxing: { url: `${BASE}/act-boxing.glb`, loop: true }, // Boxing_Practice
  'reload.stand': { url: `${BASE}/act-reload.stand.glb` }, // Standing_Reload
  'draw.shoot': { url: `${BASE}/act-draw.shoot.glb` }, // Draw_and_Shoot_Left
  'roll.cover': { url: `${BASE}/act-roll.cover.glb` }, // Roll_Behind_Cover
  'hit.face': { url: `${BASE}/act-hit.face.glb` }, // Face_Punch_Reaction
  'hit.waist': { url: `${BASE}/act-hit.waist.glb` }, // Hit_Reaction_to_Waist
  electrocuted: { url: `${BASE}/act-electrocuted.glb` }, // Electrocution_Reaction
  knockdown: { url: `${BASE}/act-knockdown.glb` }, // Knock_Down
  'die.slow': { url: `${BASE}/act-die.slow.glb` }, // Shot_and_Slow_Fall_Backward
  'die.back.shot': { url: `${BASE}/act-die.back.shot.glb` }, // Shot_in_the_Back_and_Fall
  'die.gut': { url: `${BASE}/act-die.gut.glb` }, // Fall_Dead_from_Abdominal_Injury
  arise: { url: `${BASE}/act-arise.glb` }, // Arise
  'stand.up': { url: `${BASE}/act-stand.up.glb` }, // Stand_Up1
  pushup: { url: `${BASE}/act-pushup.glb`, loop: true }, // push_up
  situps: { url: `${BASE}/act-situps.glb`, loop: true }, // situps
  jacks: { url: `${BASE}/act-jacks.glb`, loop: true }, // jumping_jacks
  curl: { url: `${BASE}/act-curl.glb`, loop: true }, // bicep_curl
  squat: { url: `${BASE}/act-squat.glb`, loop: true }, // air_squat
  'dance.funny': { url: `${BASE}/act-dance.funny.glb`, loop: true }, // FunnyDancing_01
  'dance.gangnam': { url: `${BASE}/act-dance.gangnam.glb`, loop: true }, // Gangnam_Groove
  'dance.joy': { url: `${BASE}/act-dance.joy.glb`, loop: true }, // Joyful_Dance_with_Hand_Sway
  'dance.hiphop': { url: `${BASE}/act-dance.hiphop.glb`, loop: true }, // Step_Hip_Hop_Dance
  // ── end of Meshy's ──
};

// Each file fetched once for everyone, its clips and the hips' height its
// rig stands at. A file that fails is forgotten, so a later ask tries it
// again (a dropped connection shouldn't cost the clip for the page's life).
const files = new Map(); // url → Promise<{ animations, hips } | null>
function file(url, loader) {
  if (!files.has(url)) {
    const p = (loader ?? gltfLoader()).loadAsync(url).then(
      (g) => ({ animations: g.animations ?? [], hips: g.scene?.getObjectByName('Hips')?.position.y ?? null }),
      () => {
        if (files.get(url) === p) files.delete(url);
        return null;
      },
    );
    files.set(url, p);
  }
  return files.get(url);
}
// the clip an entry names, noting the hips it was made on
function take(entry, loader) {
  return file(entry.url, loader).then((f) => {
    if (!f) return null;
    const c = (entry.take ? f.animations.find((a) => a.name === entry.take) : f.animations[0]) ?? null;
    const hips = entry.hips ?? f.hips;
    if (c && hips != null && c.userData.hips !== hips) c.userData = { ...c.userData, hips };
    return c;
  });
}

export function loadClip(name, { loader = null } = {}) {
  const entry = CLIPS[name];
  return entry ? take(entry, loader) : Promise.resolve(null);
}

export function preload(names = [], { loader = null } = {}) {
  return Promise.all(names.map((n) => loadClip(n, { loader }))).then(() => undefined);
}

// The figures' copies: one per clip and figure template. The library's own
// clip is never changed (everyone shares it); a copy that couldn't be made
// is forgotten with its file.
const copies = new Map(); // `${name}:${key}` → Promise<clip | null>
export function forFigure(name, { hipsY = null, up = null, key = null, ahead = null, loader = null } = {}) {
  const id = key == null ? null : `${name}:${key}`;
  if (id && copies.has(id)) return copies.get(id);
  const p = Promise.all([loadClip(name, { loader }), up && ahead == null ? loadClip('walk', { loader }) : null]).then(([clip, walk]) => {
    if (!clip) return null;
    const from = clip.userData.hips ?? RICK_HIPS;
    const copy = retarget(clip, hipsY ?? from, from);
    const to = up ? (ahead ?? heading(walk, up)) : null;
    if (to != null) faceForward(copy, up, to);
    return copy;
  });
  if (id) {
    copies.set(id, p);
    p.then((c) => {
      if (!c && copies.get(id) === p) copies.delete(id);
    });
  }
  return p;
}

// Rick's clips by name (rick-<name>.glb), whether the registry has them or
// not; the same clip loadClip hands out for the ones it does
export function borrowClips(names = ['idle', 'walk', 'run'], { loader = null } = {}) {
  return Promise.all(names.map((n) => take({ url: `${BASE}/rick-${n}.glb` }, loader))).then((got) => Object.fromEntries(names.map((n, i) => [n, got[i]])));
}

// A copy of `clip` for a figure whose hips stand `hipsY` high (in its rig's
// units): every bone's turn, and the hips' position scaled from `from`'s;
// anything else (a bone's position or scale) left out, as it would stretch
// the figure to Rick's proportions. The hips are found by role (rigCheck's
// ROLES.hips: Meshy's Hips, mixamorig:Hips, Unreal's pelvis, Character
// Creator's hip), the role's first name the clip moves, so a clip from any
// family keeps its root's travel.
export function retarget(clip, hipsY, from = RICK_HIPS) {
  if (!clip) return null;
  const k = hipsY / from;
  const at = (tr) => tr.name.slice(0, tr.name.lastIndexOf('.'));
  const root = checkRig(clip.tracks.filter((tr) => /\.position$/.test(tr.name)).map(at)).roles.hips;
  const tracks = [];
  for (const tr of clip.tracks) {
    if (/\.quaternion$/.test(tr.name)) tracks.push(tr.clone());
    else if (root != null && /\.position$/.test(tr.name) && at(tr) === root) {
      const t = tr.clone();
      for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
      tracks.push(t);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Meshy's idle stands turned off to one side, like a fighter's stance: turn
// a clip's hips about the up axis (`up`, in the hips' parent's space) so its
// mean heading matches `target` (the walk's, which faces ahead).
const hipsTrack = (clip) => clip?.tracks.find((t) => /^hips\.quaternion$/i.test(t.name));
export function heading(clip, up) {
  const v = hipsTrack(clip)?.values;
  if (!v) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < v.length; i += 4) {
    // the twist about `up`: 2·atan2(q.xyz · up, q.w)
    const a = 2 * Math.atan2(v[i] * up.x + v[i + 1] * up.y + v[i + 2] * up.z, v[i + 3]);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx);
}
export function faceForward(clip, up, target) {
  const v = hipsTrack(clip)?.values;
  const now = heading(clip, up);
  if (!v || now == null) return;
  const fix = new THREE.Quaternion().setFromAxisAngle(up, target - now);
  const q = new THREE.Quaternion();
  for (let i = 0; i < v.length; i += 4) {
    q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(fix);
    v[i] = q.x;
    v[i + 1] = q.y;
    v[i + 2] = q.z;
    v[i + 3] = q.w;
  }
}
// every clip but the walk turned to the walk's heading (its own copies: a
// borrowed clip is retargeted first, so Rick's are never turned)
export function faceAhead(clips, up) {
  const ahead = heading(clips.walk, up);
  if (ahead == null) return;
  for (const [n, c] of Object.entries(clips)) if (c && n !== 'walk') faceForward(c, up, ahead);
}
