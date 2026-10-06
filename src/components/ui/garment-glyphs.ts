/*
 * Icon node data below copied from @lucide/lab 0.7.0, under its ISC License:
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * Garment glyphs that lucide-react-native does not ship, so the recommended-piece
 * badge can draw trousers, a skirt or a heel rather than one shirt for
 * everything.
 *
 * The node definitions are copied verbatim from `@lucide/lab` 0.7.0 (ISC,
 * Lucide Icons and Contributors), Lucide's own staging set, drawn on the same
 * 24px grid and stroke rules as the core icons. Copying the handful we need
 * adds no dependency.
 *
 * This file holds **data only**. `components/ui/Icon.tsx` turns each node into
 * a component with lucide-react-native's public `createLucideIcon` factory, so
 * every glyph takes the same size, colour and stroke props as the rest of the
 * registry, and Icon.tsx stays the one file that imports the icon library.
 *
 * // src: lucide-react-native 1.30.0 · dist/types/lucide-react-native.d.ts:
 * //   type IconNode = [elementName: SVGElementType, attrs: Record<string, string>][]
 * // src: https://www.npmjs.com/package/@lucide/lab/v/0.7.0 · dist/esm/icons/<name>.js
 */

/** Structurally lucide's `IconNode`; Icon.tsx passes these straight to `createLucideIcon`. */
export type GlyphNode = [
  elementName: "circle" | "ellipse" | "g" | "line" | "path" | "polygon" | "polyline" | "rect",
  attrs: Record<string, string>,
][];

