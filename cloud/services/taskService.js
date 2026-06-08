import { Task } from '../models.js';
import { isConnected } from './db.js';
import { pushTaskToClient, pushCancelToClient } from '../server.js';

const mockTasks = [];

export async function queueTask(commandType, payload) {
  let task;
  if (isConnected()) {
    task = await Task.create({
      commandType,
      payload,
      status: 'pending'
    });
  } else {
    task = {
      _id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      commandType,
      payload,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockTasks.push(task);
  }

  pushTaskToClient(task);
  return task;
}

export async function fetchPendingTasks() {
  if (isConnected()) {
    const pending = await Task.find({ status: 'pending' });
    if (pending.length > 0) {
      const ids = pending.map(t => t._id);
      await Task.updateMany({ _id: { $in: ids } }, { $set: { status: 'running', updatedAt: new Date() } });
    }
    return pending;
  } else {
    const pending = mockTasks.filter(t => t.status === 'pending');
    pending.forEach(t => {
      t.status = 'running';
      t.updatedAt = new Date();
    });
    return pending;
  }
}

export async function completeTask(id, status, result) {
  if (isConnected()) {
    const current = await Task.findById(id);
    if (!current) throw new Error('Task not found');
    if (current.status === 'failed' || current.status === 'cancelled') {
      return current;
    }
    const task = await Task.findByIdAndUpdate(
      id,
      { status, result, updatedAt: new Date() },
      { new: true }
    );
    return task;
  } else {
    const task = mockTasks.find(t => t._id === id);
    if (!task) throw new Error('Task not found');
    if (task.status === 'failed' || task.status === 'cancelled') {
      return task;
    }
    task.status = status;
    task.result = result;
    task.updatedAt = new Date();
    return task;
  }
}

export async function getTaskById(id) {
  if (isConnected()) {
    return await Task.findById(id);
  } else {
    return mockTasks.find(t => t._id === id);
  }
}

export async function cancelAllTasks() {
  if (isConnected()) {
    await Task.updateMany(
      { status: { $in: ['pending', 'running'] } },
      { $set: { status: 'failed', result: 'Cancelled by user', updatedAt: new Date() } }
    );
  } else {
    mockTasks.forEach(t => {
      if (t.status === 'pending' || t.status === 'running') {
        t.status = 'failed';
        t.result = 'Cancelled by user';
        t.updatedAt = new Date();
      }
    });
  }
  pushCancelToClient()
}

export async function hasPendingTasksForChat(chatId) {
  if (isConnected()) {
    const count = await Task.countDocuments({
      status: { $in: ['pending', 'running'] },
      'payload.chatId': chatId,
    });
    return count > 0;
  }

  return mockTasks.some(
    (task) =>
      (task.status === 'pending' || task.status === 'running') &&
      task.payload?.chatId === chatId,
  );
}
