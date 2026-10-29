import { describe, expect, it } from 'vitest';
import { optionalPlayPath } from './bf2web-smoke.mjs';

describe('publication smoke optional resources', () => {
  it('allows optional profile and backdrop misses, including a redirected versioned backdrop', () => {
    for (const path of ['/profile/options', '/ui-data/backdrop/main.jpg', '/battlefront/engine/r1035-177d10ea/ui-data/backdrop/main.jpg'])
      expect(optionalPlayPath(path), path).toBe(true);
  });

  it('still rejects missing pages, modules, rulebooks, fonts and unrecognized build resources', () => {
    for (const path of ['/universe', '/ui/main.js', '/ui-data/screens.json', '/export/fonts/font.ttf',
      '/battlefront/engine/b1/index.html', '/battlefront/engine/b1/original-frame-graph.wasm',
      '/battlefront/engine/b1/ui-data/screens.json', '/battlefront/engine/b1/ui/main.js',
      '/battlefront/engine/b1/export/fonts/font.ttf', '/battlefront/engine/b1/profile/options',
      '/battlefront/engine/b1/ui-data/backdrop-private/key', '/battlefront/engine/b1/ui-data/backdrop'])
      expect(optionalPlayPath(path), path).toBe(false);
  });
});
