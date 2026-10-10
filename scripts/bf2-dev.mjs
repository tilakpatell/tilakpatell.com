// The Battlefront world's dev backend (src/components/battlefront/assets.js):
// with BF2_ROOT set, the dev server answers /bf2/<path> from the local
// export's web build, <BF2_ROOT>/web_opt (the owner's machine) or
// <BF2_ROOT>/web (a cloud session's lab/assets/bf2017, as
// scripts/bf2017-fetch.mjs lays it out). Nothing is copied and nothing is
// built: with BF2_ROOT unset the plugin does nothing.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = { '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.glb': 'model/gltf-binary', '.png': 'image/png', '.ktx2': 'image/ktx2', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.bin': 'application/octet-stream' };

// the web build under a root: web_opt where the export has it, else web
export function webRoot(root) {
  if (!root) return null;
  const opt = resolve(root, 'web_opt');
  return existsSync(opt) ? opt : resolve(root, 'web');
}

// a request's file under the web root, or null for anything outside it
export function fileFor(web, url) {
  const path = decodeURIComponent(url.split('?')[0]).replace(/^\/bf2\//, '');
  const file = normalize(join(web, path));
  return file.startsWith(web + sep) ? file : null;
}

export default function bf2Dev(root = process.env.BF2_ROOT) {
  const web = webRoot(root);
  return {
    name: 'bf2-dev',
    apply: 'serve',
    configureServer(server) {
      if (!web) return;
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/bf2/')) return next();
        const file = fileFor(web, req.url);
        if (!file || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}
