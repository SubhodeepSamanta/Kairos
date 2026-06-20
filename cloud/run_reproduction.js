import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

ws.on("open", async () => {
  console.log("Connected to Kairos Cloud");
  ws.send(JSON.stringify({ type: "register_connector", name: "reproduction_script" }));
  await delay(1000);

  try {
    console.log("--- Sending Goal: open youtube ---");
    await sendGoalAndWait("open youtube");
    await delay(3000);

    console.log("--- Sending Goal: search lofi on youtube ---");
    await sendGoalAndWait("search lofi on youtube");
    await delay(3000);

    console.log("--- Sending Goal: play first video ---");
    await sendGoalAndWait("play first video");
    
    console.log("Reproduction sequence complete.");
  } catch (err) {
    console.error("Error during reproduction:", err);
  } finally {
    ws.close();
  }
});

let pendingResolve = null;

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`[RECV] Type: ${message.type}`);
    if (message.type === "goal_status") {
      console.log(`[STATUS] ${message.status}`);
    } else if (message.type === "goal_result") {
      console.log(`[RESULT] Success: ${message.success}`);
      console.log(`[RESULT] Details:\n${message.result}`);
      if (pendingResolve) {
        pendingResolve(message);
        pendingResolve = null;
      }
    }
  } catch (e) {
    console.error("Error parsing message:", e);
  }
});

function sendGoalAndWait(goal) {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    ws.send(JSON.stringify({ type: "goal", goal }));
  });
}
