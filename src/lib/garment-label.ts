/**
 * Which garment a recommended product is. Every catalogue photo shows a whole
 * outfit, so a card that only says "Tops" leaves her guessing which piece Mila
 * means. This names it, so the badge over the photo can.
 *
 * The rules, in order:
 *
 * 1. **The category decides the kind.** It is the column the server matched
 *    the product on, so it is the truth about which shelf it sits on. A
 *    category this file does not know keeps its own word as the label.
 * 2. **Only the product name is read.** Catalogue titles are
 *    "Name | Colour | Size", and a colour can itself be a garment word
 *    ("Baggy Chino | Trench Coat Khaki"). So only the text before the first "|"
 *    counts, and a trailing " with ..." / " in ..." clause is set aside ("Mod
 *    Coat with Liner Vest" is a coat). If that clause holds the only garment
 *    word ("Made in Italy Ballet Flat"), the whole name is read instead.
 * 3. **The head noun names it.** The garment word that comes last in the name
 *    wins ("Hat Bead Charm" is a charm, "Chino Short" is shorts); when two end
 *    on the same word, the longer phrase wins ("Polo Shirt" is a polo).
 * 4. **Never guess.** The head noun refines the label only on a shelf it
 *    belongs to (`within`); a few may move the piece to its real kind (a clutch
 *    filed under Accessories is a bag). Any other head noun, or none at all,
 *    and the category's own label stands.
 *
 * Pure and platform-free (lib/). The keyword table, labels and rules mirror the
 * web's `src/lib/garment-label.ts`, so both clients name a piece the same way;
 * change both together. `icon` is mobile's only addition.
 */

export type GarmentKind =
  | "top"
  | "bottoms"
  | "dress"
  | "outerwear"
  | "shoes"
  | "bag"
  | "jewelry"
  | "accessory"
  | "unknown";

/**
 * Glyph names. Each one is registered under the same name in
 * `components/ui/Icon.tsx`, which is where the drawing lives; `lib/` only
 * names it.
 */
export type GarmentIcon =
  | "shirt"
  | "trousers"
  | "shorts"
  | "skirt"
  | "dress"
  | "jacket"
  | "vest"
  | "sneaker"
  | "heel"
  | "socks"
  | "belt"
  | "scarf"
  | "hat"
  | "handbag"
  | "backpack"
  | "gem"
  | "ring"
  | "watch"
  | "sunglasses"
  | "tag";

export type Garment = { kind: GarmentKind; label: string; icon: GarmentIcon };

/** The catalogue's eight categories (`constants/wardrobe.ts`), plus their singulars. */
const CATEGORY_KINDS: Readonly<Record<string, GarmentKind>> = {
  top: "top",
  tops: "top",
  bottom: "bottoms",
  bottoms: "bottoms",
  dress: "dress",
  dresses: "dress",
  outerwear: "outerwear",
  shoe: "shoes",
  shoes: "shoes",
  bag: "bag",
  bags: "bag",
  jewelry: "jewelry",
  jewellery: "jewelry",
  accessory: "accessory",
  accessories: "accessory",
};

/** What a piece is called when its name adds nothing confident. */
export const GARMENT_KIND_DEFAULTS: Readonly<Record<GarmentKind, { label: string; icon: GarmentIcon }>> = {
  top: { label: "Top", icon: "shirt" },
  bottoms: { label: "Bottoms", icon: "trousers" },
  dress: { label: "Dress", icon: "dress" },
  outerwear: { label: "Outerwear", icon: "jacket" },
  shoes: { label: "Shoes", icon: "sneaker" },
  bag: { label: "Bag", icon: "handbag" },
  jewelry: { label: "Jewelry", icon: "gem" },
  accessory: { label: "Accessory", icon: "tag" },
  unknown: { label: "Piece", icon: "tag" },
};

