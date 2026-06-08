import axios from 'axios';
import { config } from './config/env.js';
import * as whatsappService from './services/whatsappService.js';
import * as commandService from './services/commandService.js';
import * as utilityService from './services/utilityService.js';
import { openBrowser } from './utils/osHelper.js';
import { clientState, abortCurrentTask } from './utils/clientState.js';

console.log('Kairos Client is initializing...');
console.log(`Connecting to Cloud at: ${config.CLOUD_URL}`);

const headers = {
  'x-client-secret': config.CLIENT_SECRET,
  'Content-Type': 'application/json'
};

async function pollTasks() {
  try {
    const response = await axios.get(`${config.CLOUD_URL}/client/tasks`, { headers });
    const tasks = response.data;

    if (tasks && tasks.length > 0) {
      console.log(`Received ${tasks.length} task(s) from cloud.`);
      for (const task of tasks) {
        await executeTask(task);
      }
    }
  } catch (error) {
    console.error('Polling connection failed:', error.message);
  }

  setTimeout(pollTasks, config.POLL_INTERVAL);
}

async function executeTask(task) {
  const { _id, commandType, payload } = task;
  console.log(`Executing task ${_id} (${commandType})...`);

  // Initialize client task state
  clientState.currentTaskId = _id;
  clientState.isCancelled = false;
  clientState.activeProcess = null;

  let status = 'completed';
  let result = '';

  // Start a polling loop to check if this task has been cancelled on the server
  const cancelCheckInterval = setInterval(async () => {
    try {
      const response = await axios.get(`${config.CLOUD_URL}/client/tasks/${_id}/status`, { headers });
      if (response.data?.status === 'failed' || response.data?.status === 'cancelled') {
        console.log(`Task ${_id} has been cancelled on the cloud. Aborting locally.`);
        abortCurrentTask();
      }
    } catch (err) {
      // Ignore network errors in status checking
    }
  }, 1000);

  try {
    switch (commandType) {
      case 'openUrl': {
        const { url, profile } = payload;
        if (!url) throw new Error('No URL specified in payload');

        if (url.includes('problem-of-the-day')) {
          result = await utilityService.openLeetcodeDaily(profile);
        } else if (url.includes('youtube.com/results')) {
          const urlParams = new URL(url);
          const q = urlParams.searchParams.get('search_query');
          result = await utilityService.openYoutubeVideo(q, profile);
        } else {
          await openBrowser(url, profile);
          result = `Opened URL: ${url}`;
        }
        break;
      }

      case 'openFolder': {
        result = await commandService.openFolder(payload.folderPath, payload.editor);
        break;
      }

      case 'runCommand': {
        result = await commandService.runCommand(payload.command);
        break;
      }

      case 'sendWhatsApp': {
        result = await whatsappService.sendText(payload.recipient, payload.message);
        break;
      }

      case 'checkWhatsAppStatuses': {
        result = await whatsappService.checkStatuses();
        break;
      }

      case 'readWhatsAppLastConversation': {
        result = await whatsappService.readLastConversation(payload.recipient);
        break;
      }

      case 'readWhatsAppStatus': {
        await whatsappService.searchContact(payload.recipient);
        await whatsappService.selectContact();
        await new Promise(resolve => setTimeout(resolve, 1500));

        const defaultClickX = 380;
        const defaultClickY = 45;

        const screenshotBounds = await whatsappService.clickAndCapture(defaultClickX, defaultClickY);
        result = screenshotBounds;
        break;
      }

      case 'getWeather': {
        result = await utilityService.getWeather(payload.location);
        break;
      }

      case 'manageApplication': {
        result = await commandService.manageApplication(payload.appName, payload.action);
        break;
      }

      case 'captureScreen': {
        result = await utilityService.captureFullScreen();
        break;
      }

      default:
        throw new Error(`Unknown command type: ${commandType}`);
    }
  } catch (err) {
    console.error(`Task ${_id} execution failed:`, err.message);
    status = 'failed';
    result = err.message;
  } finally {
    clearInterval(cancelCheckInterval);
    clientState.currentTaskId = null;
    clientState.activeProcess = null;
  }

  // If the task was cancelled, don't try to report status to the cloud to avoid race condition overwrite
  if (clientState.isCancelled) {
    console.log(`Task ${_id} execution stopped due to local cancellation.`);
    return;
  }

  try {
    await axios.post(`${config.CLOUD_URL}/client/tasks/${_id}/complete`, { status, result }, { headers });
    console.log(`Task ${_id} status reported: ${status}`);
  } catch (err) {
    console.error(`Failed reporting task ${_id} status:`, err.message);
  }
}

pollTasks();
