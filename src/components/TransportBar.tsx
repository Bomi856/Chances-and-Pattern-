import { Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';
import {
  CaptureScheduleConfig,
  EngineTelemetry,
  ResolutionPreset,
} from '../types/studio';
import { formatElapsedMs } from '../utils/formatTime';

interface TransportBarProps {
  sketchName: string;
  isPlaying: boolean;
  speed: number;
  resolution: ResolutionPreset;
  telemetry: EngineTelemetry;
  schedule: CaptureScheduleConfig;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onChangeResolution: (res: ResolutionPreset) => void;
  onToggleFullscreen: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8];

const RESOLUTION_OPTIONS: { value: ResolutionPreset; label: string }[] = [
  { value: 'fit', label: 'Viewport Fit' },
  { value: '1080x1080', label: '1080 × 1080' },
  { value: '1280x720', label: '1280 × 720' },
  { value: '1920x1080', label: '1920 × 1080' },
  { value: '1080x1920', label: '1080 × 1920' },
];

function getNextCaptureSummary(
  elapsedMs: number,
  schedule: CaptureScheduleConfig
): string {
  if (!schedule.enabled) return 'Auto-capture off';

  const candidates: number[] = [];

  if (schedule.mode === 'milestones' || schedule.mode === 'both') {
    const nextMilestone = schedule.milestones
      .filter((m) => m.enabled && !m.triggered)
      .map((m) => m.seconds * 1000)
      .sort((a, b) => a - b)[0];
    if (nextMilestone !== undefined) {
      candidates.push(nextMilestone);
    }
  }

  if (schedule.mode === 'interval' || schedule.mode === 'both') {
    const intervalMs = Math.max(1000, schedule.intervalSeconds * 1000);
    const nextInterval = (Math.floor(elapsedMs / intervalMs) + 1) * intervalMs;
    candidates.push(nextInterval);
  }

  if (candidates.length === 0) return 'All milestones captured';

  const nextTargetMs = Math.min(...candidates);
  const remainingMs = Math.max(0, nextTargetMs - elapsedMs);
  return `Next ${formatElapsedMs(nextTargetMs, false)} (in ${formatElapsedMs(remainingMs, false)})`;
}

export function TransportBar({
  sketchName,
  isPlaying,
  speed,
  resolution,
  telemetry,
  schedule,
  isFullscreen,
  onTogglePlay,
  onReset,
  onChangeSpeed,
  onChangeResolution,
  onToggleFullscreen,
}: TransportBarProps) {
  const nextSummary = getNextCaptureSummary(telemetry.elapsedMs, schedule);

  return (
    <div className="border-t border-zinc-800 bg-[#111114] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Resume</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          title="Reset elapsed time and restart sketch from t = 0"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset</span>
        </button>

        <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 ml-1">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChangeSpeed(opt)}
              className={`px-2 py-1 text-[11px] font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 ${
                speed === opt
                  ? 'bg-zinc-700 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono tabular-nums">
        <span className="hidden xl:inline text-zinc-300 font-sans font-medium truncate max-w-[180px]">
          {sketchName}
        </span>
        <span className="text-zinc-100 font-medium">
          {formatElapsedMs(telemetry.elapsedMs, true)}
        </span>
        <span aria-hidden="true" className="text-zinc-700">
          ·
        </span>
        <span>#{telemetry.frameCount}</span>
        <span aria-hidden="true" className="text-zinc-700 hidden md:inline">
          ·
        </span>
        <span className="hidden md:inline">
          {telemetry.canvasWidth}×{telemetry.canvasHeight}
        </span>
        <span aria-hidden="true" className="text-zinc-700 hidden lg:inline">
          ·
        </span>
        <span className="hidden lg:inline text-amber-400/90">{nextSummary}</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="resolution-select">
          Canvas resolution
        </label>
        <select
          id="resolution-select"
          value={resolution}
          onChange={(e) => onChangeResolution(e.target.value as ResolutionPreset)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          {RESOLUTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors shrink-0"
          title={isFullscreen ? 'Exit expanded viewport' : 'Expand viewport'}
          aria-label={isFullscreen ? 'Exit expanded viewport' : 'Expand viewport'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
