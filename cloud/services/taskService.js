import { Task } from '../models.js';
import { isConnected } from './db.js';

const mockTasks = [];

export async function queueTask(commandType, payload) {
  if (isConnected()) {
    return await Task.create({
      commandType,
      payload,
      status: 'pending'
    });
  } else {
    const task = {
      _id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      commandType,
      payload,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockTasks.push(task);
    return task;
  }
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
    const task = await Task.findByIdAndUpdate(
      id,
      { status, result, updatedAt: new Date() },
      { new: true }
    );
    if (!task) throw new Error('Task not found');
    return task;
  } else {
    const task = mockTasks.find(t => t._id === id);
    if (!task) throw new Error('Task not found');
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
