import axios from 'axios';

// Default configuration from environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-2-9b-it:free';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Tool definitions for Kairos agent function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'openUrl',
      description: 'Opens a specific web URL on the user\'s local computer web browser (e.g., YouTube videos, articles, search pages).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute URL to open (including https://).' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'openFolder',
      description: 'Opens a folder path in Antigravity/VS Code or standard File Explorer on the user\'s local computer.',
      parameters: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'The path of the folder to open (absolute or relative/home-based).' },
          editor: { type: 'string', enum: ['antigravity', 'explorer'], default: 'antigravity', description: 'The application to open the folder with.' }
        },
        required: ['folderPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: 'Runs a generic terminal/shell command on the user\'s local computer.',
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
      description: 'Sends a WhatsApp text message or a captured desktop screenshot to a specific contact name on the user\'s local PC.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'The contact name to search and send to (e.g. Subhodeep, Mom).' },
          mode: { type: 'string', enum: ['text', 'screenshot'], description: 'Whether to send a text message or a desktop screenshot.' },
          message: { type: 'string', description: 'The text message content. Required if mode is "text".' }
        },
        required: ['recipient', 'mode']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getWeather',
      description: 'Gets the current weather or temperature for a specified location.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City/location to check weather for.' }
        },
        required: ['location']
      }
    }
  }
];

export async function getChatCompletion(messages) {
  if (!OPENROUTER_API_KEY) {
    console.warn("WARNING: OPENROUTER_API_KEY is not set. Using mock local responses.");
    return {
      content: "I'm running in mock mode because no API key is configured. Please configure your .env file with OPENROUTER_API_KEY."
    };
  }

  try {
    const response = await axios.post(
      API_URL,
      {
        model: OPENROUTER_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/SubhodeepSamanta/Kairos',
          'X-Title': 'Kairos AI Agent'
        }
      }
    );

    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new Error('Invalid response structure from OpenRouter');
    }

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls || null
    };
  } catch (error) {
    console.error('Error in LLM api call:', error.response?.data || error.message);
    throw error;
  }
}
