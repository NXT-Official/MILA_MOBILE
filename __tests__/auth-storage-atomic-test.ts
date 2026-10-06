/**
 * The real session adapter in `services/supabase/auth-storage.ts`, against a
 * SecureStore fake that can pause or fail any single native call.
 *
 * A session larger than one SecureStore value is split across several keys.
 * The old adapter wrote the chunks in place and then the header, so an app
 * killed between the two (Android does this to a backgrounded app mid-refresh)
 * left the new header beside half-replaced chunks: the next launch read a
 * corrupt session and the member was signed out. These tests pin the repair:
 * a write lands under a fresh generation and only the final header swap makes
 * it live, so every read sees the previous whole session or the new one.
 *
 * `securestore-chunking-test.ts` still pins the original format, which this
 * adapter keeps reading so nobody is signed out by the upgrade itself.
 */
type Op = "get" | "set" | "delete";
type Hook = (op: Op, key: string) => Promise<void> | void;

const mockStore = new Map<string, string>();
let mockHook: Hook | null = null;

/**
 * Both platforms persist UTF-8. A lone surrogate (half of an emoji) does not
 * survive that encoding, so the fake applies it too rather than storing the
 * JS string verbatim.
 */
function mockPersisted(value: string): string {
  return new TextDecoder().decode(new TextEncoder().encode(value));
}

jest.mock("expo-secure-store", () => ({
  // The value is read before the pause, so a paused read returns what was
  // there when it started, exactly like a native read already in flight.
  getItemAsync: jest.fn(async (key: string) => {
    const value = mockStore.get(key) ?? null;
    await mockHook?.("get", key);
    return value;
  }),
  // The pause (or failure) comes first: a write that throws never lands.
  setItemAsync: jest.fn(async (key: string, value: string) => {
    await mockHook?.("set", key);
    mockStore.set(key, mockPersisted(value));
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    await mockHook?.("delete", key);
    mockStore.delete(key);
  }),
}));

import { supabaseStorage as adapter } from "@/services/supabase/auth-storage";

const KEY = "sb-project-auth-token";
const CHUNK_SIZE = 1800;
const OLD = `{"access_token":"${"a".repeat(CHUNK_SIZE * 2)}","refresh_token":"old"}`;
const NEW = `{"access_token":"${"b".repeat(CHUNK_SIZE * 2 + 300)}","refresh_token":"new"}`;

function crash(message = "process killed"): never {
  throw new Error(message);
}

function snapshot(): Map<string, string> {
  return new Map(mockStore);
}

beforeEach(() => {
  mockStore.clear();
  mockHook = null;
});

describe("round trip", () => {
  it("stores a small value as itself", async () => {
    await adapter.setItem(KEY, "small");
    expect(await adapter.getItem(KEY)).toBe("small");
    expect([...mockStore.keys()]).toEqual([KEY]);
  });

  it("returns a large value byte-identical, without storing it under the header key", async () => {
    await adapter.setItem(KEY, NEW);
    expect(await adapter.getItem(KEY)).toBe(NEW);
    expect(mockStore.get(KEY)).not.toBe(NEW);
    for (const stored of mockStore.values()) expect(stored.length).toBeLessThanOrEqual(CHUNK_SIZE);
  });

  it("never splits an emoji across two chunks", async () => {
    // The emoji's first half sits exactly on the chunk boundary.
    const value = `${"x".repeat(CHUNK_SIZE - 1)}\u{1F600}${"y".repeat(CHUNK_SIZE)}`;
    await adapter.setItem(KEY, value);
    expect(await adapter.getItem(KEY)).toBe(value);
  });

  it("reads back a small value that happens to look like a chunk header", async () => {
    for (const value of ["__chunks__:3", "__chunks2__:gabc:2:10"]) {
      await adapter.setItem(KEY, value);
      expect(await adapter.getItem(KEY)).toBe(value);
    }
  });

  it("reads an absent key as null", async () => {
    expect(await adapter.getItem("never-written")).toBeNull();
  });
});

