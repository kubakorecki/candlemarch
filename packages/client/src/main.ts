import { SIM_PACKAGE } from '@candlemarch/sim';

const root = document.getElementById('root');
if (root) root.textContent = `Candlemarch (${SIM_PACKAGE} loaded)`;
