import express from 'express';
import { config } from './config/env.js';
import { connectDB } from './services/db.js';
import { fetchPendingTasks, completeTask } from './services/taskService.js';
import { initBot, handleTaskCompletion, shutdownBot } from './services/botService.js';

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

app.post('/client/tasks/:id/complete', verifyClient, async (req, res) => {
  const { id } = req.params;
  const { status, result } = req.body;

  try {
    const completed = await completeTask(id, status, result);
    res.json({ success: true });
    handleTaskCompletion(completed);
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

async function startServer() {
  await connectDB();
  initBot();

  app.listen(PORT, () => {
    console.log(`Kairos Server listening on port ${PORT}`);
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
