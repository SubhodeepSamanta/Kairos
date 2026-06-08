export const clientState = {
  currentTaskId: null,
  isCancelled: false,
  activeProcess: null
};

export function abortCurrentTask() {
  clientState.isCancelled = true;
  if (clientState.activeProcess) {
    console.log('Killing active process due to task cancellation...');
    try {
      clientState.activeProcess.kill('SIGKILL');
    } catch (e) {
      console.error('Failed to kill active process:', e.message);
    }
    clientState.activeProcess = null;
  }
}
