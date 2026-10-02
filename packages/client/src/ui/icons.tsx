// The HUD's icon set: engraved line icons on a 24-unit grid, drawn with `currentColor` so they take
// the colour of their text. Add an icon here (name + paths) rather than drawing one inline.
import type { ReactNode } from 'react';

const PATHS = {
  log: (
    <>
      <path d="M4 8.5h12.5M4 15.5h12.5M4 8.5a2.2 3.5 0 0 0 0 7" />
      <ellipse cx="16.5" cy="12" rx="2.4" ry="3.5" />
      <path d="M16.5 11v2" />
    </>
  ),
  firewood: (
    <>
      <path d="M5 19l5-13 2.5 4.5L9 19z" />
      <path d="M11.5 19l4.5-12 2.5 4-3 8z" />
      <path d="M3 21h18" />
    </>
  ),
  food: (
    <>
      <path d="M3 11.5h18a9 7.5 0 0 1-18 0z" />
      <path d="M8.5 8c0-2 2-2.5 2-5M13.5 8c0-2 2-2.5 2-5" />
    </>
  ),
  fish: (
    <>
      <path d="M2.5 12c3.5-5.5 10.5-5.5 14.5 0-4 5.5-11 5.5-14.5 0z" />
      <path d="M17 12l4.5-3.5v7z" />
      <path d="M7 10.8v.4" />
    </>
  ),
  berry: (
    <>
      <circle cx="8.5" cy="15" r="3.5" />
      <circle cx="15.5" cy="15" r="3.5" />
      <circle cx="12" cy="9" r="3.5" />
      <path d="M12 5.5c0-2 1.5-3 3.5-3" />
    </>
  ),
  mushroom: (
    <>
      <path d="M3.5 12.5a8.5 7.5 0 0 1 17 0z" />
      <path d="M9.5 12.5v6a2.5 2.5 0 0 0 5 0v-6" />
    </>
  ),
  meat: (
    <>
      <ellipse cx="14.5" cy="9.5" rx="6.5" ry="5.5" transform="rotate(-35 14.5 9.5)" />
      <path d="M9.5 14.5L5.5 18.5" />
      <circle cx="4.5" cy="19.5" r="1.8" />
    </>
  ),
  hide: <path d="M6 3.5l3 2.5h6l3-2.5-.5 5.5 2.5 3.5-3 1.5.5 6-5.5-2.5L6.5 20l.5-6-3-1.5L6.5 9z" />,
  stone: (
    <>
      <path d="M3.5 18.5l2-6.5 5-2.5 5 1.5 3 3 2 4.5z" />
      <path d="M8 6.5l3-2.5 4 1 1 3.5" />
      <path d="M10.5 9.5l1.5 4M15.5 11l-2.5 3" />
    </>
  ),
  clay: (
    <>
      <path d="M3.5 17c1-4 4.5-6 8.5-6s7.5 2 8.5 6c-3 1.8-14 1.8-17 0z" />
      <path d="M9 11.5c.5-3 2-5 3-7.5 1 2.5 2.5 4.5 3 7.5" />
      <path d="M8 15h3" />
    </>
  ),
  ore: (
    <>
      <path d="M4 17.5l2.5-8 6-3.5 5.5 3 2 8.5-8 2z" />
      <path d="M9 11.5l1.5 1.5M14 10l1 2M11.5 16l1.5-.5" />
    </>
  ),
  grain: (
    <>
      <path d="M12 21V6" />
      <path d="M12 9c-2-.5-3.5-2-3.5-4.5 2 .3 3.5 2 3.5 4.5zM12 9c2-.5 3.5-2 3.5-4.5-2 .3-3.5 2-3.5 4.5z" />
      <path d="M12 13.5c-2-.5-3.5-2-3.5-4.5 2 .3 3.5 2 3.5 4.5zM12 13.5c2-.5 3.5-2 3.5-4.5-2 .3-3.5 2-3.5 4.5z" />
      <path d="M12 18c-2-.5-3.5-2-3.5-4.5 2 .3 3.5 2 3.5 4.5zM12 18c2-.5 3.5-2 3.5-4.5-2 .3-3.5 2-3.5 4.5z" />
      <path d="M12 6V3" />
    </>
  ),
  field: (
    <>
      <path d="M2.5 14l9.5-5 9.5 5-9.5 5z" />
      <path d="M7 11.6l9.5 5M9.5 10.3l9.5 5" />
      <path d="M12 9V4.5M12 6.5c-1.5 0-2.5-1-2.5-2.5 1.5 0 2.5 1 2.5 2.5zM12 6.5c1.5 0 2.5-1 2.5-2.5-1.5 0-2.5 1-2.5 2.5z" />
    </>
  ),
  unfield: (
    <>
      <path d="M2.5 14l9.5-5 9.5 5-9.5 5z" />
      <path d="M7 11.6l9.5 5M9.5 10.3l9.5 5" />
      <path d="M15 2.5l5 5M20 2.5l-5 5" />
    </>
  ),
  charcoal: (
    <>
      <path d="M3.5 18l2.5-6 5.5-2 3.5 3-2 5.5z" />
      <path d="M12.5 18.5l2.5-5 4.5-.5 1.5 5z" />
      <path d="M8 14l2 1" />
    </>
  ),
  planks: (
    <>
      <path d="M3 7.5h18v4H3zM3 13.5h18v4H3z" />
      <path d="M6 9.5h6M10 15.5h7" />
    </>
  ),
  cutStone: (
    <>
      <path d="M3.5 10l4-4h13l-4 4z" />
      <path d="M3.5 10v8h13v-8M16.5 18l4-4V6" />
    </>
  ),
  bricks: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M3 10h18M3 14h18M9 6v4M15 6v4M6 10v4M12 10v4M18 10v4M9 14v4M15 14v4" />
    </>
  ),
  smokedFish: (
    <>
      <path d="M2.5 15c3.5-5 10.5-5 14.5 0-4 5-11 5-14.5 0z" />
      <path d="M17 15l4.5-3v6z" />
      <path d="M9 9c-1.5-1.5 1.5-3 0-5M13 9c-1.5-1.5 1.5-3 0-5" />
    </>
  ),
  smokedMeat: (
    <>
      <ellipse cx="14.5" cy="13" rx="5.5" ry="4.5" transform="rotate(-35 14.5 13)" />
      <path d="M10 17L6 20.5" />
      <path d="M8 9c-1.5-1.5 1.5-3 0-5M12 7.5c-1.5-1.5 1.5-3 0-5" />
    </>
  ),
  saw: (
    <>
      <path d="M3 9h15l3 3H3z" />
      <path d="M3 12l1.5 2 1.5-2 1.5 2 1.5-2 1.5 2 1.5-2 1.5 2 1.5-2 1.5 2 1.5-2" />
      <path d="M18 9V5.5h3V12" />
    </>
  ),
  chisel: (
    <>
      <path d="M4 20l9-9M13 11l2-2 3 3-2 2z" />
      <path d="M15.5 8.5l3-3 3 3-3 3" />
      <path d="M3 21h4" />
    </>
  ),
  smokehouse: (
    <>
      <path d="M4 20V11l7-6 7 6v9z" />
      <path d="M9 20v-5h4v5" />
      <path d="M15 7V3.5h2.5V9" />
      <path d="M16 3c-1-1 1-1.5 0-2.5" />
    </>
  ),
  ironBars: (
    <>
      <path d="M3 18l2-4h9l2 4zM8 14l2-4h9l2 4" />
      <path d="M14 14h7" />
    </>
  ),
  ale: (
    <>
      <path d="M5 8h10v12H5z" />
      <path d="M15 11h2.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H15" />
      <path d="M4.5 8c0-2 2-3 3.5-2 1-1.8 4-1.8 5 0 1.5-.5 2.5.5 2.5 2" />
      <path d="M8.5 11v6M11.5 11v6" />
    </>
  ),
  bloomery: (
    <>
      <path d="M3 20h18" />
      <path d="M7 20l2-14h6l2 14" />
      <path d="M10 20v-3.5a2 2 0 0 1 4 0V20" />
      <path d="M12 4c-1-1 1-1.5 0-2.5" />
    </>
  ),
  barrel: (
    <>
      <path d="M7 3.5h10c1.5 2.5 2 5.5 2 8.5s-.5 6-2 8.5H7c-1.5-2.5-2-5.5-2-8.5s.5-6 2-8.5z" />
      <path d="M5.5 8h13M5.5 16h13" />
    </>
  ),
  kiln: (
    <>
      <path d="M3 20h18" />
      <path d="M4.5 20a7.5 9 0 0 1 15 0" />
      <path d="M9.5 20v-3a2.5 2.5 0 0 1 5 0v3" />
      <path d="M12 9.5V8c0-1.5 1.5-2 1.5-3.5S12 2.5 12 2.5" />
    </>
  ),
  master: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 14.2A5 5 0 0 1 21 19" />
    </>
  ),
  hut: (
    <>
      <path d="M3 11l9-7.5 9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  hall: (
    <>
      <path d="M2.5 12.5L12 6l9.5 6.5" />
      <path d="M4.5 11v9h15v-9" />
      <path d="M10 20v-4.5a2 2 0 0 1 4 0V20" />
      <path d="M12 6V2.5h4.5l-1.3 1.3 1.3 1.3H12" />
    </>
  ),
  board: (
    <>
      <path d="M3 7.5L12 3.5l9 4" />
      <path d="M4.5 8.5h15v8h-15z" />
      <path d="M6.5 16.5V21M17.5 16.5V21" />
      <path d="M7.5 10.5H11v4H7.5zM13 10.5h3.5v3H13z" />
    </>
  ),
  stall: (
    <>
      <path d="M3 9.5l2-5h14l2 5" />
      <path d="M3 9.5c0 1.4 1 2.2 2.25 2.2S7.5 10.9 7.5 9.5c0 1.4 1 2.2 2.25 2.2S12 10.9 12 9.5c0 1.4 1 2.2 2.25 2.2s2.25-.8 2.25-2.2c0 1.4 1 2.2 2.25 2.2S21 10.9 21 9.5" />
      <path d="M5 11.7V20h14v-8.3" />
      <path d="M8.5 20v-4.5h7V20" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5.2" />
      <path d="M12 9.2v5.6M10.2 10.6h3.6" />
    </>
  ),
  lock: (
    <>
      <path d="M6 11h12v9H6z" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      <path d="M12 14.5v2" />
    </>
  ),
  granary: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6M9 14l6 6M15 14l-6 6" />
    </>
  ),
  stockpile: (
    <>
      <path d="M3 12.5h8v8H3zM13 12.5h8v8h-8zM8 4.5h8v8H8z" />
      <path d="M3 12.5l8 8M8 4.5l8 8M13 12.5l8 8" />
    </>
  ),
  axe: (
    <>
      <path d="M4 20.5L14.5 8" />
      <path d="M12.5 5.5c2.5-2.5 6.5-2.5 8.5 0-.5 3.5-3 5.5-5.8 5.2z" />
    </>
  ),
  sapling: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 14c-1-3.5-4-5-7.5-4.5.5 3.5 3.5 5 7.5 4.5z" />
      <path d="M12 12c.5-3.5 3-6 7-6 0 4-2.8 6.3-7 6z" />
      <path d="M7.5 21h9" />
    </>
  ),
  reserve: (
    <>
      <path d="M12 3.5l-4.5 7h3l-4 6.5h11l-4-6.5h3z" />
      <path d="M12 17v3.5" />
      <path d="M3 21h18" />
      <path d="M3.5 21v-5M20.5 21v-5" />
    </>
  ),
  fell: (
    <>
      <path d="M8 3.5l-4 6.5h2.5L3 16h10l-3.5-6H12z" />
      <path d="M8 16v4.5M2.5 20.5h9" />
      <path d="M21 20.5L15 10" />
      <path d="M13.2 11c-1.6-1.9-1.1-4.6 1-5.6l2.9 4.9c-1.2.9-2.6 1.2-3.9.7z" />
    </>
  ),
  spade: (
    <>
      <path d="M12 3.5v9M9.5 3.5h5" />
      <path d="M8.5 12.5h7v4a3.5 3.5 0 0 1-7 0z" />
      <path d="M4 21h4.5M15.5 21H20" />
    </>
  ),
  unreserve: (
    <>
      <path d="M9 3.5l-4.5 7h3l-4 6.5h11l-4-6.5h3z" />
      <path d="M9 17v3.5" />
      <path d="M15 14l6 6M21 14l-6 6" />
    </>
  ),
  basket: (
    <>
      <path d="M3.5 10.5h17l-2 9.5h-13z" />
      <path d="M7.5 10.5a4.5 5 0 0 1 9 0" />
      <path d="M4.5 14.5h15M9.5 10.5l-1 9.5M14.5 10.5l1 9.5" />
    </>
  ),
  bow: (
    <>
      <path d="M7 3c7.5 3 7.5 15 0 18" />
      <path d="M7 3v18" />
      <path d="M3 12h17" />
      <path d="M17.5 9.5L20.5 12l-3 2.5" />
    </>
  ),
  block: (
    <>
      <ellipse cx="11" cy="15" rx="7.5" ry="2.8" />
      <path d="M3.5 15v3.5c0 1.6 15 1.6 15 0V15" />
      <path d="M11 13.5L16.5 4" />
      <path d="M14.5 3.5l5 2.5-1.5 2.5-4.5-2" />
    </>
  ),
  torch: (
    <>
      <path d="M12 12v9.5" />
      <path d="M8.5 12h7l-1 2h-5z" />
      <path d="M12 2.5c2.5 2.5 3.5 5 1.5 8h-3c-2-3-1-5.5 1.5-8z" />
    </>
  ),
  brazier: (
    <>
      <path d="M4 12h16l-2.5 4h-11z" />
      <path d="M8 16l-2.5 5M16 16l2.5 5M12 16v5" />
      <path d="M12 3c2.5 2.5 3.5 5 1.5 8h-3c-2-3-1-5.5 1.5-8z" />
    </>
  ),
  tower: (
    <>
      <path d="M7 21l1.2-11h7.6L17 21z" />
      <path d="M6 10h12V4.5h-2.5v2h-2v-2h-3v2h-2v-2H6z" />
      <path d="M11 13.5h2v3h-2z" />
    </>
  ),
  bell: (
    <>
      <path d="M5.5 17c1.2-2 1.5-4 1.5-7a5 5 0 0 1 10 0c0 3 .3 5 1.5 7z" />
      <path d="M3.5 17h17" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
      <path d="M12 3v2" />
    </>
  ),
  palisade: (
    <>
      <path d="M3 21V8l2-3 2 3v13M10 21V8l2-3 2 3v13M17 21V8l2-3 2 3v13" />
      <path d="M2 12h20M2 17h20" />
    </>
  ),
  gate: (
    <>
      <path d="M4 21V10a8 6.5 0 0 1 16 0v11" />
      <path d="M12 3.5V21M4 14h16" />
      <path d="M2 21h20" />
    </>
  ),
  path: (
    <>
      <path d="M3.5 21c2-7 8-9 6-18" />
      <path d="M14 21c2-7 8-9 6-18" />
      <path d="M9.5 20.5l.6-2M12.3 14.5l.5-1.8M13.8 8.5l.2-2" />
    </>
  ),
  unpath: (
    <>
      <path d="M3.5 21c2-7 8-9 6-18" />
      <path d="M14 21c2-7 8-9 6-18" />
      <path d="M8 9l7 7M15 9l-7 7" />
    </>
  ),
  drain: (
    <>
      <path d="M2 8h5l2.5 9h5L17 8h5" />
      <path d="M9 13c1-.8 2-.8 3 0s2 .8 3 0" />
      <path d="M3.5 4.5c1-.8 2-.8 3 0M17.5 4.5c1-.8 2-.8 3 0" />
    </>
  ),
  pass: (
    <>
      <path d="M2 17l6-11 4 6 3-4 7 9" />
      <path d="M10 21l1.2-4.5M14.5 21l-1-4.5" />
    </>
  ),
  hammer: (
    <>
      <path d="M5 20.5l9-9" />
      <path d="M11 6.5l3.5-3.5 6.5 6.5-3.5 3.5z" />
    </>
  ),
  pick: (
    <>
      <path d="M5 21L14.5 10" />
      <path d="M4.5 7.5c5-4 11-4 15.5 1.5-4.5-1.5-9-1.5-12.5.8z" />
    </>
  ),
  ruins: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V9l2-2 1.5 2L10 8v13" />
      <path d="M14 21v-8l1.5-1.5L17 13l2-1v9" />
      <path d="M11.5 18.5h2.5" />
    </>
  ),
  shrine: (
    <>
      <path d="M8.5 20l-.8-11.5L10 4l3.5-1 2.5 4-.5 13z" />
      <path d="M5 20.5h14" />
      <path d="M12 12.5a1.5 1.5 0 1 1 1.4-2 3 3 0 1 1-4 2.6" />
    </>
  ),
  snow: (
    <>
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" />
      <path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  skull: (
    <>
      <path d="M5 11a7 7 0 0 1 14 0v3.5l-2 1V20H7v-4.5l-2-1z" />
      <circle cx="9" cy="11.5" r="1.6" />
      <circle cx="15" cy="11.5" r="1.6" />
      <path d="M10.5 20v-2.5M13.5 20v-2.5" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.3" />
    </>
  ),
  dire: (
    <>
      <path d="M12 2l10 10-10 10L2 12z" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3c0 5 9 5 9 9s-9 4-9 9" />
      <path d="M16.5 3c0 5-9 5-9 9s9 4 9 9" />
    </>
  ),
  pause: <path d="M8.5 5v14M15.5 5v14" />,
  play: <path d="M7 4.5l12 7.5-12 7.5z" />,
  steps: (
    <>
      <path d="M7 3.5c2 0 3 2 3 5s-1 4-3 4-3-1.8-3-4 1-5 3-5zM5.5 15h3v2a1.5 1.5 0 0 1-3 0z" />
      <path d="M17 7.5c2 0 3 2 3 5s-1 4-3 4-3-1.8-3-4 1-5 3-5zM15.5 19h3v.5a1.5 1.5 0 0 1-3 0z" />
    </>
  ),
  quill: (
    <>
      <path d="M20.5 3.5C11 5 6.5 11 4.5 20.5" />
      <path d="M20.5 3.5c-1 6-5.5 10-12 11.5" />
      <path d="M3 21h8" />
    </>
  ),
  book: (
    <>
      <path d="M2.5 5c3.5-1.3 6.5-1 9.5 1v14c-3-2-6-2.3-9.5-1z" />
      <path d="M21.5 5c-3.5-1.3-6.5-1-9.5 1v14c3-2 6-2.3 9.5-1z" />
    </>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chev: <path d="M9 5l7 7-7 7" />,
  cart: (
    <>
      <path d="M2.5 6h3l3 9h9.5l2.5-6.5H7" />
      <circle cx="10" cy="19" r="1.8" />
      <circle cx="17" cy="19" r="1.8" />
    </>
  ),
  zzz: <path d="M4 8h5l-5 6h5M13 4h4l-4 5h4M14 14h6l-6 6.5h6" />,
  sword: (
    <>
      <path d="M20.5 3.5L9 15" />
      <path d="M20.5 3.5h-4.5M20.5 3.5V8" />
      <path d="M6 12l6 6M4 20l3.5-3.5" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

/** An icon `size` px square in the colour of the text around it. Decorative: label its button. */
export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `ic ${className}` : 'ic'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
