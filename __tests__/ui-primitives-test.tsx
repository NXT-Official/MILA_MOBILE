import { fireEvent, render } from "@testing-library/react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { CreditsMeter } from "@/components/ui/CreditsMeter";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, InlineError } from "@/components/ui/ErrorState";
import { SeasonTag } from "@/components/ui/SeasonTag";
import { SettingsList, SettingsRow } from "@/components/ui/SettingsList";

/**
 * The primitives and the accessibility contract they carry.
 *
 * No snapshots: they break on every design change and assert nothing about
 * correctness (§Testing strategy). What is asserted here is behaviour and the
 * accessibility rules that rot silently — a missing label on an icon-only
 * control is invisible until someone using TalkBack hits it.
 *
 * **`render`, `fireEvent` and `rerender` are all async in RNTL 14.** Forgetting
 * an `await` does not fail loudly; it hands back a pending promise whose query
 * methods do not exist yet, and every assertion in the test dies on a confusing
 * "is not a function".
 */

describe("Button", () => {
  it("labels itself and reports the button role", async () => {
    const s = await render(<Button label="Compose today's look" onPress={() => {}} />);
    expect(s.getByRole("button", { name: "Compose today's look" })).toBeTruthy();
  });

  it("fires onPress when enabled", async () => {
    const onPress = jest.fn();
    const s = await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(s.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onPress = jest.fn();
    const s = await render(<Button label="Save" disabled onPress={onPress} />);
    await fireEvent.press(s.getByRole("button", { name: "Save" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not fire while loading, and reports busy", async () => {
    const onPress = jest.fn();
    const s = await render(<Button label="Saving" loading onPress={onPress} />);
    const button = s.getByRole("button", { name: "Saving" });

    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it("keeps the label visible while loading", async () => {
    // The label stays so the member can still read what is happening.
    const s = await render(<Button label="Publishing" loading onPress={() => {}} />);
    expect(s.getByText("Publishing")).toBeTruthy();
  });

  it.each(["primary", "secondary", "outline", "ghost", "destructive"] as const)(
    "renders the %s variant",
    async (variant) => {
      const s = await render(<Button label="Action" variant={variant} onPress={() => {}} />);
      expect(s.getByRole("button", { name: "Action" })).toBeTruthy();
    },
  );
});

describe("Chip", () => {
  it("reports checkbox role and checked state", async () => {
    const s = await render(<Chip label="Everyday Casual" selected onPress={() => {}} />);
    const chip = s.getByRole("checkbox", { name: "Everyday Casual" });
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
  });

  it("carries selection in more than colour — the check glyph appears", async () => {
    const s = await render(<Chip label="Brunch" selected={false} onPress={() => {}} />);
    const unselected = JSON.stringify(s.toJSON());

    await s.rerender(<Chip label="Brunch" selected onPress={() => {}} />);

    // The selected tree gains a node (the check icon), so the two differ
    // structurally rather than only by colour.
    expect(JSON.stringify(s.toJSON())).not.toBe(unselected);
  });
});

describe("SeasonTag", () => {
  /**
   * The signature component, and the strictest application of the
   * Colour-Is-Content rule: the swatch colour is data, and a portion of the
   * audience cannot distinguish the swatches at all. The name is not optional.
   */
  it("always renders the season name beside the swatch", async () => {
    const s = await render(<SeasonTag season="Soft Autumn" hex="#c9a96e" />);
    expect(s.getByText("Soft Autumn")).toBeTruthy();
  });

  it("does not expose the raw hex to assistive tech", async () => {
    const s = await render(<SeasonTag season="Deep Winter" hex="#1b2a41" />);
    expect(s.getByText("Deep Winter")).toBeTruthy();
    expect(s.queryByLabelText("#1b2a41")).toBeNull();
  });
});

describe("CreditsMeter", () => {
  it("announces the balance as a count", async () => {
    const s = await render(<CreditsMeter balance={12} allowance={null} loading={false} />);
    expect(s.getByLabelText(/^12 credits remaining\.$/)).toBeTruthy();
  });

  it("singularises one credit", async () => {
    const s = await render(<CreditsMeter balance={1} allowance={null} loading={false} />);
    expect(s.getByLabelText(/^1 credit remaining\.$/)).toBeTruthy();
  });

  it("counts down to the reset only when a plan owes a daily allowance", async () => {
    const s = await render(<CreditsMeter balance={12} allowance={30} loading={false} />);
    expect(s.getByText(/^Resets in \d+h \d+m\.$/)).toBeTruthy();
  });

  it("promises no reset to a member whose plan owes no allowance", async () => {
    const s = await render(<CreditsMeter balance={12} allowance={null} loading={false} />);
    expect(s.queryByText(/reset/i)).toBeNull();
  });

  it("names the plan's allowance when there is one", async () => {
    const s = await render(<CreditsMeter balance={12} allowance={30} loading={false} />);
    expect(s.getByLabelText(/^12 credits remaining of 30 today\. Resets in \d+h \d+m\.$/)).toBeTruthy();
    expect(s.getByText("of 30 left today")).toBeTruthy();
  });

  it("tells her when the empty bucket comes back", async () => {
    const s = await render(<CreditsMeter balance={0} allowance={30} loading={false} />);
    expect(s.getByLabelText(/They reset tomorrow\.$/)).toBeTruthy();
    expect(s.getByText("They reset tomorrow.")).toBeTruthy();
  });

  it("does not say an empty bucket comes back when no plan refills it", async () => {
    const s = await render(<CreditsMeter balance={0} allowance={null} loading={false} />);
    expect(s.getByLabelText(/You've used all your credits\.$/)).toBeTruthy();
    expect(s.getByText("You've used all your credits.")).toBeTruthy();
    expect(s.queryByText(/reset/i)).toBeNull();
    expect(s.queryByLabelText(/reset/i)).toBeNull();
  });

  it("treats a null balance as zero rather than blank", async () => {
    const s = await render(<CreditsMeter balance={null} allowance={null} loading={false} />);
    expect(s.getByLabelText(/^0 credits remaining\./)).toBeTruthy();
  });

  it("shows a skeleton while loading, not a zero", async () => {
    const s = await render(<CreditsMeter balance={null} allowance={null} loading />);
    expect(s.queryByLabelText(/^0 credits remaining/)).toBeNull();
  });
});

describe("EmptyState", () => {
  it("carries a title, one line, and one action", async () => {
    const onAction = jest.fn();
    const s = await render(
      <EmptyState
        icon="feed"
        title="No looks yet today"
        description="Be the first."
        actionLabel="Post your outfit"
        onAction={onAction}
      />,
    );

    expect(s.getByText("No looks yet today")).toBeTruthy();
    expect(s.getByText("Be the first.")).toBeTruthy();
    await fireEvent.press(s.getByRole("button", { name: "Post your outfit" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("omits the action when there is nothing to do", async () => {
    const s = await render(<EmptyState icon="feed" title="Nothing here" description="Quiet." />);
    expect(s.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("offers a retry in plain language, never a raw code", async () => {
    const onAction = jest.fn();
    const s = await render(
      <ErrorState
        title="The feed didn't load"
        description="Check your connection and try again."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

    await fireEvent.press(s.getByRole("button", { name: "Try again" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("renders an inline failure message", async () => {
    const s = await render(<InlineError message="That photo didn't come through." />);
    expect(s.getByText("That photo didn't come through.")).toBeTruthy();
  });
});

describe("Badge", () => {
  it("carries its meaning in the words, not the fill", async () => {
    const s = await render(<Badge label="Most popular" variant="accent" />);
    expect(s.getByText("Most popular")).toBeTruthy();
  });
});

describe("SettingsRow", () => {
  it("announces the label and its current value together", async () => {
    // "Default location, Manila" in one focus stop, rather than leaving the
    // value orphaned in a second.
    const s = await render(
      <SettingsList>
        <SettingsRow icon="location" label="Default location" value="Manila" onPress={() => {}} />
      </SettingsList>,
    );

    expect(s.getByRole("button", { name: "Default location, Manila" })).toBeTruthy();
  });

  it("falls back to the label alone when there is no value", async () => {
    const s = await render(
      <SettingsList>
        <SettingsRow icon="help" label="Help and feedback" onPress={() => {}} />
      </SettingsList>,
    );

    expect(s.getByRole("button", { name: "Help and feedback" })).toBeTruthy();
  });

  it("fires its press handler", async () => {
    const onPress = jest.fn();
    const s = await render(
      <SettingsList>
        <SettingsRow icon="secure" label="Privacy" onPress={onPress} />
      </SettingsList>,
    );

    await fireEvent.press(s.getByRole("button", { name: "Privacy" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
