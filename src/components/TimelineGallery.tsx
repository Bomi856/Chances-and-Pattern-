import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Code2,
  Download,
  Grid,
  Trash2,
} from 'lucide-react';
import { CapturedFrame } from '../types/studio';
import {
  downloadDataUrl,
  generateContactSheet,
} from '../utils/captureStorage';
import {
  formatElapsedMs,
  formatFilenameTimestamp,
  formatWallTime,
} from '../utils/formatTime';

interface TimelineGalleryProps {
  captures: CapturedFrame[];
  onInspect: (frame: CapturedFrame) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRestoreCode: (frame: CapturedFrame) => void;
  onReturnToStudio: () => void;
}

export function TimelineGallery({
  captures,
  onInspect,
  onDelete,
  onClearAll,
  onRestoreCode,
  onReturnToStudio,
}: TimelineGalleryProps) {
  const [selectedSketch, setSelectedSketch] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'chronological' | 'newest'>(
    'chronological'
  );
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [splitPos, setSplitPos] = useState<number>(50);
  const [exportingSheet, setExportingSheet] = useState(false);

  const sketchNames = useMemo(() => {
    const map = new Map<string, string>();
    captures.forEach((c) => map.set(c.sketchId, c.sketchName));
    return Array.from(map.entries());
  }, [captures]);

  const filtered = useMemo(() => {
    const base =
      selectedSketch === 'all'
        ? captures
        : captures.filter((c) => c.sketchId === selectedSketch);

    return [...base].sort((a, b) =>
      sortOrder === 'chronological'
        ? a.elapsedMs - b.elapsedMs || a.capturedAt - b.capturedAt
        : b.capturedAt - a.capturedAt
    );
  }, [captures, selectedSketch, sortOrder]);

  const comparePair = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const a = captures.find((c) => c.id === compareIds[0]);
    const b = captures.find((c) => c.id === compareIds[1]);
    if (!a || !b) return null;
    return a.elapsedMs <= b.elapsedMs ? [a, b] : [b, a];
  }, [compareIds, captures]);

  const toggleCompareSelection = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleExportContactSheet = async () => {
    if (filtered.length === 0) return;
    setExportingSheet(true);
    try {
      const title =
        selectedSketch === 'all'
          ? 'Tessera Evolution Contact Sheet'
          : `${filtered[0].sketchName} — Evolution Contact Sheet`;
      const sheetUrl = await generateContactSheet(filtered, title);
      downloadDataUrl(sheetUrl, `tessera-contact-sheet-${Date.now()}.png`);
    } finally {
      setExportingSheet(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-[1440px] w-full mx-auto space-y-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
            Evolution Timeline
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Inspect timestamped pattern milestones, compare two stages side-by-side, or export an annotated contact sheet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter captures by sketch"
            value={selectedSketch}
            onChange={(e) => setSelectedSketch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Sketches ({captures.length})</option>
            {sketchNames.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSortOrder('chronological')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                sortOrder === 'chronological'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              By Pattern Time
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('newest')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                sortOrder === 'newest'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Newest First
            </button>
          </div>

          <button
            type="button"
            disabled={filtered.length === 0 || exportingSheet}
            onClick={handleExportContactSheet}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Grid className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{exportingSheet ? 'Rendering...' : 'Export Contact Sheet'}</span>
          </button>

          {captures.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-red-300 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Split Comparison Panel when 2 frames are selected */}
      {comparePair && (
        <section className="border border-zinc-800 rounded-xl bg-[#111114] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="font-medium text-zinc-100">
                Stage Comparison
              </span>
              <span className="text-zinc-500">·</span>
              <span className="font-mono text-xs tabular-nums text-zinc-300">
                {formatElapsedMs(comparePair[0].elapsedMs)} vs{' '}
                {formatElapsedMs(comparePair[1].elapsedMs)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Exit Comparison
            </button>
          </div>

          <div className="relative w-full max-w-4xl mx-auto aspect-video bg-black border border-zinc-800 rounded-lg overflow-hidden select-none">
            <img
              src={comparePair[1].dataUrl}
              alt={`Later stage at ${formatElapsedMs(comparePair[1].elapsedMs)}`}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
            >
              <img
                src={comparePair[0].dataUrl}
                alt={`Earlier stage at ${formatElapsedMs(comparePair[0].elapsedMs)}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain bg-black"
              />
            </div>

            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none"
              style={{ left: `${splitPos}%` }}
            />

            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/80 text-xs font-mono tabular-nums text-zinc-100">
              {formatElapsedMs(comparePair[0].elapsedMs)}
            </div>
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/80 text-xs font-mono tabular-nums text-zinc-100">
              {formatElapsedMs(comparePair[1].elapsedMs)}
            </div>
          </div>

          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400">Split</span>
            <input
              type="range"
              min={0}
              max={100}
              value={splitPos}
              onChange={(e) => setSplitPos(Number(e.target.value))}
              aria-label="Comparison split position"
              className="flex-1 accent-amber-500"
            />
          </div>
        </section>
      )}

      {/* Grid of Captured Frames */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-zinc-300 font-medium">
            No timestamped screenshots captured yet.
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Let your pattern run in the Studio to capture automatic milestones, or press Capture Frame manually at any moment.
          </p>
          <button
            type="button"
            onClick={onReturnToStudio}
            className="mt-2 inline-flex items-center px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
          >
            Back to Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((frame) => {
            const isSelected = compareIds.includes(frame.id);
            return (
              <article
                key={frame.id}
                className={`border rounded-xl bg-[#111114] overflow-hidden transition-colors ${
                  isSelected
                    ? 'border-amber-500'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
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

                <div className="p-3.5 space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-zinc-100 truncate">
                        {frame.sketchName}
                      </h3>
                      <span className="text-xs font-mono tabular-nums text-amber-400 shrink-0">
                        {formatElapsedMs(frame.elapsedMs)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 font-mono tabular-nums">
                      <span>{frame.triggerLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {frame.width}×{frame.height}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatWallTime(frame.capturedAt)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompareSelection(frame.id)}
                      className={`text-xs font-medium transition-colors ${
                        isSelected
                          ? 'text-amber-400'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isSelected ? 'Selected for Compare' : 'Compare'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRestoreCode(frame)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                        title="Load code snapshot into Studio"
                        aria-label="Load code snapshot into Studio"
                      >
                        <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

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
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                        title="Download PNG"
                        aria-label="Download PNG"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(frame.id)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete capture"
                        aria-label="Delete capture"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
