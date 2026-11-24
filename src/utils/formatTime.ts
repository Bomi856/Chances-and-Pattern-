export function formatElapsedMs(ms: number, showTenths = true): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeMs % 1000) / 100);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const base =
    hours > 0 ? `${String(hours).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;

  return showTenths ? `${base}.${tenths}` : base;
}

export function formatShortDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.round(totalSeconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

export function formatFilenameTimestamp(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}h${String(mins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s`;
}

export function parseDurationInput(raw: string): number | null {
  const input = raw.trim().toLowerCase();
  if (!input) return null;

  // Format: hh:mm:ss or mm:ss
  if (input.includes(':')) {
    const parts = input.split(':').map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  // Suffix formats: 1.5h, 10m, 45s
  const suffixMatch = input.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs)$/);
  if (suffixMatch) {
    const val = Number(suffixMatch[1]);
    const unit = suffixMatch[2];
    if (unit.startsWith('h')) return Math.round(val * 3600);
    if (unit.startsWith('m')) return Math.round(val * 60);
    return Math.round(val);
  }

  // Plain numeric seconds
  const num = Number(input);
  if (!Number.isNaN(num) && num > 0) {
    return Math.round(num * 10) / 10;
  }

  return null;
}

export function formatWallTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
