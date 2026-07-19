import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const rowsByTable = {
  kairos_turns: [],
  kairos_events: [],
  kairos_moods: [],
  kairos_prefs: [],
  kairos_digests: []
};

vi.mock("../../src/memory/db.js", () => ({
  isDbActive: () => true,
  memoryPool: () => ({
    query: vi.fn(async (sql) => {
      const table = Object.keys(rowsByTable).find(t => sql.includes(t));
      return { rows: rowsByTable[table] || [] };
    })
  }),
  hasDatabase: () => true,
  connectMemoryDb: async () => null,
  loadAllFromDb: async () => ({}),
  upsertFact: async () => true,
  deleteFact: async () => true
}));

const { hydrateCompanionFromDb } = await import("../../src/companion/hydrate.js");
const { loadTurns, getPrefs, getDigest, resetCompanionCacheForTests } = await import("../../src/companion/store.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-hydrate-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
  for (const k of Object.keys(rowsByTable)) rowsByTable[k] = [];
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("companion hydration from Postgres", () => {
  it("seeds empty local stores from the database on a fresh deploy", async () => {
    rowsByTable.kairos_turns = [
      { chat_id: "t1", role: "user", text: "hey", said_at: "2026-07-18T10:00:00Z" },
      { chat_id: "t1", role: "assistant", text: "hi!", said_at: "2026-07-18T10:00:05Z" }
    ];
    rowsByTable.kairos_prefs = [
      { chat_id: "t1", persona: "sassy", mood_tracking: true, summary: "they code a lot", covered_turns: 8 }
    ];
    rowsByTable.kairos_digests = [{ chat_id: "t1", day: "2026-07-18", line: "built stuff" }];

    const seeded = await hydrateCompanionFromDb();
    expect(seeded).toContain("turns");
    expect(seeded).toContain("prefs");
    expect(seeded).toContain("digests");

    expect((await loadTurns("t1")).map(t => t.text)).toEqual(["hey", "hi!"]);
    expect((await getPrefs("t1")).persona).toBe("sassy");
    expect(await getDigest("t1", "2026-07-18")).toBe("built stuff");
  });

  it("never overwrites an existing local store", async () => {
    fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "data", "turns.json"),
      JSON.stringify({ local: { list: [{ role: "user", text: "local truth", at: "2026-07-19T00:00:00Z" }], dropped: 0 } })
    );
    rowsByTable.kairos_turns = [{ chat_id: "db", role: "user", text: "db copy", said_at: "2026-07-18T10:00:00Z" }];

    const seeded = await hydrateCompanionFromDb();
    expect(seeded).not.toContain("turns");
    expect((await loadTurns("local")).map(t => t.text)).toEqual(["local truth"]);
    expect(await loadTurns("db")).toEqual([]);
  });
});
