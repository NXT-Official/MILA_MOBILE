import { createCaptchaController } from "@/components/feedback/use-captcha-gate";

function handle() {
  return { challenge: jest.fn(async () => "tok"), reset: jest.fn(), markUsed: jest.fn() };
}

test("forwards markUsed, reset and challenge to the attached gate", async () => {
  const controller = createCaptchaController();
  const gate = handle();
  controller.attach(gate);

  controller.markUsed();
  controller.reset();

  expect(gate.markUsed).toHaveBeenCalledTimes(1);
  expect(gate.reset).toHaveBeenCalledTimes(1);
  await expect(controller.challenge()).resolves.toBe("tok");
});

test("is a quiet no-op before the gate mounts and after it detaches", async () => {
  const controller = createCaptchaController();
  expect(() => controller.markUsed()).not.toThrow();
  expect(() => controller.reset()).not.toThrow();
  await expect(controller.challenge()).resolves.toBeNull();

  const gate = handle();
  controller.attach(gate);
  controller.attach(null);
  controller.markUsed();
  expect(gate.markUsed).not.toHaveBeenCalled();
});
