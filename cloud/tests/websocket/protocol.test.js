import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { env } from "../../src/config/env.js";
import { startWebSocketServer, executeActionRemotely, isClientConnected, setReconnectWaitForTests } from "../../src/websocket/server.js";

const PORT = 18099;
let wss;

function answerExecute(ws, observation) {
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "execute") {
      ws.send(JSON.stringify({ type: "result", requestId: msg.requestId, observation }));
    }
  });
}

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

  it("rejects a pending request when the client disconnects and does not come back", async () => {
    setReconnectWaitForTests(150);
    const { ws } = await connect({ type: "register_client", secret: env.CLIENT_SECRET });
    const pending = executeActionRemotely({ type: "read_ui", params: {} });
    setTimeout(() => ws.terminate(), 50);
    await expect(pending).rejects.toThrow("client_disconnected");
    setReconnectWaitForTests(null);
  });

  it("gives up with no_client_connected when nobody reconnects in time", async () => {
    setReconnectWaitForTests(150);
    await new Promise(r => setTimeout(r, 100));
    await expect(executeActionRemotely({ type: "read_ui", params: {} })).rejects.toThrow("no_client_connected");
    setReconnectWaitForTests(null);
  });

  it("survives a brief client restart: waits for reconnect and retries the step once", async () => {
    setReconnectWaitForTests(3000);
    const first = await connect({ type: "register_client", secret: env.CLIENT_SECRET });
    const pending = executeActionRemotely({ type: "read_ui", params: {} });
    setTimeout(() => first.ws.terminate(), 40);

    const second = new WebSocket(`ws://localhost:${PORT}`);
    second.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "execute") {
        second.send(JSON.stringify({ type: "result", requestId: msg.requestId, observation: { success: true, page: { url: "https://back.example", title: "back" } } }));
      }
    });
    setTimeout(() => {
      second.on("open", () => second.send(JSON.stringify({ type: "register_client", secret: env.CLIENT_SECRET })));
      if (second.readyState === WebSocket.OPEN) second.send(JSON.stringify({ type: "register_client", secret: env.CLIENT_SECRET }));
    }, 250);

    const observation = await pending;
    expect(observation.success).toBe(true);
    expect(observation.page.url).toBe("https://back.example");
    second.close();
    setReconnectWaitForTests(null);
  });
});
