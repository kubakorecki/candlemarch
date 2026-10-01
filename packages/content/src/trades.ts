import type { MastersDef, TradeDef, TradeId } from './types';

// The seven master trades of v1 (spec, Trades and masters). Which workshops each runs is on the
// buildings (`BuildingDef.trade`).
export const trades: Record<TradeId, TradeDef> = {
  carpenter: { id: 'carpenter', name: 'Carpenter' },
  mason: { id: 'mason', name: 'Mason' },
  butcher: { id: 'butcher', name: 'Butcher' },
  smith: { id: 'smith', name: 'Smith' },
  miller: { id: 'miller', name: 'Miller' },
  brewer: { id: 'brewer', name: 'Brewer' },
  baker: { id: 'baker', name: 'Baker' },
};

// Numbers Proposed (spec, How a trade scales without apprentices).
export const masters: MastersDef = {
  masterSpeedPercent: 150,
  lostSpeedPercent: 25,
};