// src: @lucide/lab 0.7.0 · dist/esm/icons/trousers.js
const trousers: GlyphNode = [
  ["path", { d: "M4 6h16", key: "1o0s65" }],
  [
    "path",
    {
      d: "M6 22a2 2 0 0 1-2-2V3c0-.6.4-1 1-1h14c.6 0 1 .4 1 1v17a2 2 0 0 1-2 2h-3l-3-10-3 10Z",
      key: "1rdpth",
    },
  ],
  ["path", { d: "m6 11-2 1", key: "wg0633" }],
  ["path", { d: "M9 8.5V6", key: "195be6" }],
  ["path", { d: "M15 6v2.5", key: "c1bjdm" }],
  ["path", { d: "m20 12-2-1", key: "1sfjm0" }],
  ["path", { d: "M4 18h6", key: "1jikk7" }],
  ["path", { d: "M14 18h6", key: "1m8k6r" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/shorts.js
const shorts: GlyphNode = [
  ["path", { d: "M2 8h20", key: "d11cs7" }],
  [
    "path",
    {
      d: "M9 20H4a2 2 0 0 1-2-2V5c0-.6.4-1 1-1h18c.6 0 1 .4 1 1v13a2 2 0 0 1-2 2h-5l-3-5Z",
      key: "17og06",
    },
  ],
  ["path", { d: "M9 12V8", key: "2l2gzn" }],
  ["path", { d: "M15 8v4", key: "1tfguq" }],
  ["path", { d: "m5 13-3 2", key: "1pooxw" }],
  ["path", { d: "m22 15-3-2", key: "jeffwy" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/skirt.js
const skirt: GlyphNode = [
  ["rect", { width: "12", height: "4", x: "6", y: "3", key: "bdw6vj" }],
  ["path", { d: "M6 7c0 1.7-.4 3.3-1 4.4C3.8 13.6 2 17 2 17s1.8 1.2 4.5 2.1", key: "qouldt" }],
  ["path", { d: "m8 16-2 4s2.7 1 6 1 6-1 6-1l-2-4", key: "1gwzr8" }],
  [
    "path",
    { d: "M17.5 19.1C20.2 18.2 22 17 22 17s-1.8-3.4-3-5.6c-.6-1.1-1-2.7-1-4.4", key: "wxgezq" },
  ],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/dress.js
const dress: GlyphNode = [
  [
    "path",
    {
      d: "M16 2v3a5.14 5.14 0 0 1 .7 4.8l-.2.5a7.64 7.64 0 0 0 .4 6.3C17.7 17.9 19 20 19 20s-3.1 2-7 2-7-2-7-2 1.3-2.1 2.1-3.5a7.64 7.64 0 0 0 .4-6.2l-.2-.5A5.66 5.66 0 0 1 8 5V2",
      key: "10k3lb",
    },
  ],
  ["path", { d: "M16 5c-1.8 0-3.3 1-4 2.5C11.3 6 9.8 5 8 5", key: "7jp3y9" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/jacket.js
const jacket: GlyphNode = [
  ["path", { d: "M8 4c0 1.1 1.8 2 4 2s4-.9 4-2V3c0-.6-.4-1-1-1H9c-.6 0-1 .4-1 1Z", key: "52eoml" }],
  ["path", { d: "M8 4c0 2 4 5 4 10v8", key: "ddivog" }],
  ["path", { d: "M12 14c0-5 4-8 4-10", key: "1hkkb4" }],
  ["path", { d: "M6 19H3c-.6 0-1-.4-1-1V7c0-1.1.8-2.3 1.9-2.6L8 3", key: "1v55fg" }],
  ["path", { d: "M18 9v12c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9", key: "1erupy" }],
  ["path", { d: "m16 3 4.1 1.4C21.2 4.7 22 5.9 22 7v11c0 .6-.4 1-1 1h-3", key: "cyu0sn" }],
  ["path", { d: "m6 15 2-2", key: "hgibns" }],
  ["path", { d: "m18 15-2-2", key: "60u0ii" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/vest.js
const vest: GlyphNode = [
  [
    "path",
    {
      d: "M10 4a2 2 0 0 0 4 0V3h4v3c0 1.7 1.3 3 3 3v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9c1.7 0 3-1.3 3-3V3h4Z",
      key: "1aiibo",
    },
  ],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/sneaker.js
const sneaker: GlyphNode = [
  ["path", { d: "M14.1 7.9 12.5 10", key: "1omg66" }],
  ["path", { d: "M17.4 10.1 16 12", key: "klmssx" }],
  [
    "path",
    {
      d: "M2 16a2 2 0 0 0 2 2h13c2.8 0 5-2.2 5-5a2 2 0 0 0-2-2c-.8 0-1.6-.2-2.2-.7l-6.2-4.2c-.4-.3-.9-.2-1.3.1 0 0-.6.8-1.2 1.1a3.5 3.5 0 0 1-4.2.1C4.4 7 3.7 6.3 3.7 6.3A.92.92 0 0 0 2 7Z",
      key: "1y12pk",
    },
  ],
  ["path", { d: "M2 11c0 1.7 1.3 3 3 3h7", key: "1aw5u0" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/high-heel.js
const highHeel: GlyphNode = [
  [
    "path",
    {
      d: "M4 3c6 6 8.4 10.5 9.8 12 .9 1 2.5 1.3 3.7.6.3-.2.5-.3.7-.6.6.3 3.8 3.1 3.8 5 0 1-1 1-1 1h-7c-1 0-2-.5-2.6-1.5L10.1 17c-.9-1.6-2.2-3-3.7-4.2L4 11a5 5 0 0 1 0-8",
      key: "1xy4gs",
    },
  ],
  ["path", { d: "m2.56 9.3.6 1.1C4.2 12.6 5 16.5 5 21", key: "tyi6z9" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/socks.js
const socks: GlyphNode = [
  [
    "path",
    {
      d: "M9.6 20.4 9 21a3.38 3.38 0 1 1-4.9-4.9l3.5-3.5C8.4 11.6 9 10.4 9 9V3c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v10a5.15 5.15 0 0 1-1.5 3.6L15 21a3.38 3.38 0 1 1-4.9-4.9l3.5-3.5c.8-1 1.4-2.2 1.4-3.6V2",
      key: "7wkxk6",
    },
  ],
  ["path", { d: "M9 6h12", key: "x4ogtv" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/belt.js
const belt: GlyphNode = [
  ["path", { d: "M7.3 9H3c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1h4.3", key: "1imxws" }],
  ["path", { d: "M6 6h3", key: "qh3tn0" }],
  ["path", { d: "M13 6h.01", key: "cksc78" }],
  ["rect", { width: "10", height: "8", x: "7", y: "2", rx: "2", key: "3xru4v" }],
  ["path", { d: "M16.7 3H21c.6 0 1 .4 1 1v4c0 .6-.4 1-1 1h-4.3", key: "vnlabj" }],
  ["path", { d: "m10.5 10-8.1 6.2", key: "qz383w" }],
  ["path", { d: "M21.6 8.8 12.2 16", key: "fvikpm" }],
  ["path", { d: "M3 22c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1h16l3 3-3 3Z", key: "1n2mdy" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/scarf.js
const scarf: GlyphNode = [
  [
    "path",
    {
      d: "M19.5 2.5 7 15c-.5.5-.6 1.5-.2 2L9 20 21.6 7.6a2 1.7 0 0 0 .1-1.9l-2-3c-.2-.4-.7-.7-1.2-.7h-13c-.5 0-1 .3-1.2.7l-2 3a2 1.7 0 0 0 .2 2l6 5.8",
      key: "ke54ui",
    },
  ],
  ["path", { d: "M12 10 4.5 2.5", key: "l2kccz" }],
  ["path", { d: "M13 20v2", key: "1t5i3p" }],
  ["path", { d: "M16 6H8", key: "whfohi" }],
  ["path", { d: "M17 12.1V22", key: "1sn4cd" }],
  ["path", { d: "M17 18h4", key: "xlnm2s" }],
  ["path", { d: "M17 20H9v2", key: "81fvye" }],
  ["path", { d: "M21 8.2V20", key: "pnvrlw" }],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/hat-bowler.js
// The lab has no plain "hat"; the bowler's crown and brim read as one at 14px.
const hatBowler: GlyphNode = [
  ["path", { d: "M6 13c0 1.7 2.7 3 6 3s6-1.3 6-3v-3a6 6 0 0 0-12 0Z", key: "164rxb" }],
  ["path", { d: "M6 9c0 1.7 2.7 3 6 3s6-1.3 6-3", key: "ewm28i" }],
  [
    "path",
    {
      d: "M6 9.2C3.6 10.3 2 12 2 14c0 3.3 4.5 6 10 6s10-2.7 10-6c0-2-1.6-3.7-4-4.8",
      key: "1urjt8",
    },
  ],
];

// src: @lucide/lab 0.7.0 · dist/esm/icons/gem-ring.js
const gemRing: GlyphNode = [
  ["path", { d: "M13.2 8.1 16 4.4 14.4 2H9.6L8 4.4l2.8 3.7", key: "srrhiz" }],
  ["circle", { cx: "12", cy: "15", r: "7", key: "14w87o" }],
];

export const garmentGlyphs = {
  trousers,
  shorts,
  skirt,
  dress,
  jacket,
  vest,
  sneaker,
  highHeel,
  socks,
  belt,
  scarf,
  hatBowler,
  gemRing,
} as const;
