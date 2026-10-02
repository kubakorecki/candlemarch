import type { ChartersDef } from './types';

// Charters on the notice board (spec, Trades and masters: Charters in M5). Numbers Proposed: fees
// run 100–300 coin, the Smith's the dearest. Each Master asks for their workshop and a building
// that supplies it, besides a free place in a House.
export const charters: ChartersDef = {
  max: 2,
  days: 10,
  againDays: 5,
  offers: {
    carpenter: { fee: 100, buildings: [['sawpit'], ['woodcutters_hut']] },
    mason: { fee: 150, buildings: [['stonecutter', 'brick_kiln'], ['quarry']] },
    butcher: { fee: 150, buildings: [['smokehouse'], ['hunters_lodge', 'fishers_hut']] },
    brewer: { fee: 200, buildings: [['brewery'], ['farm']] },
    smith: {
      fee: 300,
      buildings: [['bloomery'], ['mine', 'bog_iron_digger'], ['charcoal_kiln']],
    },
  },
};
