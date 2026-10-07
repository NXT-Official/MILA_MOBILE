import { act, fireEvent, render } from "@testing-library/react-native";
import { createRef } from "react";

import { CaptchaGate, type CaptchaGateHandle } from "@/components/feedback/CaptchaGate";

/**
 * The hCaptcha library reports every outcome through one `onMessage` channel,
 * as a bare string: a token on success, otherwise a name like `challenge-closed`
 * or `network-error`. The gate used to treat anything it did not recognise as a
 * token, so a closed challenge or a dropped connection showed "Verified" and the
 * sign-in that followed failed with a message she could not act on.
 *
 * These tests drive the gate through the same events the library emits (see
 * `Hcaptcha.js` in the package: tokens arrive with `success: true`, errors with
 * `success: false`, and the library's own `cancel` / loading-timeout events
 * carry no `success` at all).
 */

const mockShow = jest.fn();
const mockHide = jest.fn();
const mockWidget: { onMessage: ((event: unknown) => void) | null } = { onMessage: null };

jest.mock("@hcaptcha/react-native-hcaptcha", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: class MockHcaptcha extends React.Component<{ onMessage: (event: unknown) => void }> {
      show = mockShow;
      hide = mockHide;
      render() {
        mockWidget.onMessage = this.props.onMessage;
        return null;
      }
    },
  };
});

// The real module reads the sitekey from env at import time and throws without it.
jest.mock("@/services/captcha", () => ({
  CAPTCHA_BASE_URL: "https://captcha.example",
  CAPTCHA_SITEKEY: "test-sitekey",
}));

const TOKEN = "10000000-aaaa-bbbb-cccc-000000000001";

function emit(data: string, success?: boolean) {
  return act(async () => {
    mockWidget.onMessage?.(success === undefined ? { nativeEvent: { data } } : { nativeEvent: { data }, success });
  });
}

async function mount(verified = false) {
  const ref = createRef<CaptchaGateHandle>();
  const onChange = jest.fn();
  const screen = await render(<CaptchaGate ref={ref} verified={verified} onChange={onChange} />);
  const open = async () => {
    let outcome: string | null | undefined;
    await act(async () => {
      void ref.current?.challenge().then((value) => {
        outcome = value;
      });
    });
    return () => outcome;
  };
  return { screen, onChange, open, ref };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWidget.onMessage = null;
});

test("a token from a successful challenge settles as verified", async () => {
  const { onChange, open } = await mount();
  const outcome = await open();

  await emit(TOKEN, true);

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(TOKEN);
  expect(outcome()).toBe(TOKEN);
});

test("the widget opening is not an outcome", async () => {
  const { screen, onChange, open } = await mount();
  const outcome = await open();

  await emit("open", true);

  expect(onChange).not.toHaveBeenCalled();
  expect(outcome()).toBeUndefined();
  expect(screen.getByText("Opening challenge…")).toBeTruthy();
});

test.each([
  ["a closed challenge", "challenge-closed", false],
  ["a dropped connection", "network-error", false],
  ["a rate limit", "rate-limited", false],
  ["a challenge error", "challenge-error", false],
  ["a script that would not load", "script-error", false],
  ["the library's own cancel", "cancel", undefined],
  ["the library's loading timeout", "error", undefined],
  ["an expired token", "expired", false],
  ["a name the gate has never seen", "something-new", false],
  ["a long error message the library mislabels as a token", "Failed to load the hCaptcha script from the network", true],
])("%s settles null and never as a token", async (_label, data, success) => {
  const { onChange, open } = await mount();
  const outcome = await open();

  await emit(data, success);

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(null);
  expect(outcome()).toBeNull();
  expect(mockHide).toHaveBeenCalled();
});

test("a challenge she closed goes back to the start without a scolding", async () => {
  const { screen, open } = await mount();
  await open();

  await emit("challenge-closed", false);

  expect(screen.getByText("I am human")).toBeTruthy();
});

test("a failed check says so and offers another go", async () => {
  const { screen, open } = await mount();
  await open();

  await emit("network-error", false);

  expect(screen.getByText("Couldn't check that. Tap to try again.")).toBeTruthy();
  expect(screen.queryByText("Verified")).toBeNull();
});

test("an expired check says so and offers another go", async () => {
  const { screen, open } = await mount();
  await open();

  await emit("expired", false);

  expect(screen.getByText("That check timed out. Tap to try again.")).toBeTruthy();
});

test("trying again after a failure reopens the challenge and clears the message", async () => {
  const { screen, open } = await mount();
  await open();
  await emit("network-error", false);
  mockShow.mockClear();

  await fireEvent.press(screen.getByRole("checkbox", { name: "Verify you are human" }));

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Opening challenge…")).toBeTruthy();
  expect(screen.queryByText("Couldn't check that. Tap to try again.")).toBeNull();
});

test("shows Verified only when the parent holds a token", async () => {
  const { screen } = await mount(true);

  expect(screen.getByText("Verified")).toBeTruthy();
});

describe("a token that has been used", () => {
  async function verified() {
    const m = await mount();
    const outcome = await m.open();
    await emit(TOKEN, true);
    expect(outcome()).toBe(TOKEN);
    return m;
  }

  test("does not report a timeout when the library later fires expiry", async () => {
    const { screen, onChange, ref } = await verified();
    await act(async () => ref.current?.markUsed());
    onChange.mockClear();

    await emit("expired", false);

    expect(screen.queryByText("That check timed out. Tap to try again.")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("reset counts as using it, so a late expiry stays quiet", async () => {
    const { screen, ref } = await verified();
    await act(async () => ref.current?.reset());

    await emit("expired", false);

    expect(screen.queryByText("That check timed out. Tap to try again.")).toBeNull();
  });

  test("an unused token that really expires still says so", async () => {
    const { screen, onChange } = await verified();
    onChange.mockClear();

    await emit("expired", false);

    expect(screen.getByText("That check timed out. Tap to try again.")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
