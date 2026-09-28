import { defineConfig } from 'vitest/config';
import { SCENARIO_TESTS } from './vitest.config';

/** `pnpm test:scenarios`: the whole-year balance runs, one file per worker. */
export default defineConfig({
  test: {
    name: 'scenarios',
    include: [SCENARIO_TESTS],
  },
});
