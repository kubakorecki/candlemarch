// `pnpm balance <scenario>`: runs a balance scenario and prints its day-by-day table.
import { content } from '@candlemarch/content';
import { formatTable, runScenario } from './harness';
import { type ScenarioName, scenarios } from './scenarios';

const name = process.argv[2];
if (name === undefined || !(name in scenarios)) {
  console.error(`Usage: pnpm balance <scenario>. Scenarios: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}
const scenario = scenarios[name as ScenarioName];
console.log(`${scenario.name}, seed ${scenario.seed}, ${scenario.ticks} ticks\n`);
console.log(formatTable(runScenario(scenario, content), content));
