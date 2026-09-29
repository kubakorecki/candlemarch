// `pnpm bench:maps [size...]`: benchmarks the sim on synthetic maps and prints Markdown tables.
import { cpus } from 'node:os';
import { content } from '@candlemarch/content';
import { benchMapSize, formatResults, type MapSizeResult } from './mapSize';

const DEFAULT_SIZES = [64, 128, 192, 256];

const sizes = process.argv.slice(2).map(Number);
if (sizes.some((s) => !Number.isInteger(s) || s < 48)) {
  console.error('Usage: pnpm bench:maps [size...], each size a whole number of tiles, at least 48');
  process.exit(1);
}

const options = {
  warmupTicks: 600,
  measuredTicks: content.calendar.dayTicks,
  pairedTicks: 200,
  reps: 20,
};
console.log(
  `Node ${process.version}, ${cpus()[0]?.model ?? 'unknown CPU'}. Warm-up ${options.warmupTicks} ticks, ` +
    `then ${options.measuredTicks} ticks timed one by one with \`stepInPlace\`, as the worker runs them; ` +
    `${options.pairedTicks} ticks run both with \`step\` and \`stepInPlace\`; ${options.reps} repeats of the rest.\n`,
);
const results: MapSizeResult[] = [];
for (const size of sizes.length > 0 ? sizes : DEFAULT_SIZES) {
  console.error(`${size}²…`);
  results.push(await benchMapSize(size, content, options));
}
console.log(formatResults(results));
