// `pnpm bench:maps [--fog] [size | valley[:seed]...]`: benchmarks the sim on synthetic maps of
// each size and on generated Valleys (seed 1 unless given) and prints Markdown tables.
import { cpus } from 'node:os';
import { content } from '@candlemarch/content';
import { benchMapSize, benchValley, formatResults, type MapSizeResult } from './mapSize';

const DEFAULT_SIZES = [64, 128, 192, 256];

const args = process.argv.slice(2);
const fog = args.includes('--fog');
const maps = args.filter((a) => a !== '--fog');
/** A generated Valley's seed from `valley` or `valley:<seed>`, else null. */
const valleySeed = (arg: string) => {
  const match = /^valley(?::(\d+))?$/.exec(arg);
  return match ? Number(match[1] ?? 1) : null;
};
if (maps.some((a) => valleySeed(a) === null && (!Number.isInteger(Number(a)) || Number(a) < 48))) {
  console.error(
    'Usage: pnpm bench:maps [--fog] [size | valley[:seed]...], each size a whole number of tiles, at least 48',
  );
  process.exit(1);
}
const options = {
  warmupTicks: 600,
  measuredTicks: content.calendar.dayTicks,
  pairedTicks: 200,
  reps: 20,
  fog,
};
console.log(
  `Node ${process.version}, ${cpus()[0]?.model ?? 'unknown CPU'}. Warm-up ${options.warmupTicks} ticks, ` +
    `then ${options.measuredTicks} ticks timed one by one with \`stepInPlace\`, as the worker runs them; ` +
    `${options.pairedTicks} ticks run both with \`step\` and \`stepInPlace\`; ${options.reps} repeats of the rest. ` +
    `Fog ${fog ? 'on' : 'off'}.\n`,
);
const results: MapSizeResult[] = [];
for (const arg of maps.length > 0 ? maps : DEFAULT_SIZES.map(String)) {
  console.error(`${arg}…`);
  const seed = valleySeed(arg);
  results.push(
    seed === null
      ? await benchMapSize(Number(arg), content, options)
      : await benchValley(seed, content, options),
  );
}
console.log(formatResults(results));
