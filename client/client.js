import axios from "axios";
import { config } from "./config/env.js";
import * as whatsappService from "./services/appService.js";
import * as commandService from "./services/commandService.js";
import * as utilityService from "./services/utilityService.js";
import { openBrowser } from "./utils/osHelper.js";
import { clientState, abortCurrentTask } from "./utils/clientState.js";
import WebSocket from "ws";
import { captureHash, verifyAction } from "./utils/verifier.js";
import {
  focusApp,
  clickElement,
  typeInto,
  readElement,
  captureWindow,
} from "./utils/uia.js";
import { webSearch } from './utils/search.js'
import { webExtract, shutdownBrowser } from './utils/extractor.js'

console.log("Kairos Client is initializing...");
console.log(`Connecting to Cloud at: ${config.CLOUD_URL}`);

const headers = {
  "x-client-secret": config.CLIENT_SECRET,
  "Content-Type": "application/json",
};

let reconnectAttempts = 0

function connectWebSocket() {
  const wsUrl = config.CLOUD_URL
    .replace('https://', 'wss://')
    .replace('http://', 'ws://')

  const ws = new WebSocket(wsUrl, {
    headers: { 'x-client-secret': config.CLIENT_SECRET }
  })

  ws.on('open', () => {
    reconnectAttempts = 0
    console.log('Connected to cloud via WebSocket.')
  })

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString())
      if (payload.type === 'cancel') {
        abortCurrentTask()
        return
      }
      await executeTask(payload)
    } catch (err) {
      console.error("Failed to parse task or execute task:", err.message)
    }
  })

  ws.on('close', () => {
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts), 
      30000
    )
    reconnectAttempts++
    console.log(`WebSocket closed. Reconnecting in ${delay}ms...`)
    setTimeout(connectWebSocket, delay)
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message || err.code || 'Connection failed')
  })
}

async function executeTask(task) {
  const { _id, commandType, payload } = task;
  console.log(`Executing task ${_id} (${commandType})...`);

  // Initialize client task state
  clientState.currentTaskId = _id;
  clientState.isCancelled = false;
  clientState.activeProcess = null;

  let status = "completed";
  let result = "";

  const needsVerification = [
    "openUrl",
    "sendWhatsApp",
    "manageApplication",
    "readWhatsAppStatus",
    "checkWhatsAppStatuses",
  ].includes(commandType);

  let beforeHash = null;
  if (needsVerification) {
    try {
      const before = await captureHash();
      beforeHash = before.hash;
    } catch (err) {
      console.warn("Failed to capture screen hash before action:", err.message);
    }
  }

  try {
    switch (commandType) {
      case "openUrl": {
        const { url, profile } = payload;
        if (!url) throw new Error("No URL specified in payload");
        await openBrowser(url, profile);
        result = `Opened URL: ${url}`;
        break;
      }

      case "openLeetcodeDaily": {
        result = await utilityService.openLeetcodeDaily(payload.profile);
        break;
      }

      case "openYoutubeVideo": {
        result = await utilityService.openYoutubeVideo(payload.searchQuery, payload.profile);
        break;
      }

      case "openFolder": {
        result = await commandService.openFolder(
          payload.folderPath,
          payload.editor,
        );
        break;
      }

      case "runCommand": {
        result = await commandService.runCommand(payload.command);
        break;
      }

      case "sendWhatsApp": {
        result = await whatsappService.sendText(
          payload.recipient,
          payload.message,
        );
        break;
      }

      case "checkWhatsAppStatuses": {
        result = await whatsappService.checkStatuses();
        break;
      }

      case "readWhatsAppLastConversation": {
        result = await whatsappService.readLastConversation(payload.recipient);
        break;
      }

      case "readWhatsAppStatus": {
        result = await whatsappService.readWhatsAppStatus(payload.recipient);
        break;
      }

      case "manageApplication": {
        result = await commandService.manageApplication(
          payload.appName,
          payload.action,
        );
        break;
      }

      case "captureScreen": {
        result = await utilityService.captureFullScreen();
        break;
      }

      case "uiAction": {
        const { appName, steps } = payload;
        const stepResults = [];
        for (const step of steps) {
          let res;
          switch (step.action) {
            case "focus":
              res = await focusApp(appName);
              break;
            case "click":
              res = await clickElement(appName, step.selector);
              break;
            case "type":
              res = await typeInto(appName, step.selector, step.value);
              break;
            case "read":
              res = await readElement(appName, step.selector);
              if (res.result) stepResults.push(res.result);
              break;
            case "capture":
              res = await captureWindow(appName);
              break;
          }
          if (res && !res.success) {
            throw new Error(`UIA step '${step.action}' failed: ${res.error}`);
          }
        }
        result = stepResults.length > 0 ? stepResults.join("\n") : "Done";
        break;
      }

      case 'webSearch': {
        const { query, maxResults = 5 } = payload
        
        if (!query) {
          result = 'No search query provided'
          break
        }

        const searchResult = await webSearch(
          query, 
          Math.min(maxResults, 10)
        )

        if (!searchResult.success || !searchResult.data.length) {
          result = `Search returned no results for: ${query}`
          break
        }

        result = 'SEARCH_RESULTS|||' + 
          JSON.stringify(searchResult.data)
        break
      }

      case 'webExtract': {
        const { url, task } = payload
        
        if (!url) {
          result = 'No URL provided'
          break
        }

        const extracted = await webExtract(url)

        if (!extracted.success) {
          result = `Could not read ${url}: ${extracted.error}`
          break
        }

        result = `EXTRACT_CONTENT|||${task}|||${extracted.text}`
        break
      }

      default:
        throw new Error(`Unknown command type: ${commandType}`);
    }

    if (needsVerification && beforeHash) {
      try {
        const verification = await verifyAction(beforeHash, commandType);
        if (!verification.success) {
          console.warn(
            `Verify failed for ${commandType}: ${verification.reason}`,
          );
          result =
            result +
            ` (Note: screen change not detected — ${verification.reason})`;
        }
      } catch (err) {
        console.warn("Verification failed to run:", err.message);
      }
    }
  } catch (err) {
    console.error(`Task ${_id} execution failed:`, err.message);
    status = "failed";
    result = err.message;
  } finally {
    clientState.currentTaskId = null;
    clientState.activeProcess = null;
  }

  // If the task was cancelled, don't try to report status to the cloud to avoid race condition overwrite
  if (clientState.isCancelled) {
    console.log(`Task ${_id} execution stopped due to local cancellation.`);
    return;
  }

  try {
    await axios.post(
      `${config.CLOUD_URL}/client/tasks/${_id}/complete`,
      { status, result },
      { headers },
    );
    console.log(`Task ${_id} status reported: ${status}`);
  } catch (err) {
    console.error(`Failed reporting task ${_id} status:`, err.message);
  }
}

connectWebSocket();

process.once('SIGINT', async () => {
  await shutdownBrowser()
  process.exit(0)
})
process.once('SIGTERM', async () => {
  await shutdownBrowser()
  process.exit(0)
})
