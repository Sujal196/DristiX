/**
 * Off-Thread Timer Web Worker Code
 * Managed off the main DOM thread to guarantee precision and prevent lag
 * even when the tab is backgrounded or busy rendering.
 */

export const timerWorkerScript = `
let timerId = null;
let remainingSeconds = 0;
let isRunning = false;

function formatTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
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
      remainingSeconds = payload.seconds;
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
      if (remainingSeconds > 0) {
        remainingSeconds--;
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
          self.postMessage({ type: 'TIMEOUT' });
        }
      }
    }, 1000);
  } else if (action === 'PAUSE') {
    isRunning = false;
  } else if (action === 'RESUME') {
    isRunning = true;
  } else if (action === 'RESET') {
    isRunning = false;
    if (timerId) clearInterval(timerId);
    if (payload && typeof payload.seconds === 'number') {
      remainingSeconds = payload.seconds;
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
