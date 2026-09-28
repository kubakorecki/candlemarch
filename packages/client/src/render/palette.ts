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
  valid: 0x9dbf73,
  invalid: 0xc4584a,

  hudBg: 0x2a241d,
  hudPanel: 0x3a3128,
  hudText: 0xefe4cc,
  hudMuted: 0xb3a58b,
  hudAccent: 0xd9a55b,
  // Alert severities in the HUD list.
  alertRed: 0xd4614f,
  alertAmber: 0xd9a55b,
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

/** Exposes the HUD colours to CSS as `--hud-*` variables on the document root. */
export function applyPaletteToCss(root: HTMLElement): void {
  root.style.setProperty('--ink', hex(palette.ink));
  root.style.setProperty('--background', hex(palette.background));
  root.style.setProperty('--hud-bg', hex(palette.hudBg));
  root.style.setProperty('--hud-panel', hex(palette.hudPanel));
  root.style.setProperty('--hud-text', hex(palette.hudText));
  root.style.setProperty('--hud-muted', hex(palette.hudMuted));
  root.style.setProperty('--hud-accent', hex(palette.hudAccent));
  root.style.setProperty('--hud-invalid', hex(palette.invalid));
  root.style.setProperty('--thriving', hex(palette.thriving));
  root.style.setProperty('--thinning', hex(palette.thinning));
  root.style.setProperty('--scarce', hex(palette.scarce));
  root.style.setProperty('--empty', hex(palette.empty));
  root.style.setProperty('--alert-red', hex(palette.alertRed));
  root.style.setProperty('--alert-amber', hex(palette.alertAmber));
}
