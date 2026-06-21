import { WebSocketServer } from "ws";
import { log, isDebug } from "../utils/logger.js";
import {
  getAgentState,
  setBrowserState
} from "../agent/state/state.js";
import { createGoal } from "../shared/schemas/goal.js";
import { runAgent } from "../agent/index.js";
import { routeMessage } from "../router/router.js";
import { chatReply } from "../chat/chat.js";
import { extractMemory } from "../memory/extract.js";
import { storeMemory } from "../memory/store.js";
import { retrieveMemory } from "../memory/retrieve.js";

let connectedClient = null;
const pendingResolvers = new Map();
const connectorClients = new Set();

function formatAgentResult(agentResult) {
  const observation = agentResult.observation;
  if (!observation) {
    return agentResult.success ? "Goal completed successfully." : "Goal execution failed.";
  }

  if (observation?.action?.type === "press_key") {
    if (observation.after?.url && observation.after?.title) {
      return `Search completed\n\nTitle:\n${observation.after.title}\n\nURL:\n${observation.after.url}`;
    }
    return `Pressed ${observation.key}`;
  }
  if (observation?.action?.type === "extract_metadata") {
    const meta = observation.metadata;
    return `\nTitle:\n${meta.title}\n\nDescription:\n${meta.description || "None"}\n\nKeywords:\n${meta.keywords || "None"}\n\nAuthor:\n${meta.author || "Unknown"}\n`;
  }
  if (observation?.action?.type === "screenshot") {
    return `Screenshot saved:\n\n${observation.path}`;
  }
  if (observation?.action?.type === "extract_links") {
    const links = observation.links || [];
    if (links.length === 0) return "No links found.";
    let response = "Links:\n\n";
    for (const link of links.slice(0, 20)) {
      response += `${link.text}\n${link.href}\n\n`;
    }
    return response;
  }
  if (observation?.action?.type === "scroll") {
    return `Scrolled ${observation.direction}`;
  }
  if (observation?.action?.type === "wait") {
    return `Waited ${observation.seconds} seconds`;
  }
  if (observation?.action?.type === "close_tab") {
    return `Closed tab ${observation.index}`;
  }
  if (!agentResult.success && agentResult.reason === "goal_impossible") {
    return `Goal could not be completed.\n\nReason:\n${observation?.action?.params?.text || "requested item"} was not found.`;
  }
  if (observation?.action?.type === "type") {
    return `Typed\n\n${observation.actual}`;
  }

  if (agentResult.success) {
    if (observation?.action?.type === "list_tabs") {
      const tabs = observation.tabs || [];
      if (tabs.length === 0) return "No tabs open.";
      let response = "Open Tabs:\n\n";
      for (const tab of tabs) {
        response += `${tab.active ? "→" : " "} Tab ${tab.index}\n${tab.title}\n${tab.url}\n\n`;
      }
      return response;
    }
    if (observation?.action?.type === "switch_tab") {
      return `Switched to tab ${observation.index}`;
    }
    if (observation?.action?.type === "new_tab") {
      return `Created tab ${observation.index}`;
    }
    if (observation?.action?.type === "click") {
      return `Clicked: ${observation.clicked || "unknown"}\n\nPage:\n${observation.actual}`;
    }
    if (observation?.expected === "page_read") {
      let response = `Title: ${observation.title || "Unknown"}\n\nURL: ${observation.url || "Unknown"}`;
      if (observation.inputs?.length) {
        response += `\n\nInputs:\n\n${observation.inputs.slice(0, 10).map(input => `- [${input.id}] ${input.text}`).join("\n")}`;
      }
      if (observation.buttons?.length) {
        response += `\n\nButtons:\n\n${observation.buttons.slice(0, 10).map(button => `- [${button.id}] ${button.text}`).join("\n")}`;
      }
      if (observation.links?.length) {
        response += `\n\nLinks:\n\n${observation.links.slice(0, 10).map(link => `- [${link.id}] ${link.text}`).join("\n")}`;
      }
      if (observation.text) {
        response += `\n\nContent:\n\n${observation.text.slice(0, 1000)}`;
      }
      if (response.length > 3500) {
        response = response.slice(0, 3500) + "\n\n[truncated]";
      }
      return response;
    }
    return `Success\n\nAction: ${observation?.action?.type || "unknown"}\nResult: ${observation?.actual || "completed"}`;
  }

  return `Failed\n\nAction: ${observation?.action?.type || "unknown"}\nReason: ${observation?.reason || agentResult.reason || "unknown"}`;
}

