# Every character on the site, audited (2026-10-07)

The audit behind [living characters](../superpowers/specs/2026-10-07-living-characters-design.md): every world's player and NPC systems read against the shared animation library and the AI toolkit, before W0. Line numbers are as of that day (origin/main 4f62d49f) and drift; the descriptions are what to look for. Waves W0–W2 fixed most of Rick and Morty's and the galaxy's; the rest is W3–W7's work.

## Rick and Morty: Portal panic arena, Citadel of Ricks + Mortytown, wardrobe turntable, Space Cruiser crew

Routes: /c-137 (Portal panic via src/pages/RickMorty.jsx:149, CruiserFlight via RickMorty.jsx:98, wardrobe via world/RmWorld.jsx:69), /c-137/citadel (src/App.jsx:352; CitadelWorld, Mortytown, wardrobe), /universe/:id? and the galaxy scenes reuse buildCruiser's crew (universe/scene.js:1820, galaxy/scene.js:536, galaxy/surface/scene.js:505)

### Portal panic hero (Rick / Morty / Pickle Rick) (player)

- **Files:** src/components/rickmorty/portal/Portal3D.js:625-646, src/components/rickmorty/portal/Portal3D.js:822-838, src/components/rickmorty/portal/meshyCast.js:80-82, src/components/rickmorty/portal/meshyCast.js:499-554, src/components/rickmorty/portal/rules.js:757-807
- **Model:** Meshy 24-bone GLB (rick, morty), each with its own -idle/-walk/-run. Pickle is an unrigged static Meshy mesh. Shape figure from cast.js if the load fails.
- **Animation:** Shared idle/walk/run blend via animate()→c.update with move=speed/5. Walk and run timeScale come from 0.75+move*0.45, not from ground speed. Rick's 'drink' fidget fires when move<0.05. Pickle uses a sine hop and z-wobble (meshyCast.js:540-542). The portal gun is parented to RightHand (Portal3D.js:633-641).
- **AI:** None (input). Movement and aim come from rules.js stepPlayer.
- **Problems:**
  - The body yaw snaps instantly to the aim each frame (Portal3D.js:825), with no smoothing. Moving opposite or sideways to the aim plays the forward walk/run clip, so the hero backpedals or strafes with skating feet.
  - At 6.2 m/s, move=speed/5 clamps to 1 and the run plays at a fixed 1.2x for both Rick (h 2.35) and Morty (h 1.95). The stride is not matched to ground speed (meshyCast.js:535-537), so the feet slide.
  - hit is always 0 for the hero (Portal3D.js:829). A 'hurt' event only shakes the camera and bursts sparks (Portal3D.js:770-773), with no hit clip and no flinch.
  - A 'shot' event only flashes the gun tip (Portal3D.js:763-765), with no shoot clip. The walk/run clip swings the gun arm, so the gun points wherever the clip swings. The shape figure pinned the gun arm forward (cast.js:510); the Meshy one has no equivalent.
  - The 'drink' fidget (meshyCast.js:523-527) fires whenever Rick stands still, including mid-fight while firing. The flask hand is likely the RightHand that holds the gun (plausible). Firing does not cancel the fidget.
  - 'lost' plays no fall clip, and wave clear or combo plays no cheer. The figure is simply hidden during a dash or travel (Portal3D.js:828).
  - Pickle Rick is unrigged, so he only hops while moving (meshyCast.js:541) and has no idle life apart from the breathe scale.
- **Opportunities:**
  - Turn the body toward the move heading with a damped turn, and twist only the upper body to the aim. Alternatively, use universe/locomotion.js's hip-yaw-to-travel plus chest-ahead (locomotion.js:126-131, after()) and its stride-phase pacing (locomotion.js:149-166) in place of meshyCast's fixed pace.
  - Play play(c,'shoot',{hold:0,speed:2}) on 'shot', masked to the upper body so the legs keep walking (meshyCast blends the full body today, meshyCast.js:529-531). Alternatively, pin the RightArm/RightForeArm toward the aim after mixer.update.
  - Play 'hit' on 'hurt', 'fall' with hold on 'lost', 'cheer' on 'offer' or wave clear, and 'taunt' on 'combo'.
  - Suppress the fidget while inp.fire or in combat (g.status==='play' and enemies alive).

### Portal panic enemies (Meeseeks, Gromflomite, Cop Rick, Morty clones, Gazorpian; Cronenberg and Cronenblob) (enemy)

- **Files:** src/components/rickmorty/portal/Portal3D.js:841-864, src/components/rickmorty/portal/rules.js:429-514, src/components/rickmorty/portal/rules.js:322-358, src/components/rickmorty/portal/meshyCast.js:263, src/components/rickmorty/portal/meshyCast.js:546-553
- **Model:** Meshy GLBs. Meeseeks, gromflomite, cop, mortyclone (morty with a shirt-swap shader) and gazorpian are rigged with their own idle/walk/run. Cronenberg and blob are unrigged static meshes (not in RIGGED, meshyCast.js:263). Shape figures (cast.js) are the fallback.
- **Animation:** Rigged enemies use the shared speed blend with move=speed/3. Unrigged ones get a sine wobble and breathe (meshyCast.js:546-551). A hit flash and the gazorpian windup become a non-uniform body squash (Portal3D.js:862, meshyCast.js:553). Mixer actions start at a random time (meshyCast.js:417), so the idles are not in unison.
- **AI:** A hand-rolled per-kind state machine, not lib/ai. Rushers (Meeseeks, clones, Cronenberg, blob) head straight at the player with a sine wobble (rules.js:489-493). Gromflomite and cop keep a distance band, strafe, flip strafe at random and fire bolts (rules.js:445-460). The Gazorpian runs walk→windup→charge (rules.js:461-488). Obstacle avoidance is a ray-ish side-step (rules.js:519-537), and enemies are pushed apart by separate().
- **Problems:**
  - Facing snaps instantly to the player except during charge or windup (Portal3D.js:860-861). Strafing Gromflomites and Cops therefore move sideways or backward while playing the forward run clip, and the feet slide.
  - With move=speed/3, nearly every kind is clamped to full run at 1.2x (Meeseeks 4.3, Gromflomite 3.4, Cop 3.1 and clone 5.0 m/s all exceed 3). The Gazorpian charges at 13 m/s on the same 1.2x run (rules.js:480-481). There is no stride matching.
  - The hit reaction is a 0.12 s squash (rules.js:355, Portal3D.js:862). The shared 'hit' clip is never played.
  - The windup feeds hit=0.5+sin(time*40)*0.3 (Portal3D.js:862), which vibrates the textured Meshy body's scale at about 6 Hz. It reads as jitter, not a wind-up.
  - On death the figure is hidden the same frame and replaced with a smoke puff (Portal3D.js:752-755, 864). The 'fall' clip is never used.
  - Gromflomite and Cop fire bolts with no shoot clip and no gun model on the Meshy figure (the gun is only added to the player, Portal3D.js:633). The 'bolt' and 'kill' events carry no enemy id (rules.js:326, 338), so the renderer cannot tell who fired or died.
  - Cronenberg and blob are unrigged and only wobble, so they have no limb motion (the shape version swung stumpy legs, cast.js:492-495).
- **Opportunities:**
  - Add id to emit('bolt'), emit('kill') and the hit path in rules.js. Then call meshy.play(c,'shoot') for the shooter, play(c,'hit') on flash, and play(c,'fall',{hold:0.6}) by keeping a dying figure for about 0.8 s before pooling it.
  - Play the Gazorpian's 'punch' or 'taunt' as its windup instead of the squash jitter.
  - Face the velocity heading with a damped turn while walking or strafing, and turn to the player only when stopped or shooting. For strafers, use locomotion.js's hip yaw.
  - Scale walk/run timeScale by groundSpeed/(clip stride*figure scale), for example locomotion.js strideOf().
  - Give the strafers lib/ai/steer.js context steering and lib/ai/squad.js shot tokens, so they stop flipping strafe at random (rules.js:460) and stop firing all at once.

### Portal panic bosses (Snowball, the big Cronenberg, the Cromulon, Evil Morty) (boss)

- **Files:** src/components/rickmorty/portal/Portal3D.js:866-886, src/components/rickmorty/portal/rules.js:568-725, src/components/rickmorty/portal/meshyCast.js:543-551
- **Model:** Meshy GLBs. Only evilmorty is rigged (its own idle/walk/run). Snowball (a mech), bigcronenberg and cromulon are unrigged static meshes.
- **Animation:** Evil Morty uses the shared speed blend. Snowball and the big Cronenberg get the generic wobble. The Cromulon gets a sine bob (meshyCast.js:543-545) plus an air offset (Portal3D.js:880). The hit and windup inputs only squash.
- **AI:** A hand-rolled state machine per boss (rules.js:597-720): snowball stalk/windup/charge/volley/rain, cronenberg lumber/spit/split, cromulon beams/notes, evilmorty idle/vanish. No lib/ai.
- **Problems:**
  - Snowball's Meshy model is a rigid mesh, so its four mech legs don't move while it stalks or charges at 15 m/s (rules.js:619-620). The shape version swung mechLegs (cast.js:496-499).
  - The yaw snaps to the player every frame (Portal3D.js:883).
  - Evil Morty reappears and fires a 3-bolt spread and 12-bolt ring (rules.js:712-717) with no 'shoot' or 'taunt' clip. The vanish is just a visibility flicker (Portal3D.js:884).
  - 'bossDown' gives only particles and shake (Portal3D.js:792-796), with no 'fall' clip. 'bossPhase' has no reaction.
  - The Cromulon's 'notes' and 'beam' attacks have no mouth or head motion. The Meshy cromulon is static apart from the bob.
- **Opportunities:**
  - Evil Morty: play 'shoot' on reappear, 'taunt' on bossPhase, 'fall' with hold on bossDown, and 'scared' or 'hit' on flash.
  - Snowball: drive procedural leg swing on the Meshy mesh's leg nodes, or rig it with rig.js figure() POSES (stride).
  - Snowball and the big Cronenberg: a squash-and-stretch lunge on windup, timed to the 0.8 s windup, in place of the static squash.

### Portal panic allies (Meeseeks from the box) and butter robots (companion)

- **Files:** src/components/rickmorty/portal/Portal3D.js:888-913, src/components/rickmorty/portal/rules.js:862-906
- **Model:** Ally: Meshy meeseeks (rigged, h 1.6). Butter robot: cast.js shape figure (makeCast('butter')).
- **Animation:** The ally uses the shared speed blend with move=|v|/3, so it is in full run at 5.2 m/s. The butter robot gets a sine bob only (Portal3D.js:910) and does not go through animate().
- **AI:** The ally homes on the nearest enemy and punches every 0.45 s when in reach (rules.js:883-904). Butter robots orbit the player on a fixed circle (rules.js:862-870).
- **Problems:**
  - a.vx and a.vy are never zeroed when the ally reaches its target or has none (rules.js:893-904). The ally keeps playing the full run clip while standing still and punching.
  - The facing is atan2(a.vx||0, a.vy||1) (Portal3D.js:898), so a fresh ally with v=0 snaps to +z, and there is no turn smoothing.
  - The 'punch' event exists (rules.js:902) but the shared 'punch' clip is never played. 'poof' plays no 'cheer' or 'happy' clip before vanishing.
- **Opportunities:**
  - Zero the ally's velocity in reach. Then play(c,'punch',{speed:1.6}) on each 'punch' (add the ally index to the event) and 'cheer' on poof ('Ooh, yeah! Can do!').
  - Smooth the ally's yaw, and face the target while punching.

### Shape-built cast fallback (cast.js makeCast/animate) (other)

- **Files:** src/components/rickmorty/portal/cast.js:461-522, src/components/rickmorty/portal/Portal3D.js:315
- **Model:** Procedural primitives baked per joint into vertex-coloured meshes (cast.js:401-459). These are limb groups, not a skeleton.
- **Animation:** Procedural: sine leg and arm swing at c.stride rad/s times move, a gun arm fixed at -1.25, Meeseeks arms waving, bob, head sway and hit squash (cast.js:488-522).
- **AI:** Same as the Meshy figure it stands in for (Portal3D drives both via animate()).
- **Problems:**
  - The swing frequency is per-kind c.stride and independent of ground speed, so its legs slide too (cast.js:490-491).
  - None of these figures can play the action library, because play() requires c.mixer (meshyCast.js:437).
- **Opportunities:**
  - Keep it as the load-failure fallback only. If it stays visible on soft WebGL, map rig.js POSES (punch, hurt, fall) onto its limb groups for hit and death.

### Citadel player Rick C-137 (wardrobe body) (player)

- **Files:** src/components/rickmorty/citadel/people.js:102-104, src/components/rickmorty/citadel/people.js:203-211, src/components/rickmorty/citadel/layout.js:17, src/components/middleearth/towns/walker.js:146-152, src/components/rickmorty/citadel/CitadelWorld.jsx:628
- **Model:** Meshy 24-bone GLB, the wardrobe body ('wd:<body>' via withWardrobe), with idle/walk/run/sit loaded (people.js:81). Walt and Jesse bodies use Rick's clips via borrowClips.
- **Animation:** Shared speed blend with move=h.speed/RICK.run(6.8). Walk at 3.6 m/s gives move 0.53 and timeScale about 0.99. Run at 6.8 gives 1.2x.
- **AI:** None (input). makeWalker turns face at RICK.turn 11 rad/s.
- **Problems:**
  - The pace is not stride-matched (meshyCast.js:535-537). Rick is 1.85 m here but 2.35 m in Portal panic on the same timeScale curve, so at most one of the two can match.
  - He has no flask fidget: people.js KINDS.rick and the wardrobe kinds carry no 'fidget' (people.js:17, wear.js:28), unlike MESHY.rick (meshyCast.js:80).
  - No action clip plays on any story beat: none on spotted ('seen') or 'caught' by Cop Ricks (CitadelWorld.jsx:685-692), a won herd, a vote, or a talk. The sit clip is loaded but never used for him.
- **Opportunities:**
  - Play 'scared' on watcher 'seen', 'fall' or 'hit' on 'caught', 'cheer' on herd 'won' or Locos 'won', and 'wave' when a talk opens. These are the same calls RmWorld.jsx already makes (RmWorld.jsx:304,843,881,904).
  - Carry fidget:'drink' onto the wardrobe Rick bodies (withWardrobe could copy MESHY[who].fidget).
  - Use locomotion.js stride pacing and lean for the player.

### Citadel standing/seated cast (concourse CAST + Mortytown CAST: Customs Rick, Day Care Rick, Cowboy Rick, worker, Cop Morty, Meeseeks janitor, Council guards, Candidate Morty; Big/Slick/campaign Morty, Rick D. Sanchez III, Simple Rick, Cop Morty + partner) (npc)

- **Files:** src/components/rickmorty/citadel/people.js:96-115, src/components/rickmorty/citadel/people.js:214-226, src/components/rickmorty/citadel/townsfolk.js:60-77, src/components/rickmorty/citadel/townsfolk.js:117-125, src/components/rickmorty/citadel/layout.js:129-139
- **Model:** Meshy 24-bone GLBs, each with its own idle/walk/run. Sitters (Day Care Rick, Big Morty) also have -sit.
- **Animation:** Idle only (animate(f,t,0)). Sitters get the sit clip at weight 1 with mixer.update directly (people.js:180-184), bypassing c.update. A random clip phase means the idles are not in unison.
- **AI:** None beyond a proximity look: within 4.5 m of Rick the whole body turns toward him, otherwise back to its home facing (people.js:220-224, townsfolk.js:119-123).
- **Problems:**
  - The turn rate is a fixed 0.08 per frame (people.js:223, townsfolk.js:122), so it depends on frame rate (about 2.4x faster at 144 Hz). It turns the whole body rather than the head, and sitters never look at all.
  - Action-flavoured lines have no animation: the Meeseeks janitor 'mopping' stands idle, and Day Care Rick 'turns a page of his magazine' on a plain sit loop (layout.js:131,135).
  - No greeting, talk gesture or reaction clip plays when Rick approaches or talks. Candidate Morty at the election booth does nothing.
  - Sitting bypasses c.update, so c.play() one-shots on a sitter would never fade in (the oneShot weights are only driven in update, meshyCast.js:503-521).
  - The code is duplicated between people.js and townsfolk.js (make, seat and animate at people.js:84-100,175-185 against townsfolk.js:49-64,102-112).
- **Opportunities:**
  - Do a head and neck look-at on the Head bone (clamped, damped by dt), with the whole-body turn only past about 70 degrees.
  - Play 'wave' once per approach inside 4.5 m and 'taunt' or 'happy' as talk gestures while that NPC's line is up. Candidate Morty plays 'cheer' and 'wave' in election mood. The Meeseeks janitor loops a mop clip (a new Meshy action) or 'dance' while idle.
  - Use 'sitcross' for Day Care Rick's idle variety, and route sitters through c.update with the sit as the base pose so play() works on them.
  - Move make, seat and animate into one shared helper in meshyCast or a new citadel/figures.js.

### Citadel Day Care Mortys (the herd) (npc)

- **Files:** src/components/rickmorty/citadel/daycare.js:13, src/components/rickmorty/citadel/daycare.js:104-202, src/components/rickmorty/citadel/people.js:186-196, src/components/rickmorty/citadel/people.js:227-232
- **Model:** Meshy morty with the shirt-swap shader (KINDS.daycare), its own idle/walk/run.
- **Animation:** Shared speed blend via walkTo: the pace is measured from the displacement and smoothed, move=pace/6.8, and the yaw is turned with dt*10 (people.js:187-196).
- **AI:** A hand-rolled flee/wander/slide-along-walls state machine (daycare.js:104-179). Penned Mortys potter about (daycare.js:182-202). No lib/ai.
- **Problems:**
  - Wander at 0.9 m/s gives move 0.13 and about 82% idle weight. Penned pottering at 0.54 m/s gives move 0.08 and about 97% idle. In both cases the Mortys glide in the idle pose, and the feet slide.
  - Fleeing at 3.1 m/s gives move 0.46, which is a calm full walk at 0.96x. A scared Morty walks rather than runs.
  - m.scared (daycare.js:115) never drives a clip, so the shared 'scared' clip goes unused. Being penned or a 'won' herd plays no 'cheer' or 'happy'. A scatter on 'out' plays no clip either.
- **Opportunities:**
  - Map move from the actual pace with a lower idle threshold, or switch to locomotion.js stride pacing. Raise HERD.flee to about 4.5 or use the run clip when scared.
  - On the rising edge of scared, play(f,'scared',{hold:0.2}) over the blend with an upper-body mask, then run. Play 'cheer' on 'penned' for that Morty and 'happy' for all on 'won'.
  - Swap the drift wander for lib/ai/steer.js context steering (flee from Rick plus seek the gate as interests, walls as dangers). That would replace the hand-rolled slide (daycare.js:146-157).

### Citadel Cop Ricks on red alert (watchers) (enemy)

- **Files:** src/components/rickmorty/citadel/people.js:233-238, src/components/rickmorty/citadel/story.js:154, src/components/middleearth/towns/watchers.js:120-251, src/components/rickmorty/citadel/CitadelWorld.jsx:681-697
- **Model:** Meshy cop, its own idle/walk/run.
- **Animation:** Shared speed blend via walkTo, with the yaw turned to w.face+w.look.
- **AI:** The shared middleearth watchers state machine (patrol/suspicious/alert/chase/search/back/caught) on lib/ai/perception (beliefs, detection timer) and lib/ai/search (shared search), with the COPS table.
- **Problems:**
  - The look-about is added to the body yaw (people.js:237), so the whole Cop sweeps ±0.9 rad while walking or standing instead of turning his head.
  - Patrol at 1.6 m/s gives move 0.24, which is about 33% idle weight while moving, so the feet slide. Chase at 5.2 m/s gives a 67/33 run/walk blend at 1.09x, which is not stride-matched.
  - There is no clip for 'alert' or 'seen' (a point or shout), 'caught' (a grab or punch) or 'search' (looking about).
- **Opportunities:**
  - Apply w.look to the Head and Spine bones after mixer.update rather than to group.rotation.
  - On 'seen', play 'taunt' (a point) or a short 'shoot' stance. On 'caught', play 'punch'. During a long 'search', play a scanning head look.
  - Feed watcher modes into the clips for both this world and the other watcher towns (Bree, Moria) from one place.

### Citadel walking crowd and Mortytown walkers (Ricks/Mortys on CROWD_LOOPS, Evil Rick, street Mortys) (crowd)

- **Files:** src/components/rickmorty/citadel/people.js:41-42, src/components/rickmorty/citadel/people.js:55-68, src/components/rickmorty/citadel/people.js:239-246, src/components/rickmorty/citadel/townsfolk.js:83-97, src/components/rickmorty/citadel/townsfolk.js:126-131, src/components/rickmorty/citadel/layout.js:146-151
- **Model:** Meshy rigged GLBs (rick, constructionrick, daycare morty, suitrick, detectiverick, sweaterrick, evilrick, morty), each with its own idle/walk/run.
- **Animation:** Shared speed blend with move=pace/RICK.run. Position comes from a pure function of time along a closed polyline (along()).
- **AI:** None: a fixed path, s0+dir*pace*t.
- **Problems:**
  - At pace 1.17-1.5 m/s, move is about 0.19, giving an idle/walk blend of roughly 55/45 (Evil Rick at 1.06 m/s is about 71% idle). Walkers glide half in the idle pose, and the feet slide.
  - The yaw is set straight from the segment heading (people.js:244, townsfolk.js:129), so it snaps 90 degrees at the corners of the rectangular loops and about 26 degrees at the vertices of the 14-gon ring.
  - There is no avoidance: walkers on the same loop in opposite directions (dir -1 every third, people.js:165) pass through each other and through Rick. They never stop, look at Rick or react. Evil Rick keeps walking while you talk to him (CitadelWorld.jsx:746-747).
  - Walkers are not in the concourse groundWorld movers (scene.js:458), so they get no contact blob, unlike the cast, mortys and cops.
