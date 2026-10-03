/**
 * The SecureStore chunking round-trip in `services/supabase/storage.ts`.
 *
 * A Supabase session with a large JWT exceeds the ~2048-byte value the platform
 * historically refuses, so the adapter splits it. Getting this wrong does not
 * fail loudly — it silently signs a member out on next launch, or worse, hands
 * `setSession` a truncated token.
 *
 * The adapter is not exported, so this test rebuilds it from the same source
 * shape and pins the behaviour. If `client.ts` ever exports it, point this at
 * the real one and delete the copy.
 */
const CHUNK_SIZE = 1800;
const CHUNK_PREFIX = "__chunks__:";

const store = new Map<string, string>();

const SecureStore = {
  getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
};

const adapter = {
  getItem: async (key: string) => {
    const head = await SecureStore.getItemAsync(key);
    if (head === null || !head.startsWith(CHUNK_PREFIX)) return head;

    const count = Number(head.slice(CHUNK_PREFIX.length));
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return parts.every((p) => p !== null) ? parts.join("") : null;
  },

  setItem: async (key: string, value: string) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}.${i}`, c)));
    await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
  },

  removeItem: async (key: string) => {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith(CHUNK_PREFIX)) {
      const count = Number(head.slice(CHUNK_PREFIX.length));
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
      );
    }
    await SecureStore.deleteItemAsync(key);
  },
};

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe("small values", () => {
  it("round-trip unchunked", async () => {
    await adapter.setItem("session", "small");
    expect(await adapter.getItem("session")).toBe("small");
    expect(store.has("session.0")).toBe(false);
  });

  it("store exactly at the chunk boundary without splitting", async () => {
    const value = "a".repeat(CHUNK_SIZE);
    await adapter.setItem("session", value);
    expect(store.get("session")).toBe(value);
    expect(store.has("session.0")).toBe(false);
  });
});

describe("large values", () => {
  const big = "x".repeat(CHUNK_SIZE * 3 + 17);

  it("round-trip byte-identical", async () => {
    await adapter.setItem("session", big);
    expect(await adapter.getItem("session")).toBe(big);
  });

  it("write a header naming the chunk count", async () => {
    await adapter.setItem("session", big);
    expect(store.get("session")).toBe(`${CHUNK_PREFIX}4`);
    expect(store.get("session.3")).toHaveLength(17);
  });

  it("survive a JWT-shaped value with dots and dashes", async () => {
    const jwt = `${"e".repeat(2000)}.${"y".repeat(2000)}.${"-_".repeat(500)}`;
    await adapter.setItem("session", jwt);
    expect(await adapter.getItem("session")).toBe(jwt);
  });
});

describe("partial writes", () => {
  /**
   * The important one. A half-written session must read as **absent** so the
   * app re-authenticates, rather than reconstructing a truncated token and
   * failing somewhere far away from the cause.
   */
  it("read as absent when a chunk is missing", async () => {
    await adapter.setItem("session", "y".repeat(CHUNK_SIZE * 2));
    store.delete("session.1");

    expect(await adapter.getItem("session")).toBeNull();
  });

  it("read as absent when every chunk is gone but the header remains", async () => {
    await adapter.setItem("session", "y".repeat(CHUNK_SIZE * 2));
    store.delete("session.0");
    store.delete("session.1");

    expect(await adapter.getItem("session")).toBeNull();
  });
});

describe("removal", () => {
  it("deletes every chunk and the header", async () => {
    await adapter.setItem("session", "z".repeat(CHUNK_SIZE * 2));
    await adapter.removeItem("session");

    expect(store.size).toBe(0);
    expect(await adapter.getItem("session")).toBeNull();
  });

  it("deletes an unchunked value", async () => {
    await adapter.setItem("session", "small");
    await adapter.removeItem("session");
    expect(store.size).toBe(0);
  });

  it("is safe on a key that was never written", async () => {
    await expect(adapter.removeItem("absent")).resolves.toBeUndefined();
  });
});

describe("absent keys", () => {
  it("read as null", async () => {
    expect(await adapter.getItem("never-written")).toBeNull();
  });
});
