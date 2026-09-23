import { TICKS_PER_SECOND } from '@candlemarch/sim';

const root = document.getElementById('root');
if (root) root.textContent = `Candlemarch (sim at ${TICKS_PER_SECOND} ticks/s)`;
