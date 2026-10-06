import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";

import type { SavedProduct, SavedProductsList } from "@/services/supabase/saved-products";

/**
 * The bookmark on a recommended piece. Real hooks over a real query client
 * (the optimistic write and its rollback live in the hook, and a stub would
 * only restate them); the service is the stub, so a test decides when and how
 * each write lands.
 */
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/services/supabase/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../src/services/supabase/saved-products", () => ({
  listSavedProducts: jest.fn(),
  saveProduct: jest.fn(),
  removeSavedProduct: jest.fn(),
}));

import { SaveFailedNotice, SaveProductButton } from "@/components/ui/SaveProductButton";
import { useRemoveSavedProduct } from "@/hooks/use-saved-products";
import { trackEvent } from "@/services/supabase/analytics";
import {
  listSavedProducts,
  removeSavedProduct,
  saveProduct,
} from "@/services/supabase/saved-products";

const product = {
  id: "product-1",
  title: "Wide-leg jeans",
  image_url: "https://cdn.example.test/jeans.jpg",
  affiliate_link: "https://shop.example.test/jeans",
  price: 49,
  currency: "USD",
  category: "Bottoms",
};

function savedRow(productId: string): SavedProduct {
  return {
    id: `row-${productId}`,
    product_id: productId,
    source: "look",
    outfit_id: null,
    post_item_id: null,
    created_at: "2026-10-07T08:00:00Z",
    snapshot: {
      title: "Wide-leg jeans",
      image_url: null,
      product_url: null,
      price: 49,
      currency: "USD",
      category: "Bottoms",
      brand: null,
    },
    availability: "available",
  };
}

let client: QueryClient;

function withClient(node: React.ReactElement) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flushes TanStack's batched observer notifications (scheduled with setTimeout 0). */
async function settle() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

