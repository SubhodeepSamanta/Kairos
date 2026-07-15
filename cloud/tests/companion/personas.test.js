import { describe, it, expect } from "vitest";
import { PERSONAS, getPersona, listPersonas, personaBlock, DEFAULT_PERSONA } from "../../src/companion/personas.js";
import { commandSuggestions } from "../../src/companion/commands.js";

describe("personas", () => {
  it("has the personalities we promised", () => {
    expect(Object.keys(PERSONAS)).toEqual(expect.arrayContaining(["aria", "sassy", "mentor", "calm", "nova"]));
  });

  it("falls back to the default for unknown ids", () => {
    expect(getPersona("nonsense").id).toBe(DEFAULT_PERSONA);
    expect(getPersona(undefined).id).toBe(DEFAULT_PERSONA);
  });

  it("every persona has tone, samples and a voice", () => {
    for (const p of Object.values(PERSONAS)) {
      expect(p.tone.length, p.id).toBeGreaterThan(2);
      expect(p.samples.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.voice.voice, p.id).toBeTruthy();
      expect(p.blurb, p.id).toBeTruthy();
    }
  });

  it("angry mentor is demanding but never contemptuous", () => {
    const tone = PERSONAS.mentor.tone.join(" ").toLowerCase();
    expect(tone).toContain("never cruel");
    expect(tone).toContain("contempt is off the table");
  });

  it("every persona block pins wording-only scope", () => {
    for (const id of Object.keys(PERSONAS)) {
      const block = personaBlock(id);
      expect(block, id).toContain("WORDING only");
      expect(block, id).toContain("never changes which actions");
    }
  });

  it("persona block stays small", () => {
    for (const id of Object.keys(PERSONAS)) {
      expect(Math.ceil(personaBlock(id).length / 4), id).toBeLessThan(320);
    }
  });

  it("lists personas for pickers", () => {
    const list = listPersonas();
    expect(list.length).toBe(Object.keys(PERSONAS).length);
    expect(list[0]).toHaveProperty("blurb");
  });
});

describe("commandSuggestions", () => {
  it("returns nothing for normal chat", () => {
    expect(commandSuggestions("hey how are you")).toBeNull();
    expect(commandSuggestions("")).toBeNull();
  });

  it("lists all commands on a bare slash", () => {
    const s = commandSuggestions("/");
    expect(s.kind).toBe("command");
    expect(s.items.map(i => i.value)).toContain("/personality");
    expect(s.items.map(i => i.value)).toContain("/mood");
  });

  it("filters commands as you type", () => {
    const s = commandSuggestions("/per");
    expect(s.items).toHaveLength(1);
    expect(s.items[0].value).toBe("/personality");
  });

  it("switches to personality values after a space", () => {
    const s = commandSuggestions("/personality ");
    expect(s.kind).toBe("value");
    expect(s.items.map(i => i.value)).toEqual(expect.arrayContaining(["aria", "sassy", "mentor", "calm", "nova"]));
  });

  it("filters personality values as you type", () => {
    const s = commandSuggestions("/personality sa");
    expect(s.items).toHaveLength(1);
    expect(s.items[0].value).toBe("sassy");
  });

  it("offers mood values", () => {
    const s = commandSuggestions("/mood ");
    expect(s.items.map(i => i.value)).toEqual(["on", "off", "clear"]);
  });
});
