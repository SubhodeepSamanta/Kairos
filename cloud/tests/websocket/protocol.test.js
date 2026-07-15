import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { env } from "../../src/config/env.js";
import { startWebSocketServer, executeActionRemotely, isClientConnected } from "../../src/websocket/server.js";

const PORT = 18099;
let wss;

function connect(registerMessage) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const timer = setTimeout(() => reject(new Error("connect timeout")), 3000);
    ws.on("open", () => {
      ws.send(JSON.stringify(registerMessage));
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "registered") {
        clearTimeout(timer);
        resolve({ ws, authed: true });
      } else if (msg.type === "auth_failed") {
        clearTimeout(timer);
        resolve({ ws, authed: false });
      }
    });
    ws.on("error", reject);
  });
}

beforeAll(() => {
  wss = startWebSocketServer(PORT);
});

afterAll(() => {
  wss?.close();
});

describe("websocket protocol", () => {
  it("rejects clients with a wrong secret when a secret is configured", async () => {
    if (!env.CLIENT_SECRET) return;
    const { authed, ws } = await connect({ type: "register_client", secret: "wrong" });
    expect(authed).toBe(false);
    ws.close();
  });

  it("registers an authed client and correlates execute/result by requestId", async () => {
    const { ws, authed } = await connect({ type: "register_client", secret: env.CLIENT_SECRET });
    expect(authed).toBe(true);
    expect(isClientConnected()).toBe(true);

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "execute") {
        ws.send(JSON.stringify({
          type: "result",
          requestId: msg.requestId,
          observation: { success: true, page: { url: "https://ok.example", title: "OK" } }
        }));
      }
    });

    const observation = await executeActionRemotely({ type: "read_ui", params: {} });
    expect(observation.success).toBe(true);
    expect(observation.page.url).toBe("https://ok.example");
    ws.close();
  });

  it("rejects pending requests when the client disconnects", async () => {
    const { ws } = await connect({ type: "register_client", secret: env.CLIENT_SECRET });
    const pending = executeActionRemotely({ type: "read_ui", params: {} });
    setTimeout(() => ws.terminate(), 50);
    await expect(pending).rejects.toThrow("client_disconnected");
  });

  it("throws immediately when no client is connected", async () => {
    await new Promise(r => setTimeout(r, 100));
    await expect(executeActionRemotely({ type: "read_ui", params: {} })).rejects.toThrow("no_client_connected");
  });
});
