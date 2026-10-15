// Thwip!, Spider-Man's game in Queens, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-thwip',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});
