// The Red Book, the world module: Bag End’s study at night, the book on
// the desk, the Palantír and the Ring beside it, on the node renderer
// (docs/superpowers/specs/2026-10-19-the-red-book-design.md). The rules are
// pure files beside this one (book, popup, ring, stone, keep, routes, rig,
// room, valar, score); this file draws them, plays them and hears the page.
//
// Props: { page: a page’s id (?page=), reduced, music (on, unless false) }.
//
// The views: over the book; back in the chair to look round the study
// (‘look’); at the round window looking out (‘window’); in the Palantír
// (‘stone’). The Ring may be held up to look at, put on, or cast in the
// fire, where its letters show.
//
// Events to the page (rt.events): 'page' { index, id, title } as a spread
// lands; 'toy' { page, toy, name, say, who, clip, acts }; 'hover' { name,
// kind } (null when off everything); 'met' { who, name }; 'found' { page,
// name, all }; 'ring' { worn, cooling, held, fire }; 'torn' {}; 'stone' {
// held, eye, seen }; 'dropped' {}; 'room' { id, name, say, clip, sound, told }
// (a thing in the study touched); 'outside' { kind, id, name, title, say,
// clip } (Gandalf, Eru or one of the Valar); 'view' { view }; 'go' { to };
// 'sauron' { text, loud, n, last } (the Eye speaks, held too long);
// 'speak' {}; 'opened' {}; 'menu' {}; 'cover' {}.
// The world adds: turn(±1), goTo(id | index), tap(nx, ny), hover(nx, ny),
// drag(dx, dy) (pixels), wearRing(on?), holdRing(on?), ringToFire(),
// holdStone(on?), setView(view), say(word), setMusic(on), keep, and set
// for the checks. In development, window.__REDBOOK__ = { world, info() }.

import * as THREE from 'three';
import { budget } from '../../../lib/device';
import { WORLD_MB } from '../../worlds/worlds';
import { leaf as leafOf, newBook, open as openOf, pageFromAddress, stepBook, turnTo } from './book';
import { KEEP, allFound, find as findIn, meet, readKeep, touch } from './keep';
import { PAGES } from './pages';
import { canWear, newRing, stepRing, wear } from './ring';
import { newStone, stepStone } from './stone';
import { LOOK_LIMITS, damp, poseFor } from './rig';
import { nextLine, nextView, roomThing } from './room';
import { createMats, canvasMap } from './mats';
import { LOOK } from './look';
import { buildSpread } from './spread';
import { createBook } from './book3d';
import { createStudy } from './study';
import { WINDOW } from './outside';
import { createPalantir, createRing, envArt, RADIUS } from './palantir';
import { createMusic } from './music';
import { LINES, lineFor } from './sauron';

export const KEYS = {
  prev: ['ArrowLeft', 'PageUp'],
  next: ['ArrowRight', 'PageDown'],
  ring: ['KeyR'],
  stone: ['KeyP'],
  fire: ['KeyF'],
  look: ['KeyL'],
  window: ['KeyW'],
  book: ['KeyB'],
  menu: ['Escape'],
};

const STONE_AT = [0.44, 0, -0.06];
const RING_AT = [-0.33, 0, 0.13];
const SIZE = { low: 0.5, mid: 0.75, high: 1 };
const FIRE_FOR = 7; // s the Ring lies in the fire before it is taken out
const KEEP_SPREADS = 4; // spreads kept painted; the oldest go
const HEARTH = new THREE.Vector3(-1.06, -0.6, -0.05); // in the flames
const inHand = new THREE.Vector3();

