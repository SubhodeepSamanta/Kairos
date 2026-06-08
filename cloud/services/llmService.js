import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env.js';

export const tools = [
  {
    type: 'function',
    function: {
      name: 'openUrl',
      description: 'Opens a web URL in the user\'s local web browser (supports opening in specific Chrome accounts/profiles like work, personal, leetcode).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute URL to open (including https://).' },
          profile: { type: 'string', description: 'The Chrome profile account to open the URL in. Can be an email address (e.g. "subhodeepsamanta2005@gmail.com"), an index number/word (e.g., "first", "second", "third", "1st", "2nd"), or a display name (e.g. "Saikou Kami", "UwU").' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'openFolder',
      description: 'Opens a directory folder in VS Code or standard File Explorer on the local PC.',
      parameters: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'The path of the folder to open (e.g., C:\\Users\\USER\\Desktop\\Kairos).' },
          editor: { type: 'string', enum: ['vscode', 'explorer'], description: 'The editor or application to open the folder with.' }
        },
        required: ['folderPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: 'Runs a command on the user\'s local command line (restricted to safe, non-destructive tools).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command line string to run.' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sendWhatsApp',
      description: 'Sends a WhatsApp text message to a specific contact name on the user\'s local PC.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'The contact name (e.g. Subhodeep, Mom).' },
          message: { type: 'string', description: 'The text message content.' }
        },
        required: ['recipient', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkWhatsAppStatuses',
      description: 'Checks which contacts have recently posted active statuses by taking a screenshot of the WhatsApp status list.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readWhatsAppStatus',
      description: 'Opens and captures the active status story page for a specific contact to read what they said/posted.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'The contact name whose status needs to be opened.' }
        },
        required: ['recipient']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readWhatsAppLastConversation',
      description: 'Opens and reads the recent conversation messages with a specific contact.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'The contact name whose conversation needs to be read.' }
        },
        required: ['recipient']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manageApplication',
      description: 'Opens or closes a specific desktop application on the computer (e.g. whatsapp, spotify, vscode, chrome).',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'The name of the application (e.g. "whatsapp", "spotify", "vscode", "chrome").' },
          action: { type: 'string', enum: ['open', 'close'], description: 'The action to perform.' }
        },
        required: ['appName', 'action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'captureScreen',
      description: 'Takes a screenshot of the user\'s desktop/screen to describe what is currently visible or open.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWeather',
      description: 'Gets the current weather or temperature. If location is omitted, checks the local city.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Optional city or region to check weather for.' }
        }
      }
    }
  }
];

const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getMD5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function requestWithRetry(requestFn, retries = 2, delay = 1000) {
  try {
    return await requestFn();
  } catch (err) {
    const isRateLimit = err.response?.status === 429;
    const isTransientError = err.response?.status >= 500;
    
    if ((isRateLimit || isTransientError) && retries > 0) {
      console.warn(`Encountered transient code ${err.response?.status}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return requestWithRetry(requestFn, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function executeTextCompletion(provider, messages) {
  const headers = {
    'Authorization': `Bearer ${provider.key}`,
    'Content-Type': 'application/json'
  };

  if (provider.name === 'OpenRouter') {
    headers['HTTP-Referer'] = 'https://github.com/SubhodeepSamanta/Kairos';
    headers['X-Title'] = 'Kairos AI Agent';
  }

  const payload = {
    model: provider.model,
    messages: messages,
    tools: tools,
    tool_choice: 'auto',
    max_tokens: 1024
  };

  const response = await requestWithRetry(() => axios.post(provider.endpoint, payload, { headers }));
  const choice = response.data.choices?.[0];
  if (!choice) throw new Error(`Invalid response payload from ${provider.name}`);

  return {
    content: choice.message.content || '',
    toolCalls: choice.message.tool_calls || null
  };
}

async function executeVisionCompletion(provider, base64Image, userPrompt) {
  const headers = {
    'Authorization': `Bearer ${provider.key}`,
    'Content-Type': 'application/json'
  };

  if (provider.name === 'OpenRouter') {
    headers['HTTP-Referer'] = 'https://github.com/SubhodeepSamanta/Kairos';
    headers['X-Title'] = 'Kairos AI Agent';
  }

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Image}`
          }
        }
      ]
    }
  ];

  const payload = {
    model: provider.model,
    messages: messages,
    max_tokens: 1024
  };

  const response = await requestWithRetry(() => axios.post(provider.endpoint, payload, { headers }));
  const choice = response.data.choices?.[0];
  if (!choice) throw new Error(`Invalid response payload from ${provider.name}`);

  return choice.message.content || 'No text extracted.';
}

export async function getChatCompletion(messages) {
  const providers = [];

  if (config.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      key: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_MODEL
    });
  }

  if (config.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      key: config.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile'
    });
  }

  if (config.NVIDIA_API_KEY) {
    providers.push({
      name: 'Nvidia',
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: config.NVIDIA_API_KEY,
      model: 'meta/llama-3.3-70b-instruct'
    });
  }

  if (providers.length === 0) {
    console.warn('WARNING: No LLM keys configured. Operating in mock mode.');
    return { content: 'Agent is operating in mock mode. Please set an API key.' };
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Attempting text completion using: ${provider.name}`);
      return await executeTextCompletion(provider, messages);
    } catch (err) {
      console.error(`${provider.name} text completion failed:`, err.response?.data || err.message);
      lastError = err;
    }
  }

  throw new Error(`All configured LLM text completion providers failed. Last error: ${lastError?.message}`);
}

export async function analyzeImage(base64Image, userPrompt) {
  const providers = [];

  if (config.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      key: config.GROQ_API_KEY,
      model: 'llama-3.2-11b-vision-instruct'
    });
  }

  if (config.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      key: config.OPENROUTER_API_KEY,
      model: 'google/gemini-2.5-flash'
    });
  }

  if (config.NVIDIA_API_KEY) {
    providers.push({
      name: 'Nvidia',
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: config.NVIDIA_API_KEY,
      model: 'meta/llama-3.2-11b-vision-instruct'
    });
  }

  if (providers.length === 0) {
    return 'Mock mode: Cannot process images without an active LLM key.';
  }

  const imageHash = getMD5(base64Image);
  const cacheKey = `${imageHash}_${getMD5(userPrompt)}`;
  const cached = apiCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log('Returning cached Vision completion response (Rate Limit Avoided)');
    return cached.data;
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Attempting vision completion using: ${provider.name}`);
      const text = await executeVisionCompletion(provider, base64Image, userPrompt);
      
      apiCache.set(cacheKey, {
        data: text,
        timestamp: Date.now()
      });
      
      return text;
    } catch (err) {
      console.error(`${provider.name} vision completion failed:`, err.response?.data || err.message);
      lastError = err;
    }
  }

  throw new Error(`All configured LLM vision providers failed. Last error: ${lastError?.message}`);
}
