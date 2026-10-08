import { Text, View } from "react-native";

import {
  asWearColour,
  defaultRoleFor,
  type SavedColourMapRow,
  type WearRole,
} from "@/lib/wear-colour";
import type { GarmentKind } from "@/lib/garment-label";

const ROLE_NAMES: Readonly<Record<WearRole, string>> = {
  base: "Base",
  statement: "Statement",
  accent: "Accent",
};

const ROLE_PLACES: Readonly<Record<WearRole, string>> = {
  base: "Bottoms and outer layers",
  statement: "Near your face",
  accent: "Shoes, bag and jewellery",
};

/**
 * The role words under a colour. The place ("Near your face") is shown only
 * when the role is where this kind of piece sits on the wear map; a role the
 * model gave against the map (a statement shoe) shows its name alone, so the
 * words never contradict the piece.
 */
function roleWords(role: WearRole, kind: GarmentKind): string {
  return role === defaultRoleFor(kind)
    ? `${ROLE_NAMES[role]} · ${ROLE_PLACES[role]}`
    : ROLE_NAMES[role];
}

/** The row as one spoken sentence: garment, colour, then the role in plain words. */
function rowLabel(label: string, wear: { name: string; role: WearRole } | null, kind: GarmentKind) {
  if (!wear) return `${label}. No colour picked for this piece`;
  const place = ROLE_PLACES[wear.role];
  const words =
    wear.role === defaultRoleFor(kind)
      ? `${ROLE_NAMES[wear.role]}, ${place.charAt(0).toLowerCase()}${place.slice(1)}`
      : ROLE_NAMES[wear.role];
  return `${label}. ${wear.name}. ${words}`;
}

/**
 * "Your colour map": which of her own colours to wear each piece of a saved
 * look in, its role beside it. The swatch is her colour as data, never the
 * only signal: the colour's name and its role are always written out, and the
 * dot is hidden from assistive tech.
 *
 * A look from before colour maps, or one with no colour picked at all, shows
 * nothing: the screen is unchanged, not given an empty map.
 */
export function ColourMap({ rows }: { rows: readonly SavedColourMapRow[] }) {
  // Rows from a saved look arrive unchecked: only a whole, safe colour is painted.
  const checked = rows.map((row) => ({ ...row, wear: asWearColour(row.wear) }));
  if (!checked.some((row) => row.wear !== null)) return null;

  return (
    <View className="gap-md">
      <Text
        accessibilityRole="header"
        className="font-body-semibold text-section tracking-section uppercase text-ink"
      >
        Your colour map
      </Text>
      <Text className="font-body text-sm text-body">Wear each piece in one of your colours.</Text>
      <View className="gap-lg pt-sm">
        {checked.map((row, index) => (
          <View
            key={`${row.kind}-${index}`}
            // One stop per piece: a screen reader hears the whole sentence once.
            accessible
            accessibilityLabel={rowLabel(row.label, row.wear, row.kind)}
            className="flex-row items-start gap-md"
          >
            <View
              testID="colour-dot"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className={
                row.wear
                  ? "h-9 w-9 rounded-pill border border-border dark:border-border/12"
                  : "h-9 w-9 rounded-pill border border-dashed border-muted"
              }
              // StyleSheet exception 1 (measured): her swatch hex is runtime data, not a token.
              style={row.wear ? { backgroundColor: row.wear.hex } : undefined}
            />
            <View className="min-w-0 flex-1">
              <Text className="font-body-semibold text-micro tracking-label uppercase text-ink">
                {row.label}
              </Text>
              {row.wear ? (
                <>
                  <Text className="font-display text-base text-ink">{row.wear.name}</Text>
                  <Text className="font-body text-micro text-muted">
                    {roleWords(row.wear.role, row.kind)}
                  </Text>
                </>
              ) : (
                <Text className="font-body text-sm text-muted">
                  No colour picked for this piece.
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