export function startWebSocketServer(
  port = 8080
) {

  const wss =
    new WebSocketServer({
      port
    });

  wss.on(
    "connection",
    (ws) => {
      log("A client connected to WebSocket");

      ws.on(
        "close",
        () => {
          log("A client disconnected");
          if (connectedClient === ws) {
            connectedClient = null;
          }
          connectorClients.delete(ws);
        }
      );

      ws.on(
        "error",
        (error) => {
          log("Client socket error: " + error.message);
        }
      );

      ws.on(
        "message",
        async (message) => {
          const data = JSON.parse(message.toString());

          if (data.type === "register_client") {
            connectedClient = ws;
            log("Automation client registered");
            return;
          }

          if (data.type === "register_connector") {
            connectorClients.add(ws);
            log(`Connector registered: ${data.name}`);
            return;
          }

          if (data.type === "goal") {
            log(`Received goal: ${data.goal}`);
            ws.send(JSON.stringify({ type: "goal_status", status: "Working..." }));

            try {
              // 1. Check Route first
              const route = routeMessage(data.goal);

              // 2. Memory extract & store (silent for agent/research, active for chat)
              const memory = await extractMemory(data.goal);
              const memoryResponse = await storeMemory(memory);
              if (memoryResponse && route.type === "chat") {
                ws.send(JSON.stringify({ type: "goal_result", success: true, result: memoryResponse }));
                return;
              }

              // 3. Memory retrieve (only for chat)
              if (route.type === "chat") {
                const retrieved = await retrieveMemory(data.goal);
                if (retrieved) {
                  ws.send(JSON.stringify({ type: "goal_result", success: true, result: retrieved }));
                  return;
                }

                const reply = await chatReply(data.goal);
                ws.send(JSON.stringify({ type: "goal_result", success: true, result: reply }));
                return;
              }

              if (route.type === "research") {
                ws.send(JSON.stringify({ type: "goal_status", status: "Researching..." }));
                const { runResearch } = await import("../research/research.js");
                const reply = await runResearch(data.goal);
                ws.send(JSON.stringify({ type: "goal_result", success: true, result: reply }));
                return;
              }

              // 4. Run Agent
              const goal = createGoal(data.goal);
              const agentResult = await runAgent({
                goal,
                executePlan: executePlanRemotely
              });

              const response = formatAgentResult(agentResult);
              ws.send(JSON.stringify({
                type: "goal_result",
                success: agentResult.success,
                result: response
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: "goal_result",
                success: false,
                result: `Error: ${error.message}`
              }));
            }
            return;
          }

          if (data.type === "execution_result") {
            const latestObservation =
              data.observations?.[data.observations.length - 1];

            const pageState = latestObservation?.pageState;

            if (pageState) {
              setBrowserState(pageState);
            }
            const goalId = data.goalId;
            const resolver = pendingResolvers.get(goalId);
            if (resolver) {
              resolver(data);
              pendingResolvers.delete(goalId);
            } else {
              // Fallback: no goalId match found (older client or race), resolve oldest pending
              const firstKey = pendingResolvers.keys().next().value;
              if (firstKey !== undefined) {
                pendingResolvers.get(firstKey)(data);
                pendingResolvers.delete(firstKey);
              }
            }
          }

          if (isDebug()) {
            log(
              "Received:",
              JSON.stringify(
                data,
                null,
                2
              )
            );
          } else {
            log(`Received WebSocket message of type: ${data.type}`);
          }
        }
      );
    }
  );

  log(
    `WebSocket listening on ${port}`
  );

  return wss;
}

export async function executePlanRemotely(
  plan
) {

  if (
    !connectedClient ||
    connectedClient.readyState !== 1
  ) {

    throw new Error(
      "No connected client"
    );
  }

  if (isDebug()) {
    console.log(
      "\n===== SENDING PLAN ====="
    );

    console.log(
      JSON.stringify(
        plan,
        null,
        2
      )
    );
  } else {
    console.log(`\n===== SENDING PLAN actionsCount=${plan.actions?.length || 0} =====`);
  }

  return new Promise(
    (resolve) => {

      pendingResolvers.set(plan.goalId, resolve);

      connectedClient.send(
        JSON.stringify({
          type:
            "execute_plan",
          plan
        })
      );
    }
  );
}