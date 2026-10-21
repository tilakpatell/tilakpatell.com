// Buckbeak (quest 6, rules/buckbeak.js): the Hippogriff in the paddock,
// proud and watching you. Walk up slowly and hold E to bow, eyes on his,
// until he bows back; come at him at a run or bob up too soon and he rears,
// screeching. Bowed to, he lets you up (E), and the ride is on rails: up out
// of the paddock, low over the Black Lake, round the castle’s towers and
// home, the keys off and the view the point, in the kit’s letterbox.
//
//   create(ctx, at) → { step, act(down), holds, state(), over, dispose() }
//   ctx.places: { lake: [x, y, z], castle: [x, y, z] } for the ride

import * as THREE from 'three';
import { BOW, SAYS, buckbeakBot, newBow, newRide, rideAt, ridePath, stepBow } from '../../rules/buckbeak';
import { makeProp } from '../props';
import { createSpellSounds } from '../spellSounds';
import { frame, furniture } from './kit';

const WHO = 'Hagrid';
const EYE = 1.05; // m over the saddle
const BACK = 0.55; // and behind it, so his head is ahead and below, not in your face
const BOW_DIP = 0.45; // radians your view goes down as you bow

export function create(ctx, at) {
  const { scene, camera, house, rt, floorAt, said, walker, tell = () => {}, places = {} } = ctx;
  const f = frame(at, floorAt);
  const group = new THREE.Group();
  group.name = 'hogwarts-lesson-buckbeak';
  scene.add(group);
  const sounds = createSpellSounds(rt);

  // Buckbeak, seven steps ahead, facing you; a post of the paddock’s fence beside him; Hagrid by it
  const home = f.put(0, 7);
  const beast = makeProp('buckbeak', { house, rt });
  beast.position.copy(home);
  beast.rotation.y = f.yaw;
  group.add(beast);
  const post = furniture('post', { house, w: 2.4, h: 1.3, colour: '#5a4632' });
  post.position.copy(f.put(-2.6, 6.2));
  post.rotation.y = f.yaw + 0.3;
  group.add(post);
  const hagridAt = f.put(2.4, 5);
  const head = hagridAt.clone().setY(hagridAt.y + 3);
  const hagrid = ctx.figure?.('hagrid', { height: 2.6 }) ?? null;
  if (hagrid) {
    hagrid.group.position.copy(hagridAt);
    hagrid.group.rotation.y = f.yaw - 0.4;
    group.add(hagrid.group);
  }

  let b = newBow();
  let bowing = false;
  let bowK = 0; // how far down you are
  let lastDist = null;
  let ride = null; // { r, t }
  let t = 0;
  let left = -1;
  let rear = 0; // s of his rearing, for the drawing
  let nod = 0; // his bow back
  const say = (text) => text && said?.say(WHO, text, head);
  const objective = () => {
    if (ride) ctx.objective(null);
    else if (b.phase === 'bowed') ctx.objective('E · climb on');
    else if (b.phase === 'rearing') ctx.objective('Back off, and wait for him to calm');
    else ctx.objective(`Walk up slowly, then hold E to bow · ${b.phase === 'bowing' || b.phase === 'thinking' ? 'hold it' : 'eyes on his'}`);
  };
  say('Hippogriffs are proud. Never insult one. Walk up slow, bow, and wait for him to bow back.');
  objective();

  const startRide = () => {
    const lake = places.lake ?? [home.x + 120, 0, home.z - 120];
    const castle = places.castle ?? [home.x + 200, 40, home.z - 400];
    ride = { r: newRide(ridePath({ paddock: home.toArray(), lake, castle }), { speed: 24 }), t: 0 };
    ctx.wand?.visible?.(false); // (both hands in his feathers)
    self.holds = true;
    tell('ride', { on: true });
    say(SAYS.ride);
    sounds.whoosh(1.6);
    objective();
  };

  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const self = {
    over: false,
    holds: false, // (the ride has your body: the walk waits)
    act(down) {
      if (ride || left > 0) return true;
      if (b.phase === 'bowed') {
        if (down) startRide();
        return true;
      }
      bowing = down;
      return true;
    },
    step(dt) {
      t += dt;
      if (ride) {
        ride.t += dt;
        const s = rideAt(ride.r, ride.t);
        // him under you, the wings beating slow, and you on his back
        beast.position.set(s.p[0], s.p[1] - 1.6, s.p[2]);
        e.set(-s.pitch * 0.6, s.yaw, s.bank, 'YXZ');
        beast.quaternion.setFromEuler(e);
        beast.position.y += Math.sin(ride.t * 3.2) * 0.12;
        camera.position.set(s.p[0] - Math.sin(s.yaw) * BACK, s.p[1] + EYE + Math.sin(ride.t * 3.2) * 0.1, s.p[2] - Math.cos(s.yaw) * BACK);
        e.set(-0.12 + s.pitch * 0.5, s.yaw + Math.PI, s.bank * 0.6, 'YXZ');
        camera.quaternion.setFromEuler(e);
        if (Math.floor(ride.t / 1.96) !== Math.floor((ride.t - dt) / 1.96)) sounds.whoosh(0.8);
        if (s.done) {
          ride = null;
          self.holds = false;
          tell('ride', { on: false });
          ctx.wand?.visible?.(true);
          beast.position.copy(home);
          beast.quaternion.identity();
          beast.rotation.y = f.yaw;
          walker?.place?.([f.put(0, 4.5).x, f.put(0, 4.5).z], at.yaw);
          say(SAYS.home);
          ctx.points(BOW.points, 'buckbeak');
          ctx.done();
          left = 4;
          objective();
        }
        return true;
      }
      // how near you are, and how fast you came on
      const me = walker?.state ? [walker.state.x, walker.state.z] : [camera.position.x, camera.position.z];
      const dist = Math.hypot(me[0] - home.x, me[1] - home.z);
      const closing = lastDist == null ? 0 : (lastDist - dist) / Math.max(dt, 1e-3);
      lastDist = dist;
      const r = stepBow(b, { bowing, dist, closing }, dt);
      b = r.bow;
      if (r.what === 'rear') {
        rear = BOW.rear;
        sounds.hit('hit');
        say(SAYS.rear);
      } else if (r.what === 'bowed') {
        nod = 1;
        say(SAYS.bowed);
      } else if (r.what === 'bowing') say(SAYS.bowing);
      else if (r.what === 'wary') say(SAYS.wary);
      if (r.what) objective();
      // your bow: the view dips while you hold it
      bowK += ((bowing ? 1 : 0) - bowK) * Math.min(1, dt * 5);
      if (bowK > 0.001) camera.rotateX(-BOW_DIP * bowK);
      // him: rearing up on his hind legs, or bowing his head back to you
      rear = Math.max(0, rear - dt);
      const up = rear > 0 ? Math.sin(Math.min(1, (BOW.rear - rear) * 3) * Math.PI * 0.5) * 0.5 : 0;
      const down = b.phase === 'bowed' ? Math.min(1, nod) * (0.25 + 0.05 * Math.sin(t * 2)) : 0;
      nod = Math.max(0, nod - dt * 0.3);
      beast.rotation.set(-up + down, f.yaw, 0);
      beast.position.y = home.y + up * 0.6;
      if (left > 0 && (left -= dt) <= 0) self.over = true;
      return bowing;
    },
    // the bot’s: bow when near (the walk is the play’s); up when he’s bowed
    bot(dist) {
      if (b.phase === 'bowed') return !ride && self.act(true);
      bowing = buckbeakBot(b, dist ?? lastDist ?? Infinity);
      return bowing;
    },
    state: () => ({ phase: b.phase, held: Math.round(b.held * 10) / 10, riding: Boolean(ride), t: ride ? Math.round(ride.t) : 0, duration: ride ? Math.round(ride.r.duration) : 0, home: [home.x, home.z].map((v) => Math.round(v * 10) / 10) }),
    dispose() {
      if (ride) {
        tell('ride', { on: false });
        ctx.wand?.visible?.(true);
      }
      scene.remove(group);
      hagrid?.dispose?.();
      post.geometry.dispose();
      beast.traverse((o) => o.geometry?.dispose?.());
    },
  };
  return self;
}
