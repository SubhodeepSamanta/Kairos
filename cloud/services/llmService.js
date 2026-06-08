import axios from "axios";
import crypto from "crypto";
import { config } from "../config/env.js";

export const tools = [
  {
    type: "function",
    function: {
      name: "openUrl",
      description:
        "Opens a web URL in the user's local web browser (supports opening in specific Chrome accounts/profiles like work, personal, leetcode).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The absolute URL to open (including https://).",
          },
          profile: {
            type: "string",
            description:
              'The Chrome profile account to open the URL in. Can be a profile email address, index number/word (e.g., "first", "second"), or a display name.',
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "openLeetcodeDaily",
      description: "Opens today's LeetCode daily coding challenge question in the browser.",
      parameters: {
        type: "object",
        properties: {
          profile: {
            type: "string",
            description: "Optional Chrome profile to use.",
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "openYoutubeVideo",
      description: "Searches and plays a video on YouTube for a given query.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: {
            type: "string",
            description: "The video topic or query to search on YouTube.",
          },
          profile: {
            type: "string",
            description: "Optional Chrome profile to use.",
          }
        },
        required: ["searchQuery"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "openFolder",
      description:
        "Opens a directory folder in VS Code, Antigravity, or standard File Explorer on the local PC.",
      parameters: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description:
              "The path of the folder to open (e.g., C:\\Users\\USER\\Desktop\\Kairos).",
          },
          editor: {
            type: "string",
            enum: ["vscode", "explorer", "antigravity"],
            description: "The editor or application to open the folder with.",
          },
        },
        required: ["folderPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "runCommand",
      description:
        "Runs a command on the user's local command line (restricted to safe, non-destructive tools).",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command line string to run.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendWhatsApp",
      description:
        "Sends a WhatsApp text message to a specific contact name on the user's local PC.",
      parameters: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description: "The contact name (e.g. John, Alice).",
          },
          message: { type: "string", description: "The text message content." },
        },
        required: ["recipient", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkWhatsAppStatuses",
      description:
        "Checks which contacts have recently posted active statuses by taking a screenshot of the WhatsApp status list.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readWhatsAppStatus",
      description:
        "Opens and captures the active status story page for a specific contact to read what they said/posted.",
      parameters: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description: "The contact name whose status needs to be opened.",
          },
        },
        required: ["recipient"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readWhatsAppLastConversation",
      description:
        "Opens and reads the recent conversation messages with a specific contact.",
      parameters: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description:
              "The contact name whose conversation needs to be read.",
          },
        },
        required: ["recipient"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manageApplication",
      description:
        "Opens or closes a specific desktop application on the computer (e.g. whatsapp, spotify, vscode, chrome).",
      parameters: {
        type: "object",
        properties: {
          appName: {
            type: "string",
            description:
              'The name of the application (e.g. "whatsapp", "spotify", "vscode", "chrome").',
          },
          action: {
            type: "string",
            enum: ["open", "close"],
            description: "The action to perform.",
          },
        },
        required: ["appName", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "captureScreen",
      description:
        "Takes a screenshot of the user's desktop/screen to describe what is currently visible or open.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "focusApp",
      description: "Brings a desktop application window to the foreground.",
      parameters: {
        type: "object",
        properties: {
          appName: {
            type: "string",
            description: "Process/app name, e.g. 'WhatsApp', 'chrome', 'spotify'.",
          },
        },
        required: ["appName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clickElement",
      description: "Clicks a UI element in an open application window.",
      parameters: {
        type: "object",
        properties: {
          appName: { type: "string" },
          selector: {
            type: "object",
            description: "Element selector using properties like name, controlType, or automationId.",
            properties: {
              name: { type: "string" },
              controlType: {
                type: "string",
                enum: [
                  "Button",
                  "Edit",
                  "ListItem",
                  "Text",
                  "List",
                  "MenuItem",
                  "CheckBox",
                  "ComboBox",
                ],
              },
              automationId: { type: "string" },
            },
          },
        },
        required: ["appName", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "typeInto",
      description: "Types text into a UI element in an application.",
      parameters: {
        type: "object",
        properties: {
          appName: { type: "string" },
          selector: {
            type: "object",
            properties: {
              name: { type: "string" },
              controlType: { type: "string" },
              automationId: { type: "string" },
            },
          },
          value: {
            type: "string",
            description: "Text to type.",
          },
        },
        required: ["appName", "selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readElement",
      description: "Reads text/value from a UI element in an application.",
      parameters: {
        type: "object",
        properties: {
          appName: { type: "string" },
          selector: {
            type: "object",
            properties: {
              name: { type: "string" },
              controlType: { type: "string" },
              automationId: { type: "string" },
            },
          },
        },
        required: ["appName", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "captureWindow",
      description:
        "Takes a screenshot of a specific app window or the full screen using '__screen__'. Returns base64 image data.",
      parameters: {
        type: "object",
        properties: {
          appName: {
            type: "string",
            description: "Application window name or '__screen__' for full desktop.",
          },
        },
        required: ["appName"],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'webSearch',
      description: `Search the web for any current \n` +
`information. Use this when you need to find \n` +
`information and don't know the exact URL, or when \n` +
`information might have changed recently.\n` +
`\n` +
`Use for:\n` +
`- News about anything ("youtube down", "IPL score", \n` +
`  "tech news", "what happened today")\n` +
`- Weather with details ("weather kolkata humidity")  \n` +
`- Prices, availability, status of anything\n` +
`- People, companies, events\n` +
`- Any question needing current information\n` +
`\n` +
`After getting results, call webExtract on the \n` +
`best URL to get the full content.\n` +
`\n` +
`Do NOT use for tasks that need browser interaction\n` +
`like clicking buttons or filling forms — use \n` +
`focusApp/clickElement/typeInto/readElement for those.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query. Be specific. Add "today" or "now" for current info. Add location for local info.'
          },
          maxResults: {
            type: 'integer',
            description: 'Max results. Default 5.',
            default: 5
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'webExtract',
      description: `Opens a URL with a real browser \n` +
`and reads the full page content. Use this to:\n` +
`- Read the top result from webSearch\n` +
`- Read a specific article or page\n` +
`- Get detailed content from a known URL\n` +
`\n` +
`Always use webSearch first if you don't know \n` +
`which URL has the best information.\n` +
`\n` +
`The content will be automatically summarized \n` +
`and sent to the user.`,
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Full URL including https://'
          },
          task: {
            type: 'string',
            description: 'What to find in the page. Be specific: "top 5 news headlines with sources", "current temperature humidity feels-like wind", "todays match scores and results", "problem title difficulty and description"'
          }
        },
        required: ['url', 'task'],
        additionalProperties: false
      }
    }
  }
];

const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getMD5(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function requestWithRetry(requestFn, retries = 1) {
  try {
    return await requestFn();
  } catch (err) {
    const status = err.response?.status;
    const shouldRetry = status === 429 || (status >= 500 && status < 600);
    if (shouldRetry && retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return requestWithRetry(requestFn, retries - 1);
    }
    throw err;
  }
}

async function executeTextCompletion(provider, messages) {
  const headers = {
    Authorization: `Bearer ${provider.key}`,
    "Content-Type": "application/json",
  };

  if (provider.name === "OpenRouter") {
    headers["HTTP-Referer"] = "https://github.com/SubhodeepSamanta/Kairos";
    headers["X-Title"] = "Kairos AI Agent";
  }

  const payload = {
    model: provider.model,
    messages: messages,
    tools: tools,
    tool_choice: "auto",
    max_tokens: 1024,
  };

  const response = await requestWithRetry(() =>
    axios.post(provider.endpoint, payload, { headers, timeout: 15000 }),
  );
  const choice = response.data.choices?.[0];
  if (!choice)
    throw new Error(`Invalid response payload from ${provider.name}`);

  return {
    content: choice.message.content || "",
    toolCalls: choice.message.tool_calls || null,
  };
}

async function executeVisionCompletion(provider, base64Image, userPrompt) {
  const headers = {
    Authorization: `Bearer ${provider.key}`,
    "Content-Type": "application/json",
  };

  if (provider.name === "OpenRouter") {
    headers["HTTP-Referer"] = "https://github.com/SubhodeepSamanta/Kairos";
    headers["X-Title"] = "Kairos AI Agent";
  }

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
    },
  ];

  const payload = {
    model: provider.model,
    messages: messages,
    max_tokens: 1024,
  };

  const response = await requestWithRetry(() =>
    axios.post(provider.endpoint, payload, { headers, timeout: 15000 }),
  );
  const choice = response.data.choices?.[0];
  if (!choice)
    throw new Error(`Invalid response payload from ${provider.name}`);

  return choice.message.content || "No text extracted.";
}

export async function getChatCompletion(messages) {
  const providers = [];

  if (config.GOOGLE_AI_KEY) {
    providers.push({
      name: "Google",
      endpoint:
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: config.GOOGLE_AI_KEY,
      model: config.GOOGLE_MODEL,
    });
  }

  if (config.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      key: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_MODEL,
    });
  }

  if (config.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      key: config.GROQ_API_KEY,
      model: config.GROQ_MODEL,
    });
  }

  if (config.NVIDIA_API_KEY) {
    providers.push({
      name: "NIM",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      key: config.NVIDIA_API_KEY,
      model: config.NVIDIA_MODEL,
    });
  }

  if (providers.length === 0) {
    console.warn("WARNING: No LLM keys configured. Operating in mock mode.");
    return {
      content: "Agent is operating in mock mode. Please set an API key.",
    };
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Attempting text completion using: ${provider.name}`);
      return await executeTextCompletion(provider, messages);
    } catch (err) {
      console.error(
        `${provider.name} text completion failed:`,
        err.response?.data || err.message,
      );
      lastError = err;
    }
  }

  throw new Error(
    `All configured LLM text completion providers failed. Last error: ${lastError?.message}`,
  );
}

export async function analyzeImage(base64Image, userPrompt) {
  const providers = [];

  if (config.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      key: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_MODEL,
    });
  }

  if (config.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      key: config.GROQ_API_KEY,
      model: config.GROQ_VISION_MODEL,
    });
  }

  if (config.NVIDIA_API_KEY) {
    providers.push({
      name: "NIM",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      key: config.NVIDIA_API_KEY,
      model: config.NVIDIA_VISION_MODEL,
    });
  }

  if (providers.length === 0) {
    return "Mock mode: Cannot process images without an active LLM key.";
  }

  const imageHash = getMD5(base64Image);
  const cacheKey = `${imageHash}_${getMD5(userPrompt)}`;
  const cached = apiCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      "Returning cached Vision completion response (Rate Limit Avoided)",
    );
    return cached.data;
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`Attempting vision completion using: ${provider.name}`);
      const text = await executeVisionCompletion(
        provider,
        base64Image,
        userPrompt,
      );

      apiCache.set(cacheKey, {
        data: text,
        timestamp: Date.now(),
      });

      return text;
    } catch (err) {
      console.error(
        `${provider.name} vision completion failed:`,
        err.response?.data || err.message,
      );
      lastError = err;
    }
  }

  throw new Error(
    `All configured LLM vision providers failed. Last error: ${lastError?.message}`,
  );
}