- **Opportunities:**
  - Raise the idle cutoff for path walkers, or pass move about 0.5 for 1.3 m/s, and drive the stride phase from the distance travelled (locomotion.js:149-160).
  - Smooth the corners with turnTo(dt*6) or a Catmull-Rom on the loop (citadel/curve.js exists).
  - Add lib/ai/steer.js separation from each other and from Rick, then let a walker pause, turn its head, 'wave' at Rick or chat in pairs (needs and advertisements per the HANDOFF's 'Citadel crowd' item).
  - Have Evil Rick stop and face Rick while the talk is open.
  - Add people.crowd to the groundWorld movers.

### Citadel static instanced crowd (rally, day and election crowds) (crowd)

- **Files:** src/components/rickmorty/citadel/crowd.js:53-146, scripts/crowd.mjs:1-12
- **Model:** Meshy figures baked by scripts/crowd.mjs: skin removed, frozen on one idle frame, decimated and drawn as an InstancedMesh per kind.
- **Animation:** None: still statues. Every instance of a kind holds the identical frozen pose.
- **AI:** None. Placement is by mood (crowdFor). Static colliders make the rally one block (layout.js:265-285).
- **Problems:**
  - Up to 40 or more frozen figures with no breathing, sway or head turn (crowd.js:117-136). The rally crowd doesn't cheer on election day or react to red alert beyond being hidden.
- **Opportunities:**
  - Add a per-instance phase attribute and a vertex-shader breathe, sway and bob (cheap, no skeleton).
  - Promote the 2-4 instances nearest the camera to live Meshy figures from people.js's cast (an LOD swap), playing 'cheer' or 'dance' in election mood and 'scared' on red.
  - Bake two or three crowd poses per kind (idle frame, cheer frame) and alternate between them per instance for variety.

### Council of Ricks, chamber clerks, Simple Rick's line workers (npc)

- **Files:** src/components/rickmorty/citadel/people.js:118-150, src/components/rickmorty/citadel/people.js:247-248, src/components/rickmorty/citadel/scene.js:400-406
- **Model:** Meshy councilrick-a/b/c (with -sit), suitrick and sweaterrick (clerks), factoryrick (workers). All rigged.
- **Animation:** Council: the sit clip alone via mixer.update. Clerks and workers: idle only, standing.
- **AI:** None.
- **Problems:**
  - Council members don't gesture while speaking in the hearing convo and don't react to 'contempt' (scene.js:407-409 is fx and shake only).
  - Clerks stand idle at their consoles with no typing. Factory workers stand idle at the line and don't react to 'layer', 'cut', 'spoilt' or 'good' (scene.js:400-406).
- **Opportunities:**
  - Play talk gestures on the speaking council member ('taunt' and 'happy' over sit with an upper-body mask), and 'sitcross' when they are not speaking.
  - Give the workers a work loop (a new Meshy action, for example 'assemble') with 'cheer' on 'good' and 'scared' on 'spoilt'. Give the clerks a typing loop.

### Mortytown Locos (hunt side quest) (npc)

- **Files:** src/components/rickmorty/citadel/locos.js:40-105, src/components/rickmorty/citadel/townsfolk.js:133-144
- **Model:** Meshy loco-a, loco-b and loco-c, rigged with their own idle/walk/run.
- **Animation:** Shared speed blend with move=l.speed/6.8, and the yaw turned with dt*10.
- **AI:** A hand-rolled state machine (hiding/following/delivered): found by distance plus sightClear, follow-the-leader chain, leash.
- **Problems:**
  - The comment says a hiding Loco 'crouches out of sight', but he just stands in the idle pose (townsfolk.js:142).
  - backHome() teleports the Loco to his hide instantly (locos.js:40-43, 81) instead of the 'slink back' the doc describes.
  - Being found plays no surrender or 'scared' clip, and being 'delivered' plays no reaction.
- **Opportunities:**
  - Use a crouch pose (rig.js-style procedural, or a Meshy crouch clip) while hiding. Play 'scared' with a hands-up hold on 'found' and 'sitcross' or a sulk on 'delivered'.
  - Walk the Loco back to his hide with the existing walkTo instead of teleporting.

### Citadel online ghosts (other players as Ricks) (other)

- **Files:** src/components/rickmorty/citadel/scene.js:154-169, src/components/rickmorty/citadel/people.js:291-295, src/components/middleearth/towns/ghosts.js:139-150
- **Model:** Meshy rick (rigged) in a translucent material.
- **Animation:** Shared speed blend via people.other().step(t, move).
- **AI:** None (network positions, interpolated).
- **Problems:**
  - ghosts.js:150 passes t + g.x as the clock. meshyCast.update derives dt from t - c.last (meshyCast.js:500), so the ghost's own x movement leaks into dt. A ghost walking +x at 3.6 m/s plays its clips about 4.6x too fast. One walking -x gets dt clamped to 0 and freezes.
- **Opportunities:**
  - Pass t to animate and use a phase offset elsewhere, or give meshyCast.update an explicit dt.

### Wardrobe turntable figure (other)

- **Files:** src/components/rickmorty/wardrobe/preview.js:55-60, src/components/rickmorty/wardrobe/preview.js:115-124, src/components/rickmorty/wardrobe/preview.js:127-155, src/components/rickmorty/wardrobe/gear.js:391-458
- **Model:** Meshy 24-bone body from wardrobe BODIES. Walt and Jesse use Rick's borrowed clips (clips.js). Gear is parented to the Head and RightHand bones, so it follows the clips.
- **Animation:** The idle clip only (only 'idle' is loaded), via figure.update(t,0,0).
- **AI:** None.
- **Problems:**
  - Nothing happens when a look changes: a colour, gear or body swap is silent. There is no fidget (the KINDS built from BODIES have no fidget).
- **Opportunities:**
  - Call cast.play(figure,'happy') or 'taunt' on a gear or colour change, and 'wave' on the first show. Add an idle fidget ('drink' for Ricks) every 8-15 s.

### Space Cruiser crew (Rick at the wheel, Morty beside him) (companion)

- **Files:** src/components/rickmorty/cruiser3d.js:104-142, src/components/rickmorty/cruiser3d.js:195-202, src/components/rickmorty/cruiser3d.js:262-267
- **Model:** Meshy rigged wardrobe bodies loaded with clips ['sit','walk'] (the walk is only used for faceAhead).
- **Animation:** The sit clip at weight 1. The crew's update() calls mixer.update directly (cruiser3d.js:196-199) and bypasses c.update.
- **AI:** None.
- **Problems:**
  - The crew don't react to bank, roll, dive or a roll into a portal (pose() moves only the ship, cruiser3d.js:262-267). Rick's hands aren't on the wheel and nobody leans.
  - Bypassing c.update means play() one-shots and fidgets can never show on the crew. This build is reused by the universe and galaxy scenes too.
- **Opportunities:**
  - After mixer.update, counter-rotate the Spine and Head bones against bank and roll (inertia lean), and let Morty play 'scared' on dive or roll-in. Rick gets an upper-body 'drink' fidget over sit.
  - Drive the crew through c.update with sit as the base pose so the shared clips work.

**Notes:** Cross-cutting issues:
(1) Portal panic and the Citadel never use the shared action clips. No `.play(` call exists in portal/ or citadel/ (grep), and only Rick's 'drink' fidget fires (meshyCast.js:523-527). rickmorty/world/RmWorld.jsx already plays cheer, scared, fall, hit and shoot on the player (RmWorld.jsx:304,843,881,904,914), and world/npc.js uses lib/ai. That is the local pattern to copy.
(2) The pace in meshyCast.update is a fixed curve, timeScale=0.75+move*0.45 (meshyCast.js:535-537). Each caller maps speed to move with its own divisor: Portal enemies use /3, the Portal hero /5 and the Citadel /RICK.run=6.8. Nothing accounts for figure scale or clip stride. Slow walkers (crowd at 1.3 m/s, herd at 0.9, patrol at 1.6) sit 30-97% in the idle pose while moving. universe/locomotion.js already solves this: strideOf() measures the foot travel and the phase follows the ground covered, plus hip-yaw for strafe or backpedal, lean, and hurt/down (locomotion.js:1-24,149-166). Promote it into meshyCast.update (optional toes/speed/side inputs) so every Meshy figure gets it.
(3) play() blends a one-shot over the whole body and scales idle/walk/run by (1-over) (meshyCast.js:529-531). There is no upper-body mask, so a wave, shoot or hit while moving freezes the legs and the feet slide. Add a mask (filter tracks to Spine and its children) or an additive layer.
(4) play() lazily fetches clips-<name>.glb on first use (meshyCast.js:438-445), so the first hit or shoot reaction lands late. Preload SHARED_CLIPS in worlds that react.
(5) Shared clips are hips-retargeted but not faceAhead-turned (meshyCast.js:441), unlike idle/walk/run (meshyCast.js:358). They may face off-axis on figures whose rig is turned (plausible).
(6) Sitting figures bypass c.update (people.js:180-184, townsfolk.js:107-111, cruiser3d.js:196-199), and seat() is duplicated three times (people.js:96, townsfolk.js:60, cruiser3d.js:127). One-shots and fidgets therefore can't play on any seated figure. Make 'sit' a base state inside meshyCast.
(7) Turns are frame-rate dependent at 0.08 per frame (people.js:223, townsfolk.js:122), while other places use dt*10. Facing snaps instantly in Portal3D (825, 861, 883, 898) and on crowd loops (people.js:244, townsfolk.js:129).
(8) The ghosts' t + g.x clock bug (ghosts.js:150) breaks clip speed for any meshyCast ghost (the Citadel, and any town passing a Meshy make).
(9) Code is duplicated: the people.js and townsfolk.js make, seat, animate and look-round blocks, and crowd.js's lightRamp copy of meshyCast's (crowd.js:23-30 against meshyCast.js:46-54).
(10) Events lack actor ids: rules.js 'bolt', 'kill' and 'hit' (rules.js:326,338,826) carry no enemy id, so Portal3D can't target reactions. Fix that before wiring clips.
(11) AI: only the Cop Ricks touch lib/ai (perception and search via middleearth/towns/watchers.js). Portal enemies, the herd, the Locos and the crowd are all hand-rolled. The HANDOFF lists 'The Citadel's crowd' (needs and advertisements) as left to do. steer.js (context steering) and squad.js (shot tokens) fit the Portal strafers and the herd directly.

## Universe map: on foot (footScene.js crews and troops, landings/ people, multiplayer guests) plus the npcs/ ships

Routes: / (universe map is the front door, App.jsx:272), /universe, /universe/:id (e.g. /universe/marvel; on-foot after landing on any furnished planet: furnish.js PLANETS list)

### Player on foot (crew lead: Rick/Morty, Walt/Jesse, Han/Chewie, Luke/Artoo) (player)

- **Files:** src/components/universe/footScene.js:88-105 (PARTY), src/components/universe/footScene.js:203-245 (loadModel), src/components/universe/footScene.js:253-279 (rigScene: Rick's borrowed clips), src/components/universe/footScene.js:2345-2348 (walkFrame, player walk), src/components/universe/footScene.js:2436-2450 (hurt/down), src/components/universe/footScene.js:2510-2552 (drawPeople), src/components/universe/locomotion.js:105-235, src/components/universe/foot.js:211-262 (walk), src/components/universe/gunplay.js:1-35
- **Model:** Rick, Morty: Meshy cast GLBs with own idle/walk/run (meshyCast via createMeshyCast(withWardrobe())). Walt, Jesse (/models/albuquerque), Han, Luke (/models/galaxy/crew), Chewie (/models/cockpit/chewie.glb): Meshy 24-bone GLBs, no clips of their own, Rick's idle/walk/run borrowed and retargeted (clips.js borrowClips/retarget/faceForward). Artoo: built from shapes (footScene.js:380-420). Anything that fails to load falls back to built 'han' shapes.
- **Animation:** locomotion.js. It re-implements the idle/walk/run blend (locomotion.js:136-146) but improves on it: it measures each clip's stride (strideOf) and drives walk/run time from ground covered (timeScale 0, time set from phase, locomotion.js:147-160), so there's no foot sliding. On top of that it adds procedural hip yaw for strafe and backpedal, a lean into turns, an acceleration pitch, a jump tuck, a landing crouch, a 0.35 s hurt flinch (chest and head back), and a knees-then-fallTurn knockdown (footScene.js:2525-2531). gunplay.js aims the gun arm, chest and head at the locked trooper. The walk/run phase starts random (locomotion.js:109) and the idle clips start at a random time (footScene.js:174, meshyCast.js:417). Built Artoo only rocks and spins his dome (footScene.js:414-418).
- **AI:** none (player input). walk() turns at FOOT.turn 2.6 rad/s, and speed eases at 12 m/s².
- **Problems:**
  - No shared action clip is ever played on foot: grep finds no play()/SHARED_CLIPS in footScene.js. Hit = procedural flinch (locomotion.js:219-225), down = procedural fallTurn (footScene.js:2527-2530), shooting = gunplay kick only.
  - The Meshy-cast path skips meshyCast's update(): fig.update calls loco.update and c.mixer.update directly (footScene.js:230-236). Rick's drink fidget (meshyCast.js:523-528) never fires on foot, and a c.play() overlay would never fade in, because the oneShot weighting lives only in meshyCast update().
  - locomotion.update sets idle+walk+run weights to sum to 1 (locomotion.js:139-146) with no (1 - over) term, so an overlay clip can't compose with it the way meshyCast.update does (meshyCast.js:529-531).
  - Walt, Jesse, Han, Luke and Chewie idle on Rick's restless Meshy idle, which swings the hips about a right angle and stoops (landings/people.js:6-9 says so). All of them, the 2.28 m Wookiee included, walk with Rick's gait.
  - The rigScene/rigged path has no play() and no hipsY kept, so shared clips can't be retargeted onto Walt/Jesse/Han/Luke/Chewie as written (footScene.js:253-279, 152-195).
  - No reaction in context: there's no cheer on 'cleared' (footScene.js:2425), no wave when another pilot's crew turns up (footScene.js:2216), and no look or turn toward a landing figure whose line is playing (scene.js:4139-4141 shows the text and voice only). No emote input at all (controls.js has none).
  - The player's head looks only at troopers (gunplay set look, footScene.js:2549), never at the people you talk to.
  - Artoo is built shapes. A static public/models/galaxy/surface/r2d2.glb exists unused.
- **Opportunities:**
  - Make locomotion composable. Add an `over` weight to locomotion.update that scales idle/walk/run by (1 - over), and run meshyCast's oneShot fade (factor it out of meshyCast.js:503-522 as an exported overlay(c, dt)) from loadModel.update (footScene.js:230-236). Then c.play(name) works on foot and Rick's drink fidget comes back.
  - Give rigScene figures the same c-shape: keep hipsY (footScene.js:265) and expose play(name), so shared clips-*.glb retarget onto Walt, Jesse, Han, Luke and Chewie as they do on cast figures.
  - Hooks. In hurt() (footScene.js:2436): play 'hit' (fade 0.1), then 'fall' with hold for the down phase in place of fallTurn on rigged figures; keep fallTurn for built ones. On the 'cleared' emit (2425): 'cheer' or 'happy'. On the 'friend'/'alt' emit (2216): 'wave'. Add an emote key in controls.js for wave/dance/taunt, with 'drink' for Rick.
  - Near a `say` spot (nearSpot, footScene.js:2075): call gunplay.set with look ~0.6 and dir toward the figure's head, so the player looks at whoever is talking.
  - Calmer idle for the borrowed-clip figures. Walt has his own public/models/cockpit/walt-idle.glb; elsewhere, office/people.js's 'stand' pose; or retarget a calmer Meshy idle in place of rick-idle.
  - Artoo: load r2d2.glb in built('artoo') and keep the procedural rock and dome turn.

### Crewmate companion (the second of the party: Morty/Rick, Jesse/Walt, Chewie/Han, Artoo/Luke) (companion)

- **Files:** src/components/universe/footScene.js:2354-2378 (follow/shoot brain), src/components/universe/footScene.js:2510-2552 (drawPeople, same draw as the player), src/components/universe/footScene.js:2414, src/components/universe/footScene.js:2496, src/components/universe/footScene.js:2533
- **Model:** Same loaders as the player (Meshy cast with own clips, Meshy GLB on Rick's clips, or built Artoo).
- **Animation:** Same as the player: stride-matched locomotion.js blend plus procedural lean and yaw, gunplay aim. move = speed/FOOT.run, so walk and run are drawn at the right speeds.
- **AI:** Hand-rolled, about 25 lines (footScene.js:2354-2378). It steers to a point 1.4 m behind and 1.3 m to the side of the player, runs when the gap is over 4 m, and otherwise faces the nearest live trooper within 30 m or the player's facing. It shoots the nearest trooper within 26 m every 0.9-1.8 s. It doesn't use lib/ai: no senses, no cover, no tokens.
- **Problems:**
  - Invulnerable and never reacts. Troop bolts that hit 'mate' are dropped (only r.hit === 'me' is handled, footScene.js:2496), melee hits on the mate are dropped (footScene.js:2414), and its hurt is hard-wired to 0 (footScene.js:2533).
  - No arrival behaviour. move is binary (1, or 0.3 while turning) once gap > 0.6 m (footScene.js:2362-2364). At run speed, walk()'s 12 m/s² decel takes about 1.5 m, so it overshoots the follow point, turns round and comes back: stop-start shuffling with no hysteresis.
  - It never looks at the player or at the landing figures, and never gestures when its own crews.js foot line plays (the comms box only).
  - No action clips: no cheer on a kill or 'cleared', no 'scared' (Morty, Jesse) when a squad comes over the horizon, no 'wave' at guests.
- **Opportunities:**
  - Arrive properly: move ∝ clamp((gap - 0.4 m) / 2 m), with a 0.6/1.2 m start/stop hysteresis, or steer.js context steering round rocks.solids.
  - Brain from lib/ai. Use utility.js to weigh follow, engage, take cover (spatial.js picks a spot beside the player with a rock between it and the squad) and regroup when hurt. Share squad.js shot tokens with the player so the two don't double-fire.
  - Make it hittable: route 'mate' hits to a mateHurt that sets a flinch (motion.hurt) and plays the 'hit' clip, then 'fall' and a get-up on low health instead of dying.
  - Personality one-shots via the composable locomotion above: Morty/Jesse 'scared' on the 'squad' event, 'cheer' or 'taunt' (Rick, Han) on 'cleared', 'wave' on 'friend', and a head look at the player while its comms line plays.

### Ground troops on rigs: Gromflomites, Federation cops, Gazorpians, Morty guards (Meshy cast); DEA agents (hank.glb), cartel gunmen (tuco.glb) (enemy)

- **Files:** src/components/universe/sides.js:146, src/components/universe/sides.js:199, src/components/universe/footScene.js:1591-1622 (troopFig), src/components/universe/footScene.js:2554-2622 (drawTroops), src/components/universe/foot.js:46-64 (TROOPS), src/components/universe/foot.js:274-361 (squad, march)
- **Model:** R&M side: Meshy cast kinds with own idle/walk/run (public/games/meshy/gromflomite-*, cop-*, gazorpian-*; mortyguard is the mortyclone kind). BB side: /models/albuquerque/hank.glb and tuco.glb, Meshy 24-bone, on Rick's borrowed clips via rigScene (cloneSkinned copies, footScene.js:1604).
- **Animation:** locomotion.js stride-matched blend, hip yaw for the strafing, procedural hurt flinch (0.35 s), and gunplay aim with the head on whichever of you is nearer. Death is procedural: knees bend, then the whole group is turned flat with fallTurn and sunk into the ground (footScene.js:2585-2593). Portal, freeze and shrink kills are FX. Idle start is random (meshyCast.js:417, footScene.js:174) and so is the loco phase (locomotion.js:109), so they're not in unison.
- **AI:** Hand-rolled march() (foot.js:307-361), no lib/ai. Each trooper targets the nearest of you and the mate by distance, which it knows from over the horizon (no perception or LOS). It turns toward the target, closes to a random hold distance, backs off if too close, strafes on a sine wave, and fires when within 0.25 rad of facing. Gazorpians close in and deal melee damage. A probe calls a squad in after 8 s of sight. No cover, no flanking, no shot tokens, no retreat, no search.
- **Problems:**
  - Slow-motion jogging. The blend input is relative to the troop's own top speed: move = speed / (TROOPS.speed * 1.2) (footScene.js:2602). At its normal 2.2-3.4 m/s pace move ≈ 0.83, so the run weight is about 0.9, and that run clip is then paced by ground speed, giving a jog at roughly half cadence. The party uses speed/FOOT.run instead.
  - When you go down, every trooper is set alive:false, dead:2.5 (footScene.js:2445). drawTroops then computes k = min(1, 2.5/0.95) = 1, so they snap flat instantly with no fall, lie there for the 2.6 s down phase, and sink once march resumes.
  - No shared clips. Hit, death and melee are procedural or missing. A Gazorpian's melee hit (foot.js:352) has no punch animation; it only calls hurt() (footScene.js:2414).
  - Knows where you are at any range, and all fire independently, so there's no 'one shooter at a time' rhythm and no search when you duck behind the ship.
  - Never taunts or cheers. The head is forward until engaged (aim), so they don't look at you while closing in.
  - Each spawn runs strideOf for walk and run per trooper (createLocomotion, footScene.js:1611; locomotion.js:96-101), which is 96 mixer updates per spawn. It isn't cached per kind.
- **Opportunities:**
  - Fix the blend input: move = |speed| / FOOT.run + |side| / FOOT.run (footScene.js:2602), as drawPeople does.
  - When you go down: play 'cheer' or 'taunt' (a looping 'dance' for Gazorpians), then march them off over the horizon instead of killing them (footScene.js:2445).
  - Hit: play 'hit' (or the galaxy's /models/galaxy/troops/clip-hit.glb) on t.hitAt in moveBolts. Death: 'fall' with hold (or clip-die / clip-dieFwd chosen by knock direction) instead of fallTurn for rigged troops. Gazorpian melee: 'punch' when march pushes into hits.
  - AI: port the galaxy surface's hostileStep pattern (docs HANDOFF PR 4: surface/hostiles.js) into march(). Use perception.js createSenses with line of sight against the landing's solids and the ship, hold/strafe/close/back/cover/flank/search modes, squad.js shot and melee tokens, and nerve so a squad down to its last member retreats. Rocks give cover.
  - Cache strides per troop kind or url to cut the per-spawn strideOf cost.

### Ground troops built from shapes: stormtroopers, scout troopers, Jack's crew, probe droid (enemy)

- **Files:** src/components/universe/sides.js:88, src/components/universe/sides.js:199, src/components/universe/footScene.js:306-321 (LOOKS), src/components/universe/footScene.js:337-378 (probe), src/components/universe/footScene.js:424-560 (built person), src/components/universe/footScene.js:2611
- **Model:** Procedural capsule and box people (built()), with groups named like Meshy bones so gunplay can pose them. Probe: a ball with a red eye. Unused Meshy-rigged GLBs already exist: public/models/galaxy/troops/stormtrooper.glb and scouttrooper.glb (have Hips/LeftToeBase skins).
- **Animation:** Bob/swing only. Leg and arm swing on phase += dt*(3+move*7) (footScene.js:538), so leg speed isn't tied to ground speed and the feet slide. Idle is totally static (swing = 0 at move 0, no breath). No locomotion: no lean, no hurt flinch (got.b.update(dt, move) only, footScene.js:2611). Death is the whole-group fallTurn with no knees. Probe: sine hover plus yaw sway.
- **AI:** Same march() as the rigged troops (foot.js:307-361). Probe: hangs back and calls a squad in (foot.js:332-338).
- **Problems:**
  - Foot sliding (phase not ground-paced, footScene.js:538).
  - Every built figure starts at phase 0 (footScene.js:530). A squad spawned in the same frame at the same move swings in lockstep.
  - Frozen idle, no hit reaction, a stiff plank-like death.
  - The Star Wars side's on-foot enemies are the lowest-fidelity characters on the map, while rigged trooper GLBs sit unused.
- **Opportunities:**
  - sides.js:88: stormtrooper figure → { url: '/models/galaxy/troops/stormtrooper.glb' }, scout → '/models/galaxy/troops/scouttrooper.glb'. troopFig's url path (rigScene + cloneSkinned + locomotion) then works unchanged, the same way as DEA and cartel. The galaxy's clip-die/clip-hit/clip-kneel/clip-taunt in public/models/galaxy/troops/ can be retargeted for reactions.
  - Jack's crew: use a Meshy figure (any albuquerque extra such as pete/declan) instead of built 'jackscrew'.
  - If built figures stay as fallbacks: seed phase randomly, and advance it by ground distance / stride (speed*dt/0.7 m) instead of a fixed rate.

### Other pilots' crews on foot (multiplayer guests) (other)

- **Files:** src/components/universe/footScene.js:2145-2160 (guestWalker), src/components/universe/footScene.js:2182-2218 (setGuests), src/components/universe/footScene.js:2220-2254 (guestsFrame), src/components/universe/footScene.js:2256 (walker wire format)
- **Model:** Same loaders as your party (loadParty with the sender's wardrobe looks), tinted for 'another dimension' doubles.
- **Animation:** locomotion.js stride-matched blend from the wire's speed and side, gunplay aim from wire aim. Position and facing are eased with k = 1-exp(-10dt), and the guest snaps if more than 6 m off (footScene.js:2228).
- **AI:** none (network-driven).
- **Problems:**
  - The wire carries only n, f, h, speed, side and aim (footScene.js:2256). A guest being hit, going down or playing any action shows nothing on other screens: motion has no hurt or down (footScene.js:2240).
  - No greeting. Your crew emits a 'friend'/'alt' comms line (footScene.js:2216), but neither side's figures wave or turn to look.
- **Opportunities:**
  - Add `act` (the last one-shot name plus a start time) and hurt/down to walker() and protocol writeFoot, and replay them with the composable c.play on the guest's figure.
  - On a guest's first appearance: 'wave' on your mate plus a head look; for doubles from another dimension, 'scared' or 'taunt'.

### Landing figures from the Portal panic cast (opts.meshy: Beth, Jerry, Summer, President, Rick at C-137, Mar-Sha, Gazorpians, Morty Jr., Squanchy, Birdperson, Phoenixperson, Unity, Gearhead, Flippy Nips, Scroopy, Glexo, Risotto) (npc)

- **Files:** src/components/universe/landings/people.js:63-85 (idling), src/components/universe/landings/landings.js:300-326, src/components/universe/landings/landings.js:620-776, src/components/universe/landings/furnish.js:229-238 (spotOf: faces the ship), src/components/universe/landings/furnish.js:258-279 (static matrix), src/components/universe/landings/furnish.js:340-342 (update(t, dt)), src/components/universe/scene.js:4139-4152 (say on approach)
- **Model:** Meshy 24-bone GLBs with their own idle/walk/run (public/games/meshy/<name>-*.glb), via createMeshyCast and loadPartyFigure.
- **Animation:** Own idle clip only: fig.update(dt, 0) → footScene blend() at move 0 (footScene.js:134-144), with a random clip start (meshyCast.js:417) plus a random hold of up to 2 s (people.js:71-80), so they're not in unison. The figure is placed once with matrixAutoUpdate=false, facing the ship's landing spot (furnish.js:231-238, 268-271).
- **AI:** none. They stand forever, facing where the ship came down. scene.js shows the line and plays the voice when you're within r + 3 m.
- **Problems:**
  - Never turns or looks toward the player. The object matrix is frozen (furnish.js:268-271), and furnish.update(t, dt) is given no player position (footScene.js:2272).
  - No body response to being talked to: no wave on approach and no talk gesture or nod while the voiced line plays (scene.js:4150).
  - No fidgets. They go through footScene's blend, not meshyCast.update, so a cast kind with a fidget (Rick at C-137, landings.js:326) never drinks.
  - No context reactions: they don't flinch, scare or hide when a squad comes and bolts fly past them, and can't be hit.
  - No life between visits: no sitting (12 figures have -sit.glb; 'sitcross' is shared), no milling about. The resort has guests, but nobody walks.
- **Opportunities:**
  - Pass context into furnish.update: update(t, dt, { me: player head world pos, near }) from footScene.js:2272. In people.js idling, wrap fig.model in a yaw group, ease its yaw toward the player within about 8 m, and aim the Head bone at the player's head (a small gunplay-style head look, or rig.js-style limb directions).
  - On first entry into the say radius: c.play('wave'). While the line plays: 'happy' (Jerry, Unity, Glexo) or 'taunt' (Gazorpian, Scroopy). Use the meshyCast instance (k.cast) directly and call c.update(t, 0, 0) instead of fig.update, so oneShots and fidgets work.
  - Per-figure idle variety from the shared set: Squanchy 'sitcross', a resort 'dance' loop, Gazorpians 'taunt'. 'scared' when the scene's bolts land within about 10 m (needs a scene event into furnish).
  - Ambient wander for crowds: a small lib/ai utility pick (stand, wander to a spatial.js spot, sit) with the walk clip paced by locomotion.js.

### Landing figures, the site's own (opts.url: Saul, Mike, Gus, Jesse, Michael, Dwight, Jim, Jack, Mark, Bumblebee) (npc)

- **Files:** src/components/universe/landings/people.js:48-61 (standing), src/components/office/people.js:121-135 (person API: look, gesture, cheer, wave), src/components/office/people.js:343-430 (update: breath, head look-round), src/components/universe/landings/landings.js:179-234, src/components/universe/landings/landings.js:384, src/components/universe/landings/landings.js:431-433, src/components/universe/landings/landings.js:515-599
- **Model:** Meshy GLBs (/models/albuquerque, /models/office/cast, /games/caribbean/jack.glb, /models/invincible/mark.glb, /games/meshy/rollout/bumblebee.glb) posed by bones from their T-pose by office/people.js (no clips).
- **Animation:** Procedural: the office 'stand' pose (arms down), a chest breathe, and a head that looks round on sines with a per-person random seed (office/people.js:305, 413-419), so they're out of phase. Static placement facing the ship (furnish.js).
- **AI:** none.
- **Problems:**
  - office/people.js already provides look(target), wave(), cheer(), gesture('nod'|'shake'|'shrug'|'fold'), and people.js calls none of them (people.js:57-60). When you walk up and Saul says 'Better call Saul!', his head keeps wandering on its sine.
  - They can't turn their body to you (frozen matrix, as above).
  - No shared Meshy clips, even though these are all on the Meshy skeleton that the clips-*.glb retarget to.
- **Opportunities:**
  - In people.js standing, return update(t, dt, ctx). Call p.look(ctx.meHead) within the say radius and p.look(null) after; p.wave() on first approach; p.gesture('nod') or 'shrug' while the voiced line plays (Michael, Dwight); p.cheer() for Jesse's 'Yeah, science!'.
  - Optionally move them onto createMeshyCast plus borrowed clips (like the crews) so the shared wave/happy/taunt clips play. Saul 'taunt' and Mike 'fold' suit them.

### Avengers HQ heroes (Thor, Black Widow, Iron Man armour, Hulk) (npc)

- **Files:** src/components/universe/landings/marvel.js:147-154, src/components/avengers/world/people.js:46-79 (clipsFor), src/components/avengers/world/people.js:99-120 (person), src/components/universe/landings/landings.js:412-415
- **Model:** Sketchfab rigs (avengers/people/models.js), not Meshy, with their own idle/walk/run clips.
- **Animation:** Own clip: p.play('idle', { speed: 0.9 }) once. play() resets to time 0 (`from = 0`), so every hero starts at the clip's first frame (each has its own clip, so it doesn't look like unison).
- **AI:** none.
- **Problems:**
  - Idle only. No look at the player, no reaction to approach or to Thor's and the Hulk's 'say' lines.
  - A non-Meshy skeleton, so the shared Meshy clips don't retarget as-is.
- **Opportunities:**
  - Use rig.js loadFigure/figure on the template: act() for their own clips, and procedural POSES for reactions on approach (Thor 'proud', Hulk 'windup'→'punch' as his 'smash?', Widow 'guard'), then back to idle.
  - Start idle at a random time: play('idle', { from: Math.random() * dur }). Head look-at on the Head bone with the same ctx as the other landing figures.

### Static landing figures (Gandalf, Sam the hobbit, Mario, the resort's guests) (npc)

- **Files:** src/components/universe/landings/middleearth.js:181-197, src/components/middleearth/kit.js:436 (makeGandalf), src/components/middleearth/kit.js:738 (makeHobbit), src/components/universe/landings/landings.js:62-63, src/components/universe/landings/landings.js:443-452, src/components/universe/landings/landings.js:770-782
- **Model:** Gandalf and Sam: procedural meshes from middleearth/kit.js. Mario (/models/universe/mario.glb) and the resort guests (/models/c137/rm/resortguest-a.glb, -b.glb): static GLBs with no skin and no animations (checked).
- **Animation:** none. Fully frozen statues (no update returned). Gandalf, Sam and Mario still say lines on approach.
- **AI:** none.
- **Problems:**
  - Talking statues: they speak (scene.js:4139) but don't move at all, not even breathing.
  - Mario has a skinned model elsewhere (public/models/mario64/mario.glb has skins) that isn't used here.
- **Opportunities:**
  - At minimum: a breath and a head turn toward the player on their procedural groups (Gandalf's body/hat/staff groups, kit.js:444-475), with a staff raise on approach.
  - Mario: use the skinned mario64/mario.glb with the Mario 64 world's own clips (idle, wave or jump on approach). Resort guests: regenerate as Meshy rigged figures so they can 'dance' or 'sitcross' from the shared set.

### Named NPCs in space (Saul, Mike, Fett, Lando, Vader, customs, Hondo, Birdperson, Squanchy, Evil Morty, Tammy, Jerry, Tuco, Hank) (enemy)

- **Files:** src/components/universe/npcs/index.js:46-71, src/components/universe/npcRules.js, src/components/universe/npcs/brains/
- **Model:** Ships only (trafficModels.js kinds: saulcaddy, slave1, tieadvanced, gunship, lowrider…). No humanoid figure. Pilots appear only as comms portraits (Faces.jsx).
- **Animation:** n/a (ship flight).
- **AI:** lib/ai: perception senses per row (npcs/index.js:21-22), utility-weighted nemesis (bait, break, search), behaviour trees for inspector and trickster, pack tokens for hunters (HANDOFF PR 3).
- **Problems:**
  - None of these characters exist on foot. Saul's merchant brain parks at a station, but you can't meet him in person, even though the Albuquerque Saul/Mike/Hank/Tuco GLBs are already used on foot (landings.js:179-180, sides.js:199).
- **Opportunities:**
  - When an ally or merchant NPC is parked near a landing (merchant, informant, tagalong brains), stand their figure by their ship at the landing as a people.js figure with a say line: Saul's url, Birdperson's meshy. A nemesis like Tuco could land and lead the squad on foot as a named troop.

**Notes:** 1. Duplicated blend, three copies. footScene.js:134-144 blend(), meshyCast.js:529-536 update(), and locomotion.js:136-160 all weight idle/walk/run from `move`. locomotion.js is the best local pattern and worth promoting. It measures each clip's stride (strideOf, locomotion.js:37-84) and drives the walk/run phase from ground covered, so there's no foot sliding. On top it adds hip yaw for strafe and backpedal, lean, a jump tuck, a crouch, a flinch and a knockdown. meshyCast.update still uses pace = 0.75+move*0.45, which slides. Fold locomotion's stride pacing into meshyCast (or let meshyCast.update accept a pace/phase), and give locomotion the (1 - over) overlay term so shared one-shots compose.

2. The shared action library is not used anywhere on the universe map's ground. The on-foot code calls the mixer directly (footScene.js:230-236, 2605-2609), which skips meshyCast's oneShot and fidget logic. So the first change is an overlay(c, dt) export from meshyCast, called from loadModel.update, rigged.update and drawTroops. rigScene must also keep hipsY and expose play() so Walt, Jesse, Han, Luke, Chewie, DEA and cartel figures can retarget clips-*.glb.

3. Landing figures get no context. furnish.update(t, dt) (furnish.js:340) receives no player position and freezes each thing's matrix (furnish.js:268). Pass { meHead, near, boltsNear } from footScene.js:2272, and give people.js figures an inner yaw group. That unlocks look-at, turn-to-face, wave and talk gestures; office/people.js already implements look, wave, nod and shrug for the url figures.

4. Troop blend bug. footScene.js:2602 normalises by the troop's own top speed, which gives a slow-motion run. Use FOOT.run as drawPeople does.

5. Down-phase bug. footScene.js:2445 marks every trooper dead with dead=2.5, so they snap flat instantly.

6. The mate is invulnerable. footScene.js:2414 and 2496 handle only 'me'.

7. Unused assets that fit: public/models/galaxy/troops/stormtrooper.glb and scouttrooper.glb (Meshy-rigged) plus clip-die/clip-hit/clip-taunt there; public/models/galaxy/surface/r2d2.glb; public/models/cockpit/walt-idle.glb; public/models/mario64/mario.glb (skinned).

8. AI. The ships use lib/ai fully. Everything on foot is hand-rolled: foot.js march() and the mate's follow block. The surface hostiles' hostileStep (galaxy, HANDOFF PR 4) is the ready pattern to port: senses with LOS against landing rocks and the ship, cover, flank, search, squad.js tokens. steer.js context steering (not yet wired into any world, per the HANDOFF) fits the mate's follow and troops pathing round rocks.solids.

9. Perf. createLocomotion runs strideOf (48 samples × 2 clips) for every spawned trooper (footScene.js:1611). Cache it per kind or url.

## Galaxy (Star Wars surface worlds, /galaxy/:system/surface)

Routes: /galaxy/:system/surface (GalaxySurface: surface/scene.js, where every character below appears), /galaxy/:system (space scene galaxy/scene.js: ships and online pilots' ships only. No on-foot characters; the cockpit view reuses cockpit/ and is out of scope), /galaxy/:system/mission (GalaxyMission)

### Player hero on foot (lead of people[], any of heroes.js roster: Luke/Leia/Han/Chewie/Ahsoka/Boba/Rick/Morty/Walt/Jesse/Artoo) (player)

- **Files:** src/components/galaxy/surface/scene.js:551-589 (load via loadPartyFigure + gunplay + saber), src/components/galaxy/surface/scene.js:1906-1953 place(): motion object -> fig.update/after, src/components/galaxy/surface/scene.js:1920 holder.rotation.set(0,yaw,0), src/components/galaxy/surface/scene.js:1922-1924 fallen tip, src/components/galaxy/surface/scene.js:1914-1918 riding, src/components/galaxy/surface/scene.js:1317-1334 dodge roll, src/components/galaxy/surface/scene.js:1385-1478 power() abilities, src/components/universe/footScene.js:152-198 rigged(), 203-245 loadModel, 253-280 rigScene, 287 loadParty, src/components/universe/locomotion.js:117-221
- **Model:** Meshy 24-bone GLBs (models/galaxy/crew/*.glb, cockpit/chewie.glb, albuquerque/walt|jesse.glb) on Rick's borrowed idle/walk/run; Rick/Morty from createMeshyCast; Artoo = catalog r2d2 via modelFigure (CREW_MODELS scene.js:112)
- **Animation:** Best rig in galaxy: footScene rigged() + universe/locomotion.js with a full motion object (speed, side, turn, air, hurt) -> clips phase-locked to ground covered (strideOf), hips turned for strafe/backpedal, lean into turns/starts, jump tuck + landing crouch, procedural hurt flinch. Arms posed by gunplay.js (aim, head look along aim) and saber.js (guard, strokes, block, throw).
- **AI:** n/a (input). walker.js walk(): turn 11 rad/s toward heading.
- **Problems:**
  - Dodge roll never shows: stepDodge sets holder.rotation.x (scene.js:1333), then place() runs later in the frame (scene.js:2333) and rotation.set(0,yaw,0) at scene.js:1920 wipes it. The dodge is a slide. Also a sideways dodge would flip about X (sign only of the forward component, scene.js:1333), a plank cartwheel about the feet, not a tuck roll.
  - Death in an assault = whole holder tipped 90 deg like a plank (scene.js:1922-1924). locomotion's `down` input (knees, arms out) and fallTurn() are never fed (motion at scene.js:1934 has no `down`). The clips-fall shared clip is unused.
  - No shared action clips can play at all. loadModel/rigScene return no play() (footScene.js:212-245), so even Rick's cast `c.play` is unreachable. No cheer on quest done or post captured, no hit clip (only the 0.35 s procedural flinch, knock fixed 0.5 at scene.js:1934), no shoot recoil body.
  - Abilities have no body action: Force push/pull/roar only set aim=1 (scene.js:1394-1420); medpack, detonator throw, overcharge, sprint and hop have no gesture (scene.js:1428-1478).
  - Yaw snaps instantly to the camera on swing, power and throw (scene.js:1272, 1392, 1555): a 180 deg pop, and a turn spike into locomotion's lean.
  - Riding = the standing idle pushed down 0.55 m at the seat with update(dt,0) (scene.js:1914-1918). Legs clip through the speeder or tauntaun. No sit pose.
  - saberBody.js (UAL Sword_Idle/Sword_Attack hip/leg layer, commit a549d345) is on origin/main, not on this branch. A lit saber here only poses the arms.
- **Opportunities:**
  - Expose play(name,{loop,hold,fade}) on loadPartyFigure figures by retargeting clips-<name>.glb with clips.js retarget(clip, hipsY) inside rigScene/rigged (or export meshyCast's sharedClip). Then: cheer on quest complete or post captured, hit on hurt(), fall on assault down, taunt for Chewie's roar, drink for medpack, punch/shoot for Force push and detonator throw, wave on emotes.
  - Feed motion.down from state.fallen and play clips-fall instead of the holder tip. Replace the dodge with a proper roll: move the dodge after place(), or tilt about the hips/centre and lower via loco.drop.
  - Riding: borrow rick-sit.glb (borrowClips(['sit'])) for seated riders, plus a lean from the ride's bank and pitch.
  - Merge origin/main for saberBody.js; ease yaw toward the camera over ~0.1 s instead of snapping.

### Party crewmate (people[1-lead], the other of the ship's two or the hero's partner) (companion)

- **Files:** src/components/galaxy/surface/scene.js:533-543, src/components/galaxy/surface/scene.js:1853-1867 follow logic, src/components/galaxy/surface/scene.js:1901-1903 waits while you ride, src/components/galaxy/surface/scene.js:1946-1951 aimK 0 for non-lead
- **Model:** Same as the player (Meshy 24-bone + Rick clips, or modelFigure for Artoo)
- **Animation:** Same locomotion pipeline as the player (motion object, stride-matched, hip turn, lean). hurt is always 0 for the mate (scene.js:1934 `mine ?`). Gun carried at aim 0, never raised.
- **AI:** Hand-rolled follow: a goal 1.1 m behind and 1.7 m beside you, walk() toward it, runs if over 7 m, teleports if over 40 m, matches your yaw at rest (scene.js:1853-1867). No lib/ai. Never shoots, never takes cover, not a target for hostiles (activity.js hostileAim only counts spawns with side 'yours'). Stands still while you ride (scene.js:1903).
- **Problems:**
  - Purely decorative in fights: aimK=0 (scene.js:1949), no target selection, no damage taken, no reactions.
  - Never looks at you or anything else. When idle it copies your yaw (scene.js:1867).
  - Teleports when over 40 m (scene.js:1858-1862) with no hidden respawn.
  - No idle variety: no fidgets, no sit when you idle, no cheer or wave.
- **Opportunities:**
  - Give the mate a hostileStep-style head (activity.js already runs friendly spawns via friendlyAim/side 'yours'): register it as a 'yours' target so it takes tokens, picks cover with lib/ai/spatial and fires through its existing gp (raise aimK).
  - Shared clips: cheer on kills or quest done, wave when you return after being away, hit/fall when hurt, sitcross or drink when you idle for 20 s near a want.
  - Head look-at toward you or the nearest threat through gunplay's `look`/dir for the non-lead (currently hard 0).

### Ambient people on Meshy rigs (actors.js life: Han, Luke, Leia, Chewie/wookiee, Greedo, Gamorrean, Bith, Tuskens, Twi'leks, Lando, Lobot, Ugnaughts, rebels, Senate guards, Jedi, Neimoidians, Mustafarians, Obi-Wan, Jango, Shaak Ti, Mando, Vader-era who's who; garrison rebels; Jabba 'still') (npc)

- **Files:** src/components/galaxy/surface/actors.js:44-132 brain/think, src/components/galaxy/surface/actors.js:217-220 anyFigure (crew first), src/components/galaxy/surface/actors.js:298-352 update (near-turn 313-316, fig.update 343), src/components/galaxy/surface/actors.js:395-401 say, src/components/galaxy/surface/crew.js:19-49, src/components/galaxy/surface/crewList.js, src/components/galaxy/surface/needs.js, src/components/galaxy/surface/garrison.js, src/components/universe/footScene.js:134-143 blend, 174 random phase, 186 blend without motion
- **Model:** Meshy 24-bone GLBs (public/models/galaxy/crew/*.glb). All use Rick's idle/walk/run via rigScene/retarget. Jabba (hutt) is unrigged jabba.glb.
- **Animation:** Shared idle/walk/run blend, but through footScene's legacy blend() (no motion object): crew.js:48 calls fig.update(dt, move) with move = b.speed/2.4 (actors.js:343). Playback timeScale = 0.8+0.4*move, not stride-matched. Whole body turns by holder yaw at 3 rad/s. Jabba: a sine scale 'breath' only (crew.js:32-36).
- **AI:** Hand-rolled think(): wander near home / patrol path / still (147 'still' entries); needs.js pickWant uses lib/ai/utility for site wants (only Bespin, Coruscant and Yavin define wants); relate() flee/chase by kind with line of sight. Turns to you within 4.5 m only if it talks, has a quest or an id (actors.js:313-316).
- **Problems:**
  - Foot sliding: blend() pace 0.8+0.4*move (footScene.js:139-142) is not tied to ground speed. think() ramps b.speed 0->pace (actors.js:113) while the clip runs at about 0.8-1.0x, and the flee pace (x1.6, actors.js:72) puts the run clip at about 1.1x for about 1.9 m/s.
  - Walk and run start at independent random times (footScene.js:174), so in the walk-run crossfade the two clips' legs are out of phase (scissoring). locomotion fixes this, but only when given motion.
  - No head/eye look-at. 'Looking at you' is the whole body yawing (actors.js:316). Non-talkers ignore you entirely, even at 1 m.
  - No action clips in context: arriving at a want just idles for `pause` s (actors.js:100-109) for food/rest/work/view; talking returns text only (actors.js:395-401, scene.js:997) with no wave on approach or talk gesture; fleeing has no 'scared' clip.
  - Ambient life doesn't hear gunfire: activity.heard() stims (activity.js:640) never reach actors. Civilians stand idle through firefights.
  - Everyone walks with Rick's gait (Vader, Jabba's guards, Ugnaughts alike). Jabba never moves his head or tail and never laughs.
  - Rigid upright for 147 'still' guards beyond the idle clip. No fidgets (meshyCast's fidget system is not reused).
- **Opportunities:**
  - Hand crew figures a motion object: have think() report speed (and turn from yaw delta) and call fig.update(dt, move, {speed: b.speed*METRE, side:0, turn}) + fig.after(...) as scene.js:1934-1937 does. createLocomotion is already built in rigged() (footScene.js:176), so foot sliding and phase scissoring go away for free.
  - Retarget clips-*.glb into rigScene and map want kinds to clips: food/cantina -> drink, rest -> sitcross (or rick-sit.glb), view -> idle with a head turn, work -> punch/taunt loop; fire -> sitcross. Wave once when you first come within TALK (the `near` rising edge at actors.js:326); talk -> happy/taunt one-shot per say(); flee -> scared then run.
  - Head look-at: rotate the Head/Neck bones toward the player within about 6 m (clamped ±70 deg), weighted, after the mixer. Applies to every crew figure.
  - Feed activity's shot stims into actors: relate()-style flee with 'scared' for non-combatants within about 25 m of a shot.
  - Fidgets for stills: a random shared one-shot every 8-20 s (cheer, wave, drink) weighted by kind.

### Ambient people on static or built models (Battlefront troopers: stormtrooper, sandtrooper, snowtrooper, scouttrooper, shoretrooper, deathtrooper, clone, battledroid, superdroid, hothtrooper; Ewoks, Jawas, Gungans, Geonosians, Kaminoans, Yoda, Vader, droids; built villagers and pilots) (crowd)

- **Files:** src/components/galaxy/surface/actors.js:137-191 modelFigure (bob branch 180-185, walk-only 169-174), src/components/galaxy/surface/catalog/battlefront.js:14-25, src/components/galaxy/surface/catalog/index.js:21-23 (battlefront overrides), src/components/galaxy/surface/catalog/people.js:8,12,16 (stale anim entries), src/components/galaxy/surface/figures.js:430-444 built person stride, src/components/galaxy/surface/figures.js:704-712 buildFigure
- **Model:** Battlefront II remaster GLBs (unskinned: 0 skins, 0 animations, checked in public/models/galaxy/surface/*.glb); Sketchfab statics (jawa, ewok, gungan, yoda, vader...); c3po has a Mixamo idle only; figures.js procedural shapes for villager/pilot/droid/etc.
- **Animation:** Static models: a vertical bob + z-sway scaled by move (actors.js:180-185). Standing still they are fully frozen (both terms × move = 0). The stormtrooper is the most common life kind (18 entries) and stands stock-still. Idle-only (c3po): idle clip + bob. Built figures: sine leg/arm swing, phase rate 2.5+6*move (figures.js:435), not tied to speed; a small head sway when idle.
- **AI:** Same actors.js think() (wander, patrol path, still), needs/relate as above.
- **Problems:**
  - Sliding statues: every Battlefront trooper and droid glides with no leg motion (actors.js:181-184) on patrol paths (32 path entries) and wanders.
  - The Battlefront import overwrote rigged Sketchfab files at the same path. people.js:8/12/16's `anim` for stormtrooper/clone/superdroid is dead config (battlefront.js is last in GROUPS, catalog/index.js:21-23), so those kinds lost their walk clips.
  - Frozen when still: no breathing or idle at all for static models (move=0 kills both terms).
  - No turn-in-place step, no look-at, no reactions. Built figures' stride rate is unrelated to speed (figures.js:435), so they skate at higher speeds.
- **Opportunities:**
  - Rig the Battlefront humanoids on the Meshy 24-bone skeleton (Meshy rigging API, as scripts/meshy-galaxy.mjs did for luke/leia) or re-import with skeletons from swbf-unmunge. Then they flow through crewFigure/rigScene and get Rick's idle/walk/run, locomotion and the shared clips (shoot, hit, fall, scared).
  - Until then, give modelFigure a non-zero idle: breathing scale and a slow weight shift when move=0 (as crew.js:35 does for Jabba).
  - Remove the stale anim entries or add `rig: true` handling so a rigged model isn't silently replaced.

### Creatures, walkers and mounts (banthas, rancor, dewbacks, wampas, tauntauns, womp rats, acklay, kaadu, shaak, BEASTS in figures.js; AT-AT/AT-ST/AT-AP/AT-TE; ride mounts) (creature)

- **Files:** src/components/galaxy/surface/actors.js:162-185 modelFigure branches, src/components/galaxy/surface/actors.js:193-211 propFigure, src/components/galaxy/surface/figures.js:575-585 beast gait, src/components/galaxy/surface/props/core.js:710-733 shaak, src/components/galaxy/surface/rides.js:25-27, src/components/galaxy/surface/scene.js:1955-1966 ride update
- **Model:** Mixed: bantha (skinned, Bantha_Walk only), rancor (skinned, 'Unreal Take' idle only), atst/atap (idle+walk), atat/atte (walk only); dewback/wampa/tauntaun/womprat/acklay/kaadu are unskinned statics; shaak and others are kit props; mounts are figures.js BEASTS.
- **Animation:** Walk-only models: walk weight 1, timeScale 0.5+move, 0 when stopped, so they freeze mid-stride (actors.js:169-174). Idle+walk: weights blended but timeScale never set (actors.js:163-168), so native speed at any pace. Idle-only (rancor): idle clip plus a bob while it slides (actors.js:175-179). Statics: bob/sway. BEASTS: procedural leg swing at 1.8+5*move rad/s (figures.js:580). Mounts: update(dt, speed/6).
- **AI:** Ambient: actors.js think() wander/path. Hostile creatures (rancor chase, acklay, womp rats) run through hostileStep 'close' (hostiles.js:202-214).
- **Problems:**
  - Rancor chases at h.chase m/s playing its idle clip, sliding (actors.js:175-179 + activity.js:578).
  - Bantha/AT-AT stop mid-stride with legs apart (actors.js:173 timeScale 0).
  - Walker clip rates are not matched to speed (actors.js:166, 173). The giant AT-AT feet skate.
  - Ride mounts (tauntaun, kaadu, bantha) are figures.js shapes although Meshy tauntaun/kaadu statics exist in library.js. The rider stands on them (see player).
  - No attack animation: a rancor/acklay melee 'swipe' is only a damage event (activity.js:624-627), with no lunge or roar.
- **Opportunities:**
  - strideOf() from locomotion.js can measure any rigged walk clip (bantha, AT-AT, AT-ST) given toe bones; otherwise set timeScale = groundSpeed/clipSpeed with a per-model clipSpeed field in the catalog.
  - Blend walk to idle on stop (crossfade weight) instead of timeScale 0; for walk-only models freeze on a planted frame (strides.plant).
  - Meshy animation API for quadrupeds (rancor attack/walk) or hand-keyed lunge poses on swipe.

### Quest hostiles and allies (activity.js spawns: troopers that shoot back, duellists Vader/Dooku/Obi-Wan/Anakin, droidekas, womp rats, rancor; 'yours' allies) (enemy)

- **Files:** src/components/galaxy/surface/activity.js:261-281 figure() choice, src/components/galaxy/surface/activity.js:334-336 heldBlade, src/components/galaxy/surface/activity.js:487-495 death tip, src/components/galaxy/surface/activity.js:501-514, 540 knock/stagger, src/components/galaxy/surface/activity.js:550-555 saber swing, src/components/galaxy/surface/activity.js:574-578 flinch + fig.update, src/components/galaxy/surface/hostiles.js:114-122 walkTo, src/components/galaxy/surface/hostiles.js:129-264 hostileStep, src/components/galaxy/surface/heldBlade.js:14-30
- **Model:** crewFigure first (Meshy + Rick clips) for most; for duellists with a blade, the static catalog model is preferred (activity.js:268), so Vader is a static bob; Dooku and Obi-Wan fall through to the Meshy crew rig; otherwise modelFigure statics (Battlefront troopers) or figures.js.
- **Animation:** fig.update(dt, moving || (b.to && !near) ? 0.6 : 0) (activity.js:578): a binary move value, no speed, no motion object. Hit = holder z-wobble (activity.js:576). Stagger/knock = whole holder tilted back rigidly (activity.js:540). Death = holder tipped 90 deg over 0.4 s, then hidden at 3 s (activity.js:489-494). Duellist strokes = rotating a detached arm group holding the blade (activity.js:551-553). Shooting = no pose; bolts leave from y+1.4 (activity.js:612).
- **AI:** Strong: lib/ai perception (cone, hearing your shots via stims, memory), utility pick (hold/strafe/close/back/cover/flank/look/search), lib/ai/spatial cover and flank spots, lib/ai/search group search, squad tokens (3 shots, 1 melee at once). Allies with side 'yours' use friendlyAim.
- **Problems:**
  - Crab-walk and moonwalk: walkTo moves straight at the goal while yaw turns at 4 rad/s (hostiles.js:114-121); strafe and back move sideways or backward while facing you (hostiles.js:196-224), all on the forward walk clip at a fixed move 0.6 (activity.js:578). Pace (1.4*1.6 = 2.24 m/s, strafe 2.5, chase up to h.chase) is unrelated to the clip.
  - Troopers fire with arms hanging at idle: no gunplay on NPCs, no raised weapon, no aim, no muzzle/recoil body motion.
  - Dooku/Obi-Wan (crew rigs): heldBlade is parented to the holder at a fixed hip-height offset (heldBlade.js:24), not RightHand. The rigged arm swings in the walk while the blade floats beside it.
  - Hit, knock, stagger and death are all rigid whole-body tilts (activity.js:489, 540, 576). Clips-hit/fall/shot are unused. A knocked figure slides upright-tilted rather than tumbling.
  - The 'search' event isn't shown (no ? over the head, HANDOFF-runtime.md:22). No bark/gesture when spotting you (mode change hold->close etc.).
  - No look-at beyond whole-body yaw; 'look'/'search' modes don't sweep the head.
- **Opportunities:**
  - Pass a motion object: hostileStep already knows out.x/z vs b.x/z. Compute speed/side in the figure's frame plus turn and call fig.update(dt, move, motion) + fig.after(), so locomotion hip-turns strafes and backpedals and phase-locks the stride. Requires crew figures (rigged()).
  - Give rigged hostiles createGunplay (as scene.js:578 and peers.js:82 do) so the blaster sits in RightHand and aims at t.aim; duellists get createSaber + saberBody in place of heldBlade.
  - Shared clips: hit on activity.hit (flinch), shot/fall on down (replacing the tip), scared on knock landing, taunt when a mode first becomes hold/close (spotted you), cheer for 'yours' allies on kills, punch for melee swipes.
  - A head bone sweep during look/search modes, and the ? sprite on the search event.

### Battlefront assault armies (missions/assault.js + assaultScene.js: snowtroopers vs Hoth rebels, shore/death troopers, clones vs B1/B2 droids, stormtroopers/scouts vs rebels and Ewoks) (enemy)

- **Files:** src/components/galaxy/surface/missions/assaultScene.js:98-120 bodies via anyFigure, src/components/galaxy/surface/missions/assaultScene.js:232-257 per-frame placement, src/components/galaxy/surface/missions/assault.js:527-556 move/yaw, src/components/galaxy/surface/missions/assault.js:588-591 move=0, src/components/galaxy/surface/missions/assaults.js:19-36 side kinds
- **Model:** anyFigure(kind): all trooper and droid kinds resolve to unskinned Battlefront statics (catalog/battlefront.js). 'rebel' resolves to the Meshy crew rig (Rick clips). Ewoks are Sketchfab statics.
- **Animation:** fig.update(dt, s.move) where s.move is 1, 0.65 or ×0.55 (assault.js:555): statics only bob and sway (no legs); rebels play blend() with run fully weighted at move 1 while moving 3 m/s, not stride-matched. Yaw is set to turnToward 4 rad/s. Crouch = whole holder pitched 0.16 rad (assaultScene.js:253-254). Hit = z-wobble (248-251). Death = rigid 90 deg tip over 0.3 s, hidden at 2.5 s (236-240). Spawn = pop visible.
- **AI:** lib/ai/squad: squads by reach, confidence/posture (hold/fall back in halves/press), frontline buffer, flankers, shot tokens for shots at you; suppression -> cover from env.solids; waves. Pure and seeded.
- **Problems:**
  - Most soldiers on both sides are sliding statues with no leg motion (Battlefront GLBs have 0 skins).
  - Soldiers face their target while moving toward goal, cover or fallback (assault.js:531-533 vs 551-553): a sideways or backward slide with the forward clip.
  - Move value ignores real speed (RULES.walk 3 m/s × engaged × crouch) and drives blend() at 0.8+0.4*move timeScale. Rebels run in place or skate.
  - No firing pose, recoil or aim: bolts leave from ground+1.4 (assaultScene.js:198) with arms at idle.
  - 'Crouch' is the whole body leaning forward 9 deg, not knees bending (assaultScene.js:253).
  - Deaths are planks tipping; no hit or fall clips; no flinch direction.
- **Opportunities:**
  - Same fix as the static troopers (rig them on Meshy 24-bone), then drive with motion: speed/side from (nx-x, nz-z) in the yaw frame, so locomotion handles strafe and backpedal under fire.
  - clips-shoot looped while s.target and not moving; locomotion `down` input for crouch (knee bend + loco.drop) when inCover or suppressed; clips-hit on hitSoldier; clips-fall or fallTurn on down; clips-cheer for a side on capture events; scared when suppressed > 0.8.
  - Distance LOD already exists (120 m, assaultScene.js:256). Cheap: share one mixer clip set per kind.

### Speeder-chase scout troopers (missions/chaseScene.js) (enemy)

- **Files:** src/components/galaxy/surface/missions/chaseScene.js:62-85, src/components/galaxy/surface/missions/chaseScene.js:176-185
- **Model:** figures.js built 'scouttrooper' (procedural shapes), even though a Battlefront scouttrooper GLB exists
- **Animation:** A standing built figure dropped 0.55 m at the bike seat; update(dt, 0) (chaseScene.js:76-77, 185). Only the bike holder pitches and banks.
- **AI:** Scripted chase.js route following (scoutAt along planned waypoints, vOff weave); fires at you.
- **Problems:**
  - A standing rider with legs through the bike, no seated pose (chaseScene.js:76).
  - No lean into banks, no aim or turn toward you when firing, no fall-off animation (ROLL is the bike rolling).
- **Opportunities:**
  - A Meshy-rigged scout + rick-sit.glb (borrowClips(['sit'])) seated pose, spine lean = bike bank, gunplay arm aiming at you, clips-fall on knock-off.

### Online peers (other pilots' crews on the same world, peers.js) (other)

- **Files:** src/components/galaxy/surface/peers.js:63-87 walker(), src/components/galaxy/surface/peers.js:122-131 ease, src/components/galaxy/surface/peers.js:164-184 update, src/components/galaxy/surface/peers.js:198-208 riding
- **Model:** Same loadPartyFigure (Meshy + Rick clips / meshyCast for Rick/Morty with wardrobe looks), r2d2 via modelFigure
- **Animation:** fig.update(dt, |speed|/7.4) with no motion object (peers.js:168), so footScene blend(): no stride match, no strafe hip turn, no lean or jump pose. Gun and saber arms via gunplay/saber from packet arms (aim, lit, swing). Position and yaw are eased from network samples.
- **AI:** n/a (network-driven)
- **Problems:**
  - A peer strafing or backpedalling plays the forward walk at a mismatched rate (no motion; the packet has speed only).
  - No hurt, down, dodge, ability or emote replication, so a peer killed in an assault stays upright.
  - Riding: standing figure sunk 0.55 m at the seat (peers.js:207), update(dt,0).
- **Opportunities:**
  - Derive motion from successive eased positions (vx, vz in the yaw frame, yaw delta) and call fig.update(dt, move, motion) + fig.after(), as the local party does.
  - Add an `act` field to the walk packet (cheer/wave/hit/fall/taunt) and play shared clips on peers, giving multiplayer emotes.

**Notes:** Cross-cutting:
1) Two animation drivers for the same Meshy figures. footScene.js:134 blend() is the legacy path (timeScale 0.8+0.4*move, walk and run at independent random phases from footScene.js:174). locomotion.js (strideOf phase-lock, hip turn for strafe and backpedal, lean, air tuck, crouch, flinch, `down`) is only fed by the local player and mate (surface/scene.js:1934-1937). crew.js:48, peers.js:168, activity.js:578 and assaultScene.js:256 all call update(dt, move) with no motion. rigged() already builds `loco` for every figure (footScene.js:176), so promoting motion to NPCs is mostly plumbing: compute {speed, side, turn} in the figure's frame from the step's dx/dz and yaw delta, and call fig.after(dt, motion, {forward, up}).
2) modelFigure (actors.js:162-185) re-implements the idle/walk/run blend with different thresholds (walkW = move*3, run from 0.6) and no timeScale. A third bob-only fallback exists for statics. activity.js:261-281 duplicates anyFigure with a different preference order (still model before crew for blade users).
3) Shared clips (meshyCast SHARED_CLIPS) are unreachable from every galaxy character. sharedClip() is private (meshyCast.js:23) and loadPartyFigure figures expose no play(). Nothing in src/components/galaxy references clips-*, cast.play, rig.js loadFigure or POSES. Exporting a play(fig, name) that retargets clips-<name>.glb by the figure's Hips y (clips.js retarget) would light up all Meshy crew, party, peers and rigged hostiles at once. rick-sit.glb exists and is borrowable for riders.
4) Death, hit and crouch are hand-rolled rigid holder rotations in three places: activity.js:489/540/576, assaultScene.js:238/250/253 and surface/scene.js:1924. locomotion's `down` + fallTurn() and clips-hit/fall/shot would replace all of them.
5) Bug: the player dodge roll is overwritten by place() (stepDodge sets holder.rotation.x at scene.js:1333, then place() at scene.js:2333 resets it at scene.js:1920), so the dodge renders as a slide.
6) Battlefront import (catalog/battlefront.js, last in GROUPS at catalog/index.js:22) replaced rigged Sketchfab stormtrooper/clone/superdroid GLBs at the same paths with unskinned meshes (verified: skins 0, animations 0). The `anim` entries in catalog/people.js:8,12,16 are dead. The most numerous NPCs on the site (stormtrooper 18 life entries, clone 13, battledroid 12, plus all assault armies) now slide with no legs.
7) saberBody.js (UAL Sword_Idle/Sword_Attack body layer, commit a549d345) is on origin/main and not on claude/living-npcs. Merge before touching saber poses.
8) The AI side is strong where lib/ai is used (hostiles.js, assault.js squads, needs.js utility). Ambient life think() is hand-rolled, with no perception of the player or of gunfire. lib/ai/perception stims from activity.heard() could drive civilian flee/scared cheaply. No NPC anywhere turns its head toward the player; 'look at you' is always a whole-body yaw (actors.js:316, hostiles.js:191).
9) No galaxy test covers animation (clip choice, stride, phase). Only universe/locomotion.test.js tests the stride logic.

## Cybertron (GameWorld open world, Roll out runner, transform showcase) + Mario 64 tribute (Bob-omb Ridge / castle)

Routes: /cybertron -> src/pages/Cybertron.jsx: GameWorld (line 170), RollOut (line 212), TransformStage/transform3d (line 220), /dot-matrix/64 -> src/pages/Mario64.jsx (App.jsx:354)

### Cybertron GameWorld player robot (Optimus WFC in Iacon, Optimus TFP at base/Jasper, Megatron FoC in Kaon) (player)

- **Files:** src/components/cybertron/game/bots.js:166-330 (riggedFigure), src/components/cybertron/game/bots.js:343-377 (makeFigure), src/components/cybertron/game/autorig.js:82-180, src/components/cybertron/game/scene.js:384-433, src/components/cybertron/game/rules.js:242-243 (yaw), src/components/cybertron/game/catalog.js:19,28,57
- **Model:** Sketchfab game rips. optimus-wfc: High Moon rig + own 'Scene' idle clip. megatron-foc: High Moon rig + one 'Scene' clip that is the whole robot-tank transform. optimus-tfp: unrigged single mesh, auto-rigged by autorig.js (Mixamo-named bones, one bone per vertex, rigid plates). Not on the Meshy skeleton.
- **Animation:** rig.js procedural poses: POSES.stride(phase, min(1,speed/3), run?1:0) while moving, leap for jump/fall, hurt, fall for dead (bots.js:310-313). Phase advances by distance: dt*speed*2pi/(0.75*height) (bots.js:250,298). Standing uses its own idle clip if it has one, through its own AnimationMixer (bots.js:239-241,302-306). Aim raises the gun arm along the camera yaw/pitch (bots.js:314-318, scene.js:424-426). Guns re-gripped every frame (holdGuns, bots.js:223-235). Megatron's transform is the clip scrubbed (scene.js:391-396,403). Optimus's transform is chunk morphing (scene.js:306-326).
- **AI:** Player input only. Yaw eases toward velocity or aim at 10 rad/s (rules.js:242-243). The render sets root.rotation.y = p.yaw directly (scene.js:389).
- **Problems:**
  - Idle and move never cross-fade. `blend` is only a threshold, not a weight (bots.js:301-308). Going idle to walk calls idle.stop() and the pose eases from stale dirs: a pop. Walk to idle holds POSES.stand for about 0.5 s, then idle.reset().play() snaps to frame 0 (bots.js:303).
  - Standing still while firing shows no aim pose on Optimus WFC. The state is never 'fire' (scene.js:423), and `posed` ignores aim (bots.js:300), so the idle-clip early return skips the aim branch.
  - Run cadence is probably about 2x too fast: stride length is fixed at 0.75*h (bots.js:250), but run swing is 0.92 rad (rig.js:405), so each step covers about 1.6*h. Feet slip at run. Walk roughly matches.
  - Walk/run switches by a hard threshold at 9 m/s (scene.js:423). run=0 vs 1 is binary in POSES.stride, so swing amplitude jumps.
  - Dead plays POSES.fall(clock) on its feet: arms flailing forever, never toppling (bots.js:312), until respawn.
  - autorig gives every vertex one bone at full weight (autorig.js:168-169). Optimus TFP tears and creases at shoulders, hips and knees on every stride.
  - No head look (rig.js has no head target here) and no hit reaction beyond the 'hurt' snap pose (rate 20).
  - Megatron's tank-to-robot release (bots.js:288-293) stops all actions and sets blend=1: an instant pop out of the held clip.
- **Opportunities:**
  - Replace the threshold with a real weight: lerp between the idle-clip pose and the rig pose, or use rig.js act(name,{fade}) / tick(), which bots.js bypasses by passing the template without clips (bots.js:167).
  - Add an 'aim' posed state: include `aim` in the posed test (bots.js:300). Add a recoil kick on each 'fire' event (scene.js events) via a short POSES.punch-like arm jolt.
  - Derive stride length per gait from the pose's swing (2*hipHeight*sin(swing)), or scale phase by 1/(1+run). Blend `run` continuously from speed between 7 and 15 m/s instead of 0/1.
  - Death: add a topple on the holder (rotate about the feet like stillFigure does, bots.js:144) after POSES.fall, then hold POSES.hurt on the ground.
  - autorig: give 2-bone weights near joints (distance falloff between the two nearest segments) for smoother bends.

### Cybertron GameWorld area people (Bumblebee, Jazz, Grimlock, Jetfire, Ultra Magnus, Zeta Prime in Iacon; Ratchet, Bulkhead, Arcee, Bumblebee TFP at the base; Soundwave, Shockwave, Barricade in Kaon) (npc)

- **Files:** src/components/cybertron/game/scene.js:228-246 (spawn), src/components/cybertron/game/scene.js:434-448 (per frame), src/components/cybertron/game/bots.js:92-163 (stillFigure), src/components/cybertron/game/bots.js:166-330, src/components/cybertron/game/sim.js:186-223 (talk), src/components/cybertron/game/areas/iacon.js:104-160, src/components/cybertron/game/areas/base.js:45-80, src/components/cybertron/game/areas/kaon.js:112-140
- **Model:** Mixed Sketchfab rigs. bumblebee-wfc and soundwave-foc have an own 'Scene' idle. jazz, grimlock, jetfire, zeta-prime, shockwave-foc, arcee, bulkhead and barricade are rigged with no idle (arcee's 'Action' and bulkhead's 'Animation' are unused stubs). ratchet and bumblebee-tfp are auto-rigged. ultra-magnus-foc is 'still'.
- **Animation:** Only f.play('idle') ever (scene.js:445). With an idle clip it loops that. Without one it holds POSES.stand, fully frozen with no breathing (bots.js:300,313). Ultra Magnus and stand-ins get stillFigure's sin bob (bots.js:140). The whole figure yaws toward the player within 40 m at 2.5 rad/s (scene.js:440-444).
- **AI:** None. Static positions from area data. Talk is sim-only (sim.js:217-223 sets sim.talk) and the scene never reads it.
- **Problems:**
  - Most of the cast (jazz, grimlock, jetfire, zeta-prime, shockwave, arcee, bulkhead, barricade, ratchet, bumblebee-tfp) stands perfectly still in POSES.stand. rig.js stand has no breathing (rig.js:315).
  - Turning to the player rotates the whole body with feet planted, so it pivots and slides (scene.js:443). There is no head or torso look first, and no step-turn.
  - No talk gesture, nod or wave when spoken to or approached (scene.js:445 is the only call).
  - Idle clips start at time 0 with no phase offset (bots.js:105,303). Duplicates would breathe in unison (Soundwave is reused across areas).
- **Opportunities:**
  - Breathing and weight shift for clip-less figures: add a slow torso pitch and arm sway to POSES.stand in bots.js update (e.g. torso.pitch += 0.02*sin(clock*1.3+seed)).
  - Look-at: drive rig torso yaw (POSES targets.torso.yaw, clamped to ±0.6) toward the player first, and only rotate the group past that angle. Add a few stride frames while turning.
  - On sim.talk === id: play a gesture pose cycle (POSES.proud or an arm-out talk pose alternating) for the line's length, and a raised-arm wave pose when the player first comes within 40 m.
  - Seed each idle clip's start time and timeScale per instance (idle.time = rand*duration).
  - Give people a small lib/ai/utility idle loop: wander a few metres between spawn points, face a console or bench (base.js tags), or turn to look at a passing jet.

### Cybertron GameWorld foot-soldier enemies (Decepticon troopers, snipers, leapers and Vehicons; Kaon's Autobot raiders Ironhide, Warpath, Ratchet, Bumblebee, Jazz) (enemy)

- **Files:** src/components/cybertron/game/rules.js:26-36 (ENEMY_KINDS), src/components/cybertron/game/rules.js:573-685 (stepEnemies), src/components/cybertron/game/scene.js:250-264 (foeFor), src/components/cybertron/game/scene.js:450-486, src/components/cybertron/game/scene.js:576-582 (flinch), src/components/cybertron/game/sim.js:21-24,62-63, src/components/cybertron/game/bots.js:166-330
- **Model:** High Moon FoC rigs (trooper/sniper/leaper), Prime vehicon rig, FoC raider rigs. All walkable by bots.js:333-338. No idle clips.
- **Animation:** Always f.play('walk', {speed: advance ? 6 : 3.6, aim:[0,0.05,1]}) (scene.js:485) on POSES.stride with the gun arm forward. POSES.hurt for 0.22 s on a hit (scene.js:484,581). POSES.fall when dead, then hidden after 3 s with a boom (scene.js:477-483). Yaw set directly from the sim (scene.js:457).
- **AI:** lib/ai: perception (ENEMY_SENSES belief, segmentClear LOS, intuition/memory, rules.js:578-610) and squad shot tokens (sim.js:13,36). The movement itself is a hand-rolled two-state machine: advance straight at the target if d > 0.8*range, otherwise strafe around it, flipping direction every 2.2 s and backing off under 18 m (rules.js:641-656). With no belief they 'hold' and sway yaw (rules.js:601-608). Yaw turns smoothly toward the target at 4 rad/s (rules.js:639). No cover or flanking.
- **Problems:**
  - Stride speed is hard-coded, not taken from velocity (scene.js:485). Holding enemies (rules.js:604, speed 0) march in place at 3.6 m/s. Strafing enemies face the player and move sideways while playing a forward stride, so they skate sideways. Autobot raiders (7.5 m/s, rules.js:34) and Shockwave (3.5) play 6.
  - Never idle: no stand pose even when stationary, and the aim never tracks the player's height (fixed [0,0.05,1]).
  - No fire pose or recoil on 'enemyFire' (rules.js:679), and shots come from e.y+0.75h, not the muzzle (rules.js:670-672). bots.js has muzzle() (line 278) but enemies don't use it.
  - Dead figures stand flailing arms (POSES.fall) for 3 s instead of falling (bots.js:312, scene.js:482).
  - Flinch is a 0.22 s snap to POSES.hurt at rate 20 with no direction (scene.js:484). The knockback is the same whatever the side hit.
  - Identical rigs with no phase offset: a wave of 4 troopers spawned together strides in lockstep (phase starts at 0, bots.js:245).
- **Opportunities:**
  - Pass the real velocity: have stepEnemies store e.vx/e.vz (rules.js:655-657). Play speed=hypot(vx,vz) and add a lateral stride (rotate the stride legs by atan2 of local velocity, or POSES.stride with torso yaw toward the player). Play 'idle' (POSES.stand + aim) when speed < 0.5.
  - Aim at the player: aim=[sin(rel), (py-ey)/d, cos(rel)] in the foe's frame, as the player does (scene.js:425-426). Fire from f.muzzle().
  - Add a recoil jolt on enemyFire and a directional flinch (torso pitch/roll by hit side). On death, topple the holder like stillFigure (bots.js:144) instead of POSES.fall.
  - Seed phase per enemy (phase = hash(id)) so waves don't march in step.
  - AI: use lib/ai/spatial place picking for cover (crates/barricades tagged in areas/iacon.js:67-72) and lib/ai/squad roles for a flanker. Add a 'peek and shoot' pose from cover (the HANDOFF doc's remaining item).

### Cybertron GameWorld bosses (Megatron FoC and Barricade with transform clips; Shockwave FoC; Zeta Prime; dormant Megatron TFP) (boss)

- **Files:** src/components/cybertron/game/rules.js:38-46 (FORMS), src/components/cybertron/game/rules.js:612-633, src/components/cybertron/game/rules.js:689-726 (drive), src/components/cybertron/game/scene.js:458-476, src/components/cybertron/game/bots.js:260-293 (hold/release), src/components/cybertron/game/catalog.js:28,31,65
- **Model:** megatron-foc and barricade: High Moon rigs whose only clip is the robot-vehicle-robot transform. shockwave-foc and zeta-prime: rigs with no clips. megatron-tfp: catalog says rig:true, but the GLB has 0 skins, so walkable() fails and it falls through to stillFigure (bots.js:361-368).
- **Animation:** While shifting or in vehicle form, the transform clip is scrubbed by shift progress (scene.js:461-466). Otherwise the same forced 'walk' stride as the troopers (scene.js:485). The vehicle form is the clip held at its 'vehicle' second, sliding with no wheel or tread motion. Megatron TFP, if spawned, would be a bobbing rigid statue.
- **AI:** Same perception and strafe as the foot soldiers. Timed form swaps (FORMS), and in vehicle form drive() charges straight at the player and overshoots (rules.js:689-695). Hand-rolled.
- **Problems:**
  - release() pops straight from the clip's last robot frame to the rig pose with no fade (bots.js:288-293, scene.js:476).
  - Shockwave (speed 3.5, rules.js:32) and Megatron (5) still play stride speed 6 (scene.js:485), so their feet overspin.
  - No boss presence: no taunt, cannon charge pose or stagger. A boss reads the same as a trooper apart from size.
  - megatron-tfp is flagged rig:true (catalog.js:65) but has no skeleton. It is not spawned now (sim.js:23 maps it), but it would glide stiffly.
- **Opportunities:**
  - Fade out of the held clip: keep the clip action at weight and cross-fade over 0.3 s into the posed stride (needs the weight blend proposed for the player).
  - Boss beats via rig.js poses: POSES.windup before a heavy shot (Shockwave cannon, Megatron fusion), POSES.proud as an arrival taunt, POSES.guard while shifting.
  - Mark megatron-tfp rig:false so it goes through autorig.js like optimus-tfp (bots.js:352).

### Cybertron stage set-pieces: Soundwave watchers on roofs/rocks, Predaking and jets flying over (npc)

- **Files:** src/components/cybertron/game/stage/iacon.js:366-373,438, src/components/cybertron/game/stage/jasper.js:145-171,177, src/components/cybertron/game/stage/kaon.js:160-175, src/components/cybertron/game/catalog.js:29,66,68
- **Model:** soundwave-foc: rig + own idle. soundwave-tfp: rig with no clips. predaking: 69-skin rig with no clips, loaded via makeThing as a static mesh.
- **Animation:** Soundwave FoC loops its idle clip. Soundwave TFP holds POSES.stand, frozen. Predaking glides rigidly on a circle with a fixed bank (jasper.js:166-169), with no wing beat.
- **AI:** None. A fixed yaw toward the area centre (iacon.js:371, jasper.js:152). Flyovers follow a parametric circle.
- **Problems:**
  - update(1/60) is a fixed dt per render frame (iacon.js:438, jasper.js:177), so the idle speed depends on display refresh (2x at 120 Hz).
  - Watchers never track the player, though the comment says 'watching whoever comes' (jasper.js:145).
  - Predaking is a rigged dragon flown as a static prop (jasper.js:159-161): no wing flap or head motion.
- **Opportunities:**
  - Pass the real dt from stage.update(clock, dt) (scene.js:551 already passes dt).
  - Turn the watcher's torso/head toward the player with rig torso yaw. Add a slow scan when the player is far.
  - Wing flap: makeFigure('predaking') and drive the wing bones with a sin rotation (rig.js figure + bone turns, like transform3d's turn()), or a POSES.fly-like custom target.

### Roll out player (Meshy Optimus/Bumblebee truck-robot; shape-built Knock Out/Breakdown fallback) (player)

- **Files:** src/components/cybertron/rollout/meshyCast.js:102-263, src/components/cybertron/rollout/RollOut3D.js:200-216,529-538, src/components/cybertron/rollout/models.js:14-58, src/components/cybertron/rollout/rules.js:42
- **Model:** Meshy 24-bone rigs (public/games/meshy/rollout/optimus.glb and bumblebee.glb; Hips, Spine02, ... the same skeleton as the shared library) with own -idle/-walk/-run.glb. Knock Out and Breakdown are primitive shape rigs (models.js).
- **Animation:** Local re-implementation: the clip time is scrubbed to phase, with weights hard-set to 1/0 and no crossfade (meshyCast.js:225-232). The robot always plays 'run' at phase = g.z*0.55, one cycle per about 11.4 m (meshyCast.js:256-260, RollOut3D.js:534). Vehicle and robot dissolve via a shader. The group is tilted for steer and jump (RollOut3D.js:537). Shapes: sin limb swing (models.js:45-57).
- **AI:** Player input (lane steering, jump, shoot).
- **Problems:**
  - Probable foot skate: robot speed is about 17 m/s (30*0.567, rules.js:42). At one cycle per 11.4 m, a 3.05 m Meshy run cycle covers far less ground than the body moves.
  - Keeps running in the air: animate() ignores the `amount` arg (0.2 when airborne, RollOut3D.js:534) on the Meshy path (meshyCast.js:256).
  - No jump/land, shoot, hit or stumble animation. Being hurt is a shell flicker only (RollOut3D.js:539-541).
  - No SHARED_CLIPS: shoot, hit, fall and cheer exist for this exact skeleton but are not loaded.
- **Opportunities:**
  - Swap the local Meshy code for createMeshyCast/play() from src/components/rickmorty/portal/meshyCast.js, or at least borrow retarget()/SHARED_CLIPS via clips.js. Play 'shoot' as an upper-body one-shot on fire, 'hit' on hurt, 'fall' on lost, and 'cheer' at the stage outro.
  - Retune the phase constant per clip: measure the run clip's root or foot travel per cycle and set phase = g.z*2pi/strideLen.
  - Airborne: hold a run frame or use a rig.js POSES.leap-style bone override while !grounded.

### Roll out foot enemies (Meshy Vehicons on the Autobot side; shape 'sentries' on the Decepticon side) (enemy)

- **Files:** src/components/cybertron/rollout/meshyCast.js:265-283, src/components/cybertron/rollout/RollOut3D.js:236-243,695-722, src/components/cybertron/rollout/rules.js:459,1060-1108
- **Model:** Meshy 24-bone vehicon.glb + vehicon-car.glb with own idle/walk/run. Sentries are shape rigs (models.js:344).
- **Animation:** Meshy: the idle clip scrubbed at time+random offset (meshyCast.js:275-279), with the car-to-robot dissolve on 'turn'. Rotation is fixed at k*pi, facing the camera (RollOut3D.js:707). Shapes standing: the stride swings at 25% amount at time*6, so they march in place (RollOut3D.js:704, models.js:47-52). Hit: emissive flash (RollOut3D.js:708-709). Death: despawn and boom.
- **AI:** Scripted: 'pass' (drive past, sometimes swerve into your lane), 'turn' (brake), 'stand' (edge toward your x at 1.1 m/s, fire bolts on a cooldown) (rules.js:1062-1100). No lib/ai.
- **Problems:**
  - Slides sideways toward your lane while playing idle (rules.js:1096, RollOut3D.js:706): no step.
  - No aim or shoot motion when firing (rules.js:1098-1101), and no hit reaction beyond a red flash.
  - Doesn't look at the player's x. Yaw is locked to pi (RollOut3D.js:707).
  - Shape sentries 'stand' by marching in place (amount 0.25).
- **Opportunities:**
  - SHARED_CLIPS on the Meshy vehicon: 'shoot' on foeShot, 'hit' on damage (with flash), 'fall' on kill before the boom, 'taunt' on the stand-up. Use the walk clip at low weight while edging.
  - Yaw toward the player: rotation.y = pi + atan2(g.x - e.x, e.z - g.z) eased.
  - Shapes: amount 0 in 'stand', plus a small aim pose.

### Roll out bosses (Meshy Megatron/Shockwave/Optimus walking backwards; shape Magnus; Starscream/Wheeljack as jets) (boss)

- **Files:** src/components/cybertron/rollout/meshyCast.js:300-332, src/components/cybertron/rollout/RollOut3D.js:461-476,794-826, src/components/cybertron/rollout/models.js:454-530
- **Model:** Meshy 24-bone megatron/shockwave/optimus with own walk/run/idle. Magnus is a shape rig. Starscream is the Meshy jet mesh. Wheeljack is a shape jet.
- **Animation:** Walk clip reversed at time*4.5, not tied to motion (RollOut3D.js:807, meshyCast.js:326-329). Cannon charge is a glow sphere at the hand bone (meshyCast.js:309-322). Death: tilts back and sinks (RollOut3D.js:805-806). Jets bank on sin(t) (RollOut3D.js:802).
- **AI:** Scripted attack patterns in rollout/rules.js (boss.attack charge/fire, exposed/stagger windows).
- **Problems:**
  - The backwards walk rate is fixed (time*4.5) while the boss travels at road speed, about 17-30 m/s in world: heavy foot skate.
  - No attack animation. Charging is only a hand glow, and the arm never comes up (transform3d.js already has an arm-raise for Megatron).
  - Death is a rigid tilt and sink with no fall clip. A stagger ('exposed') is only an emissive pulse.
  - The jets' wings and bodies are rigid (expected for vehicles).
- **Opportunities:**
  - Play SHARED_CLIPS 'shoot' (or 'punch' for Magnus-style hits) through charge-fire, 'hit' on flash, 'scared'/'hit' during exposed, 'fall' on death, and 'taunt' on entry.
  - Lock the reverse walk to road distance as the player is (phase from g.z).
  - Reuse transform3d.js's turn() arm raise as a fallback when the clip isn't loaded.

### Transform showcase (TransformStage): Optimus transform rig, Meshy Megatron (other)

- **Files:** src/components/cybertron/transform3d.js:155-191 (Optimus clip), src/components/cybertron/transform3d.js:231-333 (Megatron rig), src/components/cybertron/transform3d.js:575-620 (pose), src/components/cybertron/transform3d.js:714-730 (cannon)
- **Model:** Optimus: Sketchfab 'optimus-transform.glb', one baked transform clip. Megatron: Meshy rollout/megatron.glb (24-bone) + megatron-idle.glb.
- **Animation:** Optimus: the clip scrubbed by t. At t=1 he holds the clip's last frame, frozen with no idle (transform3d.js:577-578). Megatron: procedural fold and unfold by bone turns (transform3d.js:280-292,611-613), then his own idle clip (transform3d.js:608). Firing is a procedural shoulder/arm raise layered over the idle (transform3d.js:722-729). The turntable is user-dragged.
- **AI:** None (UI-driven: mode, matrix, firing).
- **Problems:**
  - Optimus stands dead still in robot mode after transforming.
  - Megatron's fire is hand-rolled bone turns even though a 'shoot' clip exists for this skeleton.
  - A third separate Meshy loader path (not meshyCast in either folder).
- **Opportunities:**
  - Megatron: SHARED_CLIPS 'taunt' after standing, 'shoot' for the fusion cannon (keep the beam on the muzzle), 'cheer'/'happy' idle fidgets.
  - Optimus robot mode: an additive breathing (spine bone sin) after t=1, or a Matrix-reveal gesture driven by `matrix`.

### Mario (player) (player)

- **Files:** src/components/mario64/models/mario-hd.js:31-74, src/components/mario64/pose.js:32-48 (run), src/components/mario64/pose.js:50-360 (ACTIONS), src/components/mario64/pose.js:362-367 (poseFor), src/components/mario64/models/limbs.js:17-33, src/components/mario64/scene.js:355-367, src/components/mario64/models/catalog.js:20-23
- **Model:** Sketchfab Mario with a Rigify skeleton (63 joints, 11 skins, no clips), posed by rig.js figure() through the MARIO_BONES map. Code-made shape Mario (models/mario.js) as fallback.
- **Animation:** Hand-written per-action procedural poses (pose.js: idle breathing, run, jump, double, triple, backflip, longjump, punch, kick, dive, ledge, swim, carry, dance, dead and more), converted to limb directions (limbs.js) and SNAPPED each frame with fig.pose(t,1,Infinity) (mario-hd.js:62). Head and hips turn as whole parts. Flips via spin groups.
- **AI:** Player input. Yaw interpolated between 30 Hz rule steps (scene.js:364).
- **Problems:**
  - No blending between actions. poseFor builds a fresh pose from rest every frame (pose.js:362-366) and the rig snaps (rate Infinity). Every action change pops: idle to walk, land to idle, punch end, jump apex (arms switch at vy sign, pose.js:124-126).
  - Run cycle skates at all speeds. phase += |fwd|/32*0.42 per frame (scene.js:365) gives a constant 4.8 m per cycle, while leg swing is also scaled by fwd (pose.js:33-37). At full speed the feet cover about a third of the ground. At fwd 8 they cover about a tenth.
  - No walk/jog/run gait change, only one run() scaled by k. The walk action is just run (pose.js:59).
  - Idle has no SM64 look-around, no head turn toward nearby enemies/stars/camera, and no fidgets (pose.js:51-58).
  - Duplicates rig.js POSES.stride with its own run() rather than using the shared one.
- **Opportunities:**
  - Ease between actions: call fig.pose(t, dt, 18) for ground actions, and keep Infinity only for spin-driven flips (triple, backflip, pound). Or cross-blend the previous and next poseFor output over 4-6 frames on setAction.
  - Fix the cadence: advance phase by distance, phase += |fwd|*dt*2pi/stride with stride ~ 0.9 m at walk to 1.8 m at run (or use rig.js POSES.stride amount and run from fwd).
  - Idle: after about 3 s, head yaw toward the nearest Goomba, star or Bob-omb (p.joints.head[1]), plus a look-around. 'Sleep' after a long idle like SM64.
  - Hit reaction direction (knockback is there; add a front/back variant from the hurt source), and a 'dance' victory already exists. Wire it to wave/cheer moments (Toad dialogue end).
  - The Rigify rig can't take Meshy clips directly. The Quaternius UAL retarget (saberBody.js pattern) could supply real walk/run/idle loops blended under the procedural action poses.

### Goombas (enemy)

- **Files:** src/components/mario64/rules/actors/foes.js:26-107, src/components/mario64/rules/actors/body.js:23-39 (walk), src/components/mario64/models/cast.js:14-72, src/components/mario64/scene.js:372-398
- **Model:** Sketchfab goomba.glb: static mesh, 0 skins, no clips. Code-made shape fallback with separate feet.
- **Animation:** HD: whole-body bob and roll waddle at t*0.25 (wander) or t*0.5 (chase) (cast.js:22-29). Shape version: feet slide ±0.08 on z plus roll (cast.js:61-70). Flat: scale squash. Knocked: root.rotation.x += 0.4 per render.
- **AI:** lib/ai/perception (GOOMBA_SENSES, raycast LOS, intuition/memory, foes.js:30-47). Hand-rolled wander/chase/flat/knocked states.
- **Problems:**
  - Snap turns: the wander yaw jumps 1.7 rad every 90 frames (foes.js:74). At edges or walls the yaw flips by pi or 0.75pi in one step (body.js:27,35), which renders as a one-frame spin.
  - Knocked spin is += 0.4 per render call, not per step (cast.js:28,69), so it depends on frame rate.
  - No notice reaction: SM64's Goomba hops and charges when it spots Mario. Here the state just flips (foes.js:73).
  - Shape feet: about 1 m travelled per 25-frame cycle against about 0.32 m of foot travel, so the feet slide.
- **Opportunities:**
  - Turn with a rate (turn(a, a.yaw+1.7, 0.1)) and treat a wall or edge as a target yaw, not an instant flip.
  - A spotted hop: on wander to chase, set vel.y = 20, pause 8 frames facing Mario, and squash on landing (cast.js body scale).
  - Phase-lock the waddle to distance walked (accumulate the walk speed) and move rotation.x spin into the 30 Hz step.

### Bob-ombs (enemy)

- **Files:** src/components/mario64/rules/actors/foes.js:109-190, src/components/mario64/models/cast.js:74-174
- **Model:** Sketchfab bobomb.glb: static mesh, 0 skins. Code-made shape fallback with feet and a wind-up key.
- **Animation:** HD: vertical bob and roll at t*0.25 or t*0.6, red emissive flash when lit, spark sprite (cast.js:90-105). The key and feet animate only in the shape version (cast.js:160-163). Held: pinned above Mario. Thrown: no tumble.
- **AI:** Hand-rolled. Lights its fuse on plain distance < 500 (foes.js:161), with no perception through walls (the HANDOFF doc flags this). Chases at 7 for 4 s, then explodes. Wander yaw snaps 2.1 rad every 120 frames (foes.js:166).
- **Problems:**
  - Lights up through walls and hills (distance-only, foes.js:161).
  - Snap turns (foes.js:166, body.js:27,35).
  - HD model loses the key-wind and feet: just a bobbing ball.
  - No panic or rush pose when lit, and no tumble spin when thrown (foes.js:153-155).
- **Opportunities:**
  - Reuse Goomba spot() perception for the fuse trigger.
  - HD: attach a procedural key (the shape key group, cast.js:128-132) behind the HD mesh. Lean forward and speed up the bob when lit, and add a fuse wobble tied to the fuse count.
  - Thrown: body.rotation.x spin by velocity. Held: a small kick or wiggle.

### King Bob-omb (boss)

- **Files:** src/components/mario64/rules/actors/foes.js:192-304, src/components/mario64/models/cast.js:76-107,142-156,171
- **Model:** Sketchfab king.glb: static mesh, 0 skins. Shape fallback with crown and moustache.
- **Animation:** Same as hdBobomb: bob when walking, rotation.z wobble when stunned or defeated, scale shrink when defeated.
- **AI:** Hand-rolled: wait (then a taunt dialog at < 1400), walk at Mario turning 0.03 rad/frame (smooth, so he can be got behind), held, thrown, stunned, return, defeated (foes.js:218-290).
- **Problems:**
  - Defeated shrink uses the global frame `t % 60`, not time since defeat (cast.js:104,171). The shrink starts mid-way and pops back to full size when t crosses a multiple of 60 within the 60-frame window (foes.js:261).
  - No taunt gesture, no grab-and-throw of Mario (SM64's main attack), and nothing in 'wait'. Mario's frontal contact just hurts (foes.js:302).
  - No arms or hands motion (static mesh).
- **Opportunities:**
  - Use (t - a.since) for the defeat shrink. Expose a.since to the render or compute it in the rules.
  - Add a grab state: within 200 in front, set m.held-like pin on Mario, wind up (body.rotation.x back), and throw (hurt plus velocity).
  - Taunt: a bounce-squash cycle and a stomp shake when the dialog fires.

### Chain Chomp (creature)

- **Files:** src/components/mario64/rules/actors/foes.js:306-413, src/components/mario64/models/cast.js:176-239
- **Model:** Sketchfab chomp.glb: static mesh. The shape version has separate jaws and teeth.
- **Animation:** Jaw gnash (shape) or head pitch (HD) by sin(t), with lunge opening wider (cast.js:218-222). Idle hops. Chain links sag between the post and the head (cast.js:225-236).
- **AI:** Hand-rolled idle/lunge/back/free/gone with a chain clamp. Lunges toward Mario's current position on a timer (foes.js:367-375).
- **Problems:**
  - The yaw snaps instantly at lunge start, on 'back' and when freed (foes.js:348,373,382). It doesn't track Mario while idle.
  - No wind-up tell before the lunge (it just goes).
- **Opportunities:**
  - Idle: turn toward Mario at a rate, then a 10-frame rear-back (head.rotation.x up, squash) before the lunge as the tell.

### Toad (castle NPC) (npc)

- **Files:** src/components/mario64/rules/actors/objects.js:96-114, src/components/mario64/models/cast.js:287-334
- **Model:** Sketchfab toad.glb: static mesh, 0 skins. Shape fallback.
- **Animation:** A small vertical bob and roll only (cast.js:295-298).
- **AI:** Yaw set straight to face Mario whenever he is within 600 (objects.js:106), and talk lines on interact.
- **Problems:**
  - Instant yaw snap to Mario on entering range (objects.js:106).
  - No talk or greeting motion. Dialogs fire with the figure unchanged.
- **Opportunities:**
  - Turn with a rate. While its dialog is open, add a squash-hop greeting on approach and a talk bob (faster bob plus roll).

**Notes:** - Neither world uses the Meshy shared library (rickmorty/portal/meshyCast.js: createMeshyCast, play(), SHARED_CLIPS, clips.js retarget). Cybertron GameWorld and Mario 64 use lib/three/rig.js (procedural poses). Roll out and transform3d use Meshy rigs on the same 24-bone skeleton (Hips, Spine02, Spine01, Spine, neck, Head...: checked in rollout/optimus, megatron, vehicon, shockwave and bumblebee .glb), but load them through separate local code.
  - src/components/cybertron/rollout/meshyCast.js:102-232 re-implements Meshy loading and clip playback: hard 1/0 weights plus time scrub, no crossfade, no one-shots.
  - transform3d.js:233-263 is a third loader path for the same megatron.glb and megatron-idle.glb.
  - These five rigs could take shoot, hit, fall, taunt and cheer straight from public/games/meshy/clips-*.glb via retarget(clip, hipsY).
- bots.js runs its own AnimationMixer beside rig.js figure(): rigFigure({scene}) is passed no clips, so rig.js act()/tick() go unused (bots.js:167,239). Its `blend` variable is only a 0.02 threshold, never a weight, so idle and pose switches pop both ways (bots.js:301-308). Switching to rig.js act({fade}), or adding a real pose-slerp weight, fixes the player, people and foes at once.
- bots.js's distance-locked stride (phase += dt*speed*2pi/stride, bots.js:298) is the right pattern but is fed fake speeds for enemies (scene.js:485). Mario's run phase (scene.js:365) is speed-proportional with speed-scaled amplitude, which slides at every speed. Roll out locks to distance with a constant (0.55) tuned for the shape rigs, not the Meshy run clip.
- Mario's pose.js run() duplicates rig.js POSES.stride. All pose.js actions apply with rate Infinity (mario-hd.js:62): no easing anywhere.
- Per-render (not per-step or dt) animation:
  - stage watcher update(1/60) (stage/iacon.js:438, stage/jasper.js:177)
  - Goomba knocked spin += 0.4 per render (cast.js:28,69)
  - Bob-omb spark Math.random scale per render (cast.js:99,167)
- Snap yaw turns in Mario actors: body.js:27,35, foes.js:74,166,348,373,382, objects.js:106.
- No character in either world plays a contextual action: no wave on approach, talk gesture, cheer, or real death fall. The only hit reactions are Cybertron foes' 0.22 s POSES.hurt and emissive flashes. Cybertron people never read sim.talk.
- Catalog bug: megatron-tfp has rig:true but its GLB has 0 skins, so it degrades to a bobbing statue (catalog.js:65, bots.js:361-368). Predaking (rigged, 69 skins) is flown as a static makeThing.
- lib/ai coverage:
  - Cybertron foes: perception plus squad tokens.
  - Goombas: perception.
  - Bob-ombs, King, Chomp, Toad, Cybertron people and all of Roll out: none. They are hand-rolled state machines or scripted.
- Only the Bob-ombs and the Cybertron foes' missing cover/flank are already noted in docs/superpowers/HANDOFF-runtime.md:16-17.
- No tests cover bots.js figure animation, rollout/meshyCast.js, transform3d.js, mario64 cast.js or mario-hd.js.

## Avengers (/avengers: Compound world plus its in-world games Smash Run, Thwip!, Infiltration) and Invincible (/invincible: city world InvWorld, Think, Mark!, GDA viewer)

Routes: /avengers: CompoundWorld (src/pages/Avengers.jsx:156). Its doors open Infiltration, SmashRun and Thwip in place (src/components/avengers/world/Place.jsx:27-29,141-145), /invincible: InvWorld (src/pages/Invincible.jsx:107), ThinkMark (:150), Viewer (:167)

### Compound player: Spider-Man on foot, swinging and climbing, plus other players' hologram ghosts (player)

- **Files:** src/components/avengers/world/scene.js:1154-1211, src/components/avengers/world/scene.js:1213-1259, src/components/avengers/world/scene.js:1452-1645, src/components/avengers/world/people.js:48-83, src/components/avengers/world/rules.js:695-706, public/models/sketchfab/avengers/manifest.json (spiderman speeds walk 1.5, run 5.08)
- **Model:** Sketchfab HD /models/marvel/spiderman.glb, loaded with rig.js loadFigure/figure. Its idle, walk, run and jump clips come from spiderman-moves.glb (made by scripts/sketchfab-avengers.mjs) and play through people.js clipsFor. Falls back to the hq kit's procedural Cap figure.
- **Animation:** On the ground: own clips through drive(). gaitFor picks the clip with hysteresis, playback rate = speed / clip speed (scene.js:1204-1207), and clipsFor keeps the stride in step on walk/run swaps. Off the ground (swing, wall, perch, zip, land, flip, trick): rig.js limb-direction poses (offPose, scene.js:1468-1553) blended over the clips per bone with a weight R.w (scene.js:1605-1609). Holder banks and slerps toward the heading (scene.js:1579-1633). Ghosts use the same drive() with a random idle start (scene.js:1226).
- **AI:** n/a (player). Ghosts are networked positions.
- **Problems:**
  - Walk rate is capped at 2.2x the 1.5 m/s clip = 3.3 m/s, but walk is held until about 5.6-6.1 m/s (gaitFor line (2.8+9.5)/2.2 plus 0.5 hysteresis), so feet slide between 3.3 and 6.1 m/s while accelerating (scene.js:1206, rules.js:700-705).
  - No action clips at all: no web-shoot arm on the ground or in a zip (only the swing pose raises a hand), no hit or stumble, no wave or talk gesture when a cast member's bubble opens (CompoundWorld.jsx:491-500 is text only).
  - Standing idle has no head or look-at toward the cast member being talked to.
- **Opportunities:**
  - Add a upper-body 'talk' or 'wave' pose to offPose, gated on s.talk, using the same R.w per-bone blend (scene.js:1605-1609).
  - Add a short web-shoot arm aim, blended the same way, on zip or point launch (h.mode === 'zipto').
  - Raise the walk rate cap or lower the walk/run line so walk never runs past about 2.2 x 1.5 m/s.

### Compound player in the Iron Man armour (suit mode) and the armour on its plinth (player)

- **Files:** src/components/avengers/world/scene.js:1342-1400, public/models/sketchfab/avengers/manifest.json (ironman rig:false, clips [])
- **Model:** Sketchfab ironman.glb: an unrigged static mesh
- **Animation:** Rigid mesh only. Pitched by speed, banked by roll, slerped toward the heading (scene.js:1377-1382), with boot flame VFX. Lerps home to the plinth afterwards.
- **AI:** n/a
- **Problems:**
  - No skeleton, so arms and legs stay frozen in the plinth stance while flying, hovering and turning (scene.js:1379-1382).
  - Stands completely static on the plinth: no idle or power-on.
- **Opportunities:**
  - Rig it (a Meshy rig, or any skeleton rig.js recognises) and drive it with rig.js POSES.fly, hover and land, the way the Invincible flyers are driven (invincible/world/scene.js:572-579).

### Compound cast NPCs: Thor, Natasha, Hulk (HD swap-ins) and the Training bot (npc)

- **Files:** src/components/avengers/world/rules.js:349-400, src/components/avengers/world/scene.js:1295-1340, src/components/avengers/world/scene.js:1682-1729, src/components/avengers/world/people.js:99-119, src/components/avengers/world/CompoundWorld.jsx:491-500
- **Model:** Thor, Natasha and Hulk are Sketchfab GLBs, each with its own idle, walk and run, on non-Meshy rigs: Thor uses Mixamo-like names (Hips/Spine2), Hulk an Unreal rig (pelvis/spine_01), Natasha Auto-Rig Pro (root_x/arm_stretch_l). The hq kit procedural figure is shown until each model loads. The Training bot stays a kit figure.
- **Animation:** Swap-ins play only their own 'idle' clip, started at from = p.phase % 3 so they are out of phase (scene.js:1324). Kit fallbacks use poseHumanoid idle plus hand-set arms: Thor arms folded, Natasha hand on hip, Hulk fists (scene.js:1699-1727).
- **AI:** None. Fixed spots. Within 9 m the whole body yaws toward the hero at rate 2.5 (scene.js:1686-1693). A text bubble opens within 3.4 m (rules.js:393-400).
- **Problems:**
  - Their walk and run clips are never used: all stand rooted forever.
  - The whole root turns on the spot while idle plays, so feet pivot with no step or turn clip (scene.js:1692-1695).
  - No head look-at on the HD models; head sway exists only on kit fallbacks (scene.js:1702).
  - The character stances (Thor's folded arms, Natasha's hand on hip) exist only on the kit fallback (scene.js:1709-1722). Once the HD model swaps in they become a generic idle.
  - Talking triggers no gesture, and nothing reacts to Spider-Man landing next to them, swinging past, pulling Mjolnir or opening the portal.
  - The bot's head scans ±0.6 rad even with the player beside it: scene.js:1726 overwrites the d<9 damping from 1702.
  - The shared Meshy clips (clips-*.glb) cannot play on these rigs without a bone map, and clips.js retarget() assumes Meshy bone names.
- **Opportunities:**
  - Wrap them in rig.js figure(), which already finds Unreal and Mixamo bones (rig.js:56-73). That gives aimable head and arm poses: a head look-at within 9 m and a POSES talk layer while the bubble is up.
  - Use the own walk clip for short beats: Thor circling the crater, Natasha pacing the prow, Hulk pacing the lab. Drive them with lib/ai steer.js and pick the beat with utility.js (idle / patrol / watch player / react).
  - Re-apply the stance poses over the HD idle by blending, as the Spider-Man code does (scene.js:1605-1609).
  - Add reactions: a POSES.guard flinch when he lands within 3 m, POSES.proud for Thor after the Mjolnir win.

### Smash Run: Hulk (player)

- **Files:** src/components/avengers/smash/scene.js:175-201, src/components/avengers/smash/scene.js:316-420, src/components/avengers/smash/scene.js:422-482, src/components/avengers/smash/meshy.js:139-187, src/components/avengers/hq/kit/humanoid.js:670-720
- **Model:** public/hq/meshy/ does not exist in the repo, so what ships is the hq kit procedural buildHumanoid('hulk'). The Meshy path (meshyFigure, own idle/walk/run) runs only after scripts/meshy.mjs has made the hq set.
- **Animation:** Procedural: poseHumanoid run, cadence 1.1 + speed/26, then hand-set bone rotations for the smash, leap, landing, roar and 'lost' kneel (scene.js:326-412). Red flash and blinking on hit. The Meshy path plays its own run and lays smash/leap/roar over it with the aim() limb pointer (scene.js:437-472).
- **AI:** n/a
- **Problems:**
  - The Meshy path's meshyFigure.set() flips weights 0/1 with no crossfade, so idle to run pops (meshy.js:172-178).
  - Meshy run timeScale 0.75 + speed/32 is not derived from ground speed (scene.js:437).
  - Getting hit is a red tint and flinch only; there is no stagger pose (scene.js:326, 416-417).
  - meshy.js has its own private GLB and clip loader that duplicates meshyCast.
- **Opportunities:**
  - Generate Hulk on the Meshy skeleton, then use createMeshyCast's idle/walk/run speed blend. SHARED_CLIPS apply directly: 'punch' for the smash, 'hit' on a hit, 'fall' for 'lost', 'taunt' for the roar.

### Smash Run: Chitauri foot soldiers and chariot riders (enemy)

- **Files:** src/components/avengers/smash/scene.js:204-218, src/components/avengers/smash/scene.js:567-612, src/components/avengers/smash/scene.js:629-671, src/components/avengers/smash/scene.js:697-714, src/components/avengers/smash/rules.js:43, src/components/avengers/smash/rules.js:369, src/components/avengers/hq/kit/humanoid.js:715
- **Model:** hq kit procedural 'chitauri' (the Meshy chitauri path is dead, as for Hulk)
- **Animation:** poseHumanoid walk at speed 1.1 with phase o.id*1.3, out of phase. The aim arm rises when within 30 m. Smashed soldiers are thrown as rigid bodies with idle flinch. Riders use poseHumanoid idle with aim 0.9.
- **AI:** None. rules.js:369 walks each one straight at Hulk at 2.2 m/s. Riders follow a scripted warn/burn path.
- **Problems:**
  - The idle side-sway sin(clock*0.7+id)*0.15 slides them sideways with no stepping (scene.js:577).
  - They raise rifles inside 30 m but never fire or recoil (scene.js:582).
  - Flung soldiers use poseHumanoid 'idle', which still swings the right arm ±0.4 rad (humanoid.js:715 applies the -sin(k*5) arm swing in idle).
  - Meshy path: the mixer is not updated while a soldier is flying (scene.js:669, non-Meshy only), so it freezes mid-step. set('walk', 1.1) is not matched to 2.2 m/s (scene.js:580).
  - No hit or fall reaction on the smash: rigid tumble only.
- **Opportunities:**
  - As Meshy figures: SHARED_CLIPS 'shoot' inside 30 m, 'hit'/'fall' on smash, 'scared' when Hulk rages.
  - Give out shots with squad.js tokens so only one or two aim at a time.

### Thwip!: Spider-Man (player)

- **Files:** src/components/avengers/thwip/scene.js:121-170, src/components/avengers/thwip/rules.js:204-208, src/components/avengers/thwip/rules.js:266-290
- **Model:** Sketchfab HD spiderman.glb through rig.js figure()
- **Animation:** rig.js POSES only: a hand-built swing pose (web arm up the line), POSES.fall in the air, POSES.guard for the flip, POSES.hover(time*3) on the street. The body leans up the web or along the velocity.
- **AI:** n/a
- **Problems:**
  - On the street the rules run him at 9 m/s (rules.js:206), but he is posed POSES.hover with dangling legs, so he slides down the avenue (scene.js:167). spiderman-moves.glb (idle/walk/run/jump) exists and the compound uses it.
  - Hitting the street (losing a heart) or being honked into by a car has no hurt or stumble pose, only smoke and shake (scene.js:253-264).
  - The swing pose is static through the arc. The compound's richer swingPose(arcK), holderAt and bankFor are duplicated code there, not shared (world/scene.js:1515-1589).
- **Opportunities:**
  - Load the manifest moves and play clipsFor 'run' on the street at 9/5.08 ≈ 1.8x.
  - Move the compound's offPose/swingPose/holderAt into one shared Spider-Man module that both scenes use.
  - Use POSES.hurt on 'street' and 'honk' events.

### Infiltration: Natasha and her hologram ghost (player)

- **Files:** src/components/avengers/widow/scene.js:36-74, src/components/avengers/widow/scene.js:328, src/components/avengers/widow/scene.js:845-919, src/components/avengers/widow/scene.js:1038-1061
- **Model:** hq kit procedural 'widow' (buildHumanoid)
- **Animation:** Hand-written bone rotations. A low stride while the tile tween runs, a side-on fighter's crouch at rest, overlays for the takedown and the Bite, and a stand-up on win.
- **AI:** n/a (turn-based)
- **Problems:**
  - Moving and crouch are a hard switch on a boolean, so pose and hips yaw snap (0 to 0.35 rad) at every tile start and end (scene.js:849 vs 867-870).
  - Stride phase uses the linear k while position uses ease(k) (scene.js:65-66, 851), and each tile is 1.6 m in 0.26 s, so feet skate at the start and end of every step.
  - Being caught by the alarm triggers no reaction; the level just resets.
- **Opportunities:**
  - Crossfade the two poses over about 0.15 s with eased per-bone weights.
  - Drive the stride phase from ease(k) so feet match position.
  - Longer term: the HD Sketchfab widow.glb (own idle/walk/run) through rig.js.

### Infiltration: HYDRA guards (enemy)

- **Files:** src/components/avengers/widow/scene.js:330-335, src/components/avengers/widow/scene.js:921-966, src/components/avengers/widow/scene.js:1007-1031, src/components/avengers/widow/scene.js:1066-1078, src/components/avengers/widow/rules.js:33-36, src/components/avengers/widow/rules.js:378-390
- **Model:** hq kit procedural 'hydra'
- **Animation:** poseHumanoid walk or idle, phase i*1.7, rifle held at the low ready, head scanning when still. Hand-set dazed kneel when stunned and an eased fall when down. Aim when this guard raised the alarm.
- **AI:** A fixed per-level schedule string (route letters, rules.js:33-36, 378-390). It is deterministic by design so solveLevel can prove each level solvable, so the AI should stay deterministic.
- **Problems:**
  - Idle and walk is a mode flip with no blend (scene.js:924).
  - Gait covers about 0.79 cycles per 1.6 m tile in 0.26 s (k*0.9*1.1*5 rad), so feet skate.
  - sh.alert is set on spotted (scene.js:1309) and decays (1030) but is never read by poseGuard: no flinch or head-snap toward Natasha.
  - No head or look-at toward Natasha when she is adjacent or at the edge of the cone.
- **Opportunities:**
  - Cosmetic reactions only: alert drives a head look and aim toward her tile; a shoulder stagger on wake.
  - Swap in a rigged Meshy soldier (meshyCast RIGGED has cop, fedagent, secretservice) with own walk plus SHARED_CLIPS 'shot'/'fall'/'hit' for the Bite and the takedown.

### Invincible city: Mark (player) and the ghosts of other players (player)

- **Files:** src/components/invincible/world/scene.js:133-142, src/components/invincible/world/scene.js:256-276, src/components/invincible/world/scene.js:441-487, src/components/invincible/world/scene.js:548-581, src/components/invincible/world/flight.js:19-21, src/lib/three/rig.js:203-208, src/lib/three/rig.js:225-251, src/lib/three/rig.js:270
- **Model:** Meshy GLB mark.glb on Meshy's humanoid skeleton, with own Meshy library clips idle, walk, run, punch, hit, land, wave, cheer, hover, fly (scripts/meshy-invincible.mjs CLIPS.hero)
- **Animation:** rig.js act() for idle/walk/run/hover/fly/hit and POSES for punch, the landing crouch, and stand fallbacks. carry() leans the body along the flight. Walk rate = clamp(flat/1.4, 0.6, 2.2); run rate = clamp(flat/5.5, 0.7, 1.6).
- **AI:** n/a
- **Problems:**
  - Normal walk top speed is FLY.walk = 4 m/s (flight.js:20). The walk clip is capped at 2.2x (about 3.1 m/s), so a plain walk always plays the clip over-sped and still slides (scene.js:567).
  - Walk to run at 4.5 m/s restarts the run clip at t=0 because rig.js act() has no stride sync (rig.js:230-231), so feet scramble. The compound's clipsFor already solves this (avengers/world/people.js:60-65).
  - Punch and the landing crouch are POSES (scene.js:564-565, 577) although 'punch' and 'land' clips exist.
  - Any clip-to-pose switch snaps: pose() calls halt(), which deletes dirs (rig.js:207), and cur starts at the target (rig.js:270), so there is no ease out of the clip.
  - wave and cheer are never played; there is no context for them (e.g. the fight's 'won' event, fans waving).
  - Unverified: clips.js:66-69 says Meshy's idle stands turned off to one side, and rig.js act() applies no faceAhead correction, so the idle may face off the walk heading.
- **Opportunities:**
  - Add stride-synced crossfade to rig.js act() (port clipsFor). Start the run near 2.5 m/s, or slow FLY.walk to about 3 m/s.
  - Play 'punch' once with the POSES arm aim layered over it.
  - Play 'land' on crouch, 'cheer' on fight 'won', and 'wave' back when a fan or Debbie waves.

### Invincible city townsfolk and named NPCs: Debbie, Cecil, Burger Mart manager and line, school students, plaza crowd (crowd)

- **Files:** src/components/invincible/world/npcs.js:31-44, src/components/invincible/world/npcs.js:51-82, src/components/invincible/world/npcs.js:100-118, src/components/invincible/world/npcs.js:167-176, src/components/invincible/world/people.js:209-284, src/components/invincible/world/people.js:295-340, src/components/invincible/world/scene.js:98-99, src/components/invincible/world/scene.js:502-507, src/components/invincible/world/scene.js:591
- **Model:** Meshy GLBs (debbie, cecil, civ-a/b/c) on Meshy's humanoid skeleton, posed with rig.js. Own clips: idle, walk, talk, wave, phone, run, cheer, look. Fallback is the hq kit person (posePerson).
- **Animation:** act(CLIP_OF[mode], { at: phase*0.37, fade: 0.4 }) for idle, talk and wave, with crowd phases spread. 'arms' (Cecil, the manager) is the posed figurePose with no clip.
- **AI:** None. Mode is set by distance: talk inside r, wave when Mark is airborne nearby. Within 30 m the whole holder yaws toward Mark with exp(-3dt).
- **Problems:**
  - Everyone within 30 m pivots the whole body to face Mark, like turrets, including when he is far overhead. It is a feet-planted pivot with no head-only look (npcs.js:109-113).
  - 'talk' loops whenever Mark is within r, whether or not a line is being said (npcs.js:114).
  - No NPC ever walks, although every one has walk, run, phone, look and cheer clips.
  - The scare events (slam, boom, ko, scene.js:502-507) reach only the traffic (scene.js:598); this crowd keeps chatting next to a fresh crater.
  - 'arms' figures are permanently posed, because pose() halts the mixer, so they have no breathing clip underneath (people.js:310, 326).
  - figurePose walk passes k*5.5/(2π) to POSES.stride, which wants radians, so the stride cycle is about 7 s (people.js:305). Dormant today because every figure has a walk clip.
- **Opportunities:**
  - They share Meshy's skeleton, so the shared clips-*.glb load straight onto them with clips.js retarget(clip, hipsY): 'scared' or 'fall' on scare events, 'cheer'/'happy' when Mark lands near or the Flaxans are beaten, 'sitcross' on plaza benches, 'drink' in the Burger Mart line.
  - Idle variety through utility.js: idle, phone, look, talk, with cooldowns.
  - Head look-at by aiming the head bone (rig.js aim) in place of yawing the body; turn the body only past about 60°, with a 'walk' turn-step.
  - A lib/ai tree: notice (perception.js) → wave/cheer → flee on stims from the scare list.

### Atom Eve's patrol (companion)

- **Files:** src/components/invincible/world/npcs.js:22-29, src/components/invincible/world/npcs.js:83-93, src/components/invincible/world/npcs.js:120-165, docs/superpowers/HANDOFF-runtime.md:18
- **Model:** Meshy GLB eve.glb on Meshy's skeleton, with the hero clip set (idle, walk, run, punch, hit, land, wave, cheer, hover, fly) through rig.js
- **Animation:** act('fly') when fast, else act('hover'). The holder leans along the velocity (or the fly clip lies along it) and slerps.
- **AI:** Hand-rolled: a parametric ellipse loop, and a stop/wait/patience/done state machine (npcs.js:124-138). It does not use lib/ai; the handoff lists her as left to do.
- **Problems:**
  - A fixed path that ignores the Flaxan fight and the rescues.
  - When stopped for Mark she hovers and faces him (npcs.js:149) but never waves, talks or cheers, although she has the wave and cheer clips.
  - Path height wobbles with sin(a*3)*25 whatever is around.
- **Opportunities:**
  - A utility.js pick over patrol, stop and talk, race, and assist (join the Flaxan fight using fight.js state).
  - Play 'wave' once on stopping and 'cheer' after a won fight, plus shared 'taunt'/'happy'.

### Invincible set-piece figures: Omni-Man over downtown, Allen near the Moon, Thragg over Mars (npc)

- **Files:** src/components/invincible/world/scene.js:143-170, src/components/invincible/world/scene.js:583-588, src/components/invincible/world/scene.js:602-607
- **Model:** Meshy GLBs through rig.js. Allen goes through personFor, so it could fall back to the kit.
- **Animation:** act('hover') with a sine bob, falling back to POSES.proud.
- **AI:** None. Fixed spot and fixed yaw.
- **Problems:**
  - Omni-Man's yaw is fixed (OMNI.yaw), so he never looks at Mark (scene.js:144, 586).
  - Allen and Thragg face Earth on a fixed yaw. You can talk to them (spaceTalk, r 70-90), but they never turn and never gesture. Allen has a 'talk' clip (scene.js:604).
- **Opportunities:**
  - Turn the yaw toward Mark within talk radius with exp smoothing.
  - Allen: 'talk' while talkers() includes him.
  - Thragg and Omni: shared 'taunt' on approach.

### Invincible city pavement walkers (instanced crowd) (crowd)

- **Files:** src/components/invincible/world/life.js:121-193, src/components/invincible/world/traffic.js:72-75, src/components/invincible/world/traffic.js:154-188
- **Model:** Instanced boxes: a torso, an icosahedron head, two rigid box legs. No arms or knees.
- **Animation:** Legs swing sin(phase*5.5) with phase += dt*speed, about 1.1 m per stride (fine). Swing grows while fleeing.
- **AI:** traffic.js: walk the pavement, turn at a corner or 20% reverse, flee directly away from scare points at 5 m/s for 4 s, then ease back.
- **Problems:**
  - Heading snaps instantly on reversals and on the start and end of a flee (life.js:174); the cars get yaw smoothing (life.js:153-155) but walkers do not.
  - On returning to the pavement, ox/oz decays sideways while they face along the street, so they slide laterally (traffic.js:170-174).
  - No avoidance of each other or of Mark: he walks through them.
  - No arms or knees; reads as 2009-era filler next to HD named NPCs.
- **Opportunities:**
  - Near-camera LOD: swap the nearest 10-20 for civ-a/b/c figures driven by meshyCast's idle/walk/run speed blend, with 'scared' on flee.
  - Smooth heading as the cars do.
  - steer.js context steering for avoidance.

### Invincible city rescue victim (npc)

- **Files:** src/components/invincible/world/challenges.js:106-163
- **Model:** hq kit procedural person (buildPerson('person', 41))
- **Animation:** posePerson 'wave' on the ledge during warn, 'hover' while tumbling through a rigid spin, 'hover' rotated -1.3 when carried.
- **AI:** Scripted by the quests rules.
- **Problems:**
  - A procedural kit figure among HD Meshy civilians.
  - Falling is a hover pose in a rigid spin, with no flailing.
  - Carried is the hover pose tilted, with no cradle or arm-around-neck.
  - No relief or thanks on set-down.
- **Opportunities:**
  - Use the civA figure with own 'wave', shared 'scared' on warn, shared 'fall' while falling, 'happy'/'cheer' on set-down, and POSES targets for the carry (arm round his neck).

### Flaxans (Invincible city invasion and Think, Mark! chapter two) (enemy)

- **Files:** src/components/invincible/world/flaxans.js:57-71, src/components/invincible/world/flaxans.js:95-118, src/components/invincible/world/fight.js:121-157, src/components/invincible/thinkmark/scene.js:72-86, src/components/invincible/thinkmark/scene.js:363-384, src/components/invincible/thinkmark/rules.js:691-787
- **Model:** hq kit procedural 'chitauri' at 0.74 scale, tinted purple. The drawing code and portal shader are duplicated in both files.
- **Animation:** poseHumanoid 'hover' with an aim arm (1 in range or while aiming) and lean by speed. KO is a rigid spin with flinch.
- **AI:** City (fight.js): every foe orbits Mark at the same 22 m radius (fight.js:131-138) and fires on a 2.4-4.2 s cooldown with no telegraph. Think, Mark! (rules.js:755-783) is better: its own radius and direction, an 'aim' state telegraph, and lead shots. Neither uses lib/ai.
- **Problems:**
  - City foes form a uniform ring and fire with no wind-up or tells (fight.js:142-146).
  - No cap on simultaneous shooters in either version.
  - No dodge, retreat or regroup when hit or when their numbers drop.
  - Rigid KO tumble with no hit reaction before it.
- **Opportunities:**
  - Port Think, Mark!'s 'aim' telegraph to fight.js.
  - squad.js shot tokens, spatial.js positions on varied radii and heights, and nerve so they scatter after several KOs.
  - As a Meshy figure: SHARED_CLIPS 'shoot', 'hit', 'fall'.

### Think, Mark!: Mark (player)

- **Files:** src/components/invincible/thinkmark/scene.js:51-61, src/components/invincible/thinkmark/scene.js:242-264
- **Model:** mark.glb, the Meshy figure with its own hero clips, through rig.js
- **Animation:** POSES only: hover(t), fly, punch aimed at the lock target, guard with a roll for the dodge, hurt. It never calls act(), although idle, hover, fly, punch, hit, land and cheer clips are loaded.
- **AI:** n/a
- **Problems:**
  - The motion-captured hover and fly clips go unused; hover is a sine bob (scene.js:260). The city world does use them for the same figure.
  - Getting hurt uses POSES.hurt, not the 'hit' clip, and a chapter clear has no 'cheer'.
- **Opportunities:**
  - act('hover')/act('fly') as invincible/world/scene.js:578-579 does; keep the aimed POSES.punch.
  - 'hit' once on hurt; 'cheer' on clearChapter.

### Think, Mark!: Omni-Man and Thragg bosses, and Omni-Man as the lesson guide (boss)

- **Files:** src/components/invincible/thinkmark/scene.js:266-312, src/components/invincible/thinkmark/scene.js:331-338, src/components/invincible/thinkmark/rules.js:821-1005
- **Model:** omni-man.glb and thragg.glb, Meshy figures with the hero clip set, through rig.js
- **Animation:** POSES only: windup (with a glowing fist), fly for charge, dive and rise, hover for recover, hurt with a roll for stagger, fall for down, proud for intro, circle and the guide.
- **AI:** Hand-rolled timed state machine: intro → circle → windup → charge → recover, with rise → dive every third attack (b.attacks % 3, rules.js:877). Thragg doubles his charge, and three HP phases speed things up. Tells and perfect-dodge windows are good. It does not use lib/ai.
- **Problems:**
  - Attack choice is a fixed rhythm (attacks % 3) with no memory of how Mark dodges or where he is.
  - His own hit, land and punch clips are unused: stagger is POSES.hurt and the dive impact has no landing.
  - b.yaw is set directly by face() (rules.js:830-832) and carry() writes holder.rotation straight from it, so turns into a charge snap.
- **Opportunities:**
  - utility.js weighs charge, dive or a feint by range, Mark's speed and his last dodge side (perception-style memory). Keep the tells.
  - 'hit' clip on stagger, 'land' at the dive impact; shared 'taunt' for the intro and 'cheer' for Omni's 'leave' (Meshy skeleton, so SHARED_CLIPS apply).

### GDA viewer turntable (Mark, Omni-Man, Thragg) (other)

- **Files:** src/components/invincible/viewer/scene.js:40-80, src/components/invincible/viewer/Viewer.jsx:38-44
- **Model:** The Meshy figures through rig.js
- **Animation:** Static rig.js POSES picked from a list: stand, hover, fly, punch, windup.
- **AI:** n/a
- **Problems:**
  - 'stand' is a frozen pose with no breathing.
  - The figures' own motion-captured clips (idle, walk, run, punch, hit, land, wave, cheer, hover, fly) cannot be previewed.
- **Opportunities:**
  - Add a clips row from f.clips that plays act(name) with tick(dt), default 'idle'; keep POSES as 'posed' variants.

**Notes:** 1. Four separate clip players with different quality:
   - avengers/world/people.js clipsFor is the best: crossfade, stride sync on walk/run swaps, and no restart when a fading clip is taken back. It is tested in people.test.js.
   - rig.js act()/tick() crossfades but has no stride sync. Also, pose() after a clip snaps straight to the target: halt() clears dirs (rig.js:207) and cur starts at the target (rig.js:270).
   - smash/meshy.js meshyFigure flips weights 0/1 with no fade (meshy.js:172-178) and has its own private loader.
   - rickmorty meshyCast has the speed blend.
   Promote clipsFor's stride sync, and the compound's pose-over-clip per-bone weight blend (avengers/world/scene.js:1601-1609), into rig.js so every rig.js figure gets them.

2. Five hand-written procedural pose systems sit on the kit skeleton:
   - hq/kit/humanoid poseHumanoid
   - invincible/world/people.js posePerson
   - widow poseWidow and poseGuard
   - smash poseHulk
   - the compound's per-NPC overrides
   None of them uses rig.js POSES. humanoid.js:715 swings the right arm ±0.4 rad even in 'idle' (left arm amp is 0). Most callers overwrite shoulderR afterwards; Smash's flung soldiers (smash/scene.js:669) do not.

3. No character in scope uses src/lib/ai. Every behaviour is hand-rolled (Eve, the ThinkMark bosses, the Flaxans, traffic walkers) or a fixed schedule (Infiltration guards, which must stay deterministic for solveLevel). Eve is already listed as left to do in HANDOFF-runtime.md:18.

4. All Invincible figures are Meshy-rigged (scripts/meshy-invincible.mjs), so the shared clips-*.glb library (SHARED_CLIPS: scared, fall, hit, cheer, happy, wave, sitcross, drink, taunt, shoot, punch, dance, shot) can be put on them directly with clips.js retarget(clip, hipsY). That is the cheapest big win. The Avengers Sketchfab models (Thor Mixamo-like, Hulk Unreal, Widow Auto-Rig Pro, Spider-Man) need a bone map first; rig.js's role finder already knows those names.

5. public/hq/meshy/ is absent, so Smash Run's Meshy path never runs and both the Hulk and the Chitauri are procedural in practice.

6. invincible/world/people.js:305 passes the walk stride phase divided by 2π to POSES.stride, which wants radians. Dormant, because every HD figure has a walk clip.

7. Unverified: clips.js:66-69 says Meshy's idle stands turned off to one side, and rig.js act() applies no faceAhead correction to the Invincible figures' idle.

8. The Spider-Man swing, wall and perch posing (avengers/world/scene.js:1464-1645) is richer than Thwip's copy (thwip/scene.js:141-170); move it into a shared module.

9. The Flaxan drawing and portal shader are duplicated between invincible/world/flaxans.js and thinkmark/scene.js.

10. Other avengers games (hq, lawn, repulsor, ricochet, tesseract, titan, trickshot) also use the kit humanoids but were outside this scope.

## Middle-earth (src/components/middleearth: map hub diorama, Shire, 12 walkable towns, Bridge, Gorgoroth, Rush)

Routes: /middle-earth (MapHub -> mapDiorama.js figures), /middle-earth/shire (ShireWorld; Rush level party), /middle-earth/bree (BreeWorld; Rush), /middle-earth/weathertop (WeathertopWorld; Rush weathertop), /middle-earth/rivendell (RivendellWorld; Rush rivendell), /middle-earth/moria (MoriaWorld; Bridge3D; Rush moria), /middle-earth/lorien (LorienWorld; Rush lorien), /middle-earth/amon-hen (AmonHenWorld; Rush amonhen), /middle-earth/dead-marshes (MarshesWorld; Rush ithilien), /middle-earth/cirith-ungol (CirithUngolWorld; Rush tower), /middle-earth/mordor (DoomWorld, Gorgoroth3D, Ring3D; Rush cormallen), /middle-earth/orthanc (OrthancWorld), /middle-earth/minas-tirith (MinasTirithWorld), /middle-earth/edoras (EdorasWorld)

### Player avatar on foot (Frodo / Sam / Gimli / Pippin / Gandalf, Shire + every town) (player)

- **Files:** src/components/middleearth/mapFigures.js:25-169 (makeToyFigure), src/components/middleearth/mapFigures.js:251-270 (pose), src/components/middleearth/shire/people.js:69-87,109-130 (makePerson, sit, dance, calm), src/components/middleearth/towns/walker.js:20,97-156 (HOBBIT, makeWalker), src/components/middleearth/shire/rules.js:230,285-330 (duplicate HOBBIT + step), src/components/middleearth/shire/scene.js:514-531, src/components/middleearth/towns/bree/scene.js:538-545, src/components/middleearth/towns/edoras/scene.js:383-386,513-517, src/components/middleearth/towns/minastirith/scene.js:634,664-679, src/components/middleearth/towns/orthanc/scene.js:614,702, src/components/middleearth/towns/cirithungol/scene.js:668-670, src/components/middleearth/towns/moria/scene.js:570-583
- **Model:** Procedural big-head toy figure. Groups for body, head, 2 single-segment cylinder legs hinged at the hip, 2 single-segment arms. No knees, elbows or ankles, no skeleton. Merged per group by compact() (people.js:31) or pack() (edoras/folk.js:61, minastirith/folk.js). No GLB.
- **Animation:** pose(): a binary `moving` flag. Legs swing sin(t*13*speed)*0.75 rad, arms counter-swing at 0.6, bob is abs(cos)*0.07. Idle is a 1.2 cm bob at 2 rad/s plus head sway sin(0.7t)*0.35. speed is 1 walking and 1.45 running (Edoras and Minas Tirith use min(1.4, h.speed/3.2 or 3.4)). Crouch is body.y -0.12 or -0.18. Plank, climb, drink and bash set arm rotations directly after pose().
- **AI:** n/a. Input goes to walker.step. Facing eases toward the input direction at turn 11 rad/s (walker.js:146-151).
- **Problems:**
  - Foot sliding: stance foot speed is about 2*0.34*sin(0.75)*13/pi = 1.9 m/s against HOBBIT.walk 3.4. At run, 2.8 m/s against 6.2. The feet cover only ~45-55% of the ground (mapFigures.js:253, walker.js:20).
  - Cadence uses absolute t, not an accumulated phase. Toggling run (speed 1 to 1.45) jumps sin(t*13*speed) to a new phase, so the legs pop (mapFigures.js:253).
  - No blend between idle and walk. moving=false zeroes legs and arms and snaps the head to the idle sway in one frame (mapFigures.js:253-258, 267).
  - No knee or ankle joints: the legs are stiff pendulums. Sit rotates the whole leg 1.45 rad (people.js:109-115). No foot placement on slopes or stairs.
  - No start/stop, turn-in-place, turn lean or jump. Being caught (Nazgul, dogs, troll, Uruks) plays no reaction: a text line and a teleport (BreeWorld.jsx:573-581).
  - pose() forces arms[1].rotation.x = 0 every frame unless waving (mapFigures.js:263), so held-item poses must be re-applied after it. arms[0].rotation.x is never reset, so it leaks between modes (e.g. Sam's -0.6 at cirithungol/scene.js:670).
  - Walker physics is duplicated: towns/walker.js:20 copies shire/rules.js:230.
- **Opportunities:**
  - Accumulate phase from distance (phase += dist/strideLen) as Bridge3D.js:420 does (stride = x*1.25), or with speed-dependent cadence like weathertop/props.js:2087-2102 gallop(). Add a 0..1 move blend with idle that mirrors meshyCast update(c,t,move,hit).
  - No LOTR figures exist in public/games/meshy. Generating Frodo, Sam, Gimli, Pippin and Gandalf with scripts/meshy.mjs would allow createMeshyCast: idle/walk/run blended by h.speed, plus SHARED_CLIPS fall (caught), hit, scared (Ring on, Nazgul 'seen' event), sitcross (Bree bench, Shire bench), drink (Edoras feast edoras/scene.js:481-489, Bree pints), dance (Bree song inn.js:272-284) and cheer (quest done).
  - Without GLBs: add knee and elbow groups to makeToyFigure and a foot-plant IK pass like Gollum's reach2 (marshes/props.js:1124-1135).
  - Make sneak/crouch a gait of its own (lower hips, shorter stride) instead of a body.y offset.

### Story cast and townsfolk (standing toy figures: Shire cast & party guests, Bree cast/inn folk/Butterbur, Rivendell cast & council, Moria gate cast, Lorien cast/Galadhrim/Lady & Lord, Amon Hen cast, Edoras court, Minas Tirith guards/Beregond/keeper, Weathertop cast) (npc)

- **Files:** src/components/middleearth/shire/scene.js:358-384,533-571, src/components/middleearth/towns/bree/scene.js:287-298,548-567, src/components/middleearth/towns/bree/inn.js:152-182,199-285, src/components/middleearth/towns/bree/props.js:770-800 (makeFolk), src/components/middleearth/towns/bree/ranger.js:287-334 (Strider in the corner), src/components/middleearth/towns/rivendell/scene.js:489-548, src/components/middleearth/towns/moria/scene.js:593-604, src/components/middleearth/towns/lorien/scene.js:803-858, src/components/middleearth/towns/amonhen/scene.js:470-479,555-563, src/components/middleearth/towns/edoras/scene.js:352-374,438-490, src/components/middleearth/towns/edoras/folk.js:472-545, src/components/middleearth/towns/minastirith/scene.js:593-619,648-662, src/components/middleearth/towns/minastirith/folk.js:394, src/components/middleearth/shire/inside.js:272-274
- **Model:** The same toy builder (mapFigures.js:25), dressed per town: Bree in bree/props.js:771; Edoras and Minas Tirith packed to about 12 draws on 4 shared vertex-colour materials. Bree's corner Strider is a bespoke procedural figure (ranger.js).
- **Animation:** pose() idle (bob plus head sway). talk is a head roll sin(9t) (mapFigures.js:268). wave raises and waggles the right arm (mapFigures.js:260-262). Within 5 m the whole group turns to the player at dt*4. sit, dance and calm come from people.js. One-offs set rotations directly: Bilbo's reach (rivendell/scene.js:497-504), Legolas's tankard (edoras/scene.js:487), the beacon keeper's eat/stir/look (minastirith/scene.js:657-662), the kneel (minastirith/scene.js:612-619), Rivendell elves' wave.
- **AI:** None. They stand at fixed c.x/c.z. Story beat and time of day decide who is visible. Proximity opens dialogue. The Minas Tirith beacon keeper runs a hand-rolled timer of eat, stir and look phases (minastirith/rules.js:77-136). No lib/ai.
- **Problems:**
  - Idles in unison: the Shire cast is posed with the same t (shire/scene.js:550). The Bree inn uses t + id.length (inn.js:268,270), and folk0..folk9 all have length 5. Minas Tirith guards use t + g.x, with pairs sharing x = 4 and x = 14 (minastirith/layout.js:270-274, scene.js:598), so each pair is in lockstep.
  - Every idle shares one frequency and amplitude (2 rad/s, 1.2 cm bob; 0.7 rad/s head), so the cast read as mannequins.
  - No head look-at. They rotate the whole group toward the player (shire/scene.js:543-546, bree/scene.js:555-559) while the head keeps its unrelated sway (mapFigures.js:267). Only Bree's corner Strider turns his head to a target (ranger.js:297-306).
  - Snap-turns with no easing: Shire Gandalf (shire/scene.js:561), Bree night Strider (bree/scene.js:565), Lorien Lady and Lord (lorien/scene.js:855), Boromir when talking (amonhen/scene.js:503).
  - In the towns, wave and talk play only once s.talk === id, never on approach (shire/scene.js:550, bree/scene.js:560). The talk gesture is a head wobble only: no arm or hand gestures.
  - Hard state cuts: the Rivendell council stands up in one frame when heat crosses the threshold (rivendell/scene.js:533-541). The Bree inn calls homeAll() every frame and teleports people per beat (inn.js:206-245). Frodo's 'slip' fall is a rotation.z tween (inn.js:226-228).
  - Nobody moves about: no schedules, no wandering, no NPC-to-NPC conversations. Towns feel static.
  - Edoras stand() resets body rotation but not arm rotation, so arm overrides leak across modes (edoras/scene.js:278-285).
- **Opportunities:**
  - lib/ai/utility.js with spatial.js for idle schedules: Butterbur serving, Bree-landers drinking or walking to the bar, Harry patrolling his gate, elves strolling between spots. Walk them with walker.push and the town COLLIDERS.
  - Clamped head look-at (yaw ±1.2) to the player within ~6 m, turning the body only past the clamp.
  - Port mapDiorama.js's greet-on-approach (671-675: greeted latch, wave+talk decay) to every town cast.
  - Per-figure phase and frequency jitter in pose(), seeded like wraiths.js:1020 or moria goblin ph0 (moria/props.js:3392).
  - With Meshy GLBs: SHARED_CLIPS drink (Bree, Edoras feast), sitcross (inn tables, council seats, Shire bench), cheer (Amon Hen skipping amonhen/scene.js:561, Bree song), dance (Shire party guests and Merry/Pippin shire/scene.js:547,566), wave on approach, taunt (Grima), scared (townsfolk when the Nazgul are out).

### Fellowship followers and guides (Rivendell/Moria/Lorien company, Moria Gandalf, Haldir, map Sam) (companion)

- **Files:** src/components/middleearth/towns/rivendell/rules.js:147-182 (newParty, lead, followAt), src/components/middleearth/towns/moria/MoriaWorld.jsx:672-705, src/components/middleearth/towns/moria/scene.js:606-619, src/components/middleearth/towns/rivendell/scene.js:509-525, src/components/middleearth/towns/lorien/scene.js:812-848, src/components/middleearth/towns/lorien/rules.js:25-60 (stepLead), src/components/middleearth/mapDiorama.js:646-665
- **Model:** Toy figures (mapFigures.js / shire/people.js).
- **Animation:** pose() with a moving flag and speed 1 (1.5 on the Moria flight). In the Moria chamber, 'fight' is wave: 0.6.
- **AI:** Breadcrumb trail: lead() drops a crumb every 0.25 m and followAt(n) places follower n at gap*(n+1) along it. Moria Gandalf lerps toward a point 2.6 m ahead of the player (MoriaWorld.jsx:678-684). Haldir walks the fixed LEAD path, stops and looks back when the gap exceeds LEADS.wait (lorien/rules.js:25-60). Map Sam keeps a 1.5 gap (mapDiorama.js:649-660). No lib/ai.
- **Problems:**
  - The Moria trail followers use the player's speed as their moving flag (MoriaWorld.jsx:688), not their own, so they walk in place or slide.
  - Rigid conga line: exact trail points, a stop on the same frame as the player, facing taken from the trail segment (rivendell/rules.js:167-181). No personal space, no idles; they overlap at corners.
  - The Moria chamber 'fight' is an arm raised at fixed FIGHT slots (MoriaWorld.jsx:690-694, moria/scene.js:618): no swings, no hits, no targeting of goblins or the troll.
  - On the flight they sit at s.flight.s + offset with moving:true, speed 1.5 (MoriaWorld.jsx:701-703). Feet cover about 2.8 m/s of the 5.6 run (moria/rules.js:141), so they skate.
  - Map Frodo and Sam snap their facing (mapDiorama.js:640,657).
- **Opportunities:**
  - lib/ai/steer.js for arrival plus separation following, with each follower's own speed driving its gait.
  - lib/ai/squad.js tokens for the Moria chamber fight: companions engage goblins and the troll in turns.
  - With clips: shoot (Legolas), punch (Gimli, Aragorn), cheer at the bridge end, scared on the flight, wave when Haldir waits.

### Watcher-patrol enemies on watchers.js (Uruk-hai, Easterling scouts, Cirith Ungol tower orcs, Moria cave troll, Boromir) (enemy)

- **Files:** src/components/middleearth/towns/watchers.js:41-262, src/components/middleearth/towns/amonhen/props.js:2578-2593 (uruk animate), src/components/middleearth/towns/amonhen/scene.js:499-507,536-552, src/components/middleearth/towns/marshes/props.js:2090-2125 (eastPose, easterling), src/components/middleearth/towns/marshes/scene.js:712-720, src/components/middleearth/towns/cirithungol/props.js:1554-1568,1683-1713,1731-1752 (ORC_BONES, orcPose, orc), src/components/middleearth/towns/cirithungol/scene.js:671-680, src/components/middleearth/towns/moria/props.js:3187-3226 (troll animate), src/components/middleearth/towns/moria/scene.js:664-672, src/components/middleearth/towns/amonhen/AmonHenWorld.jsx:508,546, src/components/middleearth/towns/marshes/MarshesWorld.jsx:592, src/components/middleearth/towns/cirithungol/CirithUngolWorld.jsx:590, src/components/middleearth/towns/moria/MoriaWorld.jsx:567
- **Model:** Bespoke procedural rigs per town. Uruk: Group hierarchy. Easterling: Group rig, merged per bone. Tower orcs: skinned meshes on a procedural THREE.Bone skeleton (orcRig with make=Bone, cirithungol/props.js:1737). Troll: Groups with shins and forearms. Boromir: a toy figure.
- **Animation:** Hand-written sine gaits on a binary flag at a fixed cadence: Uruk t*9.5 (amonhen/props.js:2579), Easterling t*6.2 (marshes/props.js:2093), orc 10.5 running and 6.4 marching (cirithungol/props.js:1686), troll t*3.0 (moria/props.js:3190). Easterling alert levels the spear. The troll's club swing is driven by s.swing and it roars while hunting. The Uruk swing loops sin(t*4) through the whole chase. Uruk, orc and goblin use per-instance ph0 or t+i offsets.
- **AI:** watchers.js on lib/ai: patrol rounds with look-about at corners. Senses: cone sight blocked by COLLIDERS (sightClear), hearing a running player, smell, the Ring. A detection timer `far`, a `suspicious` walk-over-to-look, lib/ai/perception beliefs with 2 s intuition, then lib/ai/search: a shared search of round corners and spots. giveUp and leash return them to the round. Boromir is the same watcher with sight 0 (amonhen/rules.js:20). Tower ORCS set no far/suspicious/search (cirithungol/rules.js:211), so they are on the old instant behaviour.
- **Problems:**
  - One cadence for patrol and chase. Uruk patrol 1.7 and chase 4.7 m/s, both on the t*9.5 run cycle (amonhen/rules.js:88). Easterling 1.5 and 4.2 on the t*6.2 march (marshes/rules.js:208). Troll 1.7 and 4.6 on t*3 (moria/rules.js:134). Tower orcs run the 10.5 cycle while patrolling at 1.5 (cirithungol/scene.js:678). Over-stepping on patrol, skating on chase.
  - Binary flags: w = running ? 1 : 0, and the troll/goblin phase is t*(running ? 10 : 0). The pose pops at every corner stop and start (amonhen/props.js:2580, moria/props.js:3189-3190).
  - No attack on catch. The 'caught' event is text and a reset. The Uruk swing loops through the chase instead of timing to contact (amonhen/scene.js:543).
  - No hit reactions. 'alert' is standing still: no point, shout or flinch. The troll roars continuously while hunting rather than once on 'seen'.
  - Chasers do not separate. walkTo heads straight at the belief and push() checks only colliders (watchers.js:72-85, 214), so several stack on one spot. The search.flood chase grid is built but unused (HANDOFF-runtime.md:20).
  - Boromir's charge raises his right arm through the wave param (amonhen/scene.js:506), so he waves while charging.
- **Opportunities:**
  - Pass the actual watcher speed to the rigs: a distance-accumulated phase and a 0..1 walk/run blend (meshyCast-style move).
  - lib/ai/squad.js tokens so 1-2 close in while others flank. lib/ai/steer.js for separation and to path around houses. Feed Bree and Moria a grid for search.flood.
  - Event-driven one-shots: 'seen' plays a roar or point (the troll's roar param exists), 'caught' plays a grab or strike, then the player falls.
  - orcRig is a real Bone skeleton (legL/shinL/foreL…). Mapping it through rig.js figure(..., { bones }) would let POSES hurt, fall, punch, windup and guard replace the hand-written sines. Sharing that rig would also cover Uruks and Easterlings.
  - Give the tower ORCS far, suspicious and search like every other town.

### Nazgul on foot (Bree night hunters, Weathertop) (enemy)

- **Files:** src/components/middleearth/towns/wraiths.js:795-940,1017-1047, src/components/middleearth/towns/bree/scene.js:303-312,581-593, src/components/middleearth/towns/bree/BreeWorld.jsx:565-586, src/components/middleearth/towns/bree/story.js:151, src/components/middleearth/towns/weathertop/scene.js:722-750, src/components/middleearth/towns/weathertop/rules.js:96-203
- **Model:** Procedural layered torn cloth (wind in the vertex shader, alpha-torn hems), 11 draws. No legs. Groups for body, head, arms and sword. A Ring-reveal shader (setRing).
- **Animation:** Transforms only (wraiths.js:1029-1047). A legless glide with bob and sway at 3.1 rad/s moving, 1.2 idle. sniff lowers the head and reaches the claw; hunt leans in and raises the sword; look turns the hood. Each instance has a seeded phase (wraiths.js:1020).
- **AI:** Bree: watchers.js with far, suspicious and search (lib/ai perception+search). They see the Ring-wearer through walls out to 40 m (story.js:151). Weathertop: a hand-rolled radial state machine (wait, creep, held, back) for the brand fight (weathertop/rules.js:123-203), and a scripted climb before it (weathertop/scene.js:737-749).
- **Problems:**
  - moving is boolean, so the glide sway pops on/off. The bob cadence is the same at patrol 1.25 and chase 4.6 m/s (wraiths.js:1033-1035).
  - Weathertop: struck by the brand they switch to 'back' with moving:true, hunt:1 (weathertop/scene.js:735). No recoil or shriek; they slide backwards facing in.
  - The climb is r = 44 - t*0.45 per gap (weathertop/scene.js:740-745): no AI, no flanking.
  - No strike on catch; a teleport (BreeWorld.jsx:573-581).
  - Bree faces each wraith straight to w.face with no scene smoothing (bree/scene.js:590).
- **Opportunities:**
  - Add a recoil or reel param like Shelob's recoil (cirithungol/props.js:2735) for brand hits, and fire a shriek pose (head back, arms out) on the 'seen' event.
  - lib/ai/squad.js at Weathertop so they circle and dart in one at a time; steer.js for the climb.
  - Drive the bob cadence from speed.

### Shelob (Cirith Ungol tunnels and pass duel) (boss)

- **Files:** src/components/middleearth/towns/cirithungol/props.js:2550-2800, src/components/middleearth/towns/cirithungol/scene.js:614-625,636-643, src/components/middleearth/towns/cirithungol/rules.js:105, src/components/middleearth/towns/cirithungol/CirithUngolWorld.jsx:549
- **Model:** Procedural, skinned on one skeleton (3 meshes). 8 legs placed by foot IK (reach).
- **Animation:** Gait phase accumulated (phase += dt*(0.8+0.9w)), legs in two sets of four, 60% stance / 40% swing, IK feet. Blended params: rear, strike, hurt, recoil. Idle foot tap. Roughly speed-matched: stance foot speed is about 3.1 m/s at w=1 against chase 3.4, and 1.5 at w=0.6 against patrol 1.4.
- **AI:** Tunnels: watchers.js with far and search (SHELOB rules.js:105), turning toward w.face + w.look. Duel: scripted phases stalk, rear, tell, strike, recover with wounds.
- **Problems:**
  - 'back' sends recoil:1 the whole way home (cirithungol/scene.js:642), so she walks back to her round in a reared recoil pose.
  - In the duel her position is sin(t) wobble (scene.js:617), not real movement, so feet and body disagree.
  - The tunnel phial never makes her flinch (hurt:0, scene.js:642). Wounds only count in the duel.
  - walking is 0.6 or 1 picked from mode, not from her actual speed.
- **Opportunities:**
  - Feed actual speed into walking. Phial charge drives hurt and recoil. 'seen' triggers a rear one-shot.
  - Promote this phase plus IK gait as the Middle-earth pattern for multi-legged and heavy creatures.

### Gollum (Marshes guide, Cirith Ungol stair, Rush thief; Doom copy; Lorien placeholder; map toy) (npc)

- **Files:** src/components/middleearth/towns/marshes/props.js:837-1160,2221 (gollum, createGollum), src/components/middleearth/towns/doom/props.js:3300-3600 (duplicate gollum with 'fall'), src/components/middleearth/towns/marshes/scene.js:565-615, src/components/middleearth/towns/cirithungol/scene.js:330,463,537,559, src/components/middleearth/rush/scene.js:207-243, src/components/middleearth/towns/lorien/scene.js:562-571,740-742, src/components/middleearth/mapFigures.js:172-207 (makeGollum toy)
- **Model:** Procedural boned rig: bone() groups for hips, spine, neck, head, thighs/shins/feet, arms/fore/hands. Two-bone IK (reach2) to foot and hand targets. In Lorien he is a capsule and a sphere on a log.
- **Animation:** target() tables for named poses (crouch, crawl, climb, cower, reach; Doom adds fall). Exponential blending between them (k = 1-exp(-9dt)), IK limbs, blinks, look yaw. Crawl cadence is t*8.5 with stride scaled by speed.
- **AI:** Scripted per beat: Marshes creep, lead and climb; Cirith Ungol stair. The Rush thief creeps, then shoos or runs off along x (rush/scene.js:219-243). No lib/ai.
- **Problems:**
  - Two full copies of the builder (marshes/props.js:837, doom/props.js:3300) besides the map toy.
  - In Lorien he is a static capsule and sphere (lorien/scene.js:563-571) though createGollum exists.
  - The Rush thief runs off at 4.5-5.5 units/s on crawl speed 1 and snaps facing (rush/scene.js:236-242), so he skates.
  - Crawl phase is absolute t (marshes/props.js:1065), not distance, so it slides when his speed differs.
- **Opportunities:**
  - Merge into one module and use createGollum in Lorien.
  - Accumulate crawl phase by distance.
  - Marshes guide on lib/ai/steer.js (stay ahead, wait, look back) plus perception (cower from scouts).
  - His pose-table plus IK blend is a pattern worth promoting for the toy figures.

### Shire animals and the Black Rider (Maggot's dogs, sheep, Rider, Bill the pony) (creature)

- **Files:** src/components/middleearth/shire/rules.js:446,462-591 (HUNT, DOG_ROUNDS, stepHunt), src/components/middleearth/shire/scene.js:584-602 (dogs), 636-657 (sheep), 662-681 (rider), src/components/middleearth/shire/props.js:2459,2509,2566 (sheep, dog, blackRider), src/components/middleearth/shire/ShireWorld.jsx:463, src/components/middleearth/towns/bree/scene.js:569-579 (Bill)
- **Model:** Procedural props-kit creatures (Groups with legs, head, tail; rider and horse).
- **Animation:** Dogs: legs sin(t*10) on patrol, sin(t*18) on chase, tail wag, a hop on 'seen'. Sheep: legs sin(t*9)*0.4, graze head-dip. Rider's horse: legs sin(t*9); the rider leans and sniffs. Bill: legs forced to 0 every frame, neck sway only.
- **AI:** Dogs: stepHunt is a hand copy of the old watchers loop, with no lib/ai. HUNT sets far:1.2 and search:6 (rules.js:446) but nothing reads them, though HANDOFF-runtime.md:11 lists HUNT as tuned. Sheep: a Math.random random-walk inside the renderer (scene.js:638-653). Rider: fixed path riderAt(r.s) with phases coming, sniff, leaving.
- **Problems:**
  - The dogs' detection timer, suspicion and shared search are dead config: stepHunt ignores far and search.
  - Dog cadence is fixed against patrol 1.7 and chase 5.2 m/s. Sheep step at 0.7 m/s on a fixed leg rate.
  - Sheep behaviour runs on Math.random in render code, outside rules, so it is not deterministic or testable.
  - The Rider's horse ignores path speed. Bill never walks: legs are zeroed and he teleports from stable to gate (bree/scene.js:571-578).
- **Opportunities:**
  - Replace stepHunt with stepWatchers(newWatchers(DOG_ROUNDS), h, dt, HUNT, { push: field clamp }) so far and search work as the docs claim.
  - Sheep flocking and flight from the player and dogs via lib/ai/steer.js.
  - The Rider sniffing the hollow through lib/ai/perception (smell) and search.
  - Rider's horse and Bill on gallop() (weathertop/props.js:2087).

### Scripted extras and crowds (Edoras henchmen brawl, Moria goblins, Minas Tirith road folk, Amon Hen decoys, Cirith Ungol brawl orcs, Doom slaver, orc and Easterling columns, Edoras host, Gorgoroth orc patrols) (crowd)

- **Files:** src/components/middleearth/towns/edoras/rules.js:24-100, src/components/middleearth/towns/edoras/scene.js:289-294,470-478, src/components/middleearth/towns/edoras/folk.js:963-1000,1463-1500 (host shader, knock), src/components/middleearth/towns/moria/props.js:3394-3417, src/components/middleearth/towns/moria/scene.js:673-682, src/components/middleearth/towns/minastirith/scene.js:566-574, src/components/middleearth/towns/amonhen/scene.js:481-497,546-551, src/components/middleearth/towns/cirithungol/scene.js:680, src/components/middleearth/towns/doom/props.js:1983,2160,2301-2328, src/components/middleearth/towns/doom/scene.js:417-440, src/components/middleearth/towns/marshes/scene.js:697-708, src/components/middleearth/Gorgoroth3D.js:534-549, src/components/middleearth/kit.js:771-798 (makeOrc)
- **Model:** Mixed: toy figures (henchmen, road folk, decoys), goblin rigs, a second orcRig in doom/props.js:1983, kit.makeOrc capsules, and instanced single geometries for the columns and the host.
- **Animation:** Henchmen: pose(moving, speed 1.1), then knock() lays them on their back with blob correction (folk.js:1463-1500). Goblins: run cycle t*10. Columns: one frozen mid-stride orc geometry instanced, plus an abs(sin) bob (doom/props.js:2316-2328, marshes/scene.js:707). Edoras host: a vertex-shader gallop with per-rider offsets (folk.js:985-995). Gorgoroth orcs: legs sin(t*7).
- **AI:** None. Henchmen walk a straight line to Gandalf at 1.6 m/s (edoras/rules.js:53-70). Goblins orbit the chamber on a circle (moria/scene.js:676-680). Decoys lerp k = t/7. Columns follow the road parameter. Gorgoroth patrols are x -= speed*dt (walk.js:66-67).
- **Problems:**
  - Moria goblins, said to be 'fighting along the walls', play the run cycle while orbiting at about 0.5 m/s (moria/scene.js:676-681). They moonwalk and never fight.
  - Columns are one pose for every soldier, sliding with a bob (doom/props.js:2320). Gorgoroth orcs step at t*7 regardless of patrol speed (Gorgoroth3D.js:542).
  - Henchmen's walk cycle is speed 1.1 against a 1.6 m/s ground speed for tall men. No hit flinch before knock().
  - Minas Tirith road folk 'scatter' by spinning the whole group in place with legs going (minastirith/scene.js:572-573). Amon Hen decoys wave their arms while lerping (amonhen/scene.js:495).
  - Cirith Ungol brawl orcs loop the same hack cycle on a timer and never react to each other (cirithungol/scene.js:680).
  - Orc rig and pose are duplicated between cirithungol/props.js:1569/1683 and doom/props.js:1983/2160.
- **Opportunities:**
  - Per-instance phase for the columns, in the vertex shader as the Edoras host does.
  - Goblins on lib/ai/squad.js attacking the company. Road folk fleeing with steer.js.
  - A hit pose before knock(), and the brawl orcs trading blows with hurt/fall from rig.js POSES once a bone map exists.
  - One shared orc rig module.

### Balrogs (Bridge of Khazad-dum duel; Moria flight chase) (boss)

- **Files:** src/components/middleearth/kit.js:521-735 (makeBalrog, animate 703-731), src/components/middleearth/Bridge3D.js:223,420-431, src/components/middleearth/duel.js:9-60, src/components/middleearth/towns/moria/props.js:4131-4160 (second Balrog), src/components/middleearth/towns/moria/scene.js:686-695, src/components/middleearth/towns/moria/rules.js:141,189
- **Model:** Two separate procedural Balrog builders: kit.js and moria/props.js.
- **Animation:** Bridge: stride = bx*1.25, a gait driven by distance with no sliding. Footfall events come from stride phase: shake and embers (Bridge3D.js:420-431). raise, lash and roar params. Moria: legs on ph = t*1.9, with stride as an amount 0.3 or 1 (moria/props.js:4137).
- **AI:** Bridge: the duel.js timeline (randomised lash gaps, crossing time shrinking each round). Moria: f.behind closes at FLY.balrog 5.4 against the player's speed (moria/rules.js:189).
- **Problems:**
  - The Moria Balrog keeps a fixed cadence while its position tracks the variable chase gap (moria/scene.js:690-695), so it slides.
  - Two builders for one creature.
- **Opportunities:**
  - Use Bridge3D's distance-driven stride in Moria, and make that pattern the shared one for every biped here.

### Saruman in the Orthanc duel (boss)

- **Files:** src/components/middleearth/towns/orthanc/scene.js:525-560,588-592
- **Model:** Toy figure (makePerson / LOOKS), white robe and staff orb.
- **Animation:** pose(), then direct arm and body rotations: tell raises the arm, cast swings it forward, open reels with body.rotation.z. Pushback lerps A.sx. Gandalf is hit with body.rotation.z, and a staff block is an arm rotation.
- **AI:** Scripted duel phases (idle, tell, cast, open, recover); the player blocks and pushes.
- **Problems:**
  - In idle he gets moving: true at speed 0.4 while standing still (orthanc/scene.js:543). The robe hides the legs, so the arms swing as if walking in place.
  - Pushback is a lerped slide with no stagger or step-back. Hit and block are single-axis rotations.
- **Opportunities:**
  - rig.js POSES windup, punch, guard, hurt and fall (or Meshy clips hit, fall, taunt) for tell, cast, block and reel, with a step-back stagger.

### Mounts and flyers (Asfaloth / Shadowfax / Snowmane / Rohan horses, fell beasts, eagles, moth, Watcher tentacles) (creature)

- **Files:** src/components/middleearth/towns/weathertop/props.js:2087-2140 (gallop), src/components/middleearth/towns/weathertop/scene.js:783-794, src/components/middleearth/towns/edoras/scene.js:408-416, src/components/middleearth/towns/minastirith/scene.js:577-586, src/components/middleearth/towns/marshes/props.js:1561,1695 (fellBeast), src/components/middleearth/towns/cirithungol/props.js:1352,1515 (witchKing), src/components/middleearth/towns/doom/props.js:2959,3136 (eagle), src/components/middleearth/towns/orthanc/props.js:1061,1090 (moth), src/components/middleearth/towns/moria/props.js:1540-1610 (tentacles)
- **Model:** Procedural. Horses are Asfaloth's rig re-coated (edoras/folk.js:15). Tentacles are skinned on a procedural bone chain.
- **Animation:** gallop(): accumulated phase with speed-dependent cadence (1.5 + 0.75v Hz, capped at 2.8), stance/swing split, knee bend, eased blend k. Flyers use flap, glide and reach params. Tentacles use rise and slam.
- **AI:** None. They ride the path, are steered by the player, or follow scripted flight paths.
- **Problems:**
  - gallop stride amplitude is constant and cadence is capped at 2.8 Hz, so hooves slide at high r.v.
  - The Shire Rider's horse (shire/scene.js:671) and the Bree Nazgul horses (bree/scene.js:601-605) do not use gallop().
- **Opportunities:**
  - Scale stride with v. Use gallop() for every horse in Middle-earth.
  - gallop() is the second pattern worth promoting for bipeds.

### Gorgoroth hobbits (Frodo and Sam on the plain walk) (player)

- **Files:** src/components/middleearth/kit.js:738-768 (makeHobbit), src/components/middleearth/Gorgoroth3D.js:389-390,506-528, src/components/middleearth/walk.js:25-87
- **Model:** A legless lathe cone under a cloak, a sphere head and a hood; Sam has a box pack.
- **Animation:** Bob abs(sin(9t))*0.05, body lean by burden. Crouch squashes group.scale.y to 0.64 (Gorgoroth3D.js:509,523). Carry sets Frodo's rotation.z to -0.75 on Sam's back.
- **AI:** n/a: hold to walk (walk.js).
- **Problems:**
  - No legs: two cones sliding.
  - Crouch is a non-uniform scale squash that distorts the mesh.
  - The carry is a rigid tilt.
- **Opportunities:**
  - Use the toy figures with a distance gait, or Meshy Frodo and Sam with a walk blend.
  - A crouch pose under the cloaks. scared or fall clips on 'seen' and 'ring'.

### Map hub diorama figures (Frodo, Sam, the CAST incl. toy Gollum and Treebeard) (npc)

- **Files:** src/components/middleearth/mapDiorama.js:487-501,543,604-682, src/components/middleearth/mapFigures.js:172-270, src/components/middleearth/mapCast.js:5-93
- **Model:** Toy figures scaled 1.8-1.9. makeGollum and makeTreebeard are toys of their own.
- **Animation:** pose() with a moving flag and speed 1 or 1.3. Wave and talk decay after a greeting. Treebeard runs at 0.4 rate via f.slow; Gollum crouch-sways.
- **AI:** Frodo follows a click path or the stick. Sam follows at a 1.5 gap. The cast turn to Frodo within 5 m and greet with wave + talk + a line when d < 2.8, re-arming at d > 4.5 (mapDiorama.js:667-682). This is the only greet-on-approach in Middle-earth.
- **Problems:**
  - Frodo and Sam snap their facing (mapDiorama.js:640,657).
  - H.speed 8 (7 by stick) against about 3.6 units/s of foot travel at scale 1.9, so they skate.
- **Opportunities:**
  - Distance-driven phase with turn easing.
  - Reuse this greet latch in the towns.

### Online ghosts (other travellers, towns/ghosts.js) (other)

- **Files:** src/components/middleearth/towns/ghosts.js:68-160, src/components/middleearth/towns/travellers.js:249-278
- **Model:** The world's figure (makePerson('frodo') by default; Gimli, Pippin or Gandalf per town) with a translucent ghost material.
- **Animation:** animate(g.f, t + g.x, p, dt), defaulting to pose(f, t, { moving: p.moving }). Position and face are exponentially smoothed.
- **AI:** n/a: network poses (moving is a 1-bit flag, set when speed > 0.4).
- **Problems:**
  - Bug: the phase passed is t + g.x, and g.x changes as the ghost walks (ghosts.js:150). The leg rate becomes 13*(1 + vx). Walking +x at 3.4 m/s swings the legs about 4.4x too fast; walking -x runs them backwards. createGhosts is shared by 9 other worlds (albuquerque, avengers, caribbean, dotmatrix, invincible, music, office, rickmorty citadel and world).
  - No speed is sent unless `motion` is set, so even the fixed fix cannot match feet to speed.
- **Opportunities:**
  - Use a fixed per-ghost phase offset (hash of id) and accumulate gait phase from the interpolated distance, sending speed where available.

### Rush hobbits (co-op kitchen players) (player)

- **Files:** src/components/middleearth/rush/scene.js:443-461, src/components/middleearth/rush/cast.js:1-5
- **Model:** Toy figures (makePerson).
- **Animation:** pose(moving, speed 1.1). Carrying holds both arms forward at -1.25. Working chops one arm at sin(22t).
- **AI:** n/a (players; rules.js).
- **Problems:**
  - Face snaps to p.face (rush/scene.js:449).
  - Fixed cadence with no speed matching. The carry and work poses are single-axis arm rotations.
- **Opportunities:**
  - With clips: cheer on an order served, scared on a fire, drink or punch as work gestures.

**Notes:** Middle-earth uses none of the shared character library. Grep finds no meshyCast, clips.js, rig.js, AnimationMixer or GLTF character in src/components/middleearth, and public/games/meshy has no LOTR characters. Every figure is procedural. The lib/ai toolkit appears in exactly one file, towns/watchers.js (perception + search). utility, tree, steer, spatial, influence and squad are unused here.

Almost every humanoid (player, cast, followers, Boromir, Saruman, ghosts, Rush, map) goes through one function, mapFigures.js:251 pose(). Fixing it once (accumulated, distance-driven phase; 0..1 move blend; per-figure phase and frequency seed; head look-at; no forced arms[1].rotation.x reset) lifts the whole world.

Better local patterns worth promoting to shared:
- Bridge3D.js:420-431: stride derived from distance travelled, with footfall events.
- weathertop/props.js:2087-2126 gallop(): accumulated phase, speed-dependent cadence, stance/swing split.
- marshes/props.js:1063-1160 Gollum: named pose tables, exponential pose blending, two-bone IK.
- cirithungol/props.js:2735-2800 Shelob: accumulated phase with IK feet, close to speed-matched.

Duplication:
- turnTo copied in 7 town scenes (amonhen:381, cirithungol:378, lorien:658, marshes:394, moria:496, orthanc:400, rivendell:418), in watchers.js:35 and in shire/rules.js.
- shire/rules.js:500-591 stepHunt is a hand copy of the old watchers loop. HUNT.far and HUNT.search are dead config, contradicting HANDOFF-runtime.md:11.
- towns/walker.js copies the Shire's HOBBIT walker.
- 2 Gollum builders (marshes/props.js:837, doom/props.js:3300), plus a toy one and a Lorien capsule.
- 2 orc rig/pose pairs (cirithungol/props.js:1569/1683, doom/props.js:1983/2160), plus kit.makeOrc, the Moria goblin, the Amon Hen Uruk and the Marshes eastRig.
- 2 Balrogs (kit.js:521, moria/props.js).
- 2 figure packers (edoras/folk.js:61, minastirith/folk.js).

Cross-world bug: towns/ghosts.js:150 passes t + g.x as the gait phase, so a remote traveller's legs run too fast or backwards depending on direction. It affects every world using createGhosts.

The only skinned skeleton that could take rig.js POSES through figure(..., { bones }) is orcRig (THREE.Bone; legL/shinL/foreL…).

To truly 'follow the library', generate Meshy LOTR figures (Frodo, Sam, Gandalf, Aragorn, Legolas, Gimli, Pippin, Merry, Strider, orc, Uruk, Easterling) with idle/walk/run via scripts/meshy.mjs, then drive them with createMeshyCast and the 13 SHARED_CLIPS. Until then the clips cannot be applied: no figure here has the 24-bone Meshy skeleton.

Tests cover NPC rules (watchers, walker, the Shire hunt, Edoras brawl, Minas Tirith sneak, Lorien lead, Rivendell follow, Weathertop brand), but nothing tests pose(), gait or speed matching, wraiths animate, or ghosts.

## Remaining worlds: Scranton (office), Albuquerque (street, Casa Tranquila, Metherria), Cockpit overlay (Falcon, X-wing, cruiser, RV), Caribbean, Dot Matrix, Minecraft, Death Star, plus Music, Travel and Dickansh, which have no characters

Routes: /scranton (office/world/OfficeWorld, OfficeFloor->Tour3D, PaperToss->Toss3D), /albuquerque (albuquerque/world/AbqWorld; lazy Metherria and CasaTranquila from AbqWorld.jsx:34-35), global Cockpit overlay (App.jsx:135, :208), launched on travel: falcon/xwing/cruiser/rv, /caribbean (caribbean/tide), /dot-matrix (dotmatrix), /dot-matrix/minecraft (minecraft), /deathstar (deathstar trench run), /music, /travel, /dickansh: no characters

### Scranton coworkers (OfficeWorld: seated, amblers, fire drill, Erin's break, Dwight's return) (npc)

- **Files:** src/components/office/people.js:134, src/components/office/people.js:204-211, src/components/office/people.js:277-279, src/components/office/people.js:304, src/components/office/people.js:357-371, src/components/office/people.js:411-436, src/components/office/world/scene.js:205-226, src/components/office/world/scene.js:281-288, src/components/office/world/scene.js:312-341, src/components/office/world/scene.js:393-487, src/components/office/world/layout.js:324-331, src/components/office/world/paths.js:155-167, src/components/office/world/OfficeWorld.jsx:588-598, src/components/office/world/OfficeWorld.jsx:746-768
- **Model:** Meshy GLBs public/models/office/cast/<id>.glb on the 24-bone Meshy skeleton. Its bone names match the public/games/meshy clips exactly (Hips, Spine02/Spine01/Spine, neck, Head, L/R Shoulder/Arm/ForeArm/Hand/UpLeg/Leg/Foot/ToeBase). No clips ship, and people.test.js:63 asserts none do.
- **Animation:** Fully procedural, with no AnimationMixer. Each frame people.js resets every bone to a pose built from the bind pose (:277-279), then applies its own IK (turn/aim/reach, :68-112). Poses: sitting leaned in to the desk; typing wrist flicks; head look-round; an on-the-spot stride (thigh ±0.4 rad sine, knee, contralateral arm, |sin| bob); gestures nod/shake/shrug/fold/cheer/wave built from IK.
- **AI:** No lib/ai. Amblers run on a fixed timetable (AMBLES every/offset/wait, layout.js:324-331): sit, walk an A* path computed once (paths.js), wait, walk back. The fire drill ping-pongs between PANIC pairs with a sine jitter (scene.js:413-431). Erin and Dwight follow story flags. Seated people look at Jim within 3.2 m and wave the first time he talks to them (scene.js:483-485, OfficeWorld.jsx:765). Amblers look at Jim within 2.6 m (scene.js:462).
- **Problems:**
  - Feet slide. Stride phase is 7.2 rad/s × rate (people.js:364) and is never derived from ground speed or leg length. Amblers move at 1.05 m/s (scene.js:281) but stride at rate 0.8 (scene.js:461), about 1.36 m/s of foot travel (moonwalk). Fire-drill runners move at 2.6-3.6 m/s, all at rate 1.6 (scene.js:423-428).
  - There is no run gait: running is the walk played faster (people.js:357-371), with no lean or flight phase.
  - Heading snaps. along() returns the current segment's heading (scene.js:336), so turns at path corners are instant. At the end of an amble they snap to a.face (scene.js:452-455) and snap again on the way back. Fire-drill runners flip 180° at each end (scene.js:424-426), and their position wobbles ±0.25 m sideways while the body faces the segment.
  - Sitting and standing swap with a pop: the seated copy hides and a standing copy appears 0.25 m behind the chair (scene.js:437-447, paths.js:162). There is no stand-up or sit-down motion.
  - Seated non-typists (Michael, Pam, Kevin, Stanley, Phyllis, Creed, Meredith, Darryl) don't breathe. Breathing needs `idle && pose !== 'sit'` (people.js:414), so they are frozen torsos with a turning head.
  - Fire-drill runners created in the same frame all start at walk.t = 0 (people.js:304) with rate 1.6, so they stride in lockstep.
  - Talking has no body language. The speech bubble opens (OfficeWorld.jsx:754-765), but only cheer and wave are ever called (scene.js:429, :485); nod/shake/shrug/fold (people.js:53) go unused here.
  - Amblers never stop or yield: Jim is pushed out of them (OfficeWorld.jsx:588-598), and they keep walking while their line is shown.
  - Standing arms are IK'd straight down at 0.96 of their reach (people.js:207-210). There is no weight shift or arm sway at idle.
- **Opportunities:**
  - Same rig as the library, so give the standing copies borrowClips() idle/walk/run (rickmorty/portal/clips.js:24) through retarget(clip, hipsY). Blend them with meshyCast's move weights, using pace = ground speed ÷ the clip's stride speed. Keep people.js look/reach/gestures as a pass after the mixer instead of the reset() at people.js:279. Ship the clips as separate files so people.test.js:63 still passes.
  - For seated breathing, retarget the cockpit's Chair_Sit_Idle_M (public/models/cockpit/*-sit.glb) or SHARED_CLIPS 'sitcross', and keep the procedural typing hands on top.
  - SHARED_CLIPS in context: 'wave' when Jim first approaches (instead of the IK wave), 'scared'/'cheer' in the fire drill, 'drink' during an amble's wait at the kitchen, 'happy' on a finished quest, 'hit' when the basketball or paper plane lands on someone.
  - Replace the AMBLES timetable with lib/ai/utility.js needs (coffee, printer, chat with a neighbour, bathroom), spatial.js to pick free spots, and steer.js to yield to Jim and to each other. Add a tree.js talk branch: notice Jim, stop, turn the body, play a talk gesture, resume.
  - Turn with an exponential yaw approach (as walker.js turn:10 does) and ease speed in and out at path ends.

### Jim, the player on foot in OfficeWorld (and other online players shown as ghost Jims) (player)

- **Files:** src/components/office/world/scene.js:233-240, src/components/office/world/scene.js:263-275, src/components/office/world/scene.js:351-376, src/components/office/world/layout.js:334, src/components/office/world/OfficeWorld.jsx:586, src/components/office/world/OfficeWorld.jsx:602-608, src/components/middleearth/towns/walker.js:108-120
- **Model:** jim.glb, the office's Meshy figure on the 24-bone rig, with no clips
- **Animation:** people.js procedural stride at rate max(0.6, speed/2.3), or 1.45 when running (scene.js:353), plus bob(). Both hands are IK'd onto the carried Jell-O or chili pot (scene.js:366-373). Idle head look-round.
- **AI:** n/a. walker.step input; heading eased by JIM.turn 10.
- **Problems:**
  - Feet slide. Walking at 2.3 m/s with rate 1 gives about 1.7 m/s of foot travel. Running at 4.4 m/s with rate 1.45 gives about 2.5 m/s (roughly 45% slide). See scene.js:353 and people.js:364.
  - A walk of 2.3 m/s (layout.js:334) is jogging speed for a walk cycle.
  - There are no run, start, stop, pivot or jump animations; running is the walk played faster.
  - Footstep sounds come from a distance counter (stride 0.72/0.95, OfficeWorld.jsx:602-608), not from the leg phase, so they drift out of sync.
  - Ghost Jims use the same unmatched stride, with rate taken from their reported speed (scene.js:270-274).
  - Carrying the chili only moves the hands; the body never leans or braces when it sloshes (scene.js:361-373).
- **Opportunities:**
  - Use borrowClips idle/walk/run with stride-matched pace, and fire the footsteps from the clip's foot contacts.
  - SHARED_CLIPS 'cheer' or 'happy' when a quest finishes and at the Dundies, and 'scared' during the fire drill.
  - Ghost Jims get the same mixer blend from p.speed.

### Scranton desk cast in the page panels (Tour3D on OfficeFloor, Toss3D in PaperToss) (npc)

- **Files:** src/components/office/Tour3D.js:60-67, src/components/office/Tour3D.js:78, src/components/office/Tour3D.js:550-561, src/components/office/Tour3D.js:620-625, src/components/office/Toss3D.js:30-40, src/components/office/Toss3D.js:494-515
- **Model:** Office Meshy figures, through office/people.js
- **Animation:** Procedural sitting, typing and idle head. Tour: the selected person looks at the camera and waves (an IK wave). Toss: everyone watches the flying ball, Dwight glares on a miss, and Kevin, Michael and Andy cheer on a make.
- **AI:** None. The reactions are scripted.
- **Problems:**
  - Only the head and arms react; bodies never turn.
  - Seated non-typists have no breathing (people.js:414).
  - A miss gets no reaction except Dwight's look (Toss3D.js:500).
- **Opportunities:**
  - SHARED_CLIPS 'cheer'/'happy' on a swish, 'taunt' for Dwight after a miss, 'scared' or 'hit' when the ball lands near someone.
  - Retarget a seated idle clip so they breathe.

### Albuquerque street cast (Jesse, Saul, Gus, Mike, Badger, Pete, Tuco in AbqWorld) (npc)

- **Files:** src/components/albuquerque/world/scene.js:794-831, src/components/albuquerque/world/scene.js:1061, src/components/albuquerque/wardrobe.js:14-32, src/components/office/people.js:134
- **Model:** Meshy GLBs /models/albuquerque/<id>.glb on the same 24-bone Meshy rig, with no clips (wardrobe.test.js:52)
- **Animation:** people.js 'stand' pose with idle: head look-round and chest breathing. Nothing else.
- **AI:** None. Each stands at a fixed spot and yaw (WHERE, scene.js:806-814).
- **Problems:**
  - They are statues. world/scene.js never calls look() or gesture() on them; they never turn to the player's car or react to a crash, a stop, or Hank's heat.
  - Not loaded on mobile or when bloom is off (scene.js:803), so phones get empty streets.
  - update() runs on all of them every frame (scene.js:1061) with frustumCulled false and cull not passed (scene.js:821).
  - Their arms are IK'd stiffly at their sides (people.js:207-210).
  - No pedestrians: the sidewalks are empty apart from these seven.
- **Opportunities:**
  - A retargeted idle clip for each figure (same rig), with people.js look() aimed at the car when state.near matches their place or the car is within ~15 m.
  - Context clips: Saul 'wave' when you pull up at his door, Gus a polite 'wave', Tuco 'taunt', Badger and Pete 'dance'/'drink', 'scared' when the car heads at someone, 'hit'/'fall' if it clips them.
  - Sidewalk pedestrians from meshyCast figures, with lib/ai spatial.js to pick destinations and steer.js to walk round each other.
  - Cull by distance.

### Casa Tranquila (Hector, the nurse, Gus) (npc)

- **Files:** src/components/albuquerque/casa/scene.js:339-345, src/components/albuquerque/casa/scene.js:405-432, src/components/albuquerque/casa/scene.js:445-449, src/components/albuquerque/casa/scene.js:527-580
- **Model:** Meshy ABQ figures (hector, nurse, gus) through office/people.js
- **Animation:** Hector: wheelchair pose; reaches for the bell; 'shake' on a miss; looks at the board, at you, or at Gus. Nurse: standing; both hands IK'd to the board; looks at the board or at Hector. Gus: stroll() in and out, a tie-straighten reach, a look.
- **AI:** Scripted by game phase (rows/letters/gus/bell/boom/after).
- **Problems:**
  - stroll() moves them linearly with no easing and a fixed stride rate of 1 (scene.js:424-432). The nurse covers ~1.1 m/s and Gus ~1.0-1.16 m/s against ~1.4 m/s of foot travel, so they slide.
  - Yaw snaps at the start of a stroll (yawTo, scene.js:429).
  - Hector and his chair simply disappear at the blast (scene.js:448-449), with no reaction.
  - Gus is made with pose 'stand' but without idle (scene.js:345), so he has no breathing or look-round. He doesn't flinch at the blast; his look is cleared (scene.js:573).
- **Opportunities:**
  - A walk clip with matched pace for both strolls.
  - An idle clip for Gus.
  - Nurse 'scared' when the bell rings.
  - A blast reaction: 'hit'/'fall' clips, or lib/three/ragdoll.js.

### Metherria customers and Jesse (npc)

- **Files:** src/components/albuquerque/metherria/scene.js:733-770, src/components/albuquerque/metherria/scene.js:1000-1038, src/components/albuquerque/metherria/scene.js:1064-1076, src/components/albuquerque/wardrobe.js:48-50
- **Model:** Meshy ABQ figures through office/people.js. 2D cut-outs until they load.
- **Animation:** Standing with idle. The customer at the front looks at the camera and plays one mood gesture when the mood changes (cheer/nod/shrug/shake/fold). Jesse looks at Walt and gestures at each reaction.
- **AI:** Queue order comes from the game's live.lobby; there is no movement logic.
- **Problems:**
  - The queue teleports: figures pop into their slots and jump forward as the line advances (scene.js:1024-1025). Nobody walks up or leaves.
  - Queue facing is set directly, never turned toward (scene.js:1025).
  - Jesse is pinned at (-2.9, 0, 0.5) with yaw -0.5 (scene.js:1067-1068) and never moves.
  - Figures are only updated while the camera is at the hatch (scene.js:1035).
- **Opportunities:**
  - Walk in and out with a walk clip at matched pace, turning smoothly.
  - SHARED_CLIPS by mood: 'happy'/'cheer' for great, 'taunt' for bad, a looping 'fold' fidget when restless.
  - Jesse 'cheer' or 'dance' after a perfect batch.

### Walt in Metherria (the player's body) (player)

- **Files:** src/components/albuquerque/metherria/scene.js:741-760, src/components/albuquerque/metherria/scene.js:772-774, src/components/albuquerque/metherria/scene.js:1043-1063
- **Model:** ABQ walt.glb through office/people.js
- **Animation:** 'stand' with no idle. At the bench his body is glued under the camera with the head scaled to 1e-3, and his right hand reaches for the drum spout, gauge, hammer or pack. At the hatch he lerps between stations.
- **AI:** n/a
- **Problems:**
  - He slides between stations with no walk() call (scene.js:1050).
  - His rotation is fixed at π (scene.js:746).
  - Breaking the slab is only a hand reach to the hammer, with no swing.
  - No idle (scene.js:741).
- **Opportunities:**
  - A walk clip while waltAt moves.
  - The 'punch' clip as the hammer swing.
  - 'cheer'/'happy' on a great order.

### Cockpit crew: Chewie (Falcon), Jesse and Walt (RV) (companion)

- **Files:** src/components/cockpit/crew.js:35-125, src/components/cockpit/crew.js:170-177, src/components/cockpit/vehicles/falcon.js:482-493, src/components/cockpit/vehicles/falcon.js:596-600, src/components/cockpit/vehicles/rv.js:112-156, src/components/cockpit/vehicles/rv.js:1755-1764, src/components/cockpit/vehicles/rv.js:2397-2415, src/components/cockpit/vehicles/rv.js:2975-2987
- **Model:** Meshy 24-bone figures /models/cockpit/{chewie,jesse,walt}.glb with their own clips: *-sit.glb (Chair_Sit_Idle_M) and walt-idle.glb. Jesse can be the ABQ figure, with the clip retargeted to it (clips.js retarget).
- **Animation:** Chewie loops his own sit clip from a random start (crew.js:88), with the hips locked in x/z and fixed nudges on spine and head. In the RV, calmly() scrubs a slice of the sit or idle clip back and forth on a cosine (rv.js:145-147), with fixed head nudges (rv.js:2402-2405).
- **AI:** None
- **Problems:**
  - The ping-pong scrub plays the clip backwards half the time (rv.js:146).
  - The levers move by themselves (falcon.js:597-600), though crew.js:6-7 says a pose can reach an arm for a lever. Chewie's roar has no animation.
  - The RV crew ignore the acceleration that swings the air freshener (rv.js:2975-2984) and don't react when the wings swing out or the RV lifts off.
  - Jesse's head is a fixed 0.45 rad nudge toward the driver (rv.js:2403), not a look-at; the camera turns to watch the wing and he doesn't follow.
  - Walt stands in a moving RV without bracing or swaying.
- **Opportunities:**
  - SHARED_CLIPS retargeted to the same rig: Chewie 'cheer' as the roar at launch; Jesse 'scared' at liftoff and 'cheer' when the wings open; Walt 'scared'.
  - Reach Chewie's hand to the lever during launch with lib/three/ik.js reach().
  - A lean spring driven by the RV's acceleration (lib/three/ik.js spring) on Spine01.
  - Head look-at the camera.

### Morty in Rick's cruiser (companion)

- **Files:** src/components/cockpit/vehicles/cruiser.js:547-571, src/components/cockpit/vehicles/cruiser.js:799-819
- **Model:** Meshy morty.glb through createMeshyCast with morty-sit and morty-walk
- **Animation:** The sit clip's weight is forced to 1 (:553). Each frame calls update(t, 0, 0) and then mixer.update(0) (:802-803). The glance is a sine timer, and the panic rotates spine, head and arm bones by hand on top (:806-818).
- **AI:** None
- **Problems:**
  - The walk clip is loaded and never used (cruiser.js:548).
  - The panic is hand-rotated arms while SHARED_CLIPS has 'scared'.
  - The glance runs on a timer and isn't aimed at Rick.
  - The idle/walk/run blend runs with no idle clip present.
- **Opportunities:**
  - play('scared', {hold}) when the portal gun fires and 'cheer' after the green flash.
  - A real look-at Rick's camera.

### Player arms in the cockpits (Rick's arms in the cruiser; nobody in the Falcon, X-wing or RV) (player)

- **Files:** src/components/cockpit/vehicles/cruiser.js:574-620, src/components/cockpit/vehicles/cruiser.js:820-830
- **Model:** Procedural cylinders and a hand mesh
- **Animation:** Local two-bone IK: the left hand on the wheel, the right raising the portal gun with a recoil kick.
- **AI:** n/a
- **Problems:**
  - The local IK duplicates lib/three/ik.js reach() and elbowFor().
  - There are no player hands in the Falcon, X-wing or RV, so nothing touches the yoke, wheel or levers.
- **Opportunities:**
  - Use lib/three/ik.js.
  - Add hands on the Falcon levers and the RV wheel or shifter.

### Captain Jack Sparrow at the Black Pearl's helm (npc)

- **Files:** src/components/caribbean/tide/Tide3D.js:181-209, src/components/caribbean/tide/Tide3D.js:223, src/components/caribbean/tide/Tide3D.js:584
- **Model:** public/games/caribbean/jack.glb: a Meshy 24-bone rig (same bone names as the library) with its own 'Armature|Idle|baselayer' clip
- **Animation:** An AnimationMixer loops clips[0] (the idle) for the whole game. The ship's tilt carries him.
- **AI:** None
- **Problems:**
  - One idle loop for the whole game (Tide3D.js:205).
  - He doesn't turn the wheel with the rudder.
  - He doesn't react to broadsides, hits, the kraken or sinking; he stays standing while she goes down.
- **Opportunities:**
  - SHARED_CLIPS fit his rig unchanged: 'drink' (rum) as an idle fidget, like Rick's flask spec.fidget; 'shoot' on the player's broadside events; 'hit' from hurtPlayer (rules.js:412); 'scared' on the kraken's 'surface' event; 'taunt'/'cheer' when a navy ship sinks; 'fall' at game over.
  - Hands on the wheel by IK, driven by s.rudder.

### Kraken head and tentacles (boss)

- **Files:** src/components/caribbean/tide/Tide3D.js:705-772, src/components/caribbean/tide/rules.js:699-775, src/components/caribbean/tide/rules.js:782-823
- **Model:** Static, unrigged Meshy GLBs (kraken.glb and tentacle.glb have 0 joints)
- **Animation:** Rigid transforms only: rise and sink, a rotation.z tip for the slam, a sine sway, a red emissive flash on hit.
- **AI:** A hand-rolled phase machine: volleys of arms with warning bubbles, then the head rises and spits ink, then it dives. It leads the player's motion and speeds up in a rage below half health.
- **Problems:**
  - A tentacle slam is a stiff pole tipping over (Tide3D.js:735-738); it never curls.
  - The head bobs as one rigid block.
- **Opportunities:**
  - Curl the tentacles with a vertex-shader bend along their height, driven by the existing fall and sway values, or rig them with a bone chain.

### Navy and cursed ships (Caribbean enemies) (enemy)

- **Files:** src/components/caribbean/tide/rules.js:540-622, src/components/caribbean/tide/rules.js:626-670
- **Model:** Meshy ship GLBs with no crew on deck
- **Animation:** Physically driven pitch, roll, heel and broadside kick (Tide3D poseShip)
- **AI:** Hand-rolled. course() is a potential field bending away from islands, the rim and other ships. They switch sides on a 10-20 s timer, run alongside, and fire a broadside once it bears. No lib/ai.
- **Problems:**
  - They always know where the player is (no perception).
  - Ships don't coordinate; they can fire in the same instant.
  - No figures on deck.
- **Opportunities:**
  - lib/ai steer.js for course().
  - squad.js tokens so broadsides rotate between ships.
  - perception.js with the fog zones.
  - Deck crews from meshyCast with 'shoot', 'cheer' and 'fall'.

### Dot Matrix hero (player) (player)

- **Files:** src/components/dotmatrix/scene.js:557-598, src/components/dotmatrix/scene.js:602-610, src/components/dotmatrix/scene.js:614-627, src/components/dotmatrix/scene.js:1302-1324, src/components/dotmatrix/rules.js:387-391, src/components/dotmatrix/rules.js:502-504
- **Model:** A procedural box figure, dithered to four shades; the style is deliberate
- **Animation:** poseWalk limb swing with a body bob. Fixed jump pose with a fist in the air. Head look-round after 2.5 s idle. Flickers when hurt; squashes into pipes.
- **AI:** n/a
- **Problems:**
  - Feet slide. walkPhase advances at (4 + 8·sp) rad/s (scene.js:1305): with a 0.37 m leg at ±0.75 rad that is about 1.9 m/s of foot travel against 4.6 m/s on the ground.
  - The jump pose switches on and off instantly (scene.js:1311-1316), with no anticipation or landing squash.
  - Getting hurt only flickers (scene.js:1322).
- **Opportunities:**
  - Advance the phase by distance (phase += distance / stride), as the Minecraft plan's 0.6662 rule does.
  - Blend into and out of the jump; squash on landing; a knockback pose when hurt.
  - An arm wave when talking to a villager. Keep the box style rather than Meshy figures.

### Dot Matrix villagers (and other online players as box ghosts) (npc)

- **Files:** src/components/dotmatrix/scene.js:1189-1203, src/components/dotmatrix/scene.js:1366-1375, src/components/dotmatrix/rules.js:267, src/components/dotmatrix/rules.js:593-637
- **Model:** Procedural box figures (LOOKS, scene.js:629-634)
- **Animation:** poseWalk at a fixed 8.8 rad/s, with amplitude scaled by speed. At these speeds (0.8-1.0 m/s) that roughly matches. Breathing is offset per villager.
- **AI:** Hand-rolled. Each walks there and back along one straight beat, waiting at the ends. Within TALK_R (1.6 m) they stop and turn to face the hero with eased yaw (rules.js:602-611). This is the only behaviour in scope that notices the player.
- **Problems:**
  - Every villager starts at phase 0 (scene.js:1192).
  - The whole body turns to the hero; the head never looks, and there is no gesture when talking.
  - Each beat is one straight segment.
  - Ghost strides use t·7 whatever their speed (scene.js:1202).
- **Opportunities:**
  - Turn the head group toward the hero and raise armR in a wave on approach.
  - Chores at the dwell points (the fisher casts a line).
  - A lib/ai utility schedule in place of the fixed beat.

### Dot Matrix walkers (stompable enemies), plants, snake and ambient critters (enemy)

- **Files:** src/components/dotmatrix/scene.js:527-553, src/components/dotmatrix/scene.js:733-790, src/components/dotmatrix/scene.js:1414-1432, src/components/dotmatrix/rules.js:245-252, src/components/dotmatrix/rules.js:580-588
- **Model:** Procedural shapes
- **Animation:** Walkers: feet shuffle on sin(t·9) ±0.08 m with a bob, and squash flat when stomped. Plants: rise and sink, leaning at the hero. Snake: a fixed loop. Gulls circle; butterflies follow Lissajous paths.
- **AI:** None. Walkers follow the clock back and forth along a line (walkerAt).
- **Problems:**
  - Walkers flip 180° instantly at the ends of their line (rules.js:587).
  - Walker feet travel about 0.46 m/s while they move at 1.1-1.5 m/s (scene.js:1427-1430).
  - Walkers never notice the hero, unlike mario64's Goombas, which now use GOOMBA_SENSES.
- **Opportunities:**
  - lib/ai perception.js plus a short charge, on the Goomba pattern.
  - Ease the turn at line ends.
  - Drive feet by distance travelled.

### Minecraft player and mobs (mobs not built yet) (player)

- **Files:** src/components/minecraft/rules/player.js:28, src/components/minecraft/pack/aliases.js:91-106, docs/superpowers/plans/2026-10-07-minecraft-world.md:387-402
- **Model:** None. First person, with no arm or held-item model. The mob skins are only aliased.
- **Animation:** None. No view bob and no arm swing; player.js tracks walked and swing, but scene.js never draws them.
- **AI:** None yet. Phase 5 plans mobs on a state enum (idle/wander/look/chase/flee/fuse/attack).
- **Problems:**
  - No mobs at all.
  - No first-person arm (planned in the plan at :401-402).
  - No view bob.
- **Opportunities:**
  - When Phase 5 lands, give hostile mobs lib/ai perception.js and build the planned states on tree.js rather than a bare enum.
  - Keep the plan's distance-driven limb swing (legs ±45° × sin(distance × 0.6662)), which cannot slide.

### Death Star TIE fighters and Vader (enemy)

- **Files:** src/components/deathstar/trench.js:398-425, src/components/deathstar/trench.js:532-560, src/components/deathstar/Trench3D.js:160-173, src/components/deathstar/Trench3D.js:781-790
- **Model:** Procedural TIE geometry. Vader has no model.
- **Animation:** Rigid: a sine weave in x and a roll of cos(phase) × 0.35
- **AI:** A fixed sine weave with jittered fire timers. Vader is bolts spawned behind the player at a jittered position (trench.js:540-545).
- **Problems:**
  - TIEs ignore the player's position and shots.
  - Vader is never seen.
- **Opportunities:**
  - lib/ai squad.js tokens for TIE fire and perception.js for leading shots.
  - A visible Vader TIE on your tail.

**Notes:** Two separate character systems: office/people.js and createMeshyCast. Nothing else in this scope uses the shared library.
- No file in scope imports src/lib/ai or src/lib/three/rig.js. createMeshyCast appears only in cockpit/vehicles/cruiser.js:547 (Morty). crew.js and rv.js only borrow clips.js retarget().
- office/people.js is a parallel procedural system with no mixer. It drives 17 office figures and 14 Albuquerque figures, used in OfficeWorld, Tour3D, Toss3D, AbqWorld, Casa Tranquila and Metherria.
- Every one of those figures is on the identical 24-bone Meshy skeleton. I checked the joint lists in jim.glb, walt.glb, cockpit jesse.glb, caribbean jack.glb and chewie.glb against the channel targets in rick-walk.glb, clips-wave.glb and walt-idle.glb, and they match. So borrowClips() and SHARED_CLIPS work on them through retarget(clip, hipsY) with no extra mapping.
- Integrating means layering, not replacing. people.js:277-279 resets every bone to a rest pose built from the bind pose each frame. Run the mixer first, then apply look/reach/typing as a pass after it. Clips must stay in separate files, because people.test.js:63 and wardrobe.test.js:52 assert that the figure GLBs ship no animations.

Duplicated code worth consolidating:
- people.js:68-112 has its own turn/aim/reach/setWorldQuat IK. It duplicates lib/three/ik.js rotateWorld/aimBone/setWorldQuaternion/reach, and cruiser.js:574-620 duplicates it again for Rick's arms.
- crew.js:105-117 (hip lock) and rv.js:129-156 (calmly) each run their own per-figure mixer instead of meshyCast's.

The library's own walk speed is not matched to ground speed:
- meshyCast.js:535 sets pace = 0.75 + 0.45·move for walk and run. That isn't derived from ground speed either, so every user of the library inherits some foot sliding.
- Fix it centrally: measure each clip's stride speed once (hip or foot travel per cycle) and set timeScale = ground speed ÷ stride speed.
- people.js:364 has the same problem: a fixed 7.2 rad/s stride whatever the leg length.

Patterns worth promoting:
- people.js look(): yaw/pitch clamped and eased, with a `moving` return value that lets render-on-demand pages like Tour3D sleep.
- people.js reach(): IK to world props.
- dotmatrix stepVillager stop-and-face (rules.js:602-611): the only "notice the player" behaviour in scope.

Other online players are drawn by middleearth/towns/ghosts.js in five forms: walking Jim figures in the office, box figures on Dot Matrix, pale Azteks in Albuquerque, ghost ships in the Caribbean, and diya lamps in the music courtyard.

Worlds or places with no characters:
- The music courtyard: first person, others shown as diyas (music/world/scene.js:650).
- Travel (globe and Akshardham).
- Dickansh (static Nandi and Ganesha statues).
- Earth and mist.
- The X-wing cockpit: no R2 or pilot body.

Players that are vehicles:
- In Albuquerque the player is the Aztek; there is no on-foot mode.
- Hank's SUV runs a fixed HANK_ROUTE loop (albuquerque/world/rules.js:998) and never chases you, even while heat builds.
- In the Caribbean the player is the Pearl.

## Rick and Morty C-137 multiverse (src/components/rickmorty/world/)

Routes: /c-137 (App.jsx:351 -> pages/RickMorty.jsx:9,97 -> RmWorld). The street, house, upstairs, garage, school, arcade, basement, Mind Blowers, Oval Office and diner are built at load (scene.js:67). The annex, Wong's office and the 40-odd dial destinations load lazily (scene.js:73+)., The sewer run (Pickle Rick) and Roy are lazy overlays inside RmWorld (RmWorld.jsx:88).

### Player avatar on foot (Morty) + Morty sat at the cruiser wheel (player)

- **Files:** src/components/rickmorty/world/scene.js:228-235, src/components/rickmorty/world/scene.js:272-282, src/components/rickmorty/world/scene.js:501-506, src/components/rickmorty/world/scene.js:519-522, src/components/rickmorty/world/scene.js:716-717, src/components/rickmorty/world/rules.js:802, src/components/rickmorty/world/rules.js:882-909, src/components/middleearth/towns/walker.js:146-152, src/components/rickmorty/world/RmWorld.jsx:304,810,843,881,904,914,1206-1212, src/components/rickmorty/portal/meshyCast.js:529-537
- **Model:** Meshy 24-bone Morty GLB, or a wardrobe body on the same skeleton (wardrobe/wear.js:21-30), with its own idle/walk/run/sit clips. Fallback is standInMorty, procedural shapes (scene.js:791-826).
- **Animation:** meshyCast update(t, speed/MORTY.run) blends idle/walk/run (scene.js:504). Facing is copied from the sim's face, which walker.js:148-150 eases at 12/s. Shared one-shots go through api.play: cheer on task done, scared when caught, hit and fall in a duel, shoot on F. The pilot gets weights set straight to sit and a bare mixer.update (scene.js:277,521).
- **AI:** n/a (player)
- **Problems:**
  - Feet slide. Walk is 3.6 m/s and run 7 m/s (rules.js:802), but timeScale is only 0.75+0.45*move (meshyCast.js:535). So walk (morty-walk.glb, 1.067 s cycle) plays at ~0.98x and run (0.667 s) at 1.2x, roughly 2.5x and 1.5x slower than the ground covered (estimate).
  - No air pose. stepMorty returns air/vy (rules.js:907), but scene.js:502-504 only raises the group. The legs keep walking or idling in mid-air, and there is no landing crouch.
  - The hit argument to update is always 0 (scene.js:504).
  - One-shots are full-body and scale locomotion by (1-over) (meshyCast.js:529-531) while the sim keeps moving him. 'shoot' is Cowboy_Quick_Draw, 7.3 s, fired with hold 0 (RmWorld.jsx:914), so he slides in a quick-draw pose; 'cheer' mid-walk slides the same way.
  - Same-clip retrigger kills itself. F has a 0.5 s cooldown (RmWorld.jsx:912). play() calls stop() first, which turns the old oneShot (the same action) into fadingOut; the fade branch then calls a.stop() on the action that is now playing (meshyCast.js:446-462, 513-520). Every other shot animation is cut after about 0.2 s.
  - n.spot.anim (RmWorld.jsx:810) is never set in any data file, so per-spot Morty actions are dead code.
  - No head or neck look-at toward the person he is talking to or state.near. No talk gesture. No turn-in-place step.
  - The stand-in's legs swing at a fixed sin(t*9)*move (scene.js:821-823), not paced to distance.
- **Opportunities:**
  - Promote universe/locomotion.js createLocomotion/strideOf (stride-measured timeScale, lean into turns, jump tuck from m.air, landing crouch, hit flinch). Hook it in scene.js:504.
  - Cut 'shoot' to its draw-and-fire part (THREE.AnimationUtils.subclip), or mask it to Spine/arm tracks so he can move and shoot. Play cheer only when speed < 0.5.
  - Play 'wave' when E opens a SAY with a friendly person. After N seconds standing still, play an idle fidget ('happy', or 'drink' on Rick bodies).
  - Add a post-mixer head/neck look-at toward state.near (same pattern as Summer's bone override, upstairs.js:471-482).
  - Fix play()/stop() in meshyCast so restarting the same action does not hand it to fadingOut.

### Other players online (ghost Mortys) (other)

- **Files:** src/components/rickmorty/world/scene.js:243-258, src/components/middleearth/towns/ghosts.js:141-150
- **Model:** Meshy Morty clone from the world cast, own idle/walk/run
- **Animation:** Same meshyCast blend, move = p.speed/MORTY.run. Facing eased in ghosts.js:141-149.
- **AI:** none (positions come from the network)
- **Problems:**
  - ghosts.js:150 calls animate(g.f, t + g.x, ...), and scene.js:255 passes that t into morty.update, which takes dt from consecutive t values (meshyCast.js:500). The mixer dt becomes frame dt + delta-x. A ghost walking west faster than 1 m/s freezes (dt clamped to 0); one walking east plays its clip (1+v) times too fast.
  - Same foot-slide as the player (3.6 m/s on a walk clip at about 1x).
  - No actions: no wave between players, no emotes.
- **Opportunities:**
  - In scene.js:255, ignore the t offset: pass the animate dt through, or keep a per-ghost local clock.
  - Network a small emote id (wave/cheer/dance) and play it through c.play.

### Dimension people and hunters (rigged Meshy, stage.js + npc.js): named locals, guards, hunters, duel bosses (Evil Rick, Hemorrhage), Evil Morty (npc)

- **Files:** src/components/rickmorty/world/dimensions/stage.js:67-104, src/components/rickmorty/world/dimensions/stage.js:111-114, src/components/rickmorty/world/npc.js:59-81, src/components/rickmorty/world/npc.js:82-87, src/components/rickmorty/world/npc.js:88-165, src/components/rickmorty/world/npc.js:200-214, src/components/rickmorty/world/dimensions/duel.js:14, src/components/rickmorty/world/dimensions/rows1.js, src/components/rickmorty/world/dimensions/rows2.js, src/components/rickmorty/world/dimensions/rows3.js, src/components/rickmorty/world/scene.js:185-191, src/components/rickmorty/world/arcade.js:810, src/components/rickmorty/world/annex.js:740
- **Model:** Meshy 24-bone GLBs with their own idle and walk (and a -run.glb on disk that is never loaded). 90 of the 203 destination figures.
- **Animation:** meshyCast blend driven by move from npc.js: wander min(0.5, sp/2.4) (npc.js:144), hunt min(1, h.speed/3) (npc.js:116), standing 0. Turning: turnTo lerps group.rotation.y (npc.js:82-87). Shared clips: punch on a duel strike (npc.js:123); hit and fall when shot (npc.js:205); sitcross looped for Evil Morty (rows3.js:18 -> npc.js:188); Rick's 'drink' fidget for any Rick.
- **AI:** Hand-rolled flag brain in npc.js:88-165 with priority hunt > wander > watch, plus bark. Movement uses lib/ai/steer.js context steering (seek/avoid/separate/resolve, npc.js:59-81). No perception, tree, utility, squad, search or spatial. Counts: 62 hunters, 110 wanderers, 49 watch-only.
- **Problems:**
  - No run clip, so hunters fall into the rest pose. stage.js:72 loads ['idle','walk'] only, and no NPC kind anywhere in this world ever gets 'run'. meshyCast.js:529-534 still gives run its weight; three's PropertyMixer fills the missing weight with the bind pose. Hunt speeds 2.2-3.4 give move 0.73-1. So the 29 rigged hunters chase 54-100% in T/A pose: customs agents, gazorpians, atlanteans, gromflomite and prison guards, meeseeks, frundlesmen, Evil Rick (~80%), Hemorrhage (~68%), Scary Terry (~54%).
  - High tier also loses walk for gromflomite and gazorpian. arcade.js:810 (built at world start) asks for them with ['idle'] only, and scene.js:186-191 need() keeps the first ask per name. Every gromflomite/gazorpian in the dimensions has no walk: patrols at move 0.5 are 100% bind pose, sliding (rows2.js:221-224 guards, rows1.js:119-120 gazorpians, squanch.js:162 raiders, prison, dim35c, vat). They also skip faceAhead (meshyCast.js:358 needs clips.walk), so they stand about 41 degrees off their facing (people.js:13-15).
  - Walk/run speed is not matched to ground speed. Wander move is capped at 0.5, so a 0.4 m/s queuer and a 1.9 m/s drone both walk at about 0.97x. The hunt move uses h.speed even when steerTo clamps the step near Morty (npc.js:115-116), so the legs run while the body crawls in.
  - No context reactions. A catch emits 'caught' with no clip on the catcher (npc.js:127-131). Spotting him (npc.js:101) plays no alert or taunt. A bark (npc.js:157-161) has no talk gesture or wave, and wanderers without watch bark facing away.
  - Watch rotates the whole group in place (npc.js:137,154): no turn step, no head look.
  - Morty is not in the steering: separate() lists only other NPCs and avoid() only solids (npc.js:67-73), so NPCs walk through the player.
  - Detection is a plain radius with no line of sight or field of view (npc.js:98). Losing him drops the hunt at once (npc.js:103). Every hunter seeks Morty's exact point (npc.js:115), with no flanking and no limit on attackers.
  - Duel stutter. Punch_Combo is 2.5 s but strikes come every 1.3 s (duel.js:14, npc.js:120-123). The same-clip retrigger bug cuts every other punch after 0.2 s while the damage still lands.
  - Wander loops are fixed 2-4-point tours. At each waypoint they only idle; no action clip.
- **Opportunities:**
  - Library fix in meshyCast update: hand a missing action's weight on to the next one present (run -> walk -> idle). And/or load ['idle','walk','run'] in stage.js:72.
  - Make scene.js need() merge the requested clip lists per name and load what is missing, instead of first-ask-wins.
  - Drive timeScale from metres per second with a per-clip stride (universe/locomotion.js strideOf). Take move from the actual step distance / dt.
  - perception.js: field-of-view plus line-of-sight detection timer instead of the near radius. Play 'scared' or 'taunt' on spotting.
  - search.js: search the last known position when he is lost. squad.js tokens: one or two chasers close in while the rest cut off the portal.
  - utility.js idle life: wander, chat with a neighbour, look at Morty, play a clip.
  - Clips in context: 'wave' when Morty first enters bark.r of a friendly (Unity, Noob-Noob, Mr. Meeseeks, Tommy). 'taunt' as a duel opens. 'cheer' on 'caught'. 'hit' on any hunter that is shot. 'shot' (Shot_and_Fall_Backward) for the duel loss. 'dance' at Schwifty and the Squanch wedding. 'drink' for Squanchy and the receptionist. 'happy' for Meeseeks.
  - Post-mixer head look-at for watch, instead of turning the whole body.

### Dimension crowds and creatures (unrigged Meshy props moved by npc.js): magdalian villagers, froopy, snakes, cronenbergs, mythologs, agency guards, frundles, heisters, Jerryboree jerries, gear people, plutonians, zigerions, Cable TV cast, primedrones, stair goblins (crowd)

- **Files:** src/components/rickmorty/portal/meshyCast.js:262, src/components/rickmorty/portal/meshyCast.js:540-553, src/components/rickmorty/world/npc.js:88-165, src/components/rickmorty/world/dimensions/fantasy.js:83-93, src/components/rickmorty/world/dimensions/rows1.js:20-24,402-407, src/components/rickmorty/world/dimensions/rows2.js:142-145
- **Model:** Static Meshy GLBs with no skeleton (DEST_PROPS, served from /models/c137/rm). 113 of the 203 destination figures.
- **Animation:** meshyCast's no-mixer branch: body bobs |sin(t*7)|*0.08*move, rolls sin(t*7)*0.08*move, and breathes sin(t*2.1). Special branches: pickle hop, cromulon bob. Stair goblins get a group.y hop (fantasy.js:92).
- **AI:** Same npc.js brains: 75 wander or hunt, 33 of them hunters.
- **Problems:**
  - Rigid statues glide across the ground with a roll wobble while wandering or chasing: Purge villagers (rows1.js:402-407), froopies, snakes, cronenbergs, agency guards, frundles and more.
  - Everyone is in unison: the bob and breath use global t with no per-figure seed (meshyCast.js:548-552), so a whole crowd breathes and wobbles together.
  - No hit or fall reactions are possible: play() returns false without a mixer (meshyCast.js:437).
  - Primedrones (y 1.5) wobble like walkers.
- **Opportunities:**
  - Rig the humanoid props with Meshy rigging so they join the 24-bone library and get idle/walk plus shared clips: magdalian, plutonian, gearperson, zigerion, heister, resortguest, agencyguard, jerry-*, simman, gloopnurse.
  - Non-humanoids (snakes, froopy, cronenberg, blob, drones, frundles dog): per-kind procedural gaits (slither sine, hop, hover) paced to ground speed, each with its own phase.
  - Cheapest fix: seed the bob and breath phase per figure in make().

### Street visitors (visitors.js): walking townsfolk (Jessica, Brad, Goldenfold, Ethan), the President and his Secret Service agent, Federation agents on post (npc)

- **Files:** src/components/rickmorty/world/visitors.js:44-71, src/components/rickmorty/world/visitors.js:134-152, src/components/rickmorty/world/rules.js:596-608, src/components/rickmorty/world/npc.js
- **Model:** Meshy rigged, each with its own idle/walk (sit loaded for president/secretservice/fedagent but unused). toonPerson shapes when a model fails.
- **Animation:** Walkers: npc.js blend, move 0.29-0.375 at 0.7-0.9 m/s. Standers: c.update(t,0,0) idle with a random phase. Fed agents yaw the whole group toward Morty within 9 m at 3/s (visitors.js:145-151).
- **AI:** Walkers: npc.js wander round fixed 4-point rectangles, plus bark (rules.js:605-608). No watch. Agents: hand-rolled turn-to-watch. President: none.
- **Problems:**
  - The President and the Secret Service agent vanish (visible=false) the moment 'president' is done (visitors.js:135-136, rules.js:596-597) while the limo drives off. Nobody walks to the car.
  - The President only idles at the kerb: no wave or greeting, and he never looks at Morty.
  - Agents pivot their whole body on the spot (visitors.js:149-150): no head look, no step.
  - Walkers get solids: [] (visitors.js:55) and do not avoid Morty, so they walk through him, the limo and the parked cruiser. They bark without turning to him.
  - Walk clip runs at ~0.92x for 0.9 m/s, so they overstep (estimate).
  - Sit clips are requested (visitors.js:46) and never used.
- **Opportunities:**
  - President: 'wave' when Morty comes near; on done, steer to the limo door and hide only once there. Secret Service: watch with a head look.
  - Walkers: give them watch, face Morty when barking, 'wave' on first approach. Occasional stop-and-chat between Jessica and Brad (utility.js). Pick sidewalk spots with spatial.js instead of fixed rectangles.
  - Pass the street's solids and Morty into createNpcs and steer separate().

### Room people standing (person()): Beth in the kitchen, Summer with her phone, Rick at the garage bench, Goldenfold and the principal, the President and generals in the Oval, Diane's hologram (npc)

- **Files:** src/components/rickmorty/world/interiors/people.js:28-40, src/components/rickmorty/world/interiors/people.js:140-163, src/components/rickmorty/world/interiors/house.js:185-186, src/components/rickmorty/world/interiors/upstairs.js:107-109, src/components/rickmorty/world/interiors/upstairs.js:461-482, src/components/rickmorty/world/interiors/lab.js:536-537, src/components/rickmorty/world/interiors/school.js:409-414, src/components/rickmorty/world/interiors/oval.js:105-116, src/components/rickmorty/world/interiors/basement.js:147
- **Model:** Meshy rigged, own idle (walk loaded only so faceAhead can turn the idle, people.js:13-19). toonPerson shapes fallback.
- **Animation:** Idle only, via c.update(t,0,0) (random start phase, meshyCast.js:417). Rick's 'drink' fidget every 14-34 s. Summer's right arm is pinned to a phone pose after the mixer (upstairs.js:471-482). Goldenfold's whole body yaws sin(t*0.35)*0.35 (school.js:411-412).
- **AI:** none (no ai field on these PEOPLE, rules.js:590-594)
- **Problems:**
  - They never turn to or look at Morty, even while he talks to them.
  - Beth just stands at the counter; nobody has a task loop.
  - Goldenfold spins on the spot like a turntable, feet pivoting (school.js:412).
  - Summer's phone pose freezes the arm, but her head never looks down at the phone.
  - President and generals: idle only. No talk gestures anywhere.
- **Opportunities:**
  - Run room people through createNpcs with watch/bark like the dimensions, or add a head look-at layer.
  - Contextual loops: Beth 'drink' (her wine, as in the show); Rick tinkering at the bench (procedural arm layer or a new Meshy clip); Goldenfold 'wave' and talk gesture when Morty enters.
  - Short steered wanders between rooms (Beth kitchen to dining, Summer desk to bed).

### Seated room people: Jerry on the couch, five students, the diner's Fed agent (on Rick's sit clip); Poopybutthole, Nancy, Tricia, Space Beth, Dr. Wong (on their own sit clips) (npc)

- **Files:** src/components/rickmorty/world/interiors/people.js:42-80, src/components/rickmorty/world/interiors/people.js:115-135, src/components/rickmorty/world/interiors/house.js:190-206, src/components/rickmorty/world/interiors/house.js:218-219, src/components/rickmorty/world/interiors/school.js:248-273, src/components/rickmorty/world/interiors/diner.js:160-186, src/components/rickmorty/world/interiors/upstairs.js:113-121, src/components/rickmorty/world/interiors/lab.js:550, src/components/rickmorty/world/interiors/wong.js:76
- **Model:** Meshy rigged. Either Rick's rick-sit.glb with only its quaternion tracks kept (people.js:53) and hand-tuned seat offsets (school.js:248, diner.js:160, house.js:197-198), or the figure's own -sit.glb placed by measuring the hips (seatOwn).
- **Animation:** A single sit loop driven by a raw mixer.update tick; never goes through meshyCast update or play.
- **AI:** none
- **Problems:**
  - They breathe in unison. The sit actions start at time 0: five students on the same Rick clip (school.js:264-266), and Nancy and Tricia side by side on one bed, both on Chair_Sit_Idle_M (10.7 s) with sit.time = 0 (people.js:120).
  - Diner asks for fedagent's own sit clip (diner.js:164) and then uses Rick's (diner.js:169-176); fedagent-sit.glb goes unused.
  - The sit block is copy-pasted three times (house.js:191-205, school.js:258-272, diner.js:169-185) next to seatOwn.
  - Nobody turns their head or reacts to Morty. One 10.7 s loop forever; Jerry watching TV is static.
- **Opportunities:**
  - Use seatOwn everywhere a figure has its own sit clip (12 on disk); fall back to retargeted Rick. Randomise sit.time.
  - Head look-at toward Morty or the TV. 'sitcross' as a variant.
  - Students: 'cheer' or 'happy' when the pop quiz (Quiz.jsx) is passed; Jerry flinches ('scared') at the Cable channel.

### Set-piece figures: the floating clone Rick (basement), the Fortress's spare Ricks in tubes, the Morty clones in Evil Rick's pods, Fantasy's stair goblins (other)

- **Files:** src/components/rickmorty/world/interiors/basement.js:676-700, src/components/rickmorty/world/dimensions/fortress.js:60-71, src/components/rickmorty/world/dimensions/fortress.js:143, src/components/rickmorty/world/dimensions/evilrick.js:85-90, src/components/rickmorty/world/dimensions/fantasy.js:83-93, src/components/rickmorty/world/dimensions/stage.js:95-101
- **Model:** Meshy rigged rick and mortyclone (Morty with swapped shirt colours). Stair goblin is a static prop.
- **Animation:** Whole group bobs or turns on a sine; underneath, c.update(t,0,0) plays the standing idle.
- **AI:** none
- **Problems:**
  - The Ricks described as 'floating, asleep' (fortress.js:69-70) and the tube clone with 'arms loose' (basement.js:672-699) play the standing idle. They also take Rick's 'drink' fidget every 14-34 s (meshyCast.js:80,425,523-527), so they sip a flask in stasis.
  - Pod clones stand breathing; freeing one plays no reaction (evilrick.js:122 just hides it).
  - Goblins hop as rigid props.
- **Opportunities:**
  - A stasis pose: rig.js POSES hover/fly limb directions, or a float clip, with the fidget turned off per figure.
  - Freed clones: 'happy' and then run off, steered.
  - Goblins: squash and stretch timed to the hop.

### Total Rickall crowd (house, during the parasite game) (crowd)

- **Files:** src/components/rickmorty/world/interiors/rickall3d.js:24, src/components/rickmorty/world/interiors/rickall3d.js:147-166, src/components/rickmorty/world/interiors/rickall3d.js:192-233, src/components/rickmorty/world/interiors/house.js:232-260
- **Model:** Meshy rigged RICKALL_FIGURES with their own idle (walk loaded only for facing). Ghost in a jar; Baby Wizard on a lift.
- **Animation:** Idle via c.update(t,0,0). A shot real person: the tilt group rotates -0.48*PI over 0.7 s while the idle keeps playing (rickall3d.js:216-219). A shot parasite shrinks and spins.
- **AI:** none: static spots from the rickall.js game state
- **Problems:**
  - Shot people fall like a plank. The shared 'shot' (Shot_and_Fall_Backward, 3.5 s) and 'fall' clips exist and are unused.
  - Bystanders never react to a shot, never look at Morty or at the gun, and never move.
- **Opportunities:**
  - Play 'shot' (held) on a real person.
  - 'scared' on anyone within ~2 m of a shot.
  - 'happy' or 'cheer' when a parasite is revealed; parasites 'taunt'.
  - Head look-at at Morty while r.aim is on them.

### Arcade (Blips and Chitz) and alien-street annex regulars (crowd)

- **Files:** src/components/rickmorty/world/arcade.js:807-821, src/components/rickmorty/world/arcade.js:851, src/components/rickmorty/world/annex.js:737-751
- **Model:** Meshy rigged gromflomite and gazorpian, loaded with ['idle'] only
- **Animation:** Idle only, at fixed spots
- **AI:** none
- **Problems:**
  - The idle-only load also takes the walk away from every gromflomite and gazorpian in the dimensions on the high tier (shared need() cache).
  - Without walk, faceAhead never runs (meshyCast.js:358), so the idle stands about 41 degrees off the intended facing.
  - Two or three static figures in a big hall; they never look at Morty.
- **Opportunities:**
  - Load ['idle','walk','run'].
  - Give them npc.js wander/watch/bark with the arcade machines as waypoints.
  - 'cheer' or 'dance' at the machines, 'drink' at the tables.

### Shape stand-ins (toonPerson, standInMorty), drawn when a Meshy file fails or meshy:false (other)

- **Files:** src/components/rickmorty/world/interiors/people.js:168-265, src/components/rickmorty/world/scene.js:791-826, src/components/rickmorty/world/visitors.js:66, src/components/rickmorty/world/interiors/diner.js:187-191, src/components/rickmorty/world/interiors/oval.js:108-113
- **Model:** Procedural shapes merged into one mesh; no rig
- **Animation:** toonPerson: breathing scale plus a small sway with a per-figure random seed (people.js:256-263). standInMorty: limbs swing sin(t*9)*move.
- **AI:** none (visitors.js:65 adds them to the npc layer only if a Meshy figure exists, so stand-in walkers never walk)
- **Problems:**
  - A stand-in walker stays put while its Meshy twin would wander.
  - Stand-in Morty's limbs swing at a fixed rate, not paced to distance.
- **Opportunities:**
  - Low priority. Let the npc layer drive stand-ins too (move the group even when there is no clip).

### Sewer run: Pickle Rick (player) (player)

- **Files:** src/components/rickmorty/world/sewer/scene.js:83-93, src/components/rickmorty/world/sewer/scene.js:154-161, src/components/rickmorty/portal/meshyCast.js:540-542
- **Model:** Meshy 'pickle', static prop (no rig)
- **Animation:** meshyCast pickle branch: hop |sin(t*9)|*0.3*move plus roll. The hero group arcs on a jump and leans into lane changes (sewer/scene.js:157-160). Stun lowers move to 0.3.
- **AI:** n/a (player; sewer/rules.js simulates the run)
- **Problems:**
  - Hop rate is a fixed 9 rad/s, not tied to TUNING.speed.
  - No squash on landing, no hit reaction beyond the lower move value.
- **Opportunities:**
  - Squash and stretch on landing and on hit; tie the hop rate to run speed.

### Sewer run: rats (enemy)

- **Files:** src/components/rickmorty/world/sewer/scene.js:105-118, src/components/rickmorty/world/sewer/scene.js:172-173, src/components/rickmorty/portal/meshyCast.js:546-553
- **Model:** Meshy 'sewerrat', static prop (in DEST_PROPS, no rig)
- **Animation:** meshyCast wobble branch at move 1, driven by global t: every rat bobs and rolls in sync
- **AI:** none: lane obstacles from sewer/rules.js
- **Problems:**
  - Rats glide with a shared synchronised wobble.
  - A hit rat simply disappears (sewer/scene.js:172).
- **Opportunities:**
  - Per-rat phase, a procedural scurry gait, a knock-flying arc on hit.

**Notes:** Cross-cutting:
(1) meshyCast update (meshyCast.js:529-534) assumes idle, walk and run all exist. If one is missing, the weights sum to less than 1 and three's PropertyMixer fills the rest with the bind pose. In this world no NPC kind ever loads run (stage.js:72, visitors.js:46, people.js:19), so every rigged hunter chases partly or fully in T/A pose. Fix it in the library by handing a missing action's weight to the next one present.
(2) scene.js:186-191 need() caches the first clip list asked for each name. On the high tier, arcade.js:810 asks for gromflomite and gazorpian with ['idle'], which strips walk from those kinds in every dimension and skips faceAhead (they stand ~41 degrees off). Merge clip lists per name instead.
(3) Pace is 0.75+0.45*move everywhere (meshyCast.js:535), with no metres-per-second link. universe/locomotion.js (strideOf/createLocomotion: stride-measured pacing, lean, jump tuck, landing crouch, hit flinch) is the local pattern to promote into meshyCast or the R&M world.
(4) play()/stop() (meshyCast.js:446-462, 513-520): restarting the same clip moves its own action into fadingOut, which then stops it after the fade. A second play() inside the fade window overwrites fadingOut and leaves the earlier action stuck at partial weight. This hits the duel punch (2.5 s clip, 1.3 s cadence) and Morty's shoot (7.3 s clip, 0.5 s cooldown).
(5) The no-mixer branch (meshyCast.js:548-552) uses global t with no seed, so all 113 unrigged destination props bob and breathe in lockstep.
(6) The sit-on-Rick's-clip code is copied three times (house.js:191-205, school.js:258-272, diner.js:169-185) beside seatOwn (people.js:115). All of them start the sit at time 0.
(7) Nothing in the world turns a head or neck bone. Summer's post-mixer arm override (upstairs.js:471-482) is the only layered bone pose and is the pattern for a look-at layer.
(8) Shared clips never used by any NPC here: wave, happy, cheer, dance, taunt, scared, shot, shoot. Only punch/hit/fall (duels), sitcross (Evil Morty) and Rick's drink fidget are used. RmWorld.jsx:810 spot.anim is dead: no data sets it.
(9) AI: npc.js is the one shared brain for the street and every dimension. It is hand-rolled (hunt > wander > watch, plus bark) and uses only lib/ai/steer.js. perception.js, search.js, squad.js, utility.js, tree.js and spatial.js are unused here. docs/superpowers/HANDOFF-runtime.md:21 says steer.js is not wired into any world; that is stale, npc.js uses it. Morty is missing from steering separation (npc.js:67-73).
(10) Ghost Mortys get t+g.x as their clock (ghosts.js:150 -> scene.js:255 -> meshyCast.js:500), so the mixer dt depends on direction of travel.
(11) Out of scope, not audited: roy/scene.js (Roy: A Life Well Lived). It has its own procedural code-built figure with a stride() helper (roy/scene.js:784); some strides are paced by distance (1825), others by time, which slides (2315: t*11).
(12) The walk-cycle foot-slide numbers are estimates from clip durations (walk 1.067 s, run 0.667 s); stride length was not measured.

## The shared layer, before W1

**Missing then:**
- Ground-speed-matched stride for every figure: only locomotion.js does it (footScene party/troops, the galaxy party). meshyCast (535-537), actors (343), npc.js (116, 144), citadel loops, peers (168), crew.js (48), hostiles (activity.js:578), office walk (364) and invincible walk all slide
- walk/run phase sync while blending (locomotion only; clipsFor only on switch)
- turn-in-place / pivot steps: idle figures rotate as a rigid group (feet skate); Portal3D.js:898 snaps facing to velocity; Citadel loops snap heading at corners; citadel turnTo is per-frame, not dt-based
- head/neck/eye look-at for clip-driven figures: only office/people.js:417-434 (procedural figures) and gunplay's chest aim exist; NPCs 'look' by yawing the whole body (actors.js:313-316, citadel/people.js:219-224, npc.js:137/154)
- upper/lower body masks: one-shots replace the full body (meshyCast 522-534), so wave, punch or shoot while walking freezes the legs; saberBody (main) is a one-off hand-rolled lower-body layer
- additive layers (breathing, flinch, recoil): THREE.AnimationUtils.makeClipAdditive / AdditiveAnimationBlendMode is used nowhere; flinches are holder wobbles or bone pokes
- action queue / sequencing / end events (play A then B, then return; on('finished')): callers use hold timers
- reliable one-shot replay: re-hitting cancels the reaction and flashes toward the bind pose (meshyCast play/stop bug)
- context reactions wired to AI: wave or greet when the player approaches (none), hit clip when shot (only R&M duels and Morty), cheer, talk gestures while a line is said (galaxy actors.say, npc barks, Citadel), point/look-around while searching (hostiles 'look' mode has no animation)
- idle variants and fidget pools per figure (only Rick's drink); Meshy's restless idle needs a calmer variant or trim (rv.js calmly() hacks a sub-range)
- consistent phase offsets: smash meshy, bots (105, 303) and the marvel landing heroes start idles at 0
- mixer LOD: offscreen pause, distance-based update rate and a frame budget, shared by all worlds (now ad hoc: citadel every 3rd frame, actors every 4th beyond 60 m, footScene none)
- foot IK / ground conform on slopes (galaxy terrain, landings): feet float or sink
- unified hit/death: locomotion hurt + fallTurn vs holder plank tip (activity.js:489) vs 'fall' clip vs ragdoll; the trooper death clips (dieFwd/dieBlown, chosen by shot direction) sit unused
- sit-down/stand-up transitions and seat interaction as a shared action (now 12 per-figure sit clips + Rick's borrowed + 3 hand-rolled drivers)
- rig.js pose-over-clip weighting (pose() halts clips and resets to rest), so procedural limbs (aim, reach) can't layer over mocap there
- root motion: none (everything is in place); fine for now, but Knock_Down's hips travel isn't followed by the capsule
- tests for meshyCast play/stop/update weights (none)

**Duplicates:**
- idle/walk/run weight blend written 4 ways: meshyCast.js:529-537 (smooth 0.05..0.35, pace 0.75+0.45m), footScene.js:134-144 blend() (0.04..0.3, pace 0.8+0.4m), locomotion.js:137-143 (0.04..0.3), galaxy/surface/actors.js:163-168 (walkW=min(1,3m), run from 0.6), plus hard switches in avengers/smash/meshy.js:172-178 and cybertron/rollout/meshyCast.js:225-232
- mixer + clipAction + random start time boilerplate: meshyCast.js:410-418, footScene.js:167-176, actors.js:146-154, avengers/smash/meshy.js:145-153 (no random), cybertron/rollout/meshyCast.js:202-209, cockpit/crew.js:85-89, rv.js:137-141 (second mixer on a model crew.js already gave one), bots.js:98-105 and 239-241 (second mixer beside rig.js's), avengers/world/people.js:49-51, rig.js:200-201
- borrow + retarget + face-ahead: meshyCast.js:353-358 (faceAhead) vs footScene.js:270-277 rigScene (the same loop by hand with faceForward/headingOf) vs interiors/people.js:47-80 (quaternion-only filter + facingAhead re-implementation) vs cockpit/crew.js:83 and rv.js:2400 (retarget for sit)
- clip-file loaders that note hips height: clips.js:24-45 borrowClips, meshyCast.js:24-40 sharedClip, meshyCast.js:316-323 clipOf, rv.js:114-123 loadClip, cybertron/rollout/meshyCast.js:107-113 clipOf, avengers/smash/meshy.js:22 clip(), interiors/people.js:47-64 sitting()
- aim a bone at a direction: rig.js:132-145 aim, lib/three/ik.js:45 aimBone, avengers/smash/meshy.js:122-137 aim, office/people.js:88 aim
- turn a bone about a figure-frame axis: rig.js:147-153 turn, office/people.js:68-77 turn, cybertron/transform3d.js:271 turn, cockpit/crew.js:173-177 nudge, lib/three/ik.js:75 rotateWorld
- two-bone reach IK: lib/three/ik.js:88 reach vs office/people.js:98 reach
- height-from-skeleton scaling (head_end/Head to toes): footScene.js:157-166 vs cockpit/crew.js:72-79
- procedural walk cycles: rig.js:400-424 POSES.stride, office/people.js:357-371, invincible/world/people.js:215-228 posePerson walk, bots.js:298-313, footScene built() figures
- body-yaw-toward-target helpers: citadel/people.js:49-53 turnTo (per-frame k), galaxy/surface/walker.js:28 turnToward (rad cap), universe/foot.js:265 turnToward (gain), rickmorty/world/npc.js:82-87 turnTo (k*dt), peers.js:128 ease
- sit handling outside the cast: citadel/people.js:180-184 and townsfolk.js:107-111 (f.sitting drives f.mixer), interiors/people.js:115-135 seatOwn (weights set by hand, mixer driven directly)
- smooth() step helper copied: meshyCast.js:492, locomotion.js:30, footScene.js:78, saberBody.js (main)
- death/fall done 4 ways: locomotion fallTurn + down (footScene.js:2582-2600), galaxy activity.js:489 holder plank tip, meshyCast 'fall' clip (npc.js:205), portalFx ragdoll (portalFx.js:144)

## The AI layer, before W2

What exists:
- Galaxy surface (actors.js):
  - Wander near home, walk a path, or stand. Turn to you within 4.5 m if they have lines (:313-317).
  - needs.js (Sims-lite): a utility.pick over site.wants, then wait `pause` s at the want (actors.js:83-110). Only 3 sites opt in (bespin.js:379, coruscant.js:234, yavin.js:222), about 8 actors.
  - fears/chases between kinds, by sight, re-checked every 0.5 s (actors.js:319-322). An Ugnaught flees a Wing Guard; a commuter flees a clone.
  - On arrival at a want they just stand in idle; no use animation (sit, warm hands, work). Fleeing is a 1.6x walk with no scared clip.
  - Your blaster fire doesn't scare anyone, because relate() reads only other actors.
  - Far actors are updated every 4th frame and fog-culled (good).
- Invincible:
  - 220 instanced box pedestrians on pavement lines that turn back at corners and scatter from slams and booms (traffic.js:155-186, scene.js:502-507). Legs swing by phase; heading snaps.
  - About 14 named townspeople stand in place and switch pose mode by your distance (talk, arms, or wave when you're airborne) (npcs.js:97-115).
  - Eve flies a fixed loop and stops for you (npcs.js:118-131).
- Citadel:
  - Rallies are frozen instanced copies (crowd.js:1-5).
  - Crowd and Mortytown walkers circle fixed loops by clock, walk through each other and Rick, and flip at the ends.
  - The named cast turns to Rick at 4.5 m. Cops are watchers.
- R&M dimensions and street:
  - npc.js wander points with steering, `watch` turn, `bark` lines, hunt/duel.
  - Street Fed agents turn to watch within 9 m (visitors.js WATCH).
- Albuquerque world: 7 static named figures (desktop only), with no civilians and no traffic people. Balloons and tumbleweeds are the only ambient life.
- Avengers compound: 4 static heroes on idle clips who turn to you.
- Middle-earth towns: folk are posed by story beats. The only other 'people' are other online visitors (travellers.js). Edoras's host is instanced.
- Universe landings: people stand and face the ship (landings/people.js).
- Office: seated people with head look, gestures and typing (the most alive).

Missing everywhere:
- Daily schedules or time-of-day routines, though several worlds have a sky clock.
- Conversations between NPCs (pairs facing, talk gestures, looking at the speaker).
- Groups walking together.
- Contextual use animations at objects (sit on benches, lean, buy at stalls, work).
- Head tracking of the player as you pass.
- Greetings (wave clip) or a reaction when bumped or shoved (actors.js shove() just pushes you).
- Fleeing from your gunfire or a nearby fight as a perception stim. Only Invincible has a scare.
- Crowds parting round you.
- A needs/advertisement model outside the 3 galaxy sites.

**Not on the toolkit:**
- src/components/universe/foot.js:307-357 march(): landing troops are omniscient (nearest target by true distance), everyone in range fires, sine strafe
- src/components/universe/wingRules.js:103-144 wingman target choice is a hand-rolled weighted nearest
- src/components/middleearth/shire/rules.js:509-570 Maggot's dogs: a patrol/alert/chase/back state machine that watchers.js generalised but the Shire never switched to
- src/components/galaxy/surface/actors.js:60-131 think(): wander/path/still/flee/chase state machine; blocked means stop and re-pick (119-129)
- src/components/galaxy/surface/needs.js:40-66 relate(): fears/chases by distance + LOS, no beliefs, no stims
- src/components/rickmorty/world/npc.js:84-163 stepNpc(): hunt/duel/wander/watch/bark if-chain; spotting by raw distance (98)
- src/components/rickmorty/citadel/people.js:240-246 and townsfolk.js:126-131: crowd and Mortytown walkers on fixed loops by clock t, no avoidance, no reaction
- src/components/rickmorty/citadel/crowd.js:1-5,117-135: rallies are unanimated instanced still copies
- src/components/invincible/world/npcs.js:97-131: townspeople pick pose mode by distance; Eve is a parametric loop with a patience timer
- src/components/invincible/world/traffic.js:155-186: pedestrians on pavement lines, flee a scare radius for 4 s
- src/components/cybertron/game/rules.js:602-655: hold/advance/strafe by range thresholds
- src/components/mario64/rules/actors/foes.js: Bob-ombs chase by distance
- src/components/avengers/world/scene.js:1687-1693 and albuquerque/world/scene.js:806-828: static casts with no AI
