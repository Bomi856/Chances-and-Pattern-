import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaptureLightbox } from './components/CaptureLightbox';
import { CaptureStrip } from './components/CaptureStrip';
import { CodeEditorPanel } from './components/CodeEditorPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PresetsView } from './components/PresetsView';
import { ReferenceView } from './components/ReferenceView';
import { SketchCanvas, SketchCanvasHandle } from './components/SketchCanvas';
import { TimelineGallery } from './components/TimelineGallery';
import { TopBar } from './components/TopBar';
import { TransportBar } from './components/TransportBar';
import { TutorialView } from './components/TutorialView';
import { BUILTIN_PRESETS } from './data/presets';
import {
  CaptureScheduleConfig,
  CapturedFrame,
  EngineTelemetry,
  ResolutionPreset,
  SketchMode,
  SketchPreset,
  StudioView,
} from './types/studio';
import {
  clearAllCaptures,
  deleteCapture,
  deleteCustomSketch,
  downloadDataUrl,
  getAllCaptures,
  loadCustomSketches,
  loadScheduleConfig,
  saveCapture,
  saveCustomSketch,
  saveScheduleConfig,
} from './utils/captureStorage';
import { formatElapsedMs, formatFilenameTimestamp } from './utils/formatTime';

const BLANK_P5_TEMPLATE = `function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);
}

function draw() {
  const t = millis() / 1000.0;
  stroke(255, 24);
  noFill();
  const x = width * 0.5 + cos(t * 0.7) * min(width, height) * 0.28;
  const y = height * 0.5 + sin(t * 1.1) * min(width, height) * 0.28;
  circle(x, y, 24 + sin(t * 2.0) * 16);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}
`;