describe("a write that dies part-way leaves the previous session readable", () => {
  it("survives a crash while the new chunks are being written", async () => {
    await adapter.setItem(KEY, OLD);
    const before = snapshot();
    let chunkWrites = 0;
    mockHook = (op, key) => {
      if (op === "set" && key !== KEY && ++chunkWrites === 2) crash();
    };

    await expect(adapter.setItem(KEY, NEW)).rejects.toThrow("process killed");

    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(OLD);
    // The half-written generation was swept, not left behind.
    expect(snapshot()).toEqual(before);
  });

  it("survives a crash on the header swap itself", async () => {
    await adapter.setItem(KEY, OLD);
    const before = snapshot();
    mockHook = (op, key) => {
      if (op === "set" && key === KEY) crash();
    };

    await expect(adapter.setItem(KEY, NEW)).rejects.toThrow("process killed");

    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(OLD);
    expect(snapshot()).toEqual(before);
  });

  it("keeps the new session when only the clean-up of the old one fails", async () => {
    await adapter.setItem(KEY, OLD);
    mockHook = (op) => {
      if (op === "delete") crash("keystore busy");
    };

    await expect(adapter.setItem(KEY, NEW)).resolves.toBeUndefined();

    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(NEW);
  });

  it("survives a crash while moving from a large session to a small one", async () => {
    await adapter.setItem(KEY, OLD);
    mockHook = (op) => {
      if (op === "set") crash();
    };

    await expect(adapter.setItem(KEY, "small")).rejects.toThrow();

    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(OLD);
  });
});

describe("reads never see a half-written session", () => {
  /**
   * Runs `write` once to count its native calls, then once per call index with
   * the writer paused just before that call while a read runs to completion.
   * Every read must be one whole value from `allowed`.
   */
  async function readAtEveryStep(
    seed: () => Promise<void>,
    write: () => Promise<void>,
    allowed: (string | null)[],
  ) {
    mockStore.clear();
    await seed();
    let total = 0;
    mockHook = () => {
      total += 1;
    };
    await write();
    mockHook = null;

    for (let step = 0; step < total; step += 1) {
      mockStore.clear();
      await seed();

      let calls = 0;
      let release: () => void = () => undefined;
      const paused = new Promise<void>((resolve) => (release = resolve));
      let reachedStep: () => void = () => undefined;
      const atStep = new Promise<void>((resolve) => (reachedStep = resolve));
      let writerPaused = false;

      mockHook = async () => {
        if (writerPaused) return; // the read's own calls pass straight through
        if (calls++ === step) {
          writerPaused = true;
          reachedStep();
          await paused;
          writerPaused = false;
        }
      };

      const writing = write();
      await atStep;
      const read = adapter.getItem(KEY);
      release();
      await writing;

      expect(allowed).toContain(await read);
      mockHook = null;
    }
  }

  it("while a large session replaces a large one", async () => {
    await readAtEveryStep(
      () => adapter.setItem(KEY, OLD),
      () => adapter.setItem(KEY, NEW),
      [OLD, NEW],
    );
  });

  it("while a small session replaces a large one", async () => {
    await readAtEveryStep(
      () => adapter.setItem(KEY, OLD),
      () => adapter.setItem(KEY, "small"),
      [OLD, "small"],
    );
  });

  it("while the session is removed", async () => {
    await readAtEveryStep(
      () => adapter.setItem(KEY, OLD),
      () => adapter.removeItem(KEY),
      [OLD, null],
    );
  });

  it("when a read had already taken the old header before the write began", async () => {
    await adapter.setItem(KEY, OLD);
    let release: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => (release = resolve));
    let pausedOnce = false;
    mockHook = async (op, key) => {
      if (!pausedOnce && op === "get" && key === KEY) {
        pausedOnce = true;
        await paused;
      }
    };

    const read = adapter.getItem(KEY);
    const write = adapter.setItem(KEY, NEW);
    release();
    await write;

    expect([OLD, NEW]).toContain(await read);
  });

  it("under randomly interleaved readers and writers", async () => {
    // Deterministic pseudo-random delays, so a failure is reproducible.
    let state = 7;
    const random = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    mockHook = async () => {
      const turns = Math.floor(random() * 4);
      for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
    };

    for (let round = 0; round < 40; round += 1) {
      mockStore.clear();
      const values = [OLD, NEW, "small", `${OLD}-${round}`, `${NEW}-${round}`];
      await adapter.setItem(KEY, values[0]);

      let writing = true;
      const reads: (string | null)[] = [];
      const writer = (async () => {
        for (const value of values.slice(1)) await adapter.setItem(KEY, value);
        writing = false;
      })();
      const readers = Array.from({ length: 3 }, async () => {
        while (writing) reads.push(await adapter.getItem(KEY));
      });
      await Promise.all([writer, ...readers]);

      for (const read of reads) expect(values).toContain(read);
      expect(await adapter.getItem(KEY)).toBe(values[values.length - 1]);
    }
  });
});

