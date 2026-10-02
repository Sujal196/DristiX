/**
 * Off-Thread Timer Web Worker Code
 * Managed off the main DOM thread to guarantee precision and prevent lag
 * even when the tab is backgrounded or busy rendering.
 */

export const timerWorkerScript = `
let timerId = null;
let remainingSeconds = 0;
let targetEndTime = 0;
let isRunning = false;

function formatTime(totalSec) {
  const safeSec = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = safeSec % 60;
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':');
}

function checkMilestones(sec) {
  if (sec === 1800) return { alert: true, message: '30 minutes remaining in the exam.' };
  if (sec === 900) return { alert: true, message: '15 minutes remaining in the exam.' };
  if (sec === 600) return { alert: true, message: 'Attention: 10 minutes remaining in the exam.' };
  if (sec === 300) return { alert: true, message: 'Warning: 5 minutes remaining. Please review your answers.' };
  if (sec === 120) return { alert: true, message: 'Urgent: 2 minutes remaining.' };
  if (sec === 60) return { alert: true, message: 'Final minute remaining. The exam will submit automatically in 60 seconds.' };
  if (sec === 30) return { alert: true, message: '30 seconds remaining.' };
  if (sec === 10) return { alert: true, message: '10 seconds remaining.' };
  if (sec === 0) return { alert: true, message: 'Time has expired. Submitting your examination session now.' };
  return { alert: false, message: '' };
}

self.onmessage = function(e) {
  const { action, payload } = e.data;

  if (action === 'START') {
    if (payload && typeof payload.seconds === 'number') {
      remainingSeconds = Math.max(0, Math.floor(payload.seconds));
    }
    if (payload && typeof payload.expiresAtMs === 'number' && payload.expiresAtMs > Date.now()) {
      targetEndTime = payload.expiresAtMs;
      remainingSeconds = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
    } else {
      targetEndTime = Date.now() + remainingSeconds * 1000;
    }

    isRunning = true;
    if (timerId) clearInterval(timerId);

    self.postMessage({
      type: 'TICK',
      remainingSeconds,
      formattedTime: formatTime(remainingSeconds)
    });

    timerId = setInterval(() => {
      if (!isRunning) return;
      const now = Date.now();
      const currentRemaining = Math.max(0, Math.round((targetEndTime - now) / 1000));

      if (currentRemaining !== remainingSeconds || currentRemaining === 0) {
        remainingSeconds = currentRemaining;
        const milestone = checkMilestones(remainingSeconds);

        self.postMessage({
          type: 'TICK',
          remainingSeconds,
          formattedTime: formatTime(remainingSeconds),
          milestone
        });

        if (remainingSeconds === 0) {
          isRunning = false;
          clearInterval(timerId);
          timerId = null;
          self.postMessage({ type: 'TIMEOUT' });
        }
      }
    }, 500);
  } else if (action === 'PAUSE') {
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  } else if (action === 'RESUME') {
    isRunning = true;
    targetEndTime = Date.now() + remainingSeconds * 1000;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      if (!isRunning) return;
      const now = Date.now();
      const currentRemaining = Math.max(0, Math.round((targetEndTime - now) / 1000));
      if (currentRemaining !== remainingSeconds || currentRemaining === 0) {
        remainingSeconds = currentRemaining;
        const milestone = checkMilestones(remainingSeconds);
        self.postMessage({
          type: 'TICK',
          remainingSeconds,
          formattedTime: formatTime(remainingSeconds),
          milestone
        });
        if (remainingSeconds === 0) {
          isRunning = false;
          clearInterval(timerId);
          timerId = null;
          self.postMessage({ type: 'TIMEOUT' });
        }
      }
    }, 500);
  } else if (action === 'RESET') {
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (payload && typeof payload.seconds === 'number') {
      remainingSeconds = Math.max(0, Math.floor(payload.seconds));
    }
    targetEndTime = Date.now() + remainingSeconds * 1000;
    self.postMessage({
      type: 'TICK',
      remainingSeconds,
      formattedTime: formatTime(remainingSeconds)
    });
  } else if (action === 'SYNC') {
    if (payload && typeof payload.seconds === 'number') {
      remainingSeconds = Math.max(0, Math.floor(payload.seconds));
    }
    if (payload && typeof payload.expiresAtMs === 'number' && payload.expiresAtMs > Date.now()) {
      targetEndTime = payload.expiresAtMs;
      remainingSeconds = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
    } else {
      targetEndTime = Date.now() + remainingSeconds * 1000;
    }
    self.postMessage({
      type: 'TICK',
      remainingSeconds,
      formattedTime: formatTime(remainingSeconds)
    });
  } else if (action === 'GET_TIME') {
    self.postMessage({
      type: 'TIME_REPORT',
      remainingSeconds,
      formattedTime: formatTime(remainingSeconds)
    });
  }
};
`;

export function createTimerWorker(): Worker {
  const blob = new Blob([timerWorkerScript], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}
