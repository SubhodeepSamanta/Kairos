const DEFAULT_WAIT_MS = 120000;

let wanted = false;
let settled = false;
let waiters = [];

function release() {
  settled = true;
  const pending = waiters;
  waiters = [];
  for (const resolve of pending) resolve();
}

export function sttWanted() {
  wanted = true;
}

export function sttSettled() {
  release();
}

export function sttStatus() {
  return { wanted, settled };
}

export function waitForSttIfWanted(timeoutMs = DEFAULT_WAIT_MS) {
  if (!wanted || settled) return Promise.resolve(settled);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters = waiters.filter(w => w !== onReady);
      resolve(false);
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    waiters.push(onReady);
  });
}

export function resetRuntimeOrderForTests() {
  wanted = false;
  settled = false;
  waiters = [];
}
