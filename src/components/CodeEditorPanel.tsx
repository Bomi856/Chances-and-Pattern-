import { KeyboardEvent, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Clock,
  FastForward,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CaptureScheduleConfig,
  ScheduleMode,
  SketchMode,
} from '../types/studio';
import { formatShortDuration, parseDurationInput } from '../utils/formatTime';
import { normalizeFlattenedCode } from '../utils/codeFormatter';

type EditorTab = 'code' | 'schedule' | 'controls';

interface CodeEditorPanelProps {
  sketchName: string;
  mode: SketchMode;
  code: string;
  isDirty: boolean;
  error: string | null;
  seedOffset: number;
  schedule: CaptureScheduleConfig;
  onChangeName: (name: string) => void;
  onChangeMode: (mode: SketchMode) => void;
  onChangeCode: (code: string) => void;
  onRunCode: () => void;
  onSaveSketch: () => void;
  onChangeSeedOffset: (seed: number) => void;
  onStepFrames: (frames: number) => void;
  onChangeSchedule: (next: CaptureScheduleConfig) => void;
  onResetMilestoneTriggers: () => void;
}

const QUICK_ADD_SECONDS = [10, 30, 60, 180, 300, 900, 1800, 3600];

export function CodeEditorPanel({
  sketchName,
  mode,
  code,
  isDirty,
  error,
  seedOffset,
  schedule,
  onChangeName,
  onChangeMode,
  onChangeCode,
  onRunCode,
  onSaveSketch,
  onChangeSeedOffset,
  onStepFrames,
  onChangeSchedule,
  onResetMilestoneTriggers,
}: CodeEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('code');
  const [milestoneInput, setMilestoneInput] = useState('');
  const [milestoneInputError, setMilestoneInputError] = useState<string | null>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lineCount = useMemo(() => code.split('\n').length, [code]);

  const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRunCode();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextValue = code.substring(0, start) + '  ' + code.substring(end);
      onChangeCode(nextValue);
      requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
      });
    }
  };

  const handleScrollSync = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleFormatCode = () => {
    onChangeCode(normalizeFlattenedCode(code));
  };

  const handleAddMilestone = (rawSeconds?: number) => {
    const parsed =
      rawSeconds !== undefined ? rawSeconds : parseDurationInput(milestoneInput);
    if (parsed === null || parsed <= 0) {
      setMilestoneInputError('Enter seconds or mm:ss (e.g. 45s, 2:30, 5m)');
      return;
    }
    setMilestoneInputError(null);
    const exists = schedule.milestones.some(
      (m) => Math.abs(m.seconds - parsed) < 0.05
    );
    if (exists) {
      setMilestoneInput('');
      return;
    }

    const updated = [
      ...schedule.milestones,
      {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        seconds: parsed,
        enabled: true,
        triggered: false,
      },
    ].sort((a, b) => a.seconds - b.seconds);

    onChangeSchedule({ ...schedule, milestones: updated });
    if (rawSeconds === undefined) setMilestoneInput('');
  };

  const handleToggleMilestone = (id: string) => {
    onChangeSchedule({
      ...schedule,
      milestones: schedule.milestones.map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      ),
    });
  };

  const handleRemoveMilestone = (id: string) => {
    onChangeSchedule({
      ...schedule,
      milestones: schedule.milestones.filter((m) => m.id !== id),
    });
  };

  return (
    <aside className="flex flex-col h-full min-h-0 bg-[#111114] border-l border-zinc-800">
      {/* Panel Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
          {(
            [
              { id: 'code', label: 'Code' },
              { id: 'schedule', label: 'Capture Schedule' },
              { id: 'controls', label: 'Evolution' },
            ] as { id: EditorTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSaveSketch}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors whitespace-nowrap shrink-0"
          title="Save current sketch to your Presets library"
        >
          <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Save</span>
        </button>
      </div>

      {activeTab === 'code' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Code Toolbar */}
          <div className="px-3 py-2 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 bg-[#0E0E11]">
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
              {(
                [
                  { id: 'p5js', label: 'p5.js / WebGL' },
                  { id: 'glsl', label: 'Pure GLSL' },
                ] as { id: SketchMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeMode(m.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === m.id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFormatCode}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors whitespace-nowrap shrink-0"
                title="Clean up flattened single-line code or GLSL directives"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>Clean Paste</span>
              </button>

              <button
                type="button"
                onClick={onRunCode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isDirty
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
                title="Compile and run sketch (Ctrl/Cmd + Enter)"
              >
                <Play className="w-3 h-3" aria-hidden="true" />
                <span>{isDirty ? 'Apply & Run' : 'Restart'}</span>
              </button>
            </div>
          </div>

          {/* Code Editor Surface */}
          <div className="relative flex-1 flex min-h-0 bg-[#09090B]">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="w-11 shrink-0 py-3 px-2 text-right font-mono text-[12px] leading-[1.6] text-zinc-600 select-none overflow-hidden border-r border-zinc-800/70 bg-[#09090B] tabular-nums"
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChangeCode(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              onScroll={handleScrollSync}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Pattern source code editor"
              className="code-editor flex-1 w-full h-full resize-none bg-[#09090B] text-zinc-200 p-3 font-mono text-[12px] leading-[1.6] focus:outline-none overflow-auto whitespace-pre"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="max-h-36 overflow-y-auto border-t border-red-900/70 bg-red-950/50 px-3 py-2.5 text-xs text-red-200 font-mono"
            >
              <div className="flex items-center gap-1.5 font-sans font-semibold text-red-300 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Compiler / Runtime Error</span>
              </div>
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                {error}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Automatic Timestamp Captures
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Captures high-res PNG frames automatically as your pattern develops, even in background tabs.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={schedule.enabled}
              onClick={() =>
                onChangeSchedule({ ...schedule, enabled: !schedule.enabled })
              }
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                schedule.enabled
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {schedule.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Schedule Mode */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-zinc-300">
              Trigger Mode
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
              {(
                [
                  { id: 'milestones', label: 'Timestamps' },
                  { id: 'interval', label: 'Interval' },
                  { id: 'both', label: 'Both' },
                ] as { id: ScheduleMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeSchedule({ ...schedule, mode: m.id })}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    schedule.mode === m.id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Milestones Section */}
          {(schedule.mode === 'milestones' || schedule.mode === 'both') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  Target Timestamp Milestones
                </span>
                <button
                  type="button"
                  onClick={onResetMilestoneTriggers}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Rearm All</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={milestoneInput}
                  onChange={(e) => setMilestoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                  placeholder="e.g. 45s, 2:30, 10m, 1h"
                  aria-label="Add custom timestamp milestone"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddMilestone()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>

              {milestoneInputError && (
                <p className="text-xs text-red-400">{milestoneInputError}</p>
              )}

              {/* Quick-add buttons */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ADD_SECONDS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleAddMilestone(sec)}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors tabular-nums"
                  >
                    +{formatShortDuration(sec)}
                  </button>
                ))}
              </div>

              {/* Milestone List */}
              <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg bg-[#09090B]">
                {schedule.milestones.length === 0 ? (
                  <div className="p-4 text-xs text-zinc-500 text-center">
                    No timestamp milestones configured. Add one above.
                  </div>
                ) : (
                  schedule.milestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => handleToggleMilestone(m.id)}
                          className="accent-amber-500 rounded"
                        />
                        <Clock
                          className="w-3.5 h-3.5 text-zinc-500"
                          aria-hidden="true"
                        />
                        <span className="font-mono tabular-nums text-zinc-200">
                          {formatShortDuration(m.seconds)}
                        </span>
                      </label>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[11px] font-mono ${
                            m.triggered ? 'text-amber-400' : 'text-zinc-500'
                          }`}
                        >
                          {m.triggered ? 'Captured' : 'Armed'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(m.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${formatShortDuration(m.seconds)} milestone`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Recurring Interval Section */}
          {(schedule.mode === 'interval' || schedule.mode === 'both') && (
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <span className="block text-xs font-medium text-zinc-300">
                Recurring Interval
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="interval-seconds"
                    className="block text-[11px] text-zinc-400 mb-1"
                  >
                    Capture every (seconds)
                  </label>
                  <input
                    id="interval-seconds"
                    type="number"
                    min={1}
                    max={86400}
                    value={schedule.intervalSeconds}
                    onChange={(e) =>
                      onChangeSchedule({
                        ...schedule,
                        intervalSeconds: Math.max(1, Number(e.target.value) || 10),
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="interval-cap"
                    className="block text-[11px] text-zinc-400 mb-1"
                  >
                    Max frames (0 = endless)
                  </label>
                  <input
                    id="interval-cap"
                    type="number"
                    min={0}
                    max={5000}
                    value={schedule.maxIntervalCaptures}
                    onChange={(e) =>
                      onChangeSchedule({
                        ...schedule,
                        maxIntervalCaptures: Math.max(
                          0,
                          Number(e.target.value) || 0
                        ),
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[10, 30, 60, 180, 300, 600].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onChangeSchedule({ ...schedule, intervalSeconds: sec })
                    }
                    className={`px-2 py-1 rounded border text-[11px] font-mono tabular-nums transition-colors ${
                      schedule.intervalSeconds === sec
                        ? 'bg-zinc-800 border-zinc-700 text-amber-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Every {formatShortDuration(sec)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-download option */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-zinc-200">
                Auto-download PNG to disk
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Captures always save to your browser Timeline automatically.
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Auto-download PNG to disk on capture"
              checked={schedule.autoDownload}
              onChange={(e) =>
                onChangeSchedule({ ...schedule, autoDownload: e.target.checked })
              }
              className="accent-amber-500 w-4 h-4"
            />
          </div>
        </div>
      )}

      {activeTab === 'controls' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="sketch-title-input"
              className="block text-xs font-medium text-zinc-300"
            >
              Sketch Name
            </label>
            <input
              id="sketch-title-input"
              type="text"
              value={sketchName}
              onChange={(e) => onChangeName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label
                htmlFor="seed-offset-input"
                className="text-xs font-medium text-zinc-300"
              >
                Seed Offset
              </label>
              <span className="text-xs font-mono tabular-nums text-zinc-400">
                {seedOffset}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="seed-offset-input"
                type="number"
                value={seedOffset}
                onChange={(e) => onChangeSeedOffset(Number(e.target.value) || 0)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() =>
                  onChangeSeedOffset(Math.floor(Math.random() * 10000))
                }
                className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Randomize
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Automatically shifts noiseSeed / randomSeed in p5.js and u_seed in Pure GLSL.
            </p>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-zinc-800">
            <div className="text-xs font-medium text-zinc-300">
              Fast-Forward / Warmup Simulation
            </div>
            <p className="text-[11px] text-zinc-400">
              Advance the pattern immediately by N frames to preview later stages of slow-developing generative webs while honoring capture milestones.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[120, 360, 900].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onStepFrames(count)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono tabular-nums text-zinc-200 transition-colors"
                >
                  <FastForward className="w-3 h-3 text-amber-400" aria-hidden="true" />
                  <span>+{count}f</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
