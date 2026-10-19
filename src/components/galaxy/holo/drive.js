// The galaxy world's side of the holotable (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md):
// ../scene.js asks this each frame whether the map's open on its page (the link, ./link.js, its `holo` prop) and,
// while it is, this draws the holotable (./holoScene.js, loaded the first time) through the post chain in the
// flight's place, and the flight waits. The scene is made once and kept while the galaxy is.
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
      const busy = holo.frame(ms / 1000, now, link, size);
      post.overlay(null);
      post.view(holo.scene, holo.camera);
      viewing = true;
      post.render(size.w, size.h);
      return busy;
    },
    dispose() {
      gone = true;
      if (viewing) post.view(null);
      holo?.dispose();
    },
  };
}