export type GarmentKeyword = {
  /**
   * Whole words or phrases, normalised like a title: lowercase, digits kept,
   * every run of anything else one space ("T-Shirt" is "t shirt"). Singular
   * and plural are both listed.
   */
  words: readonly string[];
  label: string;
  /** The shelves (category kinds) this noun may name a piece on. */
  within: readonly GarmentKind[];
  /** The kind the piece becomes when matched. Omitted: the category's kind stays. */
  kind?: GarmentKind;
  icon: GarmentIcon;
};

/**
 * The one keyword table. Which entry wins is decided by position in the name
 * (rule 3), not by order here; order only breaks a tie between two equally
 * long matches ending on the same word.
 */
export const GARMENT_KEYWORDS: readonly GarmentKeyword[] = [
  // Bags, including the ones the catalogue files under Accessories.
  {
    words: ["belt bag", "belt bags", "bum bag", "bum bags", "fanny pack", "fanny packs"],
    label: "Belt bag",
    within: ["bag", "accessory"],
    kind: "bag",
    icon: "handbag",
  },
  {
    words: ["clutch", "clutches"],
    label: "Clutch",
    within: ["bag", "accessory"],
    kind: "bag",
    icon: "handbag",
  },
  {
    words: ["tote", "totes", "tote bag", "tote bags"],
    label: "Tote",
    within: ["bag", "accessory"],
    kind: "bag",
    icon: "handbag",
  },
  {
    words: ["backpack", "backpacks", "rucksack", "rucksacks"],
    label: "Backpack",
    within: ["bag", "accessory"],
    kind: "bag",
    icon: "backpack",
  },
  {
    words: ["bag", "bags", "handbag", "handbags", "purse", "purses"],
    label: "Bag",
    within: ["bag", "accessory"],
    kind: "bag",
    icon: "handbag",
  },

  // Tops.
  { words: ["t shirt", "t shirts", "tee", "tees"], label: "T-shirt", within: ["top"], icon: "shirt" },
  {
    words: ["sweater", "sweaters", "jumper", "jumpers", "pullover", "pullovers"],
    label: "Sweater",
    within: ["top"],
    icon: "shirt",
  },
  {
    words: ["sweatshirt", "sweatshirts", "hoodie", "hoodies"],
    label: "Sweatshirt",
    within: ["top"],
    icon: "shirt",
  },
  { words: ["cardigan", "cardigans"], label: "Cardigan", within: ["top", "outerwear"], icon: "jacket" },
  { words: ["blouse", "blouses"], label: "Blouse", within: ["top"], icon: "shirt" },
  {
    words: ["shirt", "shirts", "button down", "button downs", "button up", "button ups"],
    label: "Shirt",
    within: ["top"],
    icon: "shirt",
  },
  {
    words: ["tank", "tanks", "camisole", "camisoles", "cami", "camis"],
    label: "Tank top",
    within: ["top"],
    icon: "shirt",
  },
  { words: ["bodysuit", "bodysuits"], label: "Bodysuit", within: ["top"], icon: "shirt" },
  {
    words: ["polo", "polos", "polo shirt", "polo shirts"],
    label: "Polo",
    within: ["top"],
    icon: "shirt",
  },

  // Bottoms.
  {
    words: ["skirt", "skirts", "miniskirt", "miniskirts", "skort", "skorts"],
    label: "Skirt",
    within: ["bottoms"],
    icon: "skirt",
  },
  { words: ["short", "shorts", "bermudas"], label: "Shorts", within: ["bottoms"], icon: "shorts" },
  { words: ["jean", "jeans", "denim"], label: "Jeans", within: ["bottoms"], icon: "trousers" },
  { words: ["legging", "leggings"], label: "Leggings", within: ["bottoms"], icon: "trousers" },
  {
    words: ["jogger", "joggers", "sweatpant", "sweatpants"],
    label: "Joggers",
    within: ["bottoms"],
    icon: "trousers",
  },
  {
    words: ["trouser", "trousers", "pant", "pants", "slacks", "chino", "chinos"],
    label: "Trousers",
    within: ["bottoms"],
    icon: "trousers",
  },

  // Dresses.
  { words: ["jumpsuit", "jumpsuits"], label: "Jumpsuit", within: ["dress"], icon: "dress" },

  // Outerwear (the catalogue also files vests and fleece half-zips here).
  { words: ["vest", "vests", "gilet", "gilets"], label: "Vest", within: ["outerwear"], icon: "vest" },
  {
    words: ["half zip", "half zips", "quarter zip", "quarter zips"],
    label: "Half-zip",
    within: ["outerwear"],
    icon: "jacket",
  },
  { words: ["fleece", "fleeces"], label: "Fleece", within: ["outerwear"], icon: "jacket" },
  {
    words: ["coat", "coats", "overcoat", "overcoats", "trench", "trenches", "parka", "parkas"],
    label: "Coat",
    within: ["outerwear"],
    icon: "jacket",
  },
  { words: ["blazer", "blazers"], label: "Blazer", within: ["outerwear"], icon: "jacket" },
  {
    words: ["jacket", "jackets", "bomber", "bombers", "shacket", "shackets"],
    label: "Jacket",
    within: ["outerwear"],
    icon: "jacket",
  },

  // Shoes.
  {
    words: ["sneaker", "sneakers", "trainer", "trainers"],
    label: "Sneakers",
    within: ["shoes"],
    icon: "sneaker",
  },
  {
    words: ["boot", "boots", "bootie", "booties"],
    label: "Boots",
    within: ["shoes"],
    icon: "sneaker",
  },
  {
    words: ["sandal", "sandals", "slide", "slides"],
    label: "Sandals",
    within: ["shoes"],
    icon: "sneaker",
  },
  { words: ["loafer", "loafers"], label: "Loafers", within: ["shoes"], icon: "sneaker" },
  { words: ["mule", "mules"], label: "Mules", within: ["shoes"], icon: "sneaker" },
  {
    words: ["flat", "flats", "ballet flat", "ballet flats", "ballerina", "ballerinas"],
    label: "Flats",
    within: ["shoes"],
    icon: "sneaker",
  },
  {
    words: ["heel", "heels", "pump", "pumps", "stiletto", "stilettos", "slingback", "slingbacks"],
    label: "Heels",
    within: ["shoes"],
    icon: "heel",
  },

  // Jewelry.
  {
    words: [
      "earring",
      "earrings",
      "stud",
      "studs",
      "hoop",
      "hoops",
      "huggie",
      "huggies",
      "ear cuff",
      "ear cuffs",
    ],
    label: "Earrings",
    within: ["jewelry"],
    icon: "gem",
  },
  {
    words: ["necklace", "necklaces", "pendant", "pendants", "choker", "chokers"],
    label: "Necklace",
    within: ["jewelry"],
    icon: "gem",
  },
  {
    words: ["bracelet", "bracelets", "bangle", "bangles", "cuff", "cuffs"],
    label: "Bracelet",
    within: ["jewelry"],
    icon: "gem",
  },
  { words: ["ring", "rings"], label: "Ring", within: ["jewelry"], icon: "ring" },
  { words: ["brooch", "brooches"], label: "Brooch", within: ["jewelry"], icon: "gem" },
  {
    words: ["watch", "watches"],
    label: "Watch",
    within: ["jewelry", "accessory"],
    icon: "watch",
  },
  { words: ["charm", "charms"], label: "Charm", within: ["jewelry", "accessory"], icon: "gem" },

  // Accessories.
  {
    words: ["sunglasses", "sunnies", "shades"],
    label: "Sunglasses",
    within: ["accessory"],
    icon: "sunglasses",
  },
  { words: ["sock", "socks"], label: "Socks", within: ["accessory"], icon: "socks" },
  { words: ["belt", "belts"], label: "Belt", within: ["accessory"], icon: "belt" },
  {
    words: [
      "scarf",
      "scarves",
      "neck wrap",
      "neck wraps",
      "bandana",
      "bandanas",
      "shawl",
      "shawls",
    ],
    label: "Scarf",
    within: ["accessory"],
    icon: "scarf",
  },
  { words: ["cap", "caps"], label: "Cap", within: ["accessory"], icon: "hat" },
  { words: ["beanie", "beanies"], label: "Beanie", within: ["accessory"], icon: "hat" },
  {
    words: ["hat", "hats", "fedora", "fedoras", "beret", "berets", "bucket hat", "bucket hats"],
    label: "Hat",
    within: ["accessory"],
    icon: "hat",
  },
  {
    words: ["glove", "gloves", "mitten", "mittens"],
    label: "Gloves",
    within: ["accessory"],
    icon: "tag",
  },
  { words: ["tie", "ties", "necktie", "neckties"], label: "Tie", within: ["accessory"], icon: "tag" },
];

