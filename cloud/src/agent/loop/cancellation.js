const POLL_MS = 250;

export function createCancellation(isCancelled) {
  const stopped = () => {
    try { return Boolean(isCancelled?.()); } catch { return false; }
  };

  const raceCancel = async (promise) => {
    let timer = null;
    const watch = new Promise((_, reject) => {
      const tick = () => {
        if (stopped()) reject(new Error("cancelled_by_user"));
        else timer = setTimeout(tick, POLL_MS);
      };
      tick();
    });
    try {
      return await Promise.race([promise, watch]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const sleepUnlessStopped = async (ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (stopped()) return false;
      await new Promise(r => setTimeout(r, Math.min(POLL_MS, until - Date.now())));
    }
    return true;
  };

  return { stopped, raceCancel, sleepUnlessStopped };
}
