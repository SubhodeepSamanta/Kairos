import { describe, it, expect } from "vitest";
import { classifyConsequence, confirmationQuestion, readsAsYes, labelFor } from "../../src/agent/consequence.js";

const page = {
  url: "https://shop.example.com/cart",
  buttons: [
    { id: 1, text: "Buy now" },
    { id: 2, text: "Add to cart" },
    { id: 3, text: "Delete account" },
    { id: 4, text: "Send message" },
    { id: 5, text: "Search" },
    { id: 6, text: "Save draft" },
    { id: 7, text: "Postcode lookup" },
    { id: 8, ariaLabel: "Place your order" }
  ],
  inputs: [{ id: 20, placeholder: "Password" }],
  links: [{ id: 30, text: "Home" }]
};

describe("what counts as consequential", () => {
  it("stops before spending money", () => {
    const c = classifyConsequence({ type: "click", id: 1 }, page);
    expect(c.kind).toBe("spend money");
  });

  it("stops before deleting", () => {
    expect(classifyConsequence({ type: "click", id: 3 }, page).kind).toBe("delete something");
  });

  it("stops before sending something to other people", () => {
    expect(classifyConsequence({ type: "click", id: 4 }, page).kind).toMatch(/send/);
  });

  it("reads an aria label when there is no visible text", () => {
    expect(classifyConsequence({ type: "click", id: 8 }, page).kind).toBe("spend money");
  });

  it("stops before submitting a saved password", () => {
    const c = classifyConsequence({ type: "type", id: 20, text: "{{secret:github_password}}", submit: true }, page);
    expect(c.kind).toMatch(/password/);
  });
});

describe("what must not be interrupted", () => {
  it("lets ordinary browsing through", () => {
    for (const id of [2, 5, 6, 30]) {
      expect(classifyConsequence({ type: "click", id }, page), `id ${id}`).toBeNull();
    }
  });

  it("does not trip on a word that merely contains a verb", () => {
    expect(classifyConsequence({ type: "click", id: 7 }, page)).toBeNull();
  });

  it("lets navigation, reading and searching through untouched", () => {
    for (const type of ["navigate", "read", "scroll", "web_search", "fetch_page", "screenshot", "done"]) {
      expect(classifyConsequence({ type, id: 1 }, page), type).toBeNull();
    }
  });

  it("does not stop typing a password without submitting it", () => {
    expect(classifyConsequence({ type: "type", id: 20, text: "{{secret:pw}}", submit: false }, page)).toBeNull();
  });

  it("does not stop ordinary typing that submits", () => {
    expect(classifyConsequence({ type: "type", id: 20, text: "lofi", submit: true }, page)).toBeNull();
  });

  it("stays quiet when the element is not on the page", () => {
    expect(classifyConsequence({ type: "click", id: 999 }, page)).toBeNull();
    expect(labelFor(999, page)).toBeNull();
  });
});

describe("the question she asks", () => {
  it("names the act, the place and the thing", () => {
    const q = confirmationQuestion(classifyConsequence({ type: "click", id: 1 }, page), page);
    expect(q).toContain("spend money");
    expect(q).toContain("shop.example.com");
    expect(q).toContain("Buy now");
  });
});

describe("reading the answer", () => {
  it("takes a clear yes as a yes", () => {
    for (const yes of ["y", "yes", "yeah", "yep", "sure", "ok", "okay", "go ahead", "do it", "confirm", "please do", "Yes."]) {
      expect(readsAsYes(yes), yes).toBe(true);
    }
  });

  it("treats anything short of a yes as a no", () => {
    for (const no of ["n", "no", "nope", "nah", "don't", "do not", "stop", "cancel", "never mind", "wait", "", "   ", "maybe", "hmm", "not sure", "why"]) {
      expect(readsAsYes(no), JSON.stringify(no)).toBe(false);
    }
  });

  it("does not read a no that happens to start with a yes-ish letter", () => {
    expect(readsAsYes("nope, don't")).toBe(false);
  });
});
