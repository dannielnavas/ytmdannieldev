/**
 * `m:ss`, or `h:mm:ss` for anything over an hour.
 *
 * This was duplicated as a private method in `player-bar` and `now-playing`,
 * byte for byte.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Accessible text for a seek slider: "1:23 de 3:45".
 *
 * Screen readers announce the raw number of a range input otherwise, which
 * gives no clue about the track length.
 */
export function formatTimeRange(current: number, total: number): string {
  return `${formatTime(current)} de ${formatTime(total)}`;
}
