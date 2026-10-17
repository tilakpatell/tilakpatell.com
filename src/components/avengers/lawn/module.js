// Hold the Lawn, Thor's game, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-lawn',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});
