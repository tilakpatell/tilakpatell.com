// The cast viewer, as a world module on the runtime (avengers/hq/module.js).
import { hqModule } from '../../avengers/shared/runtime';

export default hqModule({
  id: 'invincible-viewer',
  route: '/invincible',
  load: () => import('./scene').then((m) => m.create),
});
