import { readFileSync } from "node:fs";
import { join } from "node:path";

import { colors, radii, spacing, touchTargets } from "@/theme/tokens";

/**
 * tokens.ts and global.css are two hand-maintained copies of one palette. Two
 * hand-maintained copies of a palette diverge; that is not a prediction, it is
 * an observation. This test is what stops it.
 */
const css = readFileSync(join(__dirname, "../src/theme/global.css"), "utf8");

function cssVars(block: ":root" | ".dark:root"): Record<string, string> {
  // `.dark:root` also matches a naive `:root` search, so anchor on the selector.
  const pattern = block === ":root" ? /(?<![\w.]):root\s*\{([^}]*)\}/ : /\.dark:root\s*\{([^}]*)\}/;
  const body = css.match(pattern)?.[1];
  if (!body) throw new Error(`No ${block} block in global.css`);

  const vars: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    vars[name] = value.trim();
  }
  return vars;
}

/** "245 240 232" → "#f5f0e8" */
function toHex(triplet: string): string {
  const parts = triplet.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Not an rgb triplet: "${triplet}"`);
  }
  return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** camelCase token name → kebab-case CSS variable name. */
const toCssName = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("design tokens", () => {
  const schemes = [
    { name: "light", block: ":root" as const },
    { name: "dark", block: ".dark:root" as const },
  ];

  for (const { name, block } of schemes) {
    describe(`${name} scheme`, () => {
      const vars = cssVars(block);
      const tokens = colors[name as keyof typeof colors];

      it("defines a CSS variable for every token", () => {
        const missing = Object.keys(tokens)
          .map(toCssName)
          .filter((cssName) => !(cssName in vars));
        expect(missing).toEqual([]);
      });

      it("defines no CSS variable without a token", () => {
        const known = new Set(Object.keys(tokens).map(toCssName));
        expect(Object.keys(vars).filter((v) => !known.has(v))).toEqual([]);
      });

      for (const [token, value] of Object.entries(tokens)) {
        it(`${token} matches`, () => {
          const cssValue = vars[toCssName(token)];
          expect(cssValue).toBeDefined();

          // The dark border token is an rgba() in TS because it is consumed at
          // 12% opacity; the CSS side carries the base triplet.
          const expected = value.startsWith("rgba(")
            ? `#${value
                .slice(5, -1)
                .split(",")
                .slice(0, 3)
                .map((n) => Number(n.trim()).toString(16).padStart(2, "0"))
                .join("")}`
            : value;

          expect(toHex(cssValue)).toBe(expected);
        });
      }
    });
  }

  it("keeps the spacing scale in step with tailwind.config.js", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tw = require("../tailwind.config.js");
    const twSpacing = tw.theme.extend.spacing as Record<string, string>;
    for (const [key, value] of Object.entries(spacing)) {
      expect(twSpacing[key]).toBe(`${value}px`);
    }
  });

  it("keeps the touch targets in step with tailwind.config.js", () => {
    // A `min-h-tap` that generates nothing is a 44px rule that silently is not
    // enforced — exactly the failure this pairing exists to catch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tw = require("../tailwind.config.js");
    const twSpacing = tw.theme.extend.spacing as Record<string, string>;
    for (const [key, value] of Object.entries(touchTargets)) {
      expect(twSpacing[key]).toBe(`${value}px`);
    }
    expect(touchTargets.tap).toBeGreaterThanOrEqual(44);
    expect(touchTargets.tile).toBeGreaterThanOrEqual(56);
  });

  it("keeps the radius scale in step with tailwind.config.js", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tw = require("../tailwind.config.js");
    const twRadii = tw.theme.extend.borderRadius as Record<string, string>;
    for (const [key, value] of Object.entries(radii)) {
      expect(twRadii[key]).toBe(`${value}px`);
    }
  });
});
