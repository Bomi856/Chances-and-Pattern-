import { Download, Images, Trash2 } from 'lucide-react';
import { CapturedFrame } from '../types/studio';
import { formatElapsedMs, formatFilenameTimestamp } from '../utils/formatTime';
import { downloadDataUrl } from '../utils/captureStorage';

interface CaptureStripProps {
  captures: CapturedFrame[];
  onInspect: (frame: CapturedFrame) => void;
  onDelete: (id: string) => void;
  onOpenTimeline: () => void;
}

export function CaptureStrip({
  captures,
  onInspect,
  onDelete,
  onOpenTimeline,
}: CaptureStripProps) {
  const recent = captures.slice(0, 12);

  return (
    <section
      aria-label="Captured timestamp filmstrip"
      className="border-t border-zinc-800 bg-[#0D0D10] px-4 py-3"
    >
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-zinc-200">Timestamp Captures</span>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <span className="text-zinc-400 font-mono tabular-nums">
            {captures.length} saved
          </span>
        </div>

        {captures.length > 0 && (
          <button
            type="button"
            onClick={onOpenTimeline}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
          >
            <Images className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Timeline & Compare</span>
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="py-4 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg text-center">
          Screenshots appear here automatically at your scheduled timestamps, or click Capture Frame anytime.
        </div>
      ) : (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
          {recent.map((frame) => (
            <div
              key={frame.id}
              className="group relative w-44 shrink-0 border border-zinc-800 hover:border-zinc-600 rounded-lg bg-[#09090B] overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => onInspect(frame)}
                className="block w-full aspect-video bg-black overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <img
                  src={frame.dataUrl}
                  alt={`${frame.sketchName} at ${formatElapsedMs(frame.elapsedMs)}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </button>

              <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono tabular-nums text-zinc-100 truncate">
                    {formatElapsedMs(frame.elapsedMs)}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {frame.triggerLabel}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const slug = frame.sketchName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-');
                      downloadDataUrl(
                        frame.dataUrl,
                        `${slug}_${formatFilenameTimestamp(frame.elapsedMs)}.png`
                      );
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
                    title="Download PNG"
                    aria-label="Download PNG"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(frame.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete capture"
                    aria-label="Delete capture"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
