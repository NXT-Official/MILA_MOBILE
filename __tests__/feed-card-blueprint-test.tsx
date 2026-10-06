import { fireEvent, render } from "@testing-library/react-native";

/**
 * "View AI blueprint" opens the member's own History. On someone else's post
 * that lands her in her own list of looks, which reads as a broken link — and
 * the look itself is private to its author, so there is nothing to route to.
 * The action therefore belongs to her own posts only.
 */
jest.mock("../src/components/media/RemoteImage", () => ({ RemoteImage: () => null }));

import { FeedCard } from "@/features/feed/components/FeedCard";
import type { FeedPost } from "@/services/api/posts";

function post(overrides: Partial<FeedPost>): FeedPost {
  return {
    id: "post-1",
    user_id: "author",
    caption: "Linen and loafers",
    created_at: "2026-10-05T08:00:00Z",
    generated_look_id: "look-1",
    image_url_back: "https://img.test/back.jpg",
    image_url_front: "https://img.test/front.jpg",
    author_name: "Ines",
    author_verified: false,
    is_self: false,
    items: [],
    ...overrides,
  };
}

async function mount(overrides: Partial<FeedPost>) {
  const onOpenBlueprint = jest.fn();
  const screen = await render(
    <FeedCard
      post={post(overrides)}
      onExpired={jest.fn()}
      onLongPress={jest.fn()}
      onOpenAuthor={jest.fn()}
      onOpenBlueprint={onOpenBlueprint}
      onSelectItem={jest.fn()}
    />,
  );
  return { screen, onOpenBlueprint };
}

test("another member's post offers no blueprint link", async () => {
  const { screen } = await mount({ is_self: false });

  expect(screen.queryByText("View AI blueprint")).toBeNull();
  expect(screen.queryByLabelText("View the AI blueprint behind this look")).toBeNull();
  // The caption is still there: only the link is withheld.
  expect(screen.getByText("Linen and loafers")).toBeTruthy();
});

test("her own post still opens the blueprint", async () => {
  const { screen, onOpenBlueprint } = await mount({ is_self: true });

  await fireEvent.press(screen.getByLabelText("View the AI blueprint behind this look"));
  expect(onOpenBlueprint).toHaveBeenCalledTimes(1);
});

test("her own post without a generated look offers no blueprint link", async () => {
  const { screen } = await mount({ is_self: true, generated_look_id: null });

  expect(screen.queryByText("View AI blueprint")).toBeNull();
});
