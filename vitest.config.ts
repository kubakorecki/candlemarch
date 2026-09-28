import { configDefaults, defineConfig } from 'vitest/config';

/** Whole-year balance runs: seconds each, so `pnpm test` leaves them to `pnpm test:scenarios`. */
export const SCENARIO_TESTS = 'tooling/balance/*.scenario.test.ts';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      {
        test: {
          name: 'tooling',
          root: 'tooling',
          exclude: [...configDefaults.exclude, '**/*.scenario.test.ts'],
        },
      },
    ],
  },
});
