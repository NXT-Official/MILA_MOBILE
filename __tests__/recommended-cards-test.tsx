import { fireEvent, render, within } from "@testing-library/react-native";
import { Linking } from "react-native";

/**
 * Both surfaces that show a recommended product now say which garment it is
 * (badge on the photo, "{Label}: {title}" under it) and carry the save
 * bookmark. Everything the cards showed before is still there.
 */
const mockMutate = jest.fn();
const mockSaves: { status: "ok" | "unavailable"; failure: "save" | "remove" | null } = {
  status: "ok",
  failure: null,
};
jest.mock("../src/hooks/use-saved-products", () => ({
  useSavedProducts: () => ({
    data: mockSaves.status === "ok" ? { status: "ok", items: [] } : { status: "unavailable" },
  }),
  useSetProductSaved: () => ({ mutate: mockMutate, isPending: false }),
  useSaveFailure: () => mockSaves.failure,
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-image", () => ({ Image: () => null }));

import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { DupeMatchCard } from "@/components/ui/DupeMatchCard";
import { ShopThisLookGrid } from "@/features/dashboard/components/ShopThisLookGrid";
import type { DupeMatch } from "@/services/api/items";
import type { ShoppablePick } from "@/types/look";

const pick: ShoppablePick = {
  id: "product-1",
  title: "Wide-leg jeans",
  brand_id: "brand-1",
  category: "Bottoms",
  price: 49,
  currency: "USD",
  image_url: "https://cdn.example.test/jeans.jpg",
  affiliate_link: "https://shop.example.test/jeans",
  verification_status: "verified",
  last_verified_at: "2026-10-01T00:00:00Z",
  rationale: "Balances the cropped top.",
  source: "planned",
};

const match: DupeMatch = {
  id: "product-2",
  title: "Leather clutch",
  brand_id: "brand-2",
  category: "Accessories",
  price: 30,
  currency: "USD",
  image_url: "https://cdn.example.test/clutch.jpg",
  affiliate_link: "https://shop.example.test/clutch",
  description: null,
  match_score: 0.9,
  match_reasons: ["Same structured shape"],
  verification_status: "verified",
  last_verified_at: "2026-10-01T00:00:00Z",
  rating: 4.5,
  units_sold: 120,
  shipping_info: "Free shipping",
  discount_percent: 20,
  is_verified_seller: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSaves.status = "ok";
  mockSaves.failure = null;
});

describe("ShopThisLookGrid", () => {
  it("badges the photo and names the garment under it", async () => {
    const s = await render(<ShopThisLookGrid items={[pick]} />);

    expect(s.getByLabelText("Mila is recommending the jeans")).toBeTruthy();
    expect(s.getByText("Jeans: Wide-leg jeans")).toBeTruthy();
  });

  it("keeps everything the card showed before", async () => {
    const s = await render(<ShopThisLookGrid items={[{ ...pick, source: "similar" }]} />);

    expect(s.getByText("Shop This Look")).toBeTruthy();
    expect(s.getByText("Similar · Bottoms")).toBeTruthy();
    expect(s.getByText("$49")).toBeTruthy();
    expect(s.getByText(/^Last checked /)).toBeTruthy();

    await fireEvent.press(s.getByRole("link", { name: "Shop Wide-leg jeans" }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://shop.example.test/jeans");
  });

  it("still says so when the catalogue matched nothing", async () => {
    const s = await render(<ShopThisLookGrid items={[]} />);
    expect(s.getByText("No verified matching item found.")).toBeTruthy();
  });

  it("saves a pick as a piece from a look", async () => {
    const s = await render(<ShopThisLookGrid items={[pick]} />);

    await fireEvent.press(s.getByLabelText("Save Wide-leg jeans"));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ product: pick, source: "look", saved: true }),
      expect.anything(),
    );
  });
});

describe("DupeMatchCard", () => {
  it("badges the photo, fixing a clutch filed under Accessories, and names it under the photo", async () => {
    const s = await render(<DupeMatchCard match={match} />);

    expect(s.getByLabelText("Mila is recommending the clutch")).toBeTruthy();
    expect(s.getByText("Clutch: Leather clutch")).toBeTruthy();
  });

  it("keeps every line and the card's own link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const s = await render(<DupeMatchCard match={match} />);

    expect(s.getByText("-20%")).toBeTruthy();
    expect(s.getByText("$30")).toBeTruthy();
    expect(s.getAllByLabelText("Verified seller").length).toBeGreaterThan(0);
    expect(s.getByText("4.5")).toBeTruthy();
    expect(s.getByText("120 sold")).toBeTruthy();
    expect(s.getByText("Free shipping")).toBeTruthy();
    expect(s.getByText("Same structured shape")).toBeTruthy();
    expect(s.getByText(/^Last checked /)).toBeTruthy();

    await fireEvent.press(s.getByRole("link"));
    expect(open).toHaveBeenCalledWith("https://shop.example.test/clutch");
    open.mockRestore();
  });

  it("puts the save button beside the card's link, never inside it", async () => {
    const s = await render(<DupeMatchCard match={match} />);
    const link = s.getByRole("link");

    expect(within(link).queryByLabelText("Save Leather clutch")).toBeNull();
    expect(s.getByLabelText("Save Leather clutch")).toBeTruthy();
  });

  it("saves as a dupe by default, and as a post item when the feed says so", async () => {
    const first = await render(<DupeMatchCard match={match} />);
    await fireEvent.press(first.getByLabelText("Save Leather clutch"));
    expect(mockMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "dupe", saved: true }),
      expect.anything(),
    );
    await first.unmount();

    const second = await render(
      <DupeMatchCard match={match} saveSource="post_item" postItemId="item-9" />,
    );
    await fireEvent.press(second.getByLabelText("Save Leather clutch"));
    expect(mockMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "post_item", postItemId: "item-9" }),
      expect.anything(),
    );
  });
});

describe("a failed save, in words", () => {
  it("shows under a Shop This Look card", async () => {
    mockSaves.failure = "save";
    const s = await render(<ShopThisLookGrid items={[pick]} />);
    expect(s.getByText("That didn't save. Check your connection and try again.")).toBeTruthy();
  });

  it("shows under a match card, outside its link", async () => {
    mockSaves.failure = "remove";
    const s = await render(<DupeMatchCard match={match} />);

    expect(
      s.getByText("That wasn't removed. Check your connection and try again."),
    ).toBeTruthy();
    expect(within(s.getByRole("link")).queryByText(/wasn't removed/)).toBeNull();
  });

  it("is absent while nothing has failed", async () => {
    const s = await render(<ShopThisLookGrid items={[pick]} />);
    expect(s.queryByText(/Check your connection/)).toBeNull();
  });
});

describe("the way back to saved pieces", () => {
  it("Shop This Look links to Saved pieces", async () => {
    const s = await render(<ShopThisLookGrid items={[pick]} />);

    await fireEvent.press(s.getByRole("link", { name: "Saved pieces" }));
    expect(router.push).toHaveBeenCalledWith("/saved");
  });

  it("is hidden while saving pieces is not switched on yet", async () => {
    mockSaves.status = "unavailable";
    const s = await render(<ShopThisLookGrid items={[pick]} />);
    expect(s.queryByRole("link", { name: "Saved pieces" })).toBeNull();
  });
});
