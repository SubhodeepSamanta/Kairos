import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

let dbFailing = false;
const queries = [];

vi.mock("../../src/memory/db.js", () => ({
  isDbActive: () => true,
  memoryPool: () => ({
    query: vi.fn(async (sql, params) => {
      if (dbFailing) throw new Error("connection refused");
      if (/^INSERT/.test(sql)) queries.push({ sql, params });
      return { rows: [] };
    })
  }),
  hasDatabase: () => true,
  connectMemoryDb: async () => null,
  loadAllFromDb: async () => ({}),
  upsertFact: async () => true,
  deleteFact: async () => true
}));

const { addTurn, resetCompanionCacheForTests } = await import("../../src/companion/store.js");
const { pendingDbWrites, resetSyncQueueForTests } = await import("../../src/memory/syncQueue.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-sync-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
  resetSyncQueueForTests();
  queries.length = 0;
  dbFailing = false;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("postgres write resilience", () => {
  it("queues writes while the database is down and replays them when it heals", async () => {
    dbFailing = true;
    await addTurn("a", "user", "first while down");
    await addTurn("a", "user", "second while down");
    expect(pendingDbWrites()).toBe(2);

    dbFailing = false;
    await addTurn("a", "user", "third after recovery");
    expect(pendingDbWrites()).toBe(0);
    expect(queries.map(q => q.params[2])).toEqual([
      "first while down",
      "second while down",
      "third after recovery"
    ]);
  });

  it("never loses the local copy even when the database write fails", async () => {
    dbFailing = true;
    await addTurn("a", "user", "kept locally");
    const file = JSON.parse(fs.readFileSync(path.join(tmp, "data", "turns.json"), "utf8"));
    expect(file.a.list[0].text).toBe("kept locally");
  });

  it("writes straight through when the database is healthy", async () => {
    await addTurn("a", "user", "hello");
    expect(pendingDbWrites()).toBe(0);
    expect(queries).toHaveLength(1);
  });
});
