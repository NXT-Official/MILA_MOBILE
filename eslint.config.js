const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/**
 * Flat config OVERRIDES a rule rather than merging it: for any given file, the
 * last matching block's `no-restricted-imports` wins outright. So every block
 * that sets it must restate the global restrictions, which is why these arrays
 * exist rather than being inlined.
 */
const ICON_PATHS = [
  {
    name: "lucide-react-native",
    message: "Import { Icon } from '@/components/ui/Icon' and add the glyph to the registry.",
  },
  {
    name: "@expo/vector-icons",
    message: "lucide-react-native is the only icon library. See AGENTS.md §11.",
  },
];

const PLATFORM_FILE_PATTERN = {
  group: ["**/*.android", "**/*.ios"],
  message: "Import the adapter folder, not a platform file. Metro resolves the variant.",
};

/** services/ is the bottom of the chain: it does I/O and holds no React state. */
const ABOVE_SERVICES = {
  group: ["@/features/*", "@/features/**", "@/app/*", "@/app/**", "@/components/*", "@/components/**", "@/hooks/*", "@/hooks/**"],
  message: "Import direction is downward only. services/ may not import from a layer above it.",
};

/** lib/, constants/, utils/ are pure — they sit below everything. */
const ABOVE_PURE = {
  group: [
    "@/features/*", "@/features/**",
    "@/app/*", "@/app/**",
    "@/components/*", "@/components/**",
    "@/hooks/*", "@/hooks/**",
    "@/services/*", "@/services/**",
  ],
  message: "lib/, constants/, and utils/ are pure. They import nothing from a layer above.",
};

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "node_modules/*"] },

  // ── Baseline for all source ────────────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/Icon.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: ICON_PATHS, patterns: [PLATFORM_FILE_PATTERN] },
      ],
    },
  },

  // ── Design system: tokens only, no arbitrary values ────────────────────────
  {
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      // Matches any string literal carrying an arbitrary Tailwind value, not
      // just a direct className child: nearly every class list in this codebase
      // goes through cn() or cva(), so a `JSXAttribute > Literal` selector
      // would let the common case straight through.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[(#|rgb\\(|[0-9]+(px|rem))/]",
          message:
            "Arbitrary Tailwind values bypass the token system. Use a design token, or add one in theme/.",
        },
        {
          selector: "TemplateElement[value.raw=/\\[(#|rgb\\(|[0-9]+(px|rem))/]",
          message:
            "Arbitrary Tailwind values bypass the token system. Use a design token, or add one in theme/.",
        },
      ],
    },
  },

  // ── Platform: no OS branching above the service layer ──────────────────────
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/lib/**/*.ts",
      "src/constants/**/*.ts",
      "src/utils/**/*.ts",
    ],
    ignores: ["src/app/_layout.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Platform",
          property: "OS",
          message:
            "Platform branching belongs in services/*. Add or extend a platform adapter (AGENTS.md §15).",
        },
      ],
    },
  },

  // ── TypeScript ─────────────────────────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/services/supabase/types.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },

  // ── Layer boundaries. LAST, because these blocks own no-restricted-imports
  //    for the files they match and must carry the baseline restrictions too. ─
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: ICON_PATHS, patterns: [PLATFORM_FILE_PATTERN, ABOVE_SERVICES] },
      ],
    },
  },
  {
    files: ["src/lib/**/*.ts", "src/constants/**/*.ts", "src/utils/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: ICON_PATHS, patterns: [PLATFORM_FILE_PATTERN, ABOVE_PURE] },
      ],
    },
  },
]);
