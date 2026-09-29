# HUD design system: Vellum

The HUD's look. Read this before adding or changing any panel, button or dialog in
`packages/client/src/ui/`. The source design is the "Vellum" direction on the
[Candlemarch UI Directions canvas](https://claude.ai/artifact/FKuHReowLZGR1uWbrkM6Ct) (boards
"Vellum · In-game HUD (dusk)" and "Vellum · System, panels & popups"). The canvas is a guide, not a
spec: it shows features the game doesn't have yet. Don't build those to match a picture.

**The mood:** mature and quiet. Umber lacquer panels, thin gilt hairlines, an engraved serif. Gilt
marks what's on or in hand. Red and amber appear only when something is at stake. Never loud, glossy,
rounded or cartoony. The world art is cartoony; the HUD frames it like an old book.

## Where things live

| What | Where |
| --- | --- |
| Colours | `render/palette.ts`, the `ui*` keys. The only source; `applyPaletteToCss` turns each listed key into a CSS variable (`uiGiltLit` → `--ui-gilt-lit`). Add a colour there, list it in `CSS_COLOURS`, then use the variable. |
| Derived tokens (alphas, shadows, fonts, sizes) | top of `ui/hud.css` (`:root`), built with `color-mix` from the palette variables. **No hex values in CSS or TSX.** |
| All HUD styles | `ui/hud.css`, one section per region. Plain class names, no CSS modules. |
| Shared pieces | `ui/kit.tsx`: `SectionHead`, `IconButton`, `CloseButton`, `Medallion`, `Avatar`, `Callout`, `Chip`, `Corners`, `RESOURCE_ICONS`. |
| Icons | `ui/icons.tsx`: `<Icon name size className?>` and the `IconName` union. |
| Fonts | `@fontsource/cinzel` and `@fontsource/eb-garamond`, imported in `main.tsx` (bundled, works offline). |

## Colour

| Token | Use |
| --- | --- |
| `--ui-umber` | the darkest ground (behind everything) |
| `--ui-lacquer` | panel fill |
| `--ui-card` / `--ui-raised` | a card inside a panel / a chosen or hovered card |
| `--ui-text` (vellum) | body text; also the Almanac ribbon's fill |
| `--ui-text-bright`, `--ui-text-soft`, `--ui-text-dim` | dire alert titles; descriptive notes; lines under callout titles |
| `--ui-muted` | labels, secondary text, the chronicle |
| `--ui-disabled` | disabled controls |
| `--ui-gilt` / `--ui-gilt-lit` | icons, section heads, borders of what's chosen / links, titles in hand, the lit state |
| `--ui-dire`, `--ui-dire-line`, `--ui-dire-text`, `--ui-dire-ink` | a life at stake: fill, edge, text, text on a dire fill |
| `--ui-warn`, `--ui-warn-line` | a trend turning bad: text, edge |
| `--ui-shade` | shadows and the dialog backdrop |

Hairlines are gilt at falling strengths: `--line-strong` (60%), `--line` (42%, panel borders),
`--line-quiet`, `--line-soft` (dividers, quiet card borders), `--line-faint` (the inner hairline).
Washes: `--gilt-wash`, `--dire-wash`, `--warn-wash`; edges: `--dire-edge`, `--warn-edge`.

**Red and amber are reserved for alerts.** Dire (red) = a villager dies at the next Dusk or Dawn
unless something changes, a death, a Homeless villager. Warning (amber) = heading for trouble,
a Workplace idle, a placement that costs something. Everything else is gilt or vellum. Colours that
must be told apart also differ in lightness.

## Type

- **Cinzel 600/700** (`--font-display`, class `caps`): titles, section heads, button labels, the
  ribbon's season and day, names in the inspector head and build details. Capitals are tracked
  0.12–0.16em (`.caps`); mixed-case names only 0.04em. Never for sentences.
- **EB Garamond 400/500/600** (`--font-body`): everything else. 15px body, 13px labels and notes,
  12px ledger labels. Italic for the chronicle, sub-lines and flavour (`.italic`, `.footnote`).
- **Figures** (`.figure`): 19px, 600, tabular lining numerals, for counts that matter.

## Surfaces

- **Panel** (`.panel`): lacquer, a 1px `--line` border, a second hairline inset 4px (`--inset`)
  and a soft drop shadow. Square corners, always. Every HUD region and dialog is a panel, except
  the Almanac, whose vellum ribbon sits beside its panel under one drop shadow.
- **Corner diamonds** (`<Corners />`, `<Corners all />`): gilt diamonds on the build menu (top two)
  and on dialogs (all four). Use sparingly: only for the one or two most important surfaces.
- **Dialog** (`.dialog.panel` + `<Corners all />`, optional `.backdrop`): centred, a heavier shadow.
  Title in caps, a skull or icon above for grave moments, actions at the bottom (`.dialog-actions`),
  primary on the right.

## Controls

- **Buttons** (`.btn`): 44px tall, Cinzel caps label. `.btn.primary` (filled gilt) at most once per
  surface; plain `.btn` (gilt outline) for the rest; `.btn.dire` only for the Militia bell or
  something as grave (`aria-pressed` fills it red while active).