/** Lowercase words and digits; everything else separates them ("T-Shirt" is t, shirt). */
function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Every keyword as its word sequence, kept beside its entry and its place in the table. */
const PHRASES = GARMENT_KEYWORDS.flatMap((entry, order) =>
  entry.words.map((phrase) => ({ entry, order, tokens: phrase.split(" ") })),
);

/**
 * The head noun of a name: the keyword match that ends last, the longer
 * phrase on a tie at the same word, then the earlier table entry.
 */
function headNoun(name: string): GarmentKeyword | null {
  const tokens = words(name);
  let best: { end: number; length: number; order: number; entry: GarmentKeyword } | null = null;

  for (const { entry, order, tokens: phrase } of PHRASES) {
    for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
      if (!phrase.every((token, offset) => tokens[start + offset] === token)) continue;
      const end = start + phrase.length - 1;
      const better =
        !best ||
        end > best.end ||
        (end === best.end && phrase.length > best.length) ||
        (end === best.end && phrase.length === best.length && order < best.order);
      if (better) best = { end, length: phrase.length, order, entry };
    }
  }
  return best?.entry ?? null;
}

/**
 * The names to read, in order (rule 2): the name without its " with ..." or
 * " in ..." clause, then the whole name. Never the colour or size after "|".
 */
