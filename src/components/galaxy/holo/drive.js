// The galaxy world's side of the holotable (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md):
// ../scene.js asks this each frame whether the map's open on its page (the link, ./link.js, its `holo` prop) and,
// while it is, this draws the holotable (./holoScene.js, loaded the first time) through the post chain in the
// flight's place, and the flight waits. The scene is made once and kept while the galaxy is.
//
// The map is drawn at the renderer's whole sharpness, whatever the flight's pace has softened its passes to: it's a
// light scene, and its lines and names are what blur first. Nor does it wear the flight's moment: a boost's rush, a
// hit's red edge or a flare's glow, which the flight sets each of its own frames and would otherwise leave standing.
//
//   createHoloDriver({ post, small, reduced, invalidate }) → { frame(ms, now, link, size) → null | busy, dispose }
//     frame's answer: null while the flight's to be drawn (the map's shut, or the holotable's still loading), else
//     whether it wants another frame

export function createHoloDriver({ post, small = false, reduced = false, invalidate = () => {} }) {
  let holo = null;
  let loading = null;
  let viewing = false;
  let gone = false;
  return {
    frame(ms, now, link, size) {
      if (link && link.wake !== invalidate) link.wake = invalidate;
      if (!link?.open) {
        if (viewing) (post.view(null), (viewing = false));
        return null;
      }
      if (!holo) {
        loading ??= import('./holoScene').then((m) => {
          if (!gone) holo = m.createHoloScene({ small, reduced });
          invalidate();
        });
        return null;
      }
      // (the flight's sharpness put back after, so its own frames draw as its pace has them)
      const sharp = post.sharpness;
      post.sharpness = 1;
      const busy = holo.frame(ms / 1000, now, link, size, post.ratio);
      post.overlay(null);
      post.view(holo.scene, holo.camera);
      viewing = true;
      post.rush(0);
      post.hit(0);
      post.flare(1);
      post.render(size.w, size.h);
      post.sharpness = sharp;
      return busy;
    },
    dispose() {
      gone = true;
      if (viewing) post.view(null);
      holo?.dispose();
    },
  };
}