- **Small buttons** (`.btn-small`): 30px, body font, inside a panel row (Unassign, Ring).
- **Icon buttons** (`<IconButton>`): 44px squares; `on` lights one whose view or menu is open
  (gilt border and an underline). Always give a `label` (it's the aria-label and the tooltip; put the
  shortcut in it, e.g. "Workers (V)"). `size="small"` for − / +, `size="bare"` for close.
- **Segmented choice** (`<fieldset className="seg">` of buttons with `aria-pressed`): speed,
  Stockpile priority. The chosen one is filled gilt. Add `joined` to butt them together.
- **Toggle chips** (`<label className="toggle-chip">` around a checkbox, an icon and a word): on/off
  settings like what a Stockpile takes.
- **Links** (`.link`): a name that selects its villager, gilt-lit.
- **Key caps** (`.keycap`): shortcut letters on build cards.
- Touch targets stay 44px where there's room; never under 28px.

## Status and alerts

Three weights, from the design's "alerts, by weight":

1. **Dire**: a red-washed row, bigger and bold, pinned first under "Lives at stake" in Tidings.
2. **Warning**: an outlined row with an amber triangle, under "Warnings".
3. **Status**: counts on the Ledger (Homeless, Hungry, Cold), not repeated as alerts. Each count
   links to its alert's target.

The **Chronicle** (italic, muted, a skull) records what already happened: deaths. Inside panels, use
`<Callout tone>` for why something is wrong (a Workplace's status, "No shade") and `<Chip tone>` for a
villager's state words.

## Icons

Line icons on a 24-unit grid, 1.6 stroke, round caps, drawn in `currentColor` (so a wrapping
`tone-*` class colours them). Gilt by default; red or amber only in alerts. Sizes: 22 in the ledger
and tabs, 28 on build cards, 18–20 in rows and buttons, 13–15 inline with small text. To add one,
add its paths to `PATHS` in `icons.tsx`; draw it in the same engraved style (open strokes, no fills).
No emoji, no icon fonts. Each resource has one icon (`RESOURCE_ICONS`), each tool one
(`TOOL_ICONS` in `ui/buildCategories.ts`).

## Layout (screen regions)

| Region | Component | Holds |
| --- | --- | --- |
| Top left | `Almanac.tsx` | vellum ribbon (year, season, day, time of day), day track, winter countdown, speed, Militia bell |
| Top, between | `Ledger.tsx` | Food, Stockpile goods, villagers with status counts, Carriers busy, the Hero |
| Top right | `nav` in `Hud.tsx` | icon buttons for views (Workers, Traffic) and Save / Load |
| Right | `Tidings.tsx` | alerts by weight, then the chronicle |
| Bottom left | `Inspector.tsx` (`LeftDock`) | workers view, then the selected thing's inspector |
| Bottom | `BuildMenu.tsx` | category tabs, the open category's cards and details; the status line floats above |
| Centre | `Dialogs.tsx` | game over, Load |

Sizes are tokens at the top of `hud.css`: margins `--edge` (16px), gaps between regions `--gap`
(16px), the Almanac `--almanac` (340px), the side columns (Tidings, the left dock) `--column`
(318px). The Ledger stretches between the Almanac and the nav, so **adding a nav button means raising
`--nav-buttons`**. Below 1440px wide the build menu reaches under Tidings, so Tidings stops above it
and scrolls. The HUD layer ignores the mouse (`pointer-events: none`); each panel takes it back.

## Recipes

- **A new inspector** (something new can be selected): a `section.inspector.panel` in
  `Inspector.tsx`, starting with `<Head lead={<Medallion icon=…/>} name=… sub=… />`, then facts
  (`.fact` rows, or a `.facts` grid), callouts, and a `<SectionHead>` per list. Render it in
  `LeftDock`.
- **A new building or tool:** add it to `TOOLS` (`game/tools.ts`), to a category and to
  `TOOL_ICONS` in `ui/buildCategories.ts` (a test checks every tool is in one category), and an icon
  if none fits. The card and details read cost, size, build time and workers from content; the
  tool's `hint` shows in the details (or in the status line above the menu when its card isn't
  showing, as for Demolish).
- **A new store on the Ledger:** it appears by itself if it's a Stockpile good; anything else is a
  `Store` cell in `Ledger.tsx`.
- **A new alert kind:** word it in `game/alertText.ts`. Red alerts go under "Lives at stake",
  amber under "Warnings"; add its kind to `ON_THE_LEDGER` in `Tidings.tsx` only if the Ledger shows it.
- **A new overlay or view:** an `IconButton` in the `nav` with `on` while it shows, and a shortcut
  in its label; raise `--nav-buttons` in `hud.css`.
- **A new dialog:** in `Dialogs.tsx`, `.dialog.panel` with `<Corners all />`.

## Don'ts

- No hex colours outside `palette.ts`; no inline colours except data-driven ones (a Job's colour on
  an avatar). Inline styles only for data-driven sizes (bars, the day marker).
- No rounded corners (circles only for medallions and avatars), no gradients on controls, no glows
  except on a chosen build card and the day marker.
- No sans-serif, no Inter/Roboto/Arial.
- No game logic in components: `Game.ts` turns sim results into `HudState` display values; pure
  helpers (`game/almanac.ts`, `game/ledger.ts`, `game/alertText.ts`) get unit tests.
