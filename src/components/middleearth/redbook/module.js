// The Red Book, the world module: Bag End’s study at night, the book on
// the desk, the Palantír and the Ring beside it, on the node renderer
// (docs/superpowers/specs/2026-10-19-the-red-book-design.md). The rules are
// pure files beside this one (book, popup, ring, stone, keep, routes, rig);
// this file draws them and hears the page.
//
// Props: { page: a page’s id (?page=), reduced }.
//
// Events to the page (rt.events): 'page' { index, id, title } as a spread
// lands; 'toy' { page, toy, name, say, who, clip, acts }; 'hover' { name }
// (null when off everything); 'met' { who, name }; 'found' { page, name,
// all }; 'ring' { worn, cooling }; 'torn' {}; 'stone' { held, looked:
// { id, name, page, to } | null }; 'dropped' {}; 'go' { to } (a place with
// no page, or a pin’s game); 'speak' {} (the Doors ask for the word);
// 'opened' {} (the word was right); 'menu' {}; 'cover' {} (the book is open).
// The world adds: turn(±1), goTo(id | index), tap(nx, ny), hover(nx, ny),
// drag(dx, dy) (pixels), wearRing(on?), holdStone(on?), stoneGo(), say(word),
// keep (what is kept), and set for the checks.
// In development, window.__REDBOOK__ = { world, info() }.

import * as THREE from 'three';
import { budget } from '../../../lib/device';
import { WORLD_MB } from '../../worlds/worlds';
import { leaf as leafOf, newBook, open as openOf, pageFromAddress, stepBook, turnTo } from './book';
import { KEEP, allFound, find as findIn, meet, readKeep, touch } from './keep';
import { PAGES } from './pages';
import { canWear, newRing, stepRing, wear } from './ring';
import { newStone, nearest, stepStone } from './stone';
import { PINS, goFor } from './routes';
import { damp, poseFor } from './rig';
import { createMats } from './mats';
import { LOOK } from './look';
import { buildSpread } from './spread';
import { createBook } from './book3d';
import { createStudy } from './study';
import { createPalantir, createRing, RADIUS } from './palantir';

export const KEYS = {
  prev: ['ArrowLeft', 'PageUp'],
  next: ['ArrowRight', 'PageDown'],
  ring: ['KeyR'],
  stone: ['KeyP'],
  menu: ['Escape'],
};

