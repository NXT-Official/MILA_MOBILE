import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SelectRow } from "@/components/ui/SelectRow";
import { Sheet } from "@/components/ui/Sheet";
import {
  DEFAULT_HISTORY_FILTER,
  HISTORY_SORTS,
  isHistoryFiltered,
  type HistoryCategory,
  type HistoryFilter,
  type HistorySort,
} from "@/lib/history-filter";
import { spacing } from "@/theme/tokens";

/**
 * Search, view by style category, and sort, above History's grid. The
 * filtering is `filterHistory` (shared with the web); this only draws the
 * controls and reports what she picked.
 *
 * It sits outside the grid's FlatList on purpose: a search field inside a
 * list header is remounted with the list and drops the keyboard mid-word.
 */
export function HistoryControls({
  filter,
  categories,
  shown,
  total,
  onChange,
  onOpenSort,
}: {
  filter: HistoryFilter;
  categories: HistoryCategory[];
  /** How many looks the current filter leaves. */
  shown: number;
  total: number;
  onChange: (next: HistoryFilter) => void;
  onOpenSort: () => void;
}) {
  const sortLabel = sortLabelOf(filter.sort);
  const filtered = isHistoryFiltered(filter);

  return (
    <View className="gap-md pb-md">
      <View className="px-xl">
        <Input
          accessibilityLabel="Search History"
          placeholder="A look, a piece, a vibe or the weather"
          value={filter.query}
          onChangeText={(query) => onChange({ ...filter, query })}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* A deliberate carousel (§10): one row of views, swiped sideways. */}
      <ScrollView
        horizontal
        accessibilityRole="radiogroup"
        accessibilityLabel="Style category"
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // ScrollView takes its content padding as a style object — case 1 of the exceptions.
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
      >
        {categories.map((category) => (
          <Chip
            key={category.id}
            single
            label={`${category.label} (${category.count})`}
            selected={category.id === filter.category}
            onPress={() => onChange({ ...filter, category: category.id })}
          />
        ))}
      </ScrollView>

      <View className="flex-row items-center justify-between gap-md px-xl">
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-muted">
          {filtered ? `Showing ${shown} of ${total}` : `${total} saved`}
        </Text>
        <View className="flex-row items-center gap-sm">
          {filtered ? (
            <Button
              label="Clear filters"
              variant="ghost"
              size="sm"
              onPress={() => onChange({ ...DEFAULT_HISTORY_FILTER, sort: filter.sort })}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sortLabel}. Change.`}
            onPress={onOpenSort}
            className="active:opacity-60 min-h-tap flex-row items-center gap-xs"
          >
            <Text className="font-body-medium text-sm text-ink">{sortLabel}</Text>
            <Icon name="chevronDown" size="xs" color="muted" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * The order, chosen in a bottom sheet (every dialog on mobile is a sheet).
 * Mounted by the screen at its root, like `VibeSheet`, never inside a card.
 */
export function HistorySortSheet({
  visible,
  sort,
  onClose,
  onSort,
}: {
  visible: boolean;
  sort: HistorySort;
  onClose: () => void;
  onSort: (next: HistorySort) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Sort by">
      <View accessibilityRole="radiogroup" className="gap-md">
        {HISTORY_SORTS.map((option) => (
          <SelectRow
            key={option.id}
            title={option.label}
            selected={option.id === sort}
            onPress={() => {
              onSort(option.id);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}

function sortLabelOf(sort: HistorySort): string {
  return HISTORY_SORTS.find((option) => option.id === sort)?.label ?? "";
}
