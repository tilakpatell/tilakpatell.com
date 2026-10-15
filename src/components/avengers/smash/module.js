// Smash Run, Bruce's game in Midtown, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-smash',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});
