// The placeholder-art palette: flat, desaturated, earthy fills with dark ink outlines.
// Every colour in the client comes from here, including the HUD (via CSS variables).

export const palette = {
  ink: 0x241c15,
  background: 0x1b1916,

  grass: 0x6e7650,
  grassAlt: 0x677049,
  grassLine: 0x4f5638,

  river: 0x4d6670,
  ice: 0xa9b8bc,
  iceCrack: 0x6f8389,

  trunk: 0x5c4431,
  canopy: 0x4b5a37,
  canopyLight: 0x5a6a41,
  canopyDark: 0x3e4a2f,
  shadow: 0x1e1a14,

  bush: 0x46553a,
  bushLight: 0x56663f,
  berry: 0x7a3445,
  berryShine: 0xb56a6f,
  mushroomCap: 0x9a5e3c,
  mushroomStem: 0xd6c8a6,
  litter: 0x5e5238,
  withered: 0x7b6a4b,
  witheredDark: 0x5e503a,

  wallLight: 0xa48d6b,
  wallDark: 0x857055,
  roof: 0x7c4c37,
  roofDark: 0x643c2c,
  door: 0x3b2d21,

  siteGround: 0x8a7556,

  dirt: 0x9a8260,
  dirtDark: 0x6f5a40,
  pileGround: 0x7d6849,
  iconBg: 0xefe4cc,
  sitePost: 0xb59a70,

  log: 0x8b6541,
  logEnd: 0xc9a06d,
  firewood: 0xa27a4f,
  firewoodEnd: 0xd8b98a,
  fish: 0x7d8a8c,
  fishBelly: 0xb9b8a4,
  meat: 0x8e4b3f,
  meatFat: 0xcf9f86,
  bone: 0xe0d3b4,
  hide: 0x8a6a48,
  hideDark: 0x6c5137,

  // Hunting ground health, outline and word.
  thriving: 0x8fae62,
  thinning: 0xc9a25a,
  scarce: 0xc4744a,
  empty: 0x8a8378,
  puff: 0xd8d0bf,

  woodcutter: 0x7e5436,
  woodsplitter: 0x6f5a3a,
  fisher: 0x4f6a6e,
  forager: 0x66683c,
  hunter: 0x5b4a3a,
  watchman: 0x4a4f63,
  carrier: 0x5a6570,
  skin: 0xd6b48e,
  axeHead: 0x9aa0a3,

  heroCloak: 0x6b3b45,
  heroTunic: 0x4a5a4c,
  heroTrim: 0xc9a25a,
  selection: 0xe8cf86,
  aura: 0xd9b45b,

  // Night: the world is multiplied by `dusk` at Dusk and `night` at full dark; light sources
  // shine through it in `glow` (their halo) and `windowLit` (a lit pane).
  dusk: 0xd49a7c,
  night: 0x6c78a4,
  glow: 0xe8973f,
  windowLit: 0xffd27a,
  window: 0x4a3a2b,
  // Torches and braziers: a pole with a pitch-wrapped head, an iron bowl; their flame and pool
  // of Light go on the lights layer in `glow` and `windowLit`.
  torchPole: 0x5c4431,
  torchHead: 0x3a2a1e,
  iron: 0x4f4c4a,
  ironLight: 0x6d6964,
  // The Militia bell: a bronze bell under a timber frame (`torchPole`).
  bell: 0x8c6d3f,
  bellLight: 0xae8c55,
  // Palisades and Gates: sharpened log stakes, and a Gate's plank door between two posts.
  stake: 0x6a4e35,
  stakeLight: 0x7d5e40,
  gatePlank: 0x8a6a48,

  // Monsters: Dens, Gloamlings (pale eyes that shine through the dark) and the dark ring around a
  // Den where nothing can be built.
  denEarth: 0x4e4236,
  denEarthDark: 0x3a3129,
  denMouth: 0x120e0c,
  gloam: 0x2d2934,
  gloamLight: 0x433d4d,
  gloamEye: 0xd9e3a4,
  darkRing: 0x221c2a,
  // Health bars over anyone in a fight: what's left, and the empty part of the bar.
  health: 0xb8503f,
  healthLost: 0x2a2226,

  valid: 0x9dbf73,
  invalid: 0xc4584a,

  // HUD, the Vellum look (docs/agents/design-system.md): umber lacquer panels, gilt hairlines, vellum
  // text. Red and amber are kept for alerts; gilt marks what's on or in hand.
  uiUmber: 0x14110e,
  uiLacquer: 0x1d1813,
  uiCard: 0x221c16,
  uiRaised: 0x2b2319,
  uiText: 0xe6dcc6,
  uiTextBright: 0xf3e6d8,
  uiTextSoft: 0xd3c7b0,
  uiTextDim: 0xc9b8a6,
  uiMuted: 0xa89a82,
  uiDisabled: 0x5e5446,
  uiGilt: 0xc9a25a,
  uiGiltLit: 0xe8cf86,
  uiDire: 0x9b3a2e,
  uiDireLine: 0xd9695a,
  uiDireText: 0xe88b7c,
  uiDireInk: 0xf0d8cc,
  uiWarn: 0xe3b066,
  uiWarnLine: 0xd9a04e,
  uiShade: 0x0b0907,
  // Road heat-map: unused, then from light to heavy Carrier traffic.
  heatNone: 0x8a8378,
  heat1: 0xd6c47e,
  heat2: 0xd9a55b,
  heat3: 0xc4744a,
  heat4: 0xa8423a,
} as const;

export type PaletteKey = keyof typeof palette;

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** HUD colours exposed to CSS, as `--<name>` variables: `uiGiltLit` becomes `--ui-gilt-lit`. */
const CSS_COLOURS = [
  'background',
  'thriving',
  'thinning',
  'scarce',
  'empty',
  'uiUmber',
  'uiLacquer',
  'uiCard',
  'uiRaised',
  'uiText',
  'uiTextBright',
  'uiTextSoft',
  'uiTextDim',
  'uiMuted',
  'uiDisabled',
  'uiGilt',
  'uiGiltLit',
  'uiDire',
  'uiDireLine',
  'uiDireText',
  'uiDireInk',
  'uiWarn',
  'uiWarnLine',
  'uiShade',
] as const satisfies readonly PaletteKey[];

/** Exposes the HUD colours to CSS as variables on the document root (see `CSS_COLOURS`). */
export function applyPaletteToCss(root: HTMLElement): void {
  for (const key of CSS_COLOURS) {
    const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    root.style.setProperty(`--${name}`, hex(palette[key]));
  }
}
