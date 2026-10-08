import { fireEvent, render, waitFor } from "@testing-library/react-native";

/**
 * The saved look's detail: it shows "Your colour map" when the look carries
 * one, shows nothing extra for a look saved before the feature, and tells her
 * honestly when Save or share fails, with a way to try again.
 */
const mockOutfit: { data: unknown; isPending: boolean; isError: boolean; refetch: jest.Mock } = {
  data: undefined,
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
const mockRemove = { mutate: jest.fn(), isPending: false };
const mockSaveAndShare = jest.fn();

jest.mock("../src/hooks/use-outfits", () => ({
  useOutfit: () => mockOutfit,
  useDeleteOutfit: () => mockRemove,
}));
jest.mock("../src/services/files", () => ({
  files: { saveAndShareRemoteImage: (...args: unknown[]) => mockSaveAndShare(...args) },
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("../src/hooks/use-saved-products", () => ({
  useSavedProducts: () => ({ data: { status: "ok", items: [] } }),
  useSetProductSaved: () => ({ mutate: jest.fn(), isPending: false }),
  useSaveFailure: () => null,
}));

import { LookDetailScreen } from "@/features/outfits/LookDetailScreen";

const DAILY = {
  type: "daily_look",
  weather: "Partly Cloudy",
  vibe: "Brunch",
  vibe_alignment_score: 88,
  outfit: { headline: "Linen Day", description: "Wide-leg linen.", styling_notes: "Cuff once." },
  hair: { style: "Low chignon", execution_tip: "Damp hair." },
  makeup: null,
};

const MAP = [
  { kind: "outerwear", label: "Coat", title: "Wool Overcoat", wear: { name: "Charcoal", hex: "#36454F", role: "base" } },
  { kind: "top", label: "Shirt", title: "Silk Camp Shirt", wear: { name: "Cream", hex: "#FFFDD0", role: "statement" } },
];

function show(analysis: unknown) {
  mockOutfit.data = {
    id: "o1",
    image_url: "https://img.example.test/a.jpg",
    created_at: "2026-10-07T08:00:00Z",
    analysis_result: analysis,
  };
}

beforeEach(() => {
  mockSaveAndShare.mockReset();
  mockOutfit.isPending = false;
  mockOutfit.isError = false;
});

describe("LookDetailScreen colour map", () => {
  it("shows Your colour map when the look carries one", async () => {
    show({ ...DAILY, colourMap: MAP });
    const s = await render(<LookDetailScreen id="o1" />);
    expect(s.getByText("Your colour map")).toBeTruthy();
    expect(s.getByText("Charcoal")).toBeTruthy();
    expect(s.getByText("Cream")).toBeTruthy();
  });

  it("a look saved before the feature is unchanged", async () => {
    show(DAILY);
    const s = await render(<LookDetailScreen id="o1" />);
    expect(s.queryByText("Your colour map")).toBeNull();
    expect(s.queryByText(/no colour map/i)).toBeNull();
    expect(s.getByText("Linen Day")).toBeTruthy();
  });
});

describe("LookDetailScreen suggested items", () => {
  const PICK = {
    id: "p1",
    title: "Striped Cotton Jacket",
    brand_id: "b1",
    category: "outerwear",
    price: 89,
    currency: "USD",
    image_url: "https://img.example.test/p1.jpg",
    affiliate_link: "https://shop.example.test/p1",
    verification_status: "verified",
    last_verified_at: null,
    rationale: "Echoes the stripe.",
  };

  it("a look saved with its suggested items shows them, each with a shop link", async () => {
    show({ ...DAILY, shoppable_picks: [PICK] });
    const s = await render(<LookDetailScreen id="o1" />);
    expect(s.getByLabelText("Shop Striped Cotton Jacket")).toBeTruthy();
  });

  it("a look saved before the field existed shows no items section", async () => {
    show(DAILY);
    const s = await render(<LookDetailScreen id="o1" />);
    expect(s.queryByText("No verified matching item found.")).toBeNull();
    expect(s.queryByLabelText(/^Shop /)).toBeNull();
  });
});

describe("LookDetailScreen save and share", () => {
  const save = (s: Awaited<ReturnType<typeof render>>) =>
    fireEvent.press(s.getByLabelText("Save or share this look"));

  it("hands the image to the share flow and shows no error when it works", async () => {
    show(DAILY);
    mockSaveAndShare.mockResolvedValue("shared");
    const s = await render(<LookDetailScreen id="o1" />);
    await save(s);
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(1));
    expect(mockSaveAndShare).toHaveBeenCalledWith({
      filename: "mila-look-linen-day.jpg",
      url: "https://img.example.test/a.jpg",
    });
    expect(s.queryByText("This look didn't save. Please try again.")).toBeNull();
  });

  it("closing the share sheet is not an error", async () => {
    show(DAILY);
    mockSaveAndShare.mockResolvedValue("cancelled");
    const s = await render(<LookDetailScreen id="o1" />);
    await save(s);
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(1));
    expect(s.queryByText("This look didn't save. Please try again.")).toBeNull();
  });

  it("a failed save says so plainly, with a Try again that runs it again", async () => {
    show(DAILY);
    mockSaveAndShare.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce("shared");
    const s = await render(<LookDetailScreen id="o1" />);
    await save(s);
    expect(await s.findByText("This look didn't save. Please try again.")).toBeTruthy();
    // Plain language, never the raw error.
    expect(s.queryByText(/network down/)).toBeNull();

    await fireEvent.press(s.getByLabelText("Try again"));
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(s.queryByText("This look didn't save. Please try again.")).toBeNull());
  });

  it("a double press starts one save, not two", async () => {
    show(DAILY);
    let finish: (v: string) => void = () => undefined;
    mockSaveAndShare.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const s = await render(<LookDetailScreen id="o1" />);
    const button = s.getByLabelText("Save or share this look");
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(mockSaveAndShare).toHaveBeenCalledTimes(1);
    finish("shared");
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(1));
    // Free again once it settles.
    mockSaveAndShare.mockResolvedValue("shared");
    await fireEvent.press(button);
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(2));
  });

  it("Try again during a run is busy, disabled and ignored; the error clears when it works", async () => {
    show(DAILY);
    let finish: (v: string) => void = () => undefined;
    mockSaveAndShare
      .mockRejectedValueOnce(new Error("down"))
      .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const s = await render(<LookDetailScreen id="o1" />);
    await fireEvent.press(s.getByLabelText("Save or share this look"));
    await s.findByText("This look didn't save. Please try again.");

    await fireEvent.press(s.getByLabelText("Try again"));
    await waitFor(() => expect(mockSaveAndShare).toHaveBeenCalledTimes(2));
    const retry = s.getByLabelText("Try again");
    expect(retry.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
    await fireEvent.press(retry);
    await fireEvent.press(s.getByLabelText("Save or share this look"));
    expect(mockSaveAndShare).toHaveBeenCalledTimes(2);

    finish("shared");
    await waitFor(() => expect(s.queryByText("This look didn't save. Please try again.")).toBeNull());
  });
});
