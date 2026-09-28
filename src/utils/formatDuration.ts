/**
 * Formats a duration in seconds as HH:MM:SS.
 *
 * Shared by the exam store and the heartbeat loop so the displayed clock and
 * the server-synced value can never disagree on formatting.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}
