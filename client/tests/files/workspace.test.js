import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  resolveInWorkspace, listFiles, readTextFile, writeTextFile, workspaceRoot, describeKind
} from "../../src/files/workspace.js";
import { executeFileAction } from "../../src/files/fileActions.js";

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-ws-"));
process.env.KAIROS_WORKSPACE = sandbox;

beforeEach(() => {
  for (const name of fs.readdirSync(sandbox)) {
    fs.rmSync(path.join(sandbox, name), { recursive: true, force: true });
  }
});

afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
  delete process.env.KAIROS_WORKSPACE;
});

describe("staying inside the Kairos folder", () => {
  it("refuses to climb out with ..", () => {
    for (const evil of ["../secrets.json", "../../etc/passwd", "notes/../../escape.txt", "..\\..\\windows\\system32\\config"]) {
      expect(() => resolveInWorkspace(evil), evil).toThrow(/outside the Kairos folder/);
    }
  });

  it("refuses an absolute path somewhere else", () => {
    const elsewhere = process.platform === "win32" ? "C:\\Windows\\System32\\drivers\\etc\\hosts" : "/etc/passwd";
    expect(() => resolveInWorkspace(elsewhere)).toThrow(/outside the Kairos folder/);
  });

  it("treats a leading slash as relative to the folder, not the disk", () => {
    expect(resolveInWorkspace("/notes.txt")).toBe(path.resolve(sandbox, "notes.txt"));
  });

  it("allows ordinary paths inside", () => {
    expect(resolveInWorkspace("notes/today.md")).toBe(path.resolve(sandbox, "notes/today.md"));
  });
});

describe("reading and writing", () => {
  it("writes a text file and reads it back", () => {
    writeTextFile("notes.md", "# hello\nsome notes");
    const read = readTextFile("notes.md");
    expect(read.kind).toBe("text");
    expect(read.text).toContain("some notes");
  });

  it("creates folders on the way", () => {
    writeTextFile("reports/july/summary.txt", "done");
    expect(fs.existsSync(path.join(sandbox, "reports", "july", "summary.txt"))).toBe(true);
  });

  it("refuses to write something that is not text", () => {
    expect(() => writeTextFile("thing.exe", "x")).toThrow(/only write text/);
  });

  it("says so plainly when the file is not there", () => {
    expect(() => readTextFile("nope.txt")).toThrow(/no file called/);
  });

  it("admits it cannot read a PDF rather than returning nothing", () => {
    fs.writeFileSync(path.join(sandbox, "paper.pdf"), "%PDF-1.4");
    expect(() => readTextFile("paper.pdf")).toThrow(/cannot read PDFs/);
  });

  it("refuses a file type it cannot make sense of", () => {
    fs.writeFileSync(path.join(sandbox, "clip.mp4"), "x");
    expect(() => readTextFile("clip.mp4")).toThrow(/cannot read/);
  });

  it("truncates a very long file instead of blowing the prompt", () => {
    writeTextFile("big.txt", "x".repeat(20000));
    const read = readTextFile("big.txt");
    expect(read.truncated).toBe(true);
    expect(read.text.length).toBeLessThanOrEqual(12000);
  });

  it("points at list_files when handed a folder", () => {
    fs.mkdirSync(path.join(sandbox, "stuff"));
    expect(() => readTextFile("stuff")).toThrow(/use list_files/);
  });
});

describe("listing", () => {
  it("shows files and folders with their kind", () => {
    writeTextFile("a.md", "hi");
    fs.mkdirSync(path.join(sandbox, "sub"));
    const listing = listFiles("");
    const names = listing.entries.map(e => e.name);
    expect(names).toContain("a.md");
    expect(names).toContain("sub");
    expect(listing.entries.find(e => e.name === "sub").directory).toBe(true);
  });

  it("says so when the folder does not exist", () => {
    expect(() => listFiles("ghosts")).toThrow(/no folder called/);
  });
});

describe("kinds", () => {
  it("knows text, images and pdfs apart", () => {
    expect(describeKind("a.md")).toBe("text");
    expect(describeKind("a.CSV")).toBe("text");
    expect(describeKind("a.png")).toBe("image");
    expect(describeKind("a.pdf")).toBe("pdf");
    expect(describeKind("a.mp4")).toBe("other");
  });
});

describe("as actions", () => {
  it("lists, writes and reads through the action layer", async () => {
    const written = await executeFileAction({ type: "write_file", params: { path: "log.txt", text: "line one" } });
    expect(written.success).toBe(true);
    expect(written.written).toBe("log.txt");

    const read = await executeFileAction({ type: "read_file", params: { path: "log.txt" } });
    expect(read.text).toBe("line one");
    expect(read.via).toBe("text");

    const listed = await executeFileAction({ type: "list_files", params: {} });
    expect(listed.listing).toContain("log.txt");
  });

  it("reports the workspace root so the user knows where things went", () => {
    expect(workspaceRoot()).toBe(sandbox);
  });
});
