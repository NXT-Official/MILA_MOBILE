// `utils/image.ts` reaches a native module at import time; only the pure
// resize maths is under test here, so the module is stubbed out.
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

import { UPLOAD_MAX_EDGE, resizeTarget } from "@/utils/image";

/**
 * The failure this protects against is silent and expensive: a fixed
 * `{ width: 1440 }` leaves a portrait capture nearly twice its intended size,
 * so every Lens analysis costs a member extra cellular data and every low-end
 * device holds a bigger bitmap — and nothing on screen says so.
 */
describe("resizeTarget", () => {
  it("caps the long edge of a landscape source on width", () => {
    expect(resizeTarget({ width: 4000, height: 3000 })).toEqual({
      width: UPLOAD_MAX_EDGE,
      height: null,
    });
  });

  it("caps the long edge of a portrait source on height", () => {
    // The one a naive `{ width: maxEdge }` gets wrong: this would otherwise
    // resolve to 1440×1920 and stay well over the intended size.
    expect(resizeTarget({ width: 3000, height: 4000 })).toEqual({
      width: null,
      height: UPLOAD_MAX_EDGE,
    });
  });

  it("caps a square source on width", () => {
    expect(resizeTarget({ width: 2000, height: 2000 })).toEqual({
      width: UPLOAD_MAX_EDGE,
      height: null,
    });
  });

  it("never upscales a source already under the cap", () => {
    expect(resizeTarget({ width: 800, height: 1000 })).toBeNull();
  });

  it("leaves a source exactly at the cap alone", () => {
    expect(resizeTarget({ width: 1080, height: UPLOAD_MAX_EDGE })).toBeNull();
  });

  it("skips the resize when the picker reported no dimensions", () => {
    // Android's photo picker returns 0 when the system did not provide a size.
    // Guessing an axis from a zero would stretch the image.
    expect(resizeTarget({ width: 0, height: 0 })).toBeNull();
  });

  it("honours an explicit cap", () => {
    expect(resizeTarget({ width: 4000, height: 3000 }, 720)).toEqual({ width: 720, height: null });
  });
});
