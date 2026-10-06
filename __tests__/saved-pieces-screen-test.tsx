import { fireEvent, render } from "@testing-library/react-native";

import type {
  SavedProduct,
  SavedProductSnapshot,
  SavedProductsList,
} from "@/services/supabase/saved-products";

/**
 * The saved-pieces screen: every recommended product she kept, grouped by
 * garment, each one badged, with a way to shop it (when it can still be
 * bought) and a way to let it go. Five honest states: loading, error, not yet
 * available (migration not applied), empty, and the list.
 */
const mockQuery: {
  data: SavedProductsList | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: jest.Mock;
  isRefetching: boolean;
} = { data: undefined, isPending: true, isError: false, refetch: jest.fn(), isRefetching: false };
const mockRemove = { mutate: jest.fn(), isPending: false, isError: false, reset: jest.fn() };

jest.mock("../src/hooks/use-saved-products", () => ({
  useSavedProducts: () => mockQuery,
  useRemoveSavedProduct: () => mockRemove,
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));

import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { SavedPiecesScreen } from "@/features/saved/SavedPiecesScreen";

function piece({
  snapshot,
  ...overrides
}: Partial<Omit<SavedProduct, "snapshot">> & {
  id: string;
  snapshot?: Partial<SavedProductSnapshot>;
}): SavedProduct {
  return {
    product_id: `product-${overrides.id}`,
    source: "look",
    outfit_id: null,
    post_item_id: null,
    created_at: "2026-10-07T08:00:00Z",
    availability: "available",
    ...overrides,
    snapshot: {
      title: "Classic piece",
      image_url: null,
      product_url: "https://shop.example.test/item",
      price: 40,
      currency: "USD",
      category: "Tops",
      brand: null,
      ...snapshot,
    },
  };
}

function show(data: SavedProductsList | undefined, state: Partial<typeof mockQuery> = {}) {
  Object.assign(mockQuery, {
    data,
    isPending: false,
    isError: false,
    isRefetching: false,
    ...state,
  });
  return render(<SavedPiecesScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemove.isPending = false;
  mockRemove.isError = false;
});

test("loading shows the shape of the list, never a spinner", async () => {
  const s = await show(undefined, { isPending: true });
  expect(s.getByText("Saved pieces")).toBeTruthy();
  expect(s.getByLabelText("Loading your saved pieces")).toBeTruthy();
});

test("a failed load says so plainly and offers a retry", async () => {
  const s = await show(undefined, { isError: true });
  expect(s.getByText("Your saved pieces didn't load")).toBeTruthy();

  await fireEvent.press(s.getByRole("button", { name: "Try again" }));
  expect(mockQuery.refetch).toHaveBeenCalled();
});

test("before the feature is switched on, it says 'not yet' calmly", async () => {
  const s = await show({ status: "unavailable" });
  expect(s.getByText("Saved pieces are almost here")).toBeTruthy();
  expect(s.queryByText(/didn't load/)).toBeNull();
});

test("an empty list invites her to save from Home", async () => {
  const s = await show({ status: "ok", items: [] });
  expect(s.getByText("Nothing saved yet")).toBeTruthy();

  await fireEvent.press(s.getByRole("button", { name: "Go to Home" }));
  expect(router.replace).toHaveBeenCalledWith("/");
});

test("groups pieces by garment, in wardrobe order, each badged and named", async () => {
  const s = await show({
    status: "ok",
    items: [
      piece({ id: "a", snapshot: { title: "Leather clutch", category: "Accessories" } }),
      piece({ id: "b", snapshot: { title: "Wide-leg jeans", category: "Bottoms" } }),
      piece({ id: "c", snapshot: { title: "Silk blouse", category: "Tops" } }),
    ],
  });

  const headers = s.getAllByRole("header").map((node) => node.props.children);
  expect(headers).toEqual(["Saved pieces", "Tops", "Bottoms", "Bags"]);

  expect(s.getByText("Blouse: Silk blouse")).toBeTruthy();
  expect(s.getByText("Jeans: Wide-leg jeans")).toBeTruthy();
  expect(s.getByText("Clutch: Leather clutch")).toBeTruthy();
  expect(s.getByLabelText("Mila is recommending the clutch")).toBeTruthy();
});

test("a piece that can be bought opens its shop link", async () => {
  const s = await show({
    status: "ok",
    items: [piece({ id: "a", snapshot: { title: "Silk blouse", product_url: "https://shop.example.test/blouse" } })],
  });

  await fireEvent.press(s.getByRole("link", { name: "Shop Silk blouse" }));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://shop.example.test/blouse");
});

test.each<[SavedProduct["availability"], string]>([
  ["gone", "No longer available"],
  ["out_of_stock", "Out of stock right now"],
  ["link_broken", "The shop link isn't working right now"],
])("a %s piece is labelled and has no Shop button", async (availability, note) => {
  const s = await show({
    status: "ok",
    items: [piece({ id: "a", availability, snapshot: { title: "Silk blouse" } })],
  });

  expect(s.getByText(note)).toBeTruthy();
  expect(s.queryByRole("link", { name: "Shop Silk blouse" })).toBeNull();
  // She can still let it go.
  expect(s.getByRole("button", { name: "Remove Silk blouse" })).toBeTruthy();
});

test("a link that is not a web address gets no Shop button", async () => {
  const s = await show({
    status: "ok",
    items: [piece({ id: "a", snapshot: { title: "Silk blouse", product_url: "javascript:alert(1)" } })],
  });
  expect(s.queryByRole("link", { name: "Shop Silk blouse" })).toBeNull();
});

test("a piece with no title is still named", async () => {
  const s = await show({
    status: "ok",
    items: [piece({ id: "a", availability: "gone", snapshot: { title: null, category: null } })],
  });
  expect(s.getByText("Piece: Saved piece")).toBeTruthy();
});

test("removing asks first, then removes that row", async () => {
  const item = piece({ id: "a", snapshot: { title: "Silk blouse" } });
  const s = await show({ status: "ok", items: [item] });

  await fireEvent.press(s.getByRole("button", { name: "Remove Silk blouse" }));
  expect(s.getByText("Remove this piece?")).toBeTruthy();

  await fireEvent.press(s.getByRole("button", { name: "Remove" }));
  expect(mockRemove.mutate).toHaveBeenCalledWith(item, expect.anything());
});

test("a failed removal keeps the sheet open and says what happened", async () => {
  mockRemove.isError = true;
  const s = await show({ status: "ok", items: [piece({ id: "a", snapshot: { title: "Silk blouse" } })] });

  await fireEvent.press(s.getByRole("button", { name: "Remove Silk blouse" }));
  expect(s.getByText("That didn't go through. Check your connection and try again.")).toBeTruthy();
});
