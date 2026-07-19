const MAX_QUEUE = 500;
const queue = [];

export function enqueueDbWrite(sql, params, label) {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ sql, params, label });
}

let flushing = null;

export function flushDbWrites(pool) {
  if (!flushing) {
    flushing = doFlush(pool).finally(() => { flushing = null; });
  }
  return flushing;
}

async function doFlush(pool) {
  if (!pool || !queue.length) return 0;
  let flushed = 0;
  while (queue.length) {
    const item = queue[0];
    try {
      await pool.query(item.sql, item.params);
      queue.shift();
      flushed++;
    } catch {
      break;
    }
  }
  if (flushed) console.log(`[MEMORY] re-synced ${flushed} queued write${flushed === 1 ? "" : "s"} to Postgres`);
  return flushed;
}

export function pendingDbWrites() {
  return queue.length;
}

export function resetSyncQueueForTests() {
  queue.length = 0;
}