const STONE_AT = [0.44, 0, -0.06];
const RING_AT = [-0.33, 0, 0.13];
const LOOK_LIMIT = 0.12; // rad a drag turns the view
const SIZE = { low: 0.5, mid: 0.75, high: 1 };

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
    scene.fog = new THREE.Fog(0x07080c, 2.2, 4.5);
    const camera = new THREE.PerspectiveCamera(38, 1.6, 0.02, 10);

    const mats = createMats();
    const study = createStudy({ mats, tier, size });
    const book = createBook({ mats, size });
    const stoneArt = createPalantir({ mats, size });
    stoneArt.group.position.set(...STONE_AT);
    const ringArt = createRing({ mats });
    ringArt.group.position.set(...RING_AT);
    scene.add(study.group, book.group, stoneArt.group, ringArt.group);

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
    let dragging = 0; // s since the last drag
    let landed = -1;
    let coverTold = bk.cover >= 1;
    let arrivalBurst = asked == null && !reduced ? 0.9 : -1;
    let looked = null;
    let hoverName = null;
    let ringHover = false;
    const look = { yaw: 0, pitch: 0, pan: 0 };
    let aspect = 1.6;
    const pose = { at: [...poseFor(bk.cover < 1 ? 'room' : 'book', aspect).at], look: [...poseFor(bk.cover < 1 ? 'room' : 'book', aspect).look], fov: 38 };

    // the spreads, built as they are wanted and kept
    const spreads = new Map();
    const spreadAt = (i) => {
      if (!spreads.has(i)) spreads.set(i, buildSpread(i, { mats, size }));
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

    // what a tap or a hover hits: the stone, the Ring, the cover, a piece, a page
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const seen = (o) => {
      for (let x = o; x; x = x.parent) if (!x.visible) return false;
      return true;
    };
    const hitAt = (nx, ny) => {
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, camera);
      const s = bk.turning ? null : spreadAt(bk.page);
      const targets = [stoneArt.stone, ringArt.band];
      if (bk.cover < 1) targets.push(book.halves.face);
      if (s) {
        targets.push(...s.pickable.filter(seen));
        targets.push(...[...s.left.children, ...s.right.children].filter((o) => o.userData.ground));
      }
      const hits = ray.intersectObjects(targets, false).filter((h) => seen(h.object));
      return hits[0]?.object ?? null;
    };
    const describe = (o) => {
      if (!o) return null;
      if (o.userData.stone) return { kind: 'stone', name: 'The Palantír' };
      if (o.userData.ring) return { kind: 'ring', name: ring.worn ? 'Take off the Ring' : 'The One Ring' };
      if (o.userData.cover) return { kind: 'cover', name: 'The Red Book' };
      if (o.userData.ground) return { kind: 'ground', side: o.userData.ground, name: null };
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
      }
      save();
      tell('toy', { page: page.id, toy: toy.id, name: toy.name, say: toy.say, who: toy.who ?? null, clip: toy.clip ?? null, acts });
    };

    const holdStone = (on = !wantStone) => {
      if (on && stone.rest > 0) return;
      wantStone = on;
      if (!on) looked = null;
      tell('stone', { held: on, looked });
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
        if (pressed('prev')) world.turn(-1);
        if (pressed('next')) world.turn(1);
        if (pressed('ring')) world.wearRing();
        if (pressed('stone')) holdStone();
        if (pressed('menu')) {
          if (wantStone) holdStone(false);
          else tell('menu');
        }

        // the book
        bk = stepBook(bk, dt);
        if (!coverTold && bk.cover >= 1) {
          coverTold = true;
          tell('cover');
        }
        if (!bk.turning && bk.page !== landed) {
          landed = bk.page;
          const p = PAGES[bk.page];
          tell('page', { index: bk.page, id: p?.id ?? (bk.page === PAGES.length ? 'met' : 'kept'), title: p?.title ?? null });
        }
        // the dragon goes up once the Shire has grown, the first time
        if (arrivalBurst > 0 && bk.cover >= 1 && bk.page === 0 && !bk.turning) {
          arrivalBurst -= dt;
          if (arrivalBurst <= 0) spreadAt(0).act('dragon', [{ act: 'burst', colour: '#9cff7a' }, { act: 'fly' }]);
        }

        // the Ring
        const r = stepRing(ring, dt);
        if (r.torn) tell('torn');
        if (r.worn !== ring.worn || (ring.cooldown > 0) !== (r.cooldown > 0)) tell('ring', { worn: r.worn, cooling: r.cooldown > 0 });
        ring = r;
        mats.uVision.value = ring.vision;

        // the stone
        dragging += dt;
        const s2 = stepStone(stone, dt, { held: wantStone, turning: dragging < 0.25 });
        if (s2.dropped) {
          wantStone = false;
          looked = null;
          // (the Eye saw you: it comes closer to the Ring too)
          ring = { ...ring, dread: Math.min(0.9, ring.dread + 0.35) };
          tell('dropped');
          tell('stone', { held: false, looked: null });
        }
        stone = s2;
        if (stone.held) {
          const pin = nearest(PINS, stoneArt.centre, 45);
          if ((pin?.id ?? null) !== (looked?.id ?? null)) {
            looked = pin ? { id: pin.id, name: pin.name, page: pin.page, to: pin.to } : null;
            tell('stone', { held: true, looked });
          }
        }

        // the drawing
        lay();
        for (const sp of new Set([book.shown.left, book.shown.right])) sp?.tick(dt, ring.vision);
        study.tick(dt, { dread: ring.dread, vision: ring.vision });
        stoneArt.tick(dt, { held: stone.held, eye: stone.eye, looked, camera, reduced });
        ringArt.tick(dt, { hover: ringHover, worn: ring.worn });

        // the camera: the room, then the book, or the stone
        const mode = stone.held || wantStone ? 'stone' : bk.cover < 1 && bk.rest > 0 ? 'room' : 'book';
        const stoneCentre = [STONE_AT[0], STONE_AT[1] + 0.06 + RADIUS, STONE_AT[2]];
        const want = poseFor(mode, aspect, { stone: stoneCentre });
        const rate = mode === 'book' && bk.cover < 1 ? 0.9 : 2.2;
        pose.at = damp(pose.at, want.at, dt, rate, reduced);
        pose.look = damp(pose.look, want.look, dt, rate, reduced);
        pose.fov += (want.fov - pose.fov) * (reduced ? 1 : 1 - Math.exp(-rate * dt));
        // the visitor’s look, settling back once let go
        if (dragging > 0.4) {
          look.yaw *= Math.exp(-3 * dt);
          look.pitch *= Math.exp(-3 * dt);
          if (aspect >= 0.9) look.pan *= Math.exp(-3 * dt);
        }
        camera.position.set(...pose.at);
        camera.position.x += look.pan;
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
        tell('ring', { worn: ring.worn, cooling: false });
      },

      // the page’s calls
      turn(dir) {
        if (wantStone) return;
        const at = bk.turning ? (bk.queued ?? bk.turning.to) : bk.page;
        bk = turnTo(bk.cover < 1 ? { ...bk, cover: 1, rest: 0 } : bk, at + Math.sign(dir));
      },
      goTo(id) {
        const i = typeof id === 'number' ? id : pageFromAddress(id);
        if (i == null) return;
        if (wantStone) holdStone(false);
        bk = turnTo(bk.cover < 1 ? { ...bk, cover: 1, rest: 0 } : bk, i);
      },
      tap(nx, ny) {
        const o = hitAt(nx, ny);
        const d = describe(o);
        if (wantStone) {
          if (d?.kind === 'stone') world.stoneGo();
          else holdStone(false);
          return d;
        }
        if (!d) return null;
        if (d.kind === 'stone') holdStone(true);
        else if (d.kind === 'ring') world.wearRing();
        else if (d.kind === 'cover') bk = { ...bk, rest: 0 };
        else if (d.kind === 'ground') world.turn(d.side === 'left' ? -1 : 1);
        else if (d.kind === 'find') {
          if (ring.vision > 0.5) {
            const page = PAGES[bk.page];
            if (!keep.found.includes(page.id)) {
              keep = findIn(keep, page.id);
              save();
              tell('found', { page: page.id, name: page.find.name, all: allFound(keep) });
            }
          }
        } else if (d.kind === 'toy' && d.toy) playToy(d.st, d.toy);
        return d;
      },
      hover(nx, ny) {
        const d = nx == null ? null : describe(hitAt(nx, ny));
        ringHover = d?.kind === 'ring';
        const name = d?.name ?? null;
        if (name !== hoverName) {
          hoverName = name;
          tell('hover', { name, kind: d?.kind ?? null });
        }
        return d;
      },
      // a drag, in pixels: turns the stone’s map while it is held, or the view
      drag(dx, dy) {
        dragging = 0;
        if (wantStone) {
          stoneArt.pan(dx / 220, dy / 220);
          return;
        }
        if (aspect < 0.9) look.pan = Math.max(-0.12, Math.min(0.12, look.pan - dx * 0.0006));
        else look.yaw = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, look.yaw - dx * 0.0012));
        look.pitch = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, look.pitch - dy * 0.0012));
      },
      wearRing(on = !ring.worn) {
        if (on && !canWear(ring)) return;
        ring = wear(ring, on);
        tell('ring', { worn: ring.worn, cooling: ring.cooldown > 0 });
      },
      holdStone,
      stoneGo() {
        if (!looked) return;
        const go = goFor(looked);
        holdStone(false);
        if (go.page) world.goTo(go.page);
        else tell('go', { to: go.to });
      },
      // the word at the Doors of Durin
      say(word) {
        const w = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '');
        if (w !== 'mellon' || PAGES[bk.page]?.id !== 'moria') return false;
        spreadAt(bk.page).act('moon', [{ act: 'show', target: ['cliff-lit'] }]);
        tell('opened');
        return true;
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
      // (the checks’: open the book at a page at once, the Ring on or off, the stone up)
      set({ page, worn, stone: up } = {}) {
        if (page != null) {
          const i = typeof page === 'number' ? page : pageFromAddress(page);
          if (i != null) bk = { ...newBook({ reduced: true, page: i }), reduced };
        }
        if (worn != null) ring = { ...wear(ring, worn), vision: worn ? 1 : 0 };
        if (up != null) holdStone(up);
        arrivalBurst = -1;
      },
      dispose() {
        rt.input?.unbind?.();
        save();
        for (const s of spreads.values()) s.dispose();
        spreads.clear();
        study.dispose();
        book.dispose();
        stoneArt.dispose();
        ringArt.dispose();
        mats.dispose();
        post?.dispose?.();
        if (typeof window !== 'undefined' && window.__REDBOOK__?.world === world) delete window.__REDBOOK__;
      },
    };
    lay();
    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      const info = () => {
        const r = rt.gfx?.renderer?.info?.render ?? {};
        return { calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0, page: bk.page, spreads: spreads.size, vision: ring.vision, dread: ring.dread, tier };
      };
      window.__REDBOOK__ = { world, info };
    }
    return world;
  },
};
