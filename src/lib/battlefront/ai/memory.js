// What a soldier bot keeps of an enemy it can no longer see, as the game’s AI
// code has it (`Reason/TargetInfo.cpp`, `TargetInfo::setInfo`: the last known
// place is written only while the target is seen, and this game’s soldiers
// keep no trail of it, so it stays where it was the moment sight was lost).
// The senses (`lib/ai/perception`) otherwise follow the truth for a moment
// and then coast along the last velocity; this holds a lost belief still. A
// belief a sound or a felt shot has moved since is the newer word, and is left
// where that put it. Pure: call it after the senses each time they run.
//
//   holdLastSeen(me)      me: the senses’ { now, beliefs }

export function holdLastSeen(me) {
  for (const b of Object.values(me?.beliefs ?? {})) {
    if (b.visible) b.seenPlace = { ...b.at };
    else if (b.heardAt != null && b.heardAt === me.now) delete b.seenPlace;
    else if (b.seenPlace) {
      b.at = { ...b.seenPlace };
      b.vel = { x: 0, y: 0, z: 0 };
    }
  }
}
