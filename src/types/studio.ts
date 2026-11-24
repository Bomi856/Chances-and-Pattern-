export type SketchMode = 'p5js' | 'glsl';

export type ResolutionPreset =
  | 'fit'
  | '1080x1080'
  | '1280x720'
  | '1920x1080'
  | '1080x1920';

export type ScheduleMode = 'milestones' | 'interval' | 'both';

export type StudioView = 'studio' | 'timeline' | 'presets' | 'reference' | 'tutorial';

export interface SketchPreset {
  id: string;
  name: string;
  category: string;
  mode: SketchMode;
  description: string;
  code: string;
  defaultSpeed?: number;
  isCustom?: boolean;
  updatedAt?: number;
}

export interface MilestoneEntry {
  id: string;
  seconds: number;
  enabled: boolean;
  triggered: boolean;
}

export interface CaptureScheduleConfig {
  enabled: boolean;
  mode: ScheduleMode;
  milestones: MilestoneEntry[];
  intervalSeconds: number;
  autoDownload: boolean;
  maxIntervalCaptures: number; // 0 = unlimited
}

export interface CapturedFrame {
  id: string;
  sketchId: string;
  sketchName: string;
  mode: SketchMode;
  elapsedMs: number;
  frameCount: number;
  width: number;
  height: number;
  capturedAt: number;
  triggerLabel: string;
  code: string;
  dataUrl: string;
}

export interface EngineTelemetry {
  elapsedMs: number;
  frameCount: number;
  fps: number;
  canvasWidth: number;
  canvasHeight: number;
}
