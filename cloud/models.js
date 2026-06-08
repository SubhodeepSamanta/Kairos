import mongoose from 'mongoose';

const MemorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  role: { type: String, required: true },
  content: { type: String },
  raw_content: { type: mongoose.Schema.Types.Mixed },
  name: { type: String },
  tool_call_id: { type: String },
  tool_calls: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  commandType: { type: String, required: true }, // e.g. 'OPEN_URL', 'OPEN_FOLDER', 'RUN_COMMAND', 'TRANSLATE_SEND', 'SAY'
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  result: { 
    type: String, 
    default: '',
    maxlength: 500000
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Memory = mongoose.model('Memory', MemorySchema);
export const Message = mongoose.model('Message', MessageSchema);
export const Task = mongoose.model('Task', TaskSchema);
