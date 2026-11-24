import { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Trash2,
  X,
} from 'lucide-react';
import { CapturedFrame } from '../types/studio';
import { downloadDataUrl } from '../utils/captureStorage';
import {
  formatElapsedMs,
  formatFilenameTimestamp,
  formatWallTime,
} from '../utils/formatTime';

interface CaptureLightboxProps {
  frame: CapturedFrame;
  allFrames: CapturedFrame[];
  onSelectFrame: (frame: CapturedFrame) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRestoreCode: (frame: CapturedFrame) => void;
}

export function CaptureLightbox({
  frame,
  allFrames,
  onSelectFrame,
  onClose,
  onDelete,
  onRestoreCode,
}: CaptureLightboxProps) {
  const index = allFrames.findIndex((f) => f.id === frame.id);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < allFrames.length - 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) {
        onSelectFrame(allFrames[index - 1]);
      }
      if (e.key === 'ArrowRight' && hasNext) {
        onSelectFrame(allFrames[index + 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allFrames, hasNext, hasPrev, index, onClose, onSelectFrame]);

  const handleDownload = () => {
    const slug = frame.sketchName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadDataUrl(
      frame.dataUrl,
      `${slug}_${formatFilenameTimestamp(frame.elapsedMs)}.png`
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot inspection for ${frame.sketchName}`}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      {/* Top Bar */}
      <div className="h-14 shrink-0 px-6 border-b border-zinc-800 flex items-center justify-between gap-4 bg-[#09090B]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display font-semibold text-zinc-100 truncate">
            {frame.sketchName}
          </span>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <span className="font-mono text-xs tabular-nums text-amber-400">
            t = {formatElapsedMs(frame.elapsedMs)}
          </span>
          <span aria-hidden="true" className="text-zinc-600 hidden sm:inline">
            ·
          </span>
          <span className="font-mono text-xs tabular-nums text-zinc-400 hidden sm:inline">
            Frame #{frame.frameCount} · {frame.width}×{frame.height} ·{' '}
            {formatWallTime(frame.capturedAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onRestoreCode(frame);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Code</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-zinc-950 transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete(frame.id);
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete capture"
            aria-label="Delete capture"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Close inspection"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-6">
        {hasPrev && (
          <button
            type="button"
            onClick={() => onSelectFrame(allFrames[index - 1])}
            className="absolute left-4 z-10 p-3 rounded-full bg-zinc-900/90 border border-zinc-700 hover:bg-zinc-800 text-zinc-100 transition-colors"
            aria-label="Previous capture"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <img
          src={frame.dataUrl}
          alt={`${frame.sketchName} at ${formatElapsedMs(frame.elapsedMs)}`}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-full object-contain border border-zinc-800 bg-black"
        />

        {hasNext && (
          <button
            type="button"
            onClick={() => onSelectFrame(allFrames[index + 1])}
            className="absolute right-4 z-10 p-3 rounded-full bg-zinc-900/90 border border-zinc-700 hover:bg-zinc-800 text-zinc-100 transition-colors"
            aria-label="Next capture"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
