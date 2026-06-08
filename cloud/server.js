import express from 'express';
import { config } from './config/env.js';
import { connectDB } from './services/db.js';
import { fetchPendingTasks, completeTask, getTaskById } from './services/taskService.js';
import { initBot, handleTaskCompletion, shutdownBot } from './services/botService.js';
import { analyzeImage } from './services/llmService.js';
import { WebSocketServer } from 'ws';

let clientSocket = null;

export function pushTaskToClient(task) {
  if (clientSocket && clientSocket.readyState === 1) {
    clientSocket.send(JSON.stringify(task));
    return true;
  }
  return false;
}

export function pushCancelToClient() {
  if (clientSocket && clientSocket.readyState === 1) {
    clientSocket.send(JSON.stringify({ type: 'cancel' }))
    return true
  }
  return false
}

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = config.PORT;

const verifyClient = (req, res, next) => {
  const token = req.headers['x-client-secret'];
  if (!token || token !== config.CLIENT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized client access.' });
  }
  next();
};

app.get('/client/tasks', verifyClient, async (req, res) => {
  try {
    const pending = await fetchPendingTasks();
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/client/tasks/:id/status', verifyClient, async (req, res) => {
  try {
    const { id } = req.params;
    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ status: task.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/client/tasks/:id/complete', verifyClient, async (req, res) => {
  const { id } = req.params;
  const { status, result } = req.body;

  try {
    const completed = await completeTask(id, status, result);
    res.json({ success: true });
    
    handleTaskCompletion({
      ...completed.toObject ? completed.toObject() : completed,
      result,
      status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/client/analyze-image', verifyClient, async (req, res) => {
  const { base64Image, prompt } = req.body;
  try {
    const analysis = await analyzeImage(base64Image, prompt);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    time: new Date()
  });
});

app.get('/', (req, res) => {
  res.send('Kairos Server is operational.');
});

const failedAttempts = new Map()

async function startServer() {
  await connectDB();
  initBot();

  const httpServer = app.listen(PORT, () => {
    console.log(`Kairos Server listening on port ${PORT}`);
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress
    const now = Date.now()
    const attempts = failedAttempts.get(ip) || 
      { count: 0, firstAttempt: now }
    
    if (now - attempts.firstAttempt > 60000) {
      attempts.count = 0
      attempts.firstAttempt = now
    }
    
    if (attempts.count >= 5) {
      ws.close(1008, 'Unauthorized')
      return
    }
    
    const token = req.headers['x-client-secret']
    if (token !== config.CLIENT_SECRET) {
      attempts.count++
      failedAttempts.set(ip, attempts)
      if (attempts.count >= 5) {
        console.warn(`Blocking IP ${ip} after 5 failed attempts`)
      }
      ws.close(1008, 'Unauthorized')
      return
    }
    
    failedAttempts.delete(ip)
    clientSocket = ws;
    console.log('Client connected via WebSocket.');

    ws.on('close', () => {
      clientSocket = null;
      console.log('Client WebSocket disconnected.');
    });
  });
}

startServer();

process.once('SIGINT', () => {
  shutdownBot();
  process.exit(0);
});
process.once('SIGTERM', () => {
  shutdownBot();
  process.exit(0);
});