describe("concurrent calls", () => {
  it("land in the order they were made and leave one generation behind", async () => {
    await adapter.setItem(KEY, OLD);
    mockHook = async () => {
      await Promise.resolve();
    };

    await Promise.all([adapter.setItem(KEY, NEW), adapter.setItem(KEY, OLD), adapter.setItem(KEY, NEW)]);

    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(NEW);
    const chunkKeys = [...mockStore.keys()].filter((key) => key !== KEY);
    expect(chunkKeys).toHaveLength(Math.ceil(NEW.length / CHUNK_SIZE));
  });

  it("reads do not queue behind each other (every API request reads the session)", async () => {
    await adapter.setItem(KEY, OLD);
    let release: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => (release = resolve));
    let pausedOnce = false;
    mockHook = async (op) => {
      if (!pausedOnce && op === "get") {
        pausedOnce = true;
        await paused;
      }
    };

    const slow = adapter.getItem(KEY);
    try {
      // The second read finishes while the first is still stuck in a native call.
      const second = await Promise.race([
        adapter.getItem(KEY),
        new Promise((resolve) => setTimeout(() => resolve("still queued"), 500)),
      ]);
      expect(second).toBe(OLD);
    } finally {
      release();
    }
    await expect(slow).resolves.toBe(OLD);
  });

  it("a write waits for reads already in flight before sweeping their generation", async () => {
    await adapter.setItem(KEY, OLD);
    let release: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => (release = resolve));
    let pausedOnce = false;
    mockHook = async (op, key) => {
      // Pause the read after it has taken the header, before its chunks.
      if (!pausedOnce && op === "get" && key === KEY) {
        pausedOnce = true;
        await paused;
      }
    };

    const read = adapter.getItem(KEY);
    const write = adapter.setItem(KEY, NEW);
    await Promise.resolve();
    release();

    await expect(read).resolves.toBe(OLD);
    await write;
    expect(await adapter.getItem(KEY)).toBe(NEW);
  });

  it("a read made after a write started returns that write", async () => {
    await adapter.setItem(KEY, OLD);
    mockHook = async () => {
      await Promise.resolve();
    };
    const write = adapter.setItem(KEY, NEW);
    const read = adapter.getItem(KEY);
    await write;
    expect(await read).toBe(NEW);
  });
});

describe("sessions written by the previous adapter", () => {
  function seedLegacy(value: string) {
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    chunks.forEach((chunk, index) => mockStore.set(`${KEY}.${index}`, chunk));
    mockStore.set(KEY, `__chunks__:${chunks.length}`);
  }

  it("are still read, so the upgrade signs nobody out", async () => {
    seedLegacy(OLD);
    expect(await adapter.getItem(KEY)).toBe(OLD);
  });

  it("are replaced cleanly by the first new write", async () => {
    seedLegacy(OLD);
    await adapter.setItem(KEY, NEW);
    expect(await adapter.getItem(KEY)).toBe(NEW);
    const legacyChunks = Math.ceil(OLD.length / CHUNK_SIZE);
    for (let index = 0; index < legacyChunks; index += 1) {
      expect(mockStore.has(`${KEY}.${index}`)).toBe(false);
    }
  });

  it("stay readable if the first new write dies before its header swap", async () => {
    seedLegacy(OLD);
    mockHook = (op, key) => {
      if (op === "set" && key === KEY) crash();
    };
    await expect(adapter.setItem(KEY, NEW)).rejects.toThrow();
    mockHook = null;
    expect(await adapter.getItem(KEY)).toBe(OLD);
  });

  it("read as absent when a chunk never landed", async () => {
    seedLegacy(OLD);
    mockStore.delete(`${KEY}.1`);
    expect(await adapter.getItem(KEY)).toBeNull();
  });

  it("are removed completely", async () => {
    seedLegacy(OLD);
    await adapter.removeItem(KEY);
    expect(mockStore.size).toBe(0);
  });
});

describe("removal", () => {
  it("deletes the header and every chunk", async () => {
    await adapter.setItem(KEY, NEW);
    await adapter.removeItem(KEY);
    expect(mockStore.size).toBe(0);
    expect(await adapter.getItem(KEY)).toBeNull();
  });

  it("reads as absent even if the chunk clean-up dies", async () => {
    await adapter.setItem(KEY, NEW);
    mockHook = (op, key) => {
      if (op === "delete" && key !== KEY) crash();
    };
    await adapter.removeItem(KEY);
    mockHook = null;
    expect(await adapter.getItem(KEY)).toBeNull();
  });

  it("is safe on a key that was never written", async () => {
    await expect(adapter.removeItem("absent")).resolves.toBeUndefined();
  });
});