function productNames(title: string): string[] {
  const name = title.split("|")[0];
  const withoutClause = name.split(/\s(?:with|in)\s/i)[0];
  return withoutClause === name ? [name] : [withoutClause, name];
}

export function garmentFor(category?: string | null, title?: string | null): Garment {
  const categoryText = (category ?? "").trim();
  const shelf = CATEGORY_KINDS[categoryText.toLowerCase()];
  if (!shelf) {
    return {
      kind: "unknown",
      label: categoryText || GARMENT_KIND_DEFAULTS.unknown.label,
      icon: GARMENT_KIND_DEFAULTS.unknown.icon,
    };
  }

  const fallback: Garment = { kind: shelf, ...GARMENT_KIND_DEFAULTS[shelf] };
  if (!title) return fallback;

  for (const name of productNames(title)) {
    const head = headNoun(name);
    if (!head) continue;
    // A head noun from another shelf is not a confident answer (rule 4).
    if (!head.within.includes(shelf)) return fallback;
    return { kind: head.kind ?? shelf, label: head.label, icon: head.icon };
  }
  return fallback;
}

/**
 * The product's own name: catalogue titles read "Name | Colour | Size" (rule
 * 2). Mirrors the web's `productName`; the colour map reads it.
 */
export function productName(title: string): string {
  return title.split("|")[0].trim();
}

/** Head-to-toe order for grouped lists. Mirrors the web's `GARMENT_KIND_ORDER`. */
export const GARMENT_KIND_ORDER: readonly GarmentKind[] = [
  "outerwear",
  "top",
  "dress",
  "bottoms",
  "shoes",
  "bag",
  "jewelry",
  "accessory",
  "unknown",
];