export default {
  id: 'redbook',
  shading: 'nodes',
  mb: WORLD_MB['/middle-earth'],
  label: 'The Red Book, open on Bilbo’s desk in Bag End',
  create(rt, props = {}) {
    const reduced = Boolean(props.reduced);
    const fit = budget();
    const tier = fit.tier ?? 'high';
    const size = SIZE[tier] ?? 1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080c);
    scene.fog = new THREE.Fog(0x0a0807, 2.6, 5.5);
    // (far enough for the land outside the window and the sky over it)
    const camera = new THREE.PerspectiveCamera(38, 1.6, 0.02, 320);

    const mats = createMats();
    const env = canvasMap(envArt(Math.round(512 * Math.max(0.5, size))));
    env.mapping = THREE.EquirectangularReflectionMapping;
    const study = createStudy({ mats, tier, size, rt });
    const book = createBook({ mats, size });
    const stoneArt = createPalantir({ mats, env });
    stoneArt.group.position.set(...STONE_AT);
    const ringArt = createRing({ mats, env });
    ringArt.group.position.set(...RING_AT);
    scene.add(study.group, book.group, stoneArt.group, ringArt.group);
    // the music, every call to it guarded: a sound that fails is let go, and
    // the picture goes on (a world whose step throws is taken down)
    const score = createMusic(rt, { on: props.music !== false, reduced });
    const music = new Proxy(score, {
      get(target, k) {
        const v = target[k];
        if (typeof v !== 'function') return v;
        return (...args) => {
          try {
            return v.apply(target, args);
          } catch (e) {
            if (import.meta.env?.DEV) console.warn('[redbook] music', k, e);
            return undefined;
          }
        };
      },
    });

    // the post chain on the tiers that bloom: the candles, the fire, the Eye
    let post = null;
    let postReady = false;
    if (fit.bloom >= 1 && rt.gfx?.post) {
      try {
        post = rt.gfx.post([{ kind: 'render', scene, camera }, { kind: 'bloom', strength: LOOK.bloom.strength, radius: LOOK.bloom.radius, threshold: LOOK.bloom.threshold }, { kind: 'output' }]);
        Promise.resolve(post.ready).then(() => (postReady = true), () => (post = null));
      } catch {
        post = null;
      }
    }

    rt.input?.bind?.(KEYS);
    rt.saves?.register?.({ key: KEEP.key, version: KEEP.version });
    let keep = readKeep(rt.saves?.get?.(KEEP.key, null) ?? null);
    const save = () => rt.saves?.set?.(KEEP.key, keep);

    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };

    const asked = pageFromAddress(props.page);
    let bk = newBook({ reduced, page: asked ?? 0, cover: asked != null ? 1 : undefined });
    let ring = newRing();
    let stone = newStone();
    let wantStone = false;
    let view = 'book';
    let ringHeld = false;
    let ringFire = 0;
    let goIn = 0;
    let goWhere = null;
    let dragging = 0; // s since the last drag
    let landed = -1;
    let coverTold = bk.cover >= 1;
    let coverCued = bk.cover >= 1;
    let rose = false; // (the spread coming has been heard to stand)
    let eyeCued = false;
    let spoken = 0; // (how many of the Eye’s lines it has said, this time the stone is held)
    let arrivalBurst = asked == null && !reduced ? 0.9 : -1;
    let frozen = false; // (the checks’: a turn held where set() put it)
    let hoverName = null;
    let ringHover = false;
    let lit = null; // the Vala lit by the mouse
    const eyeLook = [0, 0];
    const counts = {};
    const look = { yaw: 0, pitch: 0, pan: 0 };
    let aspect = 1.6;
    const start = poseFor(bk.cover < 1 ? 'room' : 'book', aspect);
    const pose = { at: [...start.at], look: [...start.look], fov: start.fov };

    // the spreads, built as they are wanted; the few last used are kept
    const spreads = new Map();
    const spreadAt = (i) => {
      if (!spreads.has(i)) {
        spreads.set(i, buildSpread(i, { mats, size }));
        for (const [k, s] of spreads) {
          if (spreads.size <= KEEP_SPREADS) break;
          if (k === i || k === bk.page || k === bk.turning?.from || k === bk.turning?.to || s === book.shown.left || s === book.shown.right) continue;
          s.dispose();
          spreads.delete(k);
        }
      } else {
        // (most recently used last)
        const s = spreads.get(i);
        spreads.delete(i);
        spreads.set(i, s);
      }
      return spreads.get(i);
    };

    // which spreads show where, the cover, the leaf, how open each stands
    const lay = () => {
      book.setCover(bk.cover);
      const tr = bk.turning;
      if (!tr) {
        const s = spreadAt(bk.page);
        book.show('left', s);
        book.show('right', s);
        book.setLeaf(null);
        s.set(openOf(bk));
        return;
      }
      const from = spreadAt(tr.from);
      const to = spreadAt(tr.to);
      const forward = tr.to > tr.from;
      const lt = leafOf(bk);
      from.set(openOf(bk, 'from'));
      to.set(openOf(bk, 'to'));
      // (while the spread going folds, it is all there is; then the leaf
      // lifts off it and the spread coming shows under the leaf, its own
      // side first and the other side once the leaf is over)
      if (lt <= 0) {
        book.show('left', from);
        book.show('right', from);
        book.setLeaf(null);
        return;
      }
      const over = lt > 0.5;
      book.show(forward ? 'right' : 'left', to);
      book.show(forward ? 'left' : 'right', over ? to : from);
      if (forward) book.setLeaf(lt, from, to);
      else book.setLeaf(1 - lt, to, from);
    };

    // what a tap or a hover hits, in the view it is in
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const seen = (o) => {
      for (let x = o; x; x = x.parent) if (!x.visible) return false;
      return true;
    };
    const hitAt = (nx, ny) => {
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, camera);
      if (wantStone) return ray.intersectObject(stoneArt.stone, false)[0] ?? null;
      if (view === 'window') return ray.intersectObjects([study.outside.gandalf, study.outside.eru, study.outside.sky], false)[0] ?? null;
      const s = bk.turning ? null : spreadAt(bk.page);
      const targets = [stoneArt.stone, ringArt.band, ...study.things];
      if (bk.cover < 1) targets.push(book.halves.face);
      if (s) {
        if (view === 'book') targets.push(...s.pickable.filter(seen));
        targets.push(...[...s.left.children, ...s.right.children].filter((o) => o.userData.ground));
      }
      return ray.intersectObjects(targets, false).filter((h) => seen(h.object))[0] ?? null;
    };
    const describe = (hit) => {
      const o = hit?.object;
      if (!o) return null;
      if (view === 'window') {
        const p = study.outside.pick(hit);
        return p ? { ...p, name: p.item.name, title: p.item.title } : null;
      }
      if (o.userData.stone) return { kind: 'stone', name: 'The Palantír' };
      if (o.userData.ring) return { kind: 'ring', name: 'The One Ring' };
      if (o.userData.cover) return { kind: 'cover', name: 'The Red Book' };
      if (o.userData.room) return { kind: 'room', id: o.userData.room, index: o.userData.index, name: roomThing(o.userData.room)?.name ?? null };
      if (o.userData.ground) return view === 'book' ? { kind: 'ground', side: o.userData.ground, name: null } : { kind: 'book', name: 'The Red Book' };
      const s = spreadAt(bk.page);
      const st = s.pieceOf(o.userData.piece);
      if (!st) return null;
      const page = PAGES[bk.page];
      if (st.spec.find) return { kind: 'find', st, name: page.find.name };
      const toy = page.toys.find((t) => t.id === st.spec.toy);
      return { kind: 'toy', st, toy, name: toy?.name ?? null };
    };

    const playToy = (st, toy) => {
      const page = PAGES[bk.page];
      const s = spreadAt(bk.page);
      const acts = s.act(st.spec.id, st.spec.does ?? []);
      keep = touch(keep, page.id, toy.id);
      if (toy.who && !keep.met.includes(toy.who)) {
        keep = meet(keep, toy.who);
        tell('met', { who: toy.who, name: toy.name });
        music.cue('met');
      }
      save();
      tell('toy', { page: page.id, toy: toy.id, name: toy.name, say: toy.say, who: toy.who ?? null, clip: toy.clip ?? null, acts });
    };

    const ringState = () => tell('ring', { worn: ring.worn, cooling: ring.cooldown > 0, held: ringHeld, fire: ringFire > 0 });
    const setView = (v) => {
      if (v === view) return;
      if (wantStone) holdStone(false);
      view = v;
      look.yaw = 0;
      look.pitch = 0;
      music.page(v === 'window' ? 'havens' : (PAGES[bk.page]?.id ?? 'met'));
      if (v !== 'window') study.outside.light(null, false);
      else study.outside.wake();
      tell('view', { view });
    };
    const holdStone = (on = !wantStone) => {
      if (on && stone.rest > 0) return;
      if (on === wantStone) return;
      wantStone = on;
      if (on) {
        ringHeld = false;
        eyeCued = false;
      }
      spoken = 0;
      music.cue(on ? 'stone-up' : 'stone-down');
      tell('stone', { held: on, eye: 0, seen: 0 });
    };
    const playRoom = (d) => {
      const thing = roomThing(d.id);
      if (!thing) return;
      counts[d.id] = (counts[d.id] ?? 0) + 1;
      const told = study.act(d.id, d.index ?? 0);
      if (thing.act === 'window') setView('window');
      if (thing.to) {
        goIn = thing.act === 'door' ? 1.4 : 0.7;
        goWhere = thing.to;
      }
      tell('room', { id: thing.id, name: thing.name, say: nextLine(thing, counts[d.id] - 1), clip: thing.clip ?? null, sound: thing.sound ?? null, told });
    };

    const world = {
      ready: rt.gfx?.compile?.(scene, camera),
      scene,
      resize(w, h) {
        aspect = w / Math.max(1, h);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        if (pressed('prev') || pressed('next') || pressed('ring') || pressed('stone') || pressed('look') || pressed('window')) music.wake();
        if (pressed('prev')) world.turn(-1);
        if (pressed('next')) world.turn(1);
        if (pressed('ring')) ringHeld ? world.wearRing(true) : world.wearRing();
        if (pressed('fire') && ringHeld) world.ringToFire();
        if (pressed('stone')) holdStone();
        for (const k of ['look', 'window', 'book']) if (pressed(k)) setView(nextView(view, KEYS[k][0]));
        if (pressed('menu')) {
          if (wantStone) holdStone(false);
          else if (ringHeld) world.holdRing(false);
          else if (view !== 'book') setView('book');
          else tell('menu');
        }

        // the book
        if (!frozen) bk = stepBook(bk, dt);
        if (!coverCued && bk.cover > 0) {
          coverCued = true;
          music.cue('cover');
        }
        if (!coverTold && bk.cover >= 1) {
          coverTold = true;
          tell('cover');
          music.page(PAGES[bk.page]?.id ?? null);
        }
        if (bk.turning && !rose && bk.turning.t > 0.7) {
          rose = true;
          music.cue('rise');
        }
        if (!bk.turning && bk.page !== landed) {
          landed = bk.page;
          const p = PAGES[bk.page];
          const id = p?.id ?? (bk.page === PAGES.length ? 'met' : 'kept');
          tell('page', { index: bk.page, id, title: p?.title ?? null });
          if (bk.cover >= 1 && view !== 'window') music.page(id);
        }
        // the dragon goes up once the Shire has grown, the first time
        if (arrivalBurst > 0 && bk.cover >= 1 && bk.page === 0 && !bk.turning) {
          arrivalBurst -= dt;
          if (arrivalBurst <= 0) spreadAt(0).act('dragon', [{ act: 'burst', colour: '#9cff7a' }, { act: 'fly' }]);
        }

        // the Ring: worn, held, or in the fire
        const r = stepRing(ring, dt);
        if (r.torn) {
          tell('torn');
          music.cue('ring-off');
        }
        if (r.worn !== ring.worn || (ring.cooldown > 0) !== (r.cooldown > 0)) {
          ring = r;
          ringState();
        } else ring = r;
        mats.uVision.value = ring.vision;
        if (ringFire > 0 && (ringFire -= dt) <= 0) {
          ringFire = 0;
          ringState();
        }

        // the stone
        const s2 = stepStone(stone, dt, { held: wantStone });
        if (s2.dropped) {
          wantStone = false;
          // (the Eye saw you: it comes closer to the Ring too)
          ring = { ...ring, dread: Math.min(0.9, ring.dread + 0.35) };
          tell('dropped');
          tell('stone', { held: false, eye: 0, seen: 0 });
          music.cue('eye');
        }
        if (s2.held && (Math.round(s2.seen * 10) !== Math.round(stone.seen * 10) || (s2.eye >= 1) !== (stone.eye >= 1))) tell('stone', { held: true, eye: s2.eye, seen: s2.seen });
        stone = s2;
        if (stone.eye > 0.5 && !eyeCued) {
          eyeCued = true;
          music.cue('eye');
        }
        // and, held too long, it speaks
        if (stone.held) {
          const n = lineFor(stone.gaze, spoken);
          if (n >= 0) {
            spoken = n + 1;
            tell('sauron', { text: LINES[n].text, loud: LINES[n].loud, n, last: n === LINES.length - 1 });
          }
        }

        // going out of the room, a door or the map
        if (goIn > 0 && (goIn -= dt) <= 0) {
          tell('go', { to: goWhere });
          goWhere = null;
        }

        // the drawing
        lay();
        for (const sp of new Set([book.shown.left, book.shown.right])) sp?.tick(dt, ring.vision);
        study.tick(dt, { dread: ring.dread, vision: ring.vision, camera, view });
        stoneArt.tick(dt, { held: stone.held, eye: stone.eye, seen: stone.seen, look: eyeLook, camera, reduced });
        const carry = ringHeld ? camera.localToWorld(inHand.set(0.06, 0.02, -0.17)) : ringFire > 0 ? HEARTH : null;
        ringArt.tick(dt, { hover: ringHover, worn: ring.worn, held: ringHeld, heat: ringFire > 0 ? 1 : ringHeld ? 0.35 : ringHover ? 0.08 : 0, camera, at: carry });
        music.update(dt, { vision: ring.vision, dread: ring.dread, stone: stone.held ? 1 : 0, eye: stone.eye * (0.6 + 0.4 * stone.seen) });

        // the camera: the room, the book, round the room, the window, or the stone
        const mode = stone.held || wantStone ? 'stone' : view !== 'book' ? view : bk.cover < 1 && bk.rest > 0 ? 'room' : 'book';
        const want = poseFor(mode, aspect, { stone: [STONE_AT[0], STONE_AT[1] + 0.075 + RADIUS, STONE_AT[2]], window: [WINDOW.x, WINDOW.y, WINDOW.z] });
        // (in the stone, the head goes nearer as the Eye fixes on it, toward the Eye up over the tower)
        if (mode === 'stone') {
          want.fov -= stone.seen * 8;
          want.look[1] += RADIUS * 0.3 * stone.eye;
        }
        const rate = mode === 'book' && bk.cover < 1 ? 0.9 : mode === 'look' ? 1.6 : 2.2;
        pose.at = damp(pose.at, want.at, dt, rate, reduced);
        pose.look = damp(pose.look, want.look, dt, rate, reduced);
        pose.fov += (want.fov - pose.fov) * (reduced ? 1 : 1 - Math.exp(-rate * dt));
        // the visitor’s look, settling back once let go where the view settles
        dragging += dt;
        const limits = LOOK_LIMITS[mode] ?? LOOK_LIMITS.book;
        if (dragging > 0.4 && limits.settles) {
          look.yaw *= Math.exp(-3 * dt);
          look.pitch *= Math.exp(-3 * dt);
          if (aspect >= 0.9) look.pan *= Math.exp(-3 * dt);
        }
        camera.position.set(...pose.at);
        camera.position.x += look.pan;
        if (mode === 'stone' && stone.seen > 0 && !reduced) {
          const k = stone.seen * 0.0025;
          camera.position.x += Math.sin(performance.now() * 0.031) * k;
          camera.position.y += Math.sin(performance.now() * 0.027 + 1) * k;
        }
        camera.lookAt(pose.look[0] + look.pan, pose.look[1], pose.look[2]);
        camera.rotateY(look.yaw);
        camera.rotateX(look.pitch);
        if (Math.abs(camera.fov - pose.fov) > 0.01) {
          camera.fov = pose.fov;
          camera.updateProjectionMatrix();
        }
      },
      draw(f) {
        if (post && postReady) post.render();
        else (f?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
      anchor: () => camera.position.toArray(),
      lowerQuality(level) {
        if (level >= 1) post = null;
        study.lower(level);
      },
      update() {},
      attached() {
        const was = held ?? [];
        held = null;
        for (const [type, data] of was) rt.events?.emit?.(type, data);
        ringState();
      },

      // the page’s calls
      turn(dir) {
        music.wake();
        if (wantStone) return;
        if (view !== 'book') setView('book');
        const at = bk.turning ? (bk.queued ?? bk.turning.to) : bk.page;
        const before = bk.turning;
        bk = turnTo(bk.cover < 1 ? { ...bk, cover: 1, rest: 0 } : bk, at + Math.sign(dir));
        if (bk.turning && bk.turning !== before) {
          rose = false;
          music.cue('turn');
        }
      },
      goTo(id) {
        const i = typeof id === 'number' ? id : pageFromAddress(id);
        if (i == null) return;
        music.wake();
        if (wantStone) holdStone(false);
        if (view !== 'book') setView('book');
        const before = bk.turning;
        bk = turnTo(bk.cover < 1 ? { ...bk, cover: 1, rest: 0 } : bk, i);
        if (bk.turning && bk.turning !== before) {
          rose = false;
          music.cue('turn');
        }
      },
      tap(nx, ny) {
        music.wake();
        const hit = hitAt(nx, ny);
        const d = describe(hit);
        if (wantStone) {
          if (!d) holdStone(false);
          return d;
        }
        if (ringHeld && d?.kind !== 'ring') {
          world.holdRing(false);
          return d;
        }
        if (!d) return null;
        if (view === 'window') {
          study.outside.act(d.id);
          tell('outside', { kind: d.kind, id: d.id, name: d.item.name, title: d.item.title, say: d.item.say, clip: d.item.clip ?? null });
          if (d.kind === 'eru') music.cue('met');
          else if (d.kind === 'vala') music.cue('find');
          return d;
        }
        if (d.kind === 'stone') holdStone(true);
        else if (d.kind === 'ring') world.holdRing(!ringHeld);
        else if (d.kind === 'cover') bk = { ...bk, rest: 0 };
        else if (d.kind === 'book') setView('book');
        else if (d.kind === 'room') playRoom(d);
        else if (d.kind === 'ground') world.turn(d.side === 'left' ? -1 : 1);
        else if (d.kind === 'find') {
          if (ring.vision > 0.5) {
            const page = PAGES[bk.page];
            if (!keep.found.includes(page.id)) {
              keep = findIn(keep, page.id);
              save();
              tell('found', { page: page.id, name: page.find.name, all: allFound(keep) });
              music.cue('find');
            }
          }
        } else if (d.kind === 'toy' && d.toy) playToy(d.st, d.toy);
        return d;
      },
      hover(nx, ny) {
        if (nx != null && wantStone) {
          eyeLook[0] = nx;
          eyeLook[1] = ny;
        }
        const d = nx == null ? null : describe(hitAt(nx, ny));
        ringHover = d?.kind === 'ring';
        if (view === 'window') {
          const id = d?.kind === 'vala' || d?.kind === 'eru' ? d.id : null;
          if (id !== lit) {
            lit = id;
            study.outside.light(id, true);
          }
        }
        const name = d ? (d.title ? `${d.name}, ${d.title}` : d.name) : null;
        if (name !== hoverName) {
          hoverName = name;
          tell('hover', { name, kind: d?.kind ?? null });
        }
        return d;
      },
      // a drag, in pixels: turns the head, or the Eye’s gaze while the stone is held
      drag(dx, dy) {
        dragging = 0;
        music.wake();
        if (wantStone) {
          eyeLook[0] = Math.max(-1, Math.min(1, eyeLook[0] + dx / 300));
          eyeLook[1] = Math.max(-1, Math.min(1, eyeLook[1] - dy / 300));
          return;
        }
        const mode = view !== 'book' ? view : 'book';
        const lim = LOOK_LIMITS[mode] ?? LOOK_LIMITS.book;
        const k = mode === 'look' ? 0.0028 : 0.0012;
        if (aspect < 0.9 && mode === 'book') look.pan = Math.max(-0.12, Math.min(0.12, look.pan - dx * 0.0006));
        else look.yaw = Math.max(-lim.yaw, Math.min(lim.yaw, look.yaw - dx * k));
        look.pitch = Math.max(-lim.pitch, Math.min(lim.pitch, look.pitch - dy * k));
      },
      wearRing(on = !ring.worn) {
        music.wake();
        if (on && !canWear(ring)) return;
        if (on === ring.worn) return;
        ring = wear(ring, on);
        ringHeld = false;
        ringFire = 0;
        music.cue(on ? 'ring-on' : 'ring-off');
        ringState();
      },
      holdRing(on = !ringHeld) {
        music.wake();
        if (ring.worn || ringFire > 0) return;
        if (on && wantStone) holdStone(false);
        ringHeld = Boolean(on);
        ringState();
      },
      // into the hearth: the fire-letters come up on the band, as Gandalf showed Frodo
      ringToFire() {
        if (ring.worn) return;
        ringHeld = false;
        ringFire = FIRE_FOR;
        // (round to the hearth, to watch it)
        if (wantStone) holdStone(false);
        setView('look');
        look.yaw = 0.95;
        look.pitch = -0.38;
        ringState();
        tell('room', { id: 'ring-fire', name: 'The One Ring, in the fire', say: 'Letters of fire come up on the band, in the tongue of Mordor. Gandalf will not say them aloud here.', clip: 'oneRing', sound: null, told: [] });
      },
      holdStone,
      setView(v) {
        music.wake();
        if (['book', 'look', 'window'].includes(v)) setView(v);
      },
      // the word at the Doors of Durin
      say(word) {
        const w = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '');
        if (w !== 'mellon' || PAGES[bk.page]?.id !== 'moria') return false;
        spreadAt(bk.page).act('moon', [{ act: 'show', target: ['cliff-lit'] }]);
        tell('opened');
        return true;
      },
      setMusic(on) {
        music.setOn(on);
      },
      get keep() {
        return keep;
      },
      get page() {
        return bk.page;
      },
      get ring() {
        return ring;
      },
      get stone() {
        return stone;
      },
      get view() {
        return view;
      },
      // (the checks’: open the book at a page at once, the Ring on or off, the stone up, a view)
      set({ page, worn, stone: up, turning, view: v, ringHeld: rh, ringFire: rf, gaze } = {}) {
        frozen = false;
        if (turning) {
          const [from, to, t] = turning;
          bk = { ...newBook({ reduced: true, page: from }), reduced, turning: { from, to, t } };
          frozen = true;
        }
        if (page != null) {
          const i = typeof page === 'number' ? page : pageFromAddress(page);
          if (i != null) bk = { ...newBook({ reduced: true, page: i }), reduced };
        }
        if (worn != null) {
          ring = { ...wear(ring, worn), vision: worn ? 1 : 0 };
          ringState();
        }
        if (up != null) holdStone(up);
        if (gaze != null && wantStone) {
          stone = { ...stone, held: true, gaze, eye: 1, seen: Math.max(0, (gaze - 8) / 6) };
          tell('stone', { held: true, eye: stone.eye, seen: stone.seen });
        }
        if (v) setView(v);
        if (rh != null) world.holdRing(rh);
        if (rf) world.ringToFire();
        arrivalBurst = -1;
      },
      dispose() {
        rt.input?.unbind?.();
        save();
        music.dispose();
        for (const s of spreads.values()) s.dispose();
        spreads.clear();
        study.dispose();
        book.dispose();
        stoneArt.dispose();
        ringArt.dispose();
        mats.dispose();
        env.dispose();
        post?.dispose?.();
        if (typeof window !== 'undefined' && window.__REDBOOK__?.world === world) delete window.__REDBOOK__;
      },
    };
    lay();
    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      const info = () => {
        const r = rt.gfx?.renderer?.info?.render ?? {};
        return { calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0, page: bk.page, spreads: spreads.size, vision: ring.vision, dread: ring.dread, view, tier, music: music.stats() };
      };
      window.__REDBOOK__ = { world, info };
    }
    return world;
  },
};
