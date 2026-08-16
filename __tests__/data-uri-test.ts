import { dataUriMimeType, dataUriToBytes } from "@/utils/data-uri";

/**
 * The generated look's visual arrives as a base64 `data:` URI and has to reach
 * Supabase storage as bytes. React Native ships no dependable `atob`, so this
 * decoder is hand-written — which makes it exactly the thing that needs a test.
 *
 * A wrong decoder does not throw: it uploads a corrupt JPEG that fails to
 * render days later, in history, with nothing pointing back here.
 */

/** Encoded with Node's Buffer, so the fixtures are independent of the decoder. */
function uri(text: string, mime = "image/jpeg"): string {
  return `data:${mime};base64,${Buffer.from(text, "binary").toString("base64")}`;
}

function decodedText(text: string): string {
  return Buffer.from(dataUriToBytes(uri(text))).toString("binary");
}

describe("dataUriToBytes", () => {
  it("round-trips every padding length", () => {
    // 0, 1 and 2 '=' respectively — the three cases the bit loop must handle.
    expect(decodedText("abc")).toBe("abc");
    expect(decodedText("ab")).toBe("ab");
    expect(decodedText("a")).toBe("a");
  });

  it("round-trips bytes above the ASCII range", () => {
    const binary = String.fromCharCode(0, 1, 127, 128, 200, 255);
    expect(decodedText(binary)).toBe(binary);
  });

  it("matches Buffer's decoding over a longer payload", () => {
    const source = Array.from({ length: 512 }, (_, i) => String.fromCharCode(i % 256)).join("");
    expect(decodedText(source)).toBe(source);
  });

  it("tolerates line breaks in the payload", () => {
    // Some encoders wrap long base64 at a fixed column. Only the payload is
    // wrapped here — newlines inside the `data:...;base64,` prefix are not
    // something any encoder produces, and are rejected as malformed.
    const [prefix, payload] = uri("the quick brown fox").split(",");
    const wrapped = `${prefix},${payload!.replace(/(.{8})/g, "$1\n")}`;
    expect(Buffer.from(dataUriToBytes(wrapped)).toString("binary")).toBe("the quick brown fox");
  });

  it("returns an empty buffer for an empty payload", () => {
    expect(dataUriToBytes("data:image/jpeg;base64,")).toHaveLength(0);
  });

  it("refuses anything that is not a base64 data URI", () => {
    // Failing loudly here beats uploading a 0-byte JPEG that fails much later.
    expect(() => dataUriToBytes("https://example.com/a.jpg")).toThrow(/data URI/);
    expect(() => dataUriToBytes("data:image/jpeg,raw")).toThrow(/base64/);
    expect(() => dataUriToBytes("data:image/jpeg;base64,!!!!")).toThrow(/valid base64/);
  });
});

describe("dataUriMimeType", () => {
  it("reads the declared media type", () => {
    expect(dataUriMimeType(uri("x", "image/png"))).toBe("image/png");
  });

  it("is null when there is no data URI to read", () => {
    expect(dataUriMimeType("https://example.com/a.jpg")).toBeNull();
  });
});