const BLANK_GLSL_TEMPLATE = `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 iResolution;
uniform float iTime;
uniform float u_seed;
varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  float d = length(uv);
  float wave = 0.5 + 0.5 * sin(d * 14.0 - iTime * 1.5 + u_seed);
  vec3 col = vec3(wave * 0.85, wave * 0.72, wave * 0.45);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function App() {
  const initialPreset = BUILTIN_PRESETS[0];

  const [activeView, setActiveView] = useState<StudioView>('studio');
  const [customSketches, setCustomSketches] = useState<SketchPreset[]>(() =>
    loadCustomSketches()
  );

  const [sketchId, setSketchId] = useState<string>(initialPreset.id);
  const [sketchName, setSketchName] = useState<string>(initialPreset.name);
  const [mode, setMode] = useState<SketchMode>(initialPreset.mode);
  const [editorCode, setEditorCode] = useState<string>(initialPreset.code);
  const [runningCode, setRunningCode] = useState<string>(initialPreset.code);
  const [compileVersion, setCompileVersion] = useState<number>(1);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(initialPreset.defaultSpeed || 1);
  const [seedOffset, setSeedOffset] = useState<number>(0);
  const [resolution, setResolution] = useState<ResolutionPreset>('fit');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [schedule, setSchedule] = useState<CaptureScheduleConfig>(() =>
    loadScheduleConfig()
  );
  const [captures, setCaptures] = useState<CapturedFrame[]>([]);
  const [lightboxFrame, setLightboxFrame] = useState<CapturedFrame | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<EngineTelemetry>({
    elapsedMs: 0,
    frameCount: 0,
    fps: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });

  const canvasRef = useRef<SketchCanvasHandle | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const allSketches = useMemo(
    () => [...customSketches, ...BUILTIN_PRESETS],
    [customSketches]
  );

  const isDirty = editorCode !== runningCode;

  // Load persisted captures from IndexedDB on startup
  useEffect(() => {
    getAllCaptures().then((loaded) => {
      setCaptures(loaded);
    });
  }, []);

  // Persist schedule settings
  useEffect(() => {
    saveScheduleConfig(schedule);
  }, [schedule]);

  const showNotice = useCallback((text: string) => {
    setCaptureNotice(text);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setCaptureNotice(null);
    }, 3000);
  }, []);

  const resetMilestoneFlags = useCallback(() => {
    setSchedule((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => ({ ...m, triggered: false })),
    }));
  }, []);

  const handleCapturedFrame = useCallback(
    (frame: CapturedFrame) => {
      setCaptures((prev) => [frame, ...prev]);
      saveCapture(frame);
      showNotice(
        `Captured ${formatElapsedMs(frame.elapsedMs)} (${frame.triggerLabel})`
      );

      if (schedule.autoDownload) {
        const slug = frame.sketchName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        downloadDataUrl(
          frame.dataUrl,
          `${slug}_${formatFilenameTimestamp(frame.elapsedMs)}.png`
        );
      }
    },
    [schedule.autoDownload, showNotice]
  );

  const handleMilestoneTriggered = useCallback((milestoneId: string) => {
    setSchedule((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === milestoneId ? { ...m, triggered: true } : m
      ),
    }));
  }, []);

  const handleRunCode = useCallback(() => {
    resetMilestoneFlags();
    setRunningCode(editorCode);
    setCompileVersion((v) => v + 1);
    setIsPlaying(true);
  }, [editorCode, resetMilestoneFlags]);

  const handleResetSimulation = useCallback(() => {
    resetMilestoneFlags();
    canvasRef.current?.resetSimulation();
  }, [resetMilestoneFlags]);

  const handleSelectSketch = useCallback(
    (sketch: SketchPreset) => {
      resetMilestoneFlags();
      setSketchId(sketch.id);
      setSketchName(sketch.name);
      setMode(sketch.mode);
      setEditorCode(sketch.code);
      setRunningCode(sketch.code);
      setSpeed(sketch.defaultSpeed || 1);
      setCompileVersion((v) => v + 1);
      setIsPlaying(true);
      setActiveView('studio');
    },
    [resetMilestoneFlags]
  );

  const handleCreateNewSketch = useCallback(
    (newMode: SketchMode) => {
      const id = `custom-${Date.now()}`;
      const name =
        newMode === 'glsl' ? 'Untitled GLSL Pattern' : 'Untitled p5.js Pattern';
      const template =
        newMode === 'glsl' ? BLANK_GLSL_TEMPLATE : BLANK_P5_TEMPLATE;
      resetMilestoneFlags();
      setSketchId(id);
      setSketchName(name);
      setMode(newMode);
      setEditorCode(template);
      setRunningCode(template);
      setCompileVersion((v) => v + 1);
      setIsPlaying(true);
      setActiveView('studio');
    },
    [resetMilestoneFlags]
  );

  const handleSaveCurrentSketch = useCallback(() => {
    const isBuiltin = BUILTIN_PRESETS.some((p) => p.id === sketchId);
    const saveId = isBuiltin ? `custom-${Date.now()}` : sketchId;
    const saveTitle = isBuiltin ? `${sketchName} (Modified)` : sketchName;

    const newSketch: SketchPreset = {
      id: saveId,
      name: saveTitle,
      category: 'Saved',
      mode,
      description: 'Saved custom generative pattern.',
      code: editorCode,
      defaultSpeed: speed,
      isCustom: true,
      updatedAt: Date.now(),
    };

    const nextList = saveCustomSketch(newSketch);
    setCustomSketches(nextList);
    setSketchId(saveId);
    setSketchName(saveTitle);
    showNotice(`Saved "${saveTitle}" to Presets`);
  }, [editorCode, mode, showNotice, sketchId, sketchName, speed]);

  const handleDeleteCustomSketch = useCallback((id: string) => {
    setCustomSketches(deleteCustomSketch(id));
  }, []);

  const handleDeleteCapture = useCallback((id: string) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    deleteCapture(id);
  }, []);

  const handleClearAllCaptures = useCallback(() => {
    setCaptures([]);
    clearAllCaptures();
  }, []);

  const handleRestoreCodeFromFrame = useCallback(
    (frame: CapturedFrame) => {
      resetMilestoneFlags();
      setSketchId(frame.sketchId);
      setSketchName(frame.sketchName);
      setMode(frame.mode);
      setEditorCode(frame.code);
      setRunningCode(frame.code);
      setCompileVersion((v) => v + 1);
      setIsPlaying(true);
      setActiveView('studio');
      showNotice(`Loaded code snapshot from ${formatElapsedMs(frame.elapsedMs)}`);
    },
    [resetMilestoneFlags, showNotice]
  );

  const handleManualCapture = useCallback(() => {
    canvasRef.current?.captureNow('Manual Capture');
  }, []);

  const handleModeSwitch = useCallback(
    (nextMode: SketchMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      resetMilestoneFlags();
      setCompileVersion((v) => v + 1);
    },
    [mode, resetMilestoneFlags]
  );

  const handleLoadLessonInStudio = useCallback(
    (title: string, lessonMode: SketchMode, lessonCode: string) => {
      resetMilestoneFlags();
      setSketchId(`tutorial-${Date.now()}`);
      setSketchName(title);
      setMode(lessonMode);
      setEditorCode(lessonCode);
      setRunningCode(lessonCode);
      setCompileVersion((v) => v + 1);
      setIsPlaying(true);
      setActiveView('studio');
      showNotice(`Loaded lesson "${title}" into Studio`);
    },
    [resetMilestoneFlags, showNotice]
  );

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#09090B] text-zinc-100 overflow-hidden">
      <TopBar
        activeView={activeView}
        onSelectView={setActiveView}
        onCaptureNow={handleManualCapture}
        captureCount={captures.length}
      />

      {/* Keep Studio mounted when browsing Timeline/Presets/Reference so long-running patterns never pause or reset */}
      <main
        className={
          activeView === 'studio'
            ? 'flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px]'
            : 'hidden'
        }
      >
        {/* Left Viewport Column */}
        <div
          className={`flex flex-col min-h-0 min-w-0 ${
            isFullscreen ? 'fixed inset-0 z-40 bg-[#09090B]' : ''
          }`}
        >
          {/* Quick Pattern Switcher Strip */}
          <div className="px-4 py-2 border-b border-zinc-800 bg-[#0D0D10] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <label
                htmlFor="studio-preset-select"
                className="text-xs text-zinc-400 whitespace-nowrap shrink-0"
              >
                Active Pattern
              </label>
              <select
                id="studio-preset-select"
                value={
                  allSketches.some((s) => s.id === sketchId) ? sketchId : ''
                }
                onChange={(e) => {
                  const found = allSketches.find(
                    (s) => s.id === e.target.value
                  );
                  if (found) handleSelectSketch(found);
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1 text-xs text-zinc-100 max-w-[260px] truncate focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {!allSketches.some((s) => s.id === sketchId) && (
                  <option value="">{sketchName}</option>
                )}
                {customSketches.length > 0 && (
                  <optgroup label="Saved Sketches">
                    {customSketches.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Studio Presets">
                  {BUILTIN_PRESETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {captureNotice && (
              <div
                role="status"
                className="text-xs font-mono tabular-nums text-amber-400 truncate"
              >
                {captureNotice}
              </div>
            )}
          </div>

          <SketchCanvas
            ref={canvasRef}
            sketchId={sketchId}
            sketchName={sketchName}
            mode={mode}
            code={runningCode}
            compileVersion={compileVersion}
            isPlaying={isPlaying}
            speed={speed}
            seedOffset={seedOffset}
            resolution={resolution}
            schedule={schedule}
            onTelemetry={setTelemetry}
            onError={setRuntimeError}
            onCapturedFrame={handleCapturedFrame}
            onMilestoneTriggered={handleMilestoneTriggered}
          />

          <TransportBar
            sketchName={sketchName}
            isPlaying={isPlaying}
            speed={speed}
            resolution={resolution}
            telemetry={telemetry}
            schedule={schedule}
            isFullscreen={isFullscreen}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onReset={handleResetSimulation}
            onChangeSpeed={setSpeed}
            onChangeResolution={setResolution}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
          />

          {!isFullscreen && (
            <CaptureStrip
              captures={captures}
              onInspect={setLightboxFrame}
              onDelete={handleDeleteCapture}
              onOpenTimeline={() => setActiveView('timeline')}
            />
          )}
        </div>

        {/* Right Code & Capture Schedule Panel */}
        {!isFullscreen && (
          <CodeEditorPanel
            sketchName={sketchName}
            mode={mode}
            code={editorCode}
            isDirty={isDirty}
            error={runtimeError}
            seedOffset={seedOffset}
            schedule={schedule}
            onChangeName={setSketchName}
            onChangeMode={handleModeSwitch}
            onChangeCode={setEditorCode}
            onRunCode={handleRunCode}
            onSaveSketch={handleSaveCurrentSketch}
            onChangeSeedOffset={setSeedOffset}
            onStepFrames={(count) => canvasRef.current?.stepFrames(count)}
            onChangeSchedule={setSchedule}
            onResetMilestoneTriggers={resetMilestoneFlags}
          />
        )}
      </main>

      {activeView === 'timeline' && (
        <TimelineGallery
          captures={captures}
          onInspect={setLightboxFrame}
          onDelete={handleDeleteCapture}
          onClearAll={handleClearAllCaptures}
          onRestoreCode={handleRestoreCodeFromFrame}
          onReturnToStudio={() => setActiveView('studio')}
        />
      )}

      {activeView === 'presets' && (
        <PresetsView
          presets={BUILTIN_PRESETS}
          customSketches={customSketches}
          activeSketchId={sketchId}
          onSelectSketch={handleSelectSketch}
          onCreateNew={handleCreateNewSketch}
          onDeleteCustom={handleDeleteCustomSketch}
        />
      )}

      {activeView === 'reference' && <ReferenceView />}

      {activeView === 'tutorial' && (
        <ErrorBoundary>
          <TutorialView onLoadLessonInStudio={handleLoadLessonInStudio} />
        </ErrorBoundary>
      )}

      {lightboxFrame && (
        <CaptureLightbox
          frame={lightboxFrame}
          allFrames={[...captures].sort((a, b) => a.elapsedMs - b.elapsedMs)}
          onSelectFrame={setLightboxFrame}
          onClose={() => setLightboxFrame(null)}
          onDelete={handleDeleteCapture}
          onRestoreCode={handleRestoreCodeFromFrame}
        />
      )}
    </div>
  );
}
