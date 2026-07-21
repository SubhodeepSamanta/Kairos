import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sockets = [];
vi.mock("ws", () => {
  class FakeSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      this.handlers = {};
      sockets.push(this);
    }
    on(event, fn) { this.handlers[event] = fn; return this; }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close() { this.readyState = 3; this.handlers.close?.(); }
    fireOpen() { this.readyState = 1; this.handlers.open?.(); }
    fireMessage(obj) { this.handlers.message?.(Buffer.from(JSON.stringify(obj))); }
    fireClose() { this.readyState = 3; this.handlers.close?.(); }
  }
  return { default: FakeSocket, OPEN: 1 };
});

const transport = await import("../../src/connectors/cli/transport.js");

describe("cloud link", () => {
  beforeEach(() => { sockets.length = 0; vi.useFakeTimers(); });
  afterEach(() => { transport.disconnectFromCloud(); vi.useRealTimers(); });

  it("registers as a connector once the socket opens", () => {
    transport.connectToCloud("ws://x", {});
    sockets[0].fireOpen();
    expect(sockets[0].sent[0]).toMatchObject({ type: "register_connector", name: "cli" });
  });

  it("reconnects instead of killing the console when the cloud drops", () => {
    const notes = [];
    transport.connectToCloud("ws://x", { onLink: n => notes.push(n) });
    sockets[0].fireOpen();
    sockets[0].fireMessage({ type: "registered" });

    sockets[0].fireClose();
    expect(notes.join(" ")).toMatch(/reconnecting/);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
  });

  it("says it is back once the cloud returns", () => {
    const notes = [];
    transport.connectToCloud("ws://x", { onLink: n => notes.push(n) });
    sockets[0].fireOpen();
    sockets[0].fireMessage({ type: "registered" });
    sockets[0].fireClose();
    vi.advanceTimersByTime(1000);

    sockets[1].fireOpen();
    sockets[1].fireMessage({ type: "registered" });
    expect(notes).toContain("back online");
  });

  it("backs off instead of hammering a cloud that stays down", () => {
    transport.connectToCloud("ws://x", {});
    sockets[0].fireClose();
    vi.advanceTimersByTime(1000);
    sockets[1].fireClose();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(3);
  });

  it("reports rather than throws when a goal is sent while offline", () => {
    const notes = [];
    transport.connectToCloud("ws://x", { onLink: n => notes.push(n) });
    sockets[0].fireClose();
    transport.sendGoal("do a thing");
    expect(notes.join(" ")).toMatch(/not connected/);
  });

  it("stops retrying once the console asks to disconnect", () => {
    transport.connectToCloud("ws://x", {});
    sockets[0].fireClose();
    transport.disconnectFromCloud();
    vi.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(1);
  });
});
