// The placeholder-art palette: flat, desaturated, earthy fills with dark ink outlines.
// Every colour in the client comes from here, including the HUD (via CSS variables).

export const palette = {
  ink: 0x241c15,
  background: 0x1b1916,

  grass: 0x6e7650,
  grassAlt: 0x677049,
  grassLine: 0x4f5638,

  river: 0x4d6670,

  trunk: 0x5c4431,
  canopy: 0x4b5a37,
  canopyLight: 0x5a6a41,
  canopyDark: 0x3e4a2f,
  shadow: 0x1e1a14,

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

  woodcutter: 0x7e5436,
  carrier: 0x5a6570,
  skin: 0xd6b48e,
  axeHead: 0x9aa0a3,

  heroCloak: 0x6b3b45,
  heroTunic: 0x4a5a4c,
  heroTrim: 0xc9a25a,
  selection: 0xe8cf86,
  aura: 0xd9b45b,

  night: 0x141a2e,
  valid: 0x9dbf73,
  invalid: 0xc4584a,

  hudBg: 0x2a241d,
  hudPanel: 0x3a3128,
  hudText: 0xefe4cc,
  hudMuted: 0xb3a58b,
  hudAccent: 0xd9a55b,
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
}
