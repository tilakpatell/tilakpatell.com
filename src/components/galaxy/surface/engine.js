// Where the galaxy's engine meets a surface's post (lane T's Task 3): the
// post the backend can draw, universe/post.js's on the classic renderer
// and nodes/post.js's on the node renderer, for the flip to call in place
// of createPost. (The game's light and the soldier's body, which Task 3
// first wired here behind stubs, are scene.js's own on main: gameLit.js
// and playerBody.js.)
//
//   postFor({ shading, renderer, scene, camera, small, glsl, nodes }) → the post

export function postFor({ shading = 'glsl', renderer, scene, camera, small = false, glsl, nodes }) {
  const make = shading === 'nodes' ? nodes : glsl;
  return make(renderer, scene, camera, { small });
}
