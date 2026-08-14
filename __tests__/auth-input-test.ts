import { Credentials, CredentialsForm, ResetRequest, Signup } from "@/lib/auth-input";

/**
 * The §6 auth contract: email ≤254 · password 8–128 · username 3–30 matching
 * `^[a-zA-Z0-9_-]+$` · captchaToken 1–4000, both objects `.strict()`.
 *
 * The server parses with the same schemas. A drifted client schema produces a
 * double validation the member cannot act on — the form accepts something the
 * server then rejects with different words.
 */
const VALID = {
  email: "ana@example.com",
  password: "Str0ngPassword",
  captchaToken: "t".repeat(20),
};

describe("Credentials", () => {
  it("accepts a valid pair", () => {
    expect(Credentials.safeParse(VALID).success).toBe(true);
  });

  it("trims the email", () => {
    const parsed = Credentials.parse({ ...VALID, email: "  ana@example.com  " });
    expect(parsed.email).toBe("ana@example.com");
  });

  it("rejects a malformed email", () => {
    expect(Credentials.safeParse({ ...VALID, email: "ana@" }).success).toBe(false);
  });

  it("enforces the 254-character email cap", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(Credentials.safeParse({ ...VALID, email: long }).success).toBe(false);
  });

  it("enforces the 8–128 password bounds", () => {
    expect(Credentials.safeParse({ ...VALID, password: "Sh0rt" }).success).toBe(false);
    expect(Credentials.safeParse({ ...VALID, password: "a".repeat(129) }).success).toBe(false);
    expect(Credentials.safeParse({ ...VALID, password: "a".repeat(128) }).success).toBe(true);
  });

  it("requires a captcha token within 1–4000", () => {
    expect(Credentials.safeParse({ ...VALID, captchaToken: "" }).success).toBe(false);
    expect(Credentials.safeParse({ ...VALID, captchaToken: "t".repeat(4001) }).success).toBe(false);
  });

  it("is strict — an unexpected key is rejected, not stripped", () => {
    // `.strict()` matters on the wire: a client that quietly sends an extra
    // field is a client whose payload the server may reject outright.
    expect(Credentials.safeParse({ ...VALID, isAdmin: true }).success).toBe(false);
  });
});

describe("Signup", () => {
  const SIGNUP = { ...VALID, username: "ana_style-01" };

  it("accepts a valid signup", () => {
    expect(Signup.safeParse(SIGNUP).success).toBe(true);
  });

  it("enforces the 3–30 username bounds", () => {
    expect(Signup.safeParse({ ...SIGNUP, username: "an" }).success).toBe(false);
    expect(Signup.safeParse({ ...SIGNUP, username: "a".repeat(31) }).success).toBe(false);
  });

  it("allows only letters, numbers, hyphens and underscores", () => {
    for (const bad of ["ana style", "ana@style", "ana.style", "ana/style", "ana😀"]) {
      expect(Signup.safeParse({ ...SIGNUP, username: bad }).success).toBe(false);
    }
  });

  it("is strict", () => {
    expect(Signup.safeParse({ ...SIGNUP, role: "admin" }).success).toBe(false);
  });
});

describe("form variants", () => {
  it("omit the captcha token, which does not exist at validation time", () => {
    expect(CredentialsForm.safeParse({ email: VALID.email, password: VALID.password }).success).toBe(
      true,
    );
  });
});

describe("ResetRequest", () => {
  it("takes an email and nothing else", () => {
    expect(ResetRequest.safeParse({ email: VALID.email }).success).toBe(true);
    expect(ResetRequest.safeParse({ email: VALID.email, password: "x" }).success).toBe(false);
  });
});
