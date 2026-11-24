import {
  CaptureScheduleConfig,
  CapturedFrame,
  SketchPreset,
} from '../types/studio';
import { formatElapsedMs } from './formatTime';

const DB_NAME = 'tessera_studio_db';
const DB_VERSION = 1;
const STORE_CAPTURES = 'captures';

const CUSTOM_SKETCHES_KEY = 'tessera_custom_sketches_v1';
const SCHEDULE_CONFIG_KEY = 'tessera_schedule_config_v1';

export const DEFAULT_SCHEDULE_CONFIG: CaptureScheduleConfig = {
  enabled: true,
  mode: 'milestones',
  milestones: [
    { id: 'm-5', seconds: 5, enabled: true, triggered: false },
    { id: 'm-15', seconds: 15, enabled: true, triggered: false },
    { id: 'm-30', seconds: 30, enabled: true, triggered: false },
    { id: 'm-60', seconds: 60, enabled: true, triggered: false },
    { id: 'm-180', seconds: 180, enabled: true, triggered: false },
    { id: 'm-300', seconds: 300, enabled: false, triggered: false },
    { id: 'm-600', seconds: 600, enabled: false, triggered: false },
  ],
  intervalSeconds: 30,
  autoDownload: false,
  maxIntervalCaptures: 0,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
        const store = db.createObjectStore(STORE_CAPTURES, { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
        store.createIndex('sketchId', 'sketchId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let memoryFallbackCaptures: CapturedFrame[] = [];

export async function saveCapture(frame: CapturedFrame): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CAPTURES, 'readwrite');
      tx.objectStore(STORE_CAPTURES).put(frame);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFallbackCaptures = [
      frame,
      ...memoryFallbackCaptures.filter((c) => c.id !== frame.id),
    ];
  }
}

export async function getAllCaptures(): Promise<CapturedFrame[]> {
  try {
    const db = await openDb();
    const items = await new Promise<CapturedFrame[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CAPTURES, 'readonly');
      const req = tx.objectStore(STORE_CAPTURES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => b.capturedAt - a.capturedAt);
  } catch {
    return [...memoryFallbackCaptures].sort(
      (a, b) => b.capturedAt - a.capturedAt
    );
  }
}

export async function deleteCapture(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CAPTURES, 'readwrite');
      tx.objectStore(STORE_CAPTURES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFallbackCaptures = memoryFallbackCaptures.filter((c) => c.id !== id);
  }
}

export async function clearAllCaptures(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CAPTURES, 'readwrite');
      tx.objectStore(STORE_CAPTURES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFallbackCaptures = [];
  }
}

export function loadCustomSketches(): SketchPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SKETCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSketch(sketch: SketchPreset): SketchPreset[] {
  const existing = loadCustomSketches();
  const next = [
    { ...sketch, isCustom: true, updatedAt: Date.now() },
    ...existing.filter((s) => s.id !== sketch.id),
  ];
  try {
    localStorage.setItem(CUSTOM_SKETCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota issues
  }
  return next;
}

export function deleteCustomSketch(id: string): SketchPreset[] {
  const existing = loadCustomSketches();
  const next = existing.filter((s) => s.id !== id);
  try {
    localStorage.setItem(CUSTOM_SKETCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadScheduleConfig(): CaptureScheduleConfig {
  try {
    const raw = localStorage.getItem(SCHEDULE_CONFIG_KEY);
    if (!raw) return DEFAULT_SCHEDULE_CONFIG;
    const parsed = JSON.parse(raw) as CaptureScheduleConfig;
    if (!parsed || !Array.isArray(parsed.milestones)) {
      return DEFAULT_SCHEDULE_CONFIG;
    }
    return {
      ...DEFAULT_SCHEDULE_CONFIG,
      ...parsed,
      milestones: parsed.milestones.map((m) => ({ ...m, triggered: false })),
    };
  } catch {
    return DEFAULT_SCHEDULE_CONFIG;
  }
}

export function saveScheduleConfig(config: CaptureScheduleConfig): void {
  try {
    const sanitized: CaptureScheduleConfig = {
      ...config,
      milestones: config.milestones.map((m) => ({ ...m, triggered: false })),
    };
    localStorage.setItem(SCHEDULE_CONFIG_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function generateContactSheet(
  frames: CapturedFrame[],
  title: string
): Promise<string> {
  const ordered = [...frames].sort((a, b) => a.elapsedMs - b.elapsedMs).slice(0, 24);
  if (ordered.length === 0) {
    throw new Error('No frames available to build contact sheet.');
  }

  const cols = ordered.length <= 2 ? ordered.length : ordered.length <= 6 ? 3 : 4;
  const rows = Math.ceil(ordered.length / cols);

  const cellW = 460;
  const cellH = 340;
  const captionH = 44;
  const gap = 24;
  const padX = 48;
  const headerH = 92;
  const padBottom = 40;

  const sheetW = padX * 2 + cols * cellW + (cols - 1) * gap;
  const sheetH = headerH + rows * (cellH + captionH) + (rows - 1) * gap + padBottom;

  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D context.');

  // Archival darkroom matte background
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, sheetW, sheetH);

  // Header
  ctx.fillStyle = '#FAFAFA';
  ctx.font = '600 26px "Outfit", sans-serif';
  ctx.fillText(title, padX, 46);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.fillText(
    `${ordered.length} timestamped frames · Generated ${new Date().toLocaleDateString()}`,
    padX,
    72
  );

  // Hairline rule
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, headerH - 8);
  ctx.lineTo(sheetW - padX, headerH - 8);
  ctx.stroke();

  const images = await Promise.all(ordered.map((f) => loadImageElement(f.dataUrl)));

  ordered.forEach((frame, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padX + col * (cellW + gap);
    const y = headerH + row * (cellH + captionH + gap);

    // Frame box
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, cellW, cellH);

    // Fit image inside cell preserving aspect ratio
    const img = images[idx];
    const scale = Math.min(cellW / img.width, cellH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (cellW - dw) / 2;
    const dy = y + (cellH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);

    // Hairline border
    ctx.strokeStyle = '#27272A';
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    // Caption
    ctx.fillStyle = '#E4E4E7';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText(`t = ${formatElapsedMs(frame.elapsedMs)}`, x, y + cellH + 20);

    ctx.fillStyle = '#71717A';
    ctx.font = '400 12px "JetBrains Mono", monospace';
    ctx.fillText(
      `#${frame.frameCount} · ${frame.width}×${frame.height} · ${frame.triggerLabel}`,
      x,
      y + cellH + 37
    );
  });

  return canvas.toDataURL('image/png');
}
