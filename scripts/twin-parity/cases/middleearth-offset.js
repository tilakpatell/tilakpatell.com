// A texture sliding along its surface (rush/themes/common.js's molten
// channel: tex.offset.y moved each frame) on a plain MeshBasicMaterial, the
// same object on both sides: moved between the frames drawn.
import * as THREE from 'three';

const slide = () => ({ scene, camera }) => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c83a08';
  g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = '#ffdc78';
    g.fillRect(0, y, 64, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat));
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  return { tick: (i) => (tex.offset.y = i * 0.05) };
};

export default {
  'middleearth:offset:slide': { node: slide(), classic: slide() },
};