beforeEach(() => {
  // Reset, not just clear: a queued one-off result must not leak into the next test.
  jest.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => client.clear());

async function renderButton(list: SavedProductsList) {
  jest.mocked(listSavedProducts).mockResolvedValue(list);
  const screen = await render(withClient(<SaveProductButton product={product} source="look" />));
  // The list query has to land before the control can know its state. TanStack
  // notifies observers on a zero-delay timeout, so let one pass inside act().
  await waitFor(() => expect(client.getQueryData(["saved-products", "member"])).toBeDefined());
  await settle();
  return screen;
}

test("is hidden while saved pieces are unavailable (migration not applied)", async () => {
  const screen = await renderButton({ status: "unavailable" });
  expect(screen.queryByLabelText("Save Wide-leg jeans")).toBeNull();
});

test("carries its state on the focusable control, for native and for the web build", async () => {
  const screen = await renderButton({ status: "ok", items: [] });
  const control = screen.getByLabelText("Save Wide-leg jeans");

  expect(control.type).toBe("View");
  expect(control.props.accessibilityRole).toBe("button");
  expect(control.props.accessibilityState).toMatchObject({ selected: false });
  expect(control.props["aria-pressed"]).toBe(false);
});

test("reads an already-saved piece as selected", async () => {
  const screen = await renderButton({ status: "ok", items: [savedRow("product-1")] });
  const control = screen.getByLabelText("Save Wide-leg jeans");

  expect(control.props.accessibilityState).toMatchObject({ selected: true });
  expect(control.props["aria-pressed"]).toBe(true);
});

test("saving flips the bookmark before the server answers, then records the event", async () => {
  const write = deferred<"saved">();
  jest.mocked(saveProduct).mockReturnValue(write.promise);
  const screen = await renderButton({ status: "ok", items: [] });

  await fireEvent.press(screen.getByLabelText("Save Wide-leg jeans"));
  await settle();

  expect(saveProduct).toHaveBeenCalledWith("member", { productId: "product-1", source: "look" });
  expect(screen.getByLabelText("Save Wide-leg jeans").props.accessibilityState).toMatchObject({
    selected: true,
  });

  jest.mocked(listSavedProducts).mockResolvedValue({ status: "ok", items: [savedRow("product-1")] });
  await act(async () => write.resolve("saved"));
  await settle();
  await settle();

  expect(trackEvent).toHaveBeenCalledWith("member", "product_saved", {
    product_id: "product-1",
    source: "look",
  });
  expect(screen.getByLabelText("Save Wide-leg jeans").props["aria-pressed"]).toBe(true);
});

test("a failed save puts the bookmark back", async () => {
  const write = deferred<"saved">();
  jest.mocked(saveProduct).mockReturnValue(write.promise);
  const screen = await renderButton({ status: "ok", items: [] });

  await fireEvent.press(screen.getByLabelText("Save Wide-leg jeans"));
  await settle();
  expect(screen.getByLabelText("Save Wide-leg jeans").props["aria-pressed"]).toBe(true);

  await act(async () => write.reject(new Error("offline")));
  await settle();
  await settle();

  expect(screen.getByLabelText("Save Wide-leg jeans").props["aria-pressed"]).toBe(false);
  expect(trackEvent).not.toHaveBeenCalled();
});

test("unsaving removes by product and records the event", async () => {
  jest.mocked(removeSavedProduct).mockResolvedValue("removed");
  const screen = await renderButton({ status: "ok", items: [savedRow("product-1")] });

  jest.mocked(listSavedProducts).mockResolvedValue({ status: "ok", items: [] });
  await fireEvent.press(screen.getByLabelText("Save Wide-leg jeans"));
  await settle();
  await act(async () => {});

  expect(removeSavedProduct).toHaveBeenCalledWith("member", { productId: "product-1" });
  expect(trackEvent).toHaveBeenCalledWith("member", "product_unsaved", {
    product_id: "product-1",
    source: "look",
  });
  expect(screen.getByLabelText("Save Wide-leg jeans").props["aria-pressed"]).toBe(false);
});

test("ignores a second tap while the first write is in flight", async () => {
  const write = deferred<"saved">();
  jest.mocked(saveProduct).mockReturnValue(write.promise);
  const screen = await renderButton({ status: "ok", items: [] });

  await fireEvent.press(screen.getByLabelText("Save Wide-leg jeans"));
  await settle();
  // The control is now busy: a second tap is not a second write.
  expect(screen.getByLabelText("Save Wide-leg jeans").props.accessibilityState).toMatchObject({
    busy: true,
  });
  await fireEvent.press(screen.getByLabelText("Save Wide-leg jeans"));
  await settle();

  expect(saveProduct).toHaveBeenCalledTimes(1);
  expect(removeSavedProduct).not.toHaveBeenCalled();
  await act(async () => write.resolve("saved"));
  await settle();
});

/**
 * TalkBack's double-tap is an accessibility click on the element it focused.
 * React Native's Pressability drops a click whose target is not the element
 * that owns the handler (it treats it as coming from a nested control), so the
 * focused, named element must be the one that handles the press.
 * src: react-native 0.86.3 · Libraries/Pressability/Pressability.js (onClick:
 *   "we shouldn't respond to clicks from nested pressables").
 * On web, react-native-web gives a Pressable its own tab stop, so the same rule
 * means one named tab stop instead of an unnamed one plus the button.
 */
test("the named, focusable button is the element that handles the press", async () => {
  const screen = await renderButton({ status: "ok", items: [] });
  const control = screen.getByRole("button", { name: "Save Wide-leg jeans" });

  expect(control.props.accessible).not.toBe(false);
  expect(typeof control.props.onClick).toBe("function");
});

test("a screen reader's double-tap on the focused button saves the piece", async () => {
  jest.mocked(saveProduct).mockResolvedValue("saved");
  const screen = await renderButton({ status: "ok", items: [] });
  const control = screen.getByRole("button", { name: "Save Wide-leg jeans" });

  // An accessibility click: no pointer, and the focused element is its own target.
  await act(async () => control.props.onClick({ nativeEvent: {}, target: 7, currentTarget: 7 }));
  await settle();

  expect(saveProduct).toHaveBeenCalledWith("member", { productId: "product-1", source: "look" });
});

async function renderWithNotice(list: SavedProductsList) {
  jest.mocked(listSavedProducts).mockResolvedValue(list);
  const screen = await render(
    withClient(
      <>
        <SaveProductButton product={product} source="look" />
        <SaveFailedNotice productId={product.id} />
      </>,
    ),
  );
  await waitFor(() => expect(client.getQueryData(["saved-products", "member"])).toBeDefined());
  await settle();
  return screen;
}

test("a failed save says so in words, and the message clears when she tries again", async () => {
  const first = deferred<"saved">();
  jest.mocked(saveProduct).mockReturnValueOnce(first.promise);
  const screen = await renderWithNotice({ status: "ok", items: [] });
  expect(screen.queryByText(/didn't save/)).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Save Wide-leg jeans" }));
  await act(async () => first.reject(new Error("offline")));
  await settle();
  await settle();

  expect(screen.getByText("That didn't save. Check your connection and try again.")).toBeTruthy();

  const retry = deferred<"saved">();
  jest.mocked(saveProduct).mockReturnValueOnce(retry.promise);
  await fireEvent.press(screen.getByRole("button", { name: "Save Wide-leg jeans" }));
  await settle();

  expect(screen.queryByText(/didn't save/)).toBeNull();
  await act(async () => retry.resolve("saved"));
  await settle();
});

test("a failed removal says so in words too", async () => {
  jest.mocked(removeSavedProduct).mockRejectedValueOnce(new Error("offline"));
  const screen = await renderWithNotice({ status: "ok", items: [savedRow("product-1")] });

  await fireEvent.press(screen.getByRole("button", { name: "Save Wide-leg jeans" }));
  await settle();
  await settle();

  expect(
    screen.getByText("That wasn't removed. Check your connection and try again."),
  ).toBeTruthy();
});

test("removing a piece whose save is still settling removes it by product, not by its placeholder id", async () => {
  jest.mocked(removeSavedProduct).mockResolvedValue("removed");
  const { result } = await renderHook(() => useRemoveSavedProduct(), {
    wrapper: ({ children }: { children: React.ReactNode }) => withClient(<>{children}</>),
  });

  await act(async () => {
    await result.current.mutateAsync({ ...savedRow("product-1"), id: "pending-product-1" });
  });

  expect(removeSavedProduct).toHaveBeenCalledWith("member", { productId: "product-1" });
});
