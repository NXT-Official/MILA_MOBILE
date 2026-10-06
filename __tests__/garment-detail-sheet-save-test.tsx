import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";

import type { DupeMatch } from "@/services/api/items";

/**
 * A match found from a feed post's garment is saved as a post item, linked to
 * that garment, rather than as a Lens dupe. The card itself is stubbed so the
 * test reads exactly what the sheet hands it.
 */
const mockCardProps: Record<string, unknown>[] = [];
jest.mock("../src/components/ui/DupeMatchCard", () => ({
  DupeMatchCard: (props: Record<string, unknown>) => {
    mockCardProps.push(props);
    return null;
  },
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));
jest.mock("../src/hooks/use-profile", () => ({ useProfile: () => ({ data: undefined }) }));
jest.mock("../src/hooks/use-haptics", () => ({ useHaptics: () => ({ selection: jest.fn() }) }));
jest.mock("../src/services/api/items", () => ({ findSimilarItems: jest.fn() }));

import { GarmentDetailSheet } from "@/features/feed/components/GarmentDetailSheet";
import type { PostItem } from "@/lib/outfit-items";
import { findSimilarItems } from "@/services/api/items";

const item: PostItem = {
  id: "post-item-7",
  label: "Denim jacket",
  category: "Outerwear",
  attributes: {
    name: "Denim jacket",
    category: "Outerwear",
    primary_color: "Indigo",
    color_undertone: "Cool",
    silhouette_tags: ["cropped"],
  },
  bbox: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
  source_url: null,
};

const match = { id: "product-3", title: "Cropped denim jacket" } as DupeMatch;

test("each match is saved as a post item, linked to the garment it was found from", async () => {
  jest.mocked(findSimilarItems).mockResolvedValue([match]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  const screen = await render(
    <QueryClientProvider client={client}>
      <GarmentDetailSheet item={item} onClose={jest.fn()} />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(mockCardProps.length).toBeGreaterThan(0));
  expect(mockCardProps.at(-1)).toMatchObject({
    match,
    saveSource: "post_item",
    postItemId: "post-item-7",
  });
  // The sheet caches matches for a day; unmount, then clear, so no 24h
  // garbage-collection timer outlives the test.
  await screen.unmount();
  client.clear();
});
