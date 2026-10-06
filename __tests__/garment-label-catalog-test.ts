import { garmentFor, type GarmentKind } from "@/lib/garment-label";

/**
 * Real catalogue titles, copied from the products the web migrations seed.
 * The catalogue's convention is "Name | Colour | Size", and the colour can
 * itself be a garment word ("Trench Coat Khaki", "Seafoam Tie Dye"). So the
 * label comes from the product name before the first "|", from its head noun
 * (the last garment word: a "Hat Bead Charm" is a charm). When the name gives
 * no confident answer, the category's own label is used. A colour word never
 * decides the label.
 *
 * Mirrors the web's `garment-label` rules, so both clients name a piece the
 * same way.
 */
type Row = [category: string, title: string, label: string, kind: GarmentKind];

/** Titles the first-keyword matcher named wrongly or too vaguely (web review I1). */
const FIXED: Row[] = [
  ["Outerwear", "Baggy Chino | Trench Coat Khaki | 30L", "Outerwear", "outerwear"],
  ["Outerwear", "The Classic Shirt in Linen | Trench Coat Khaki", "Outerwear", "outerwear"],
  ["Outerwear", "The Cotton Honeycomb Square Crew | Trench Coat Khaki", "Outerwear", "outerwear"],
  ["Outerwear", "Labo Men's Mod Coat with Liner Vest", "Coat", "outerwear"],
  ["Accessories", "The Retro Jersey Short | Seafoam Tie Dye", "Accessory", "accessory"],
  ["Accessories", "Hat Bead Charm", "Charm", "accessory"],
  ["Accessories", "Hat Bead Charm Set", "Charm", "accessory"],
  ["Jewelry", "River Ear Cuff Chained Hoop", "Earrings", "jewelry"],
  ["Bottoms", "The A-Line Denim Short | Medium Indigo", "Shorts", "bottoms"],
  ["Bottoms", "The Long A-Line Denim Short | Garment-Dyed Tan", "Shorts", "bottoms"],
  ["Bottoms", "The 7” Slim-Fit Performance Chino Short | Slate Grey", "Shorts", "bottoms"],
  ["Bottoms", "The 7” Slim-Fit Performance Chino Short | Toasted Coconut", "Shorts", "bottoms"],
  ["Bottoms", "The Pull-On Performance Chino Short | Khaki", "Shorts", "bottoms"],
  ["Tops", "Kobe Men's Dri-FIT Fleece Pullover Basketball Hoodie", "Sweatshirt", "top"],
  ["Tops", "Cotton Pique Polo Shirt", "Polo", "top"],
  ["Tops", "DRY-EX Polo Shirt", "Polo", "top"],
  ["Tops", "Pique Mini Polo Shirt", "Polo", "top"],
  ["Shoes", "Studio Kitten Heel Bootie | Russet", "Boots", "shoes"],
];

/** Titles that were already right, and must stay right. */
const CONTROLS: Row[] = [
  ["Dresses", "Ailany Dress", "Dress", "dress"],
  ["Tops", "Adina Top", "Top", "top"],
  ["Bottoms", "Jeane Skirt", "Skirt", "bottoms"],
  ["Bottoms", "Slim Straight Jeans (Men's)", "Jeans", "bottoms"],
  ["Shoes", "Sandy Heeled Sandal", "Sandals", "shoes"],
  ["Jewelry", "Mini Ridge Heart Charm Pendant Necklace | 18ct Gold Plated", "Necklace", "jewelry"],
  ["Jewelry", "14K Lab Grown Diamond Circle Charm Huggies", "Earrings", "jewelry"],
  [
    "Jewelry",
    "Solid Gold Pear Diamond Charm Flat Back Stud Earring | 9ct Solid Gold",
    "Earrings",
    "jewelry",
  ],
  ["Jewelry", "14K Diamond Melbourne Cuff", "Bracelet", "jewelry"],
  ["Accessories", "Nike Everyday Elevated Crew Socks (3 Pairs)", "Socks", "accessory"],
  ["Accessories", "Evermore Solid Brass Leather Belt", "Belt", "accessory"],
  ["Accessories", "Jordan Apex Bucket Hat", "Hat", "accessory"],
  ["Accessories", "KHAITE Donna Lamb leather clutch", "Clutch", "bag"],
  ["Accessories", "Water Repellent 2-Way Shoulder Bag", "Bag", "bag"],
  ["Bags", "Nike Commuter Elite Backpack (15L)", "Backpack", "bag"],
  ["Bags", "Small System Zipper Tote", "Tote", "bag"],
  // Two garment words ending together: the longer phrase is the head noun.
  ["Bags", "Nike Heritage Tote Bag (22L)", "Tote", "bag"],
  ["Tops", "Crew Neck T-Shirt", "T-shirt", "top"],
  ["Tops", "Merino Blend Polo Cardigan | Short Sleeve", "Cardigan", "top"],
  ["Outerwear", "Trench Jacket in Double Cotton", "Jacket", "outerwear"],
  ["Outerwear", "The Oversized Blazer in Stretch Linen | Cedarwood", "Blazer", "outerwear"],
  ["Outerwear", "Lightweight Down Vest", "Vest", "outerwear"],
  ["Shoes", "Made in Italy Ballet Flat | Juniper", "Flats", "shoes"],
  ["Shoes", "The Glove Mule in ReKnit | Seagrass", "Mules", "shoes"],
  ["Bottoms", "The Chino Jogger in Buttersoft | Black", "Joggers", "bottoms"],
  ["Dresses", "Scarf-Tie Mini Dress in Silk Georgette | Men's Navy/Birch", "Dress", "dress"],
];

describe("real catalogue titles the first-keyword matcher got wrong", () => {
  it.each(FIXED)("%s + %j is labelled %s", (category, title, label, kind) => {
    expect(garmentFor(category, title)).toMatchObject({ label, kind });
  });
});

describe("real catalogue titles that were already right", () => {
  it.each(CONTROLS)("%s + %j is labelled %s", (category, title, label, kind) => {
    expect(garmentFor(category, title)).toMatchObject({ label, kind });
  });
});
