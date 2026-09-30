// Bottom: the build menu. Category tabs along the bottom (Demolish at the end); the open category's
// cards above them, and details of the card under the mouse or in hand. The status line (the last
// message and any placement warning) floats above it.
import {
  type BuildingDef,
  type BuildingId,
  content,
  type ResourceAmount,
} from '@candlemarch/content';
import { TICKS_PER_SECOND } from '@candlemarch/sim';
import { useEffect, useState } from 'react';
import type { Game, HudState } from '../game/Game';
import { type TOOLS, type ToolId, toolDef } from '../game/tools';
import { BUILD_CATEGORIES, type BuildCategoryId, categoryOf, TOOL_ICONS } from './buildCategories';
import { Icon } from './icons';
import { Callout, Corners, employsText, Medallion, RESOURCE_ICONS, SectionHead } from './kit';

type Tool = (typeof TOOLS)[number];

/** The building a tool places, or null for paths, Stockpiles and Demolish. */
function buildingOf(id: ToolId): BuildingDef | null {
  return id in content.buildings ? content.buildings[id as BuildingId] : null;
}

function Cost({ cost }: { cost: readonly ResourceAmount[] }) {
  if (cost.length === 0) return <span className="cost">Free</span>;
  return (
    <span className="cost">
      {cost.map((c) => (
        <span key={c.resource} className="cost">
          <Icon name={RESOURCE_ICONS[c.resource]} size={15} />
          {c.amount}
        </span>
      ))}
    </span>
  );
}

function Card({
  tool,
  hud,
  game,
  onHover,
}: {
  tool: Tool;
  hud: HudState;
  game: Game;
  onHover: (id: ToolId | null) => void;
}) {
  const building = buildingOf(tool.id);
  const inHand = hud.tool === tool.id;
  return (
    <button
      type="button"
      className="build-card"
      aria-pressed={inHand}
      disabled={!hud.ready}
      onClick={() => (inHand ? game.cancelTool() : game.selectTool(tool.id))}
      onMouseEnter={() => onHover(tool.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(tool.id)}
      onBlur={() => onHover(null)}
    >
      <span className="keycap">{tool.key.toUpperCase()}</span>
      <Medallion icon={TOOL_ICONS[tool.id]} size={28} />
      <span className="name">{building?.name ?? tool.label}</span>
      <Cost cost={building?.construction?.cost ?? []} />
    </button>
  );
}

/** What a card's building costs, how long it takes, its size and who works or lives in it. */
function Details({ tool }: { tool: Tool }) {
  const building = buildingOf(tool.id);
  const turns = building && !tool.drag ? ' Q/E turns it.' : '';
  const perTile = tool.drag ? ' a tile' : '';
  const employs = building ? employsText(building) : '';
  return (
    <div className="build-details">
      <div className="title">{building?.name ?? tool.label}</div>
      <div className="note">
        {tool.hint}
        {turns}
      </div>
      {building?.construction && (
        <div className="stats">
          <div>
            <span className="muted">Cost</span>
            {building.construction.cost
              .map((c) => `${c.amount} ${content.resources[c.resource].name.toLowerCase()}`)
              .join(', ') || 'Free'}
            {perTile}
          </div>
          <div>
            <span className="muted">Build time</span>
            {building.construction.buildTicks / TICKS_PER_SECOND} s{perTile}
          </div>
          <div>
            <span className="muted">Size</span>
            {building.size.w}×{building.size.h}
            {building.outputBuffer && ', and a yard'}
          </div>
          {employs && (
            <div>
              <span className="muted">Workers</span>
              {employs}
            </div>
          )}
          {building.residents !== undefined && (
            <div>
              <span className="muted">Houses</span>
              {building.residents} villagers
            </div>
          )}
          {building.foodCapacity !== undefined && (
            <div>
              <span className="muted">Holds</span>
              {building.foodCapacity} Food
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BuildMenu({ hud, game }: { hud: HudState; game: Game }) {
  const [open, setOpen] = useState<BuildCategoryId | null>(null);
  const [hovered, setHovered] = useState<ToolId | null>(null);

  // Picking a tool by its key opens its category.
  useEffect(() => {
    const category = hud.tool && categoryOf(hud.tool);
    if (category) setOpen(category);
  }, [hud.tool]);

  const category = BUILD_CATEGORIES.find((c) => c.id === open);
  const shown = hovered ?? (hud.tool && category?.tools.includes(hud.tool) ? hud.tool : null);
  const shownTool = shown && toolDef(shown);
  const demolish = toolDef('demolish');
  // A tool in hand whose card isn't showing (Demolish, or a collapsed drawer) gets its hint here.
  const hint = hud.tool && !category?.tools.includes(hud.tool) ? toolDef(hud.tool)?.hint : null;
  const status = hud.message ?? hint;

  return (
    <section className="build panel" aria-label="Build">
      <Corners />
      {(status || hud.placementWarning) && (
        <div className="toast panel" role="status">
          {status && <div>{status}</div>}
          {hud.placementWarning && <Callout tone="warn" title={hud.placementWarning} />}
        </div>
      )}

      {category && (
        <div className="build-drawer" id="build-drawer">
          <SectionHead
            title={category.label}
            aside={
              category.tools.every((id) => toolDef(id)?.drag)
                ? 'Drag to lay · Esc or right-click cancels'
                : 'Click to place · Shift-click for more · Q / E turn · Esc or right-click cancels'
            }
          />
          <div className="build-body">
            <div className="build-cards">
              {category.tools.map((id) => {
                const tool = toolDef(id);
                return (
                  tool && <Card key={id} tool={tool} hud={hud} game={game} onHover={setHovered} />
                );
              })}
            </div>
            {shownTool ? (
              <Details tool={shownTool} />
            ) : (
              <div className="build-details">
                <div className="note italic">
                  Point at a card to read about it; click to pick it up.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="build-tabs">
        {BUILD_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="build-tab"
            aria-expanded={open === c.id}
            aria-controls={open === c.id ? 'build-drawer' : undefined}
            disabled={!hud.ready}
            onClick={() => setOpen(open === c.id ? null : c.id)}
          >
            <Icon name={c.icon} size={22} />
            {c.label}
          </button>
        ))}
        {demolish && (
          <button
            type="button"
            className="build-tab demolish"
            aria-pressed={hud.tool === 'demolish'}
            disabled={!hud.ready}
            title={`${demolish.hint} (${demolish.key.toUpperCase()})`}
            onClick={() =>
              hud.tool === 'demolish' ? game.cancelTool() : game.selectTool('demolish')
            }
          >
            <Icon name={TOOL_ICONS.demolish} size={22} />
            {demolish.label}
          </button>
        )}
      </div>
    </section>
  );
}
