import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';

const CLOUD_URL = 'http://localhost:3000';
const CLIENT_SECRET = 'default-secret';

async function runTest() {
  console.log('Starting Cloud Server process for testing...');
  const serverPath = path.resolve('server.js');
  
  const serverProc = spawn('node', [serverPath], {
    env: { ...process.env, PORT: '3000', CLIENT_SECRET },
    stdio: 'inherit'
  });

  // Wait 2 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // 1. Health check
    console.log('Checking server health...');
    const health = await axios.get(`${CLOUD_URL}/health`);
    console.log('Server health:', health.data);

    // 2. Poll tasks
    console.log('Polling tasks as client...');
    const tasksRes = await axios.get(`${CLOUD_URL}/client/tasks`, {
      headers: { 'x-client-secret': CLIENT_SECRET }
    });
    console.log('Tasks polled:', tasksRes.data);

    console.log('Verification test completed successfully.');
  } catch (error) {
    console.error('Verification failed:', error.message);
  } finally {
    console.log('Stopping server process...');
    serverProc.kill();
  }
}

runTest();
