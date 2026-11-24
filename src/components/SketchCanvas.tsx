import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import p5 from 'p5';
import {
  CaptureScheduleConfig,
  CapturedFrame,
  EngineTelemetry,
  ResolutionPreset,
  SketchMode,
} from '../types/studio';
import { preprocessGlslDirectives } from '../utils/codeFormatter';
import { formatElapsedMs } from '../utils/formatTime';

export interface SketchCanvasHandle {
  captureNow: (triggerLabel?: string) => CapturedFrame | null;
  resetSimulation: () => void;
  stepFrames: (count: number) => void;
}

interface SketchCanvasProps {
  sketchId: string;
  sketchName: string;
  mode: SketchMode;
  code: string;
  compileVersion: number;
  isPlaying: boolean;
  speed: number;
  seedOffset: number;
  resolution: ResolutionPreset;
  schedule: CaptureScheduleConfig;
  onTelemetry: (telemetry: EngineTelemetry) => void;
  onError: (error: string | null) => void;
  onCapturedFrame: (frame: CapturedFrame) => void;
  onMilestoneTriggered: (milestoneId: string) => void;
}

const DEFAULT_VERT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`;

function parseResolutionPreset(
  preset: ResolutionPreset,
  containerW: number,
  containerH: number
): { w: number; h: number } {
  switch (preset) {
    case '1080x1080':
      return { w: 1080, h: 1080 };
    case '1280x720':
      return { w: 1280, h: 720 };
    case '1920x1080':
      return { w: 1920, h: 1080 };
    case '1080x1920':
      return { w: 1080, h: 1920 };
    case 'fit':
    default:
      return {
        w: Math.max(320, Math.floor(containerW)),
        h: Math.max(240, Math.floor(containerH)),
      };
  }
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  function SketchCanvas(
    {
      sketchId,
      sketchName,
      mode,
      code,
      compileVersion,
      isPlaying,
      speed,
      seedOffset,
      resolution,
      schedule,
      onTelemetry,
      onError,
      onCapturedFrame,
      onMilestoneTriggered,
    },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const canvasMountRef = useRef<HTMLDivElement | null>(null);

    const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const p5InstanceRef = useRef<p5 | null>(null);
    const glCleanupRef = useRef<(() => void) | null>(null);
    const renderTickRef = useRef<(() => void) | null>(null);
    const resizeHandlerRef = useRef<((w: number, h: number) => void) | null>(null);

    const containerSizeRef = useRef<{ w: number; h: number }>({ w: 960, h: 640 });
    const runtimeStateRef = useRef({
      elapsedMs: 0,
      frameCount: 0,
      lastTickWallMs: performance.now(),
      fpsAccumFrames: 0,
      fpsLastReportWallMs: performance.now(),
      currentFps: 60,
      nextIntervalMs: Math.max(1, schedule.intervalSeconds) * 1000,
      intervalCaptureCount: 0,
    });

    // Latest props stored in refs for zero-stale closures inside animation loops
    const propsRef = useRef({
      sketchId,
      sketchName,
      mode,
      code,
      isPlaying,
      speed,
      seedOffset,
      resolution,
      schedule,
      onTelemetry,
      onError,
      onCapturedFrame,
      onMilestoneTriggered,
    });

    propsRef.current = {
      sketchId,
      sketchName,
      mode,
      code,
      isPlaying,
      speed,
      seedOffset,
      resolution,
      schedule,
      onTelemetry,
      onError,
      onCapturedFrame,
      onMilestoneTriggered,
    };

    const getTargetSize = useCallback(() => {
      return parseResolutionPreset(
        propsRef.current.resolution,
        containerSizeRef.current.w,
        containerSizeRef.current.h
      );
    }, []);

    const captureCanvasData = useCallback(
      (triggerLabel: string): CapturedFrame | null => {
        const canvas = activeCanvasRef.current;
        if (!canvas) return null;

        try {
          const dataUrl = canvas.toDataURL('image/png');
          const { sketchId: sId, sketchName: sName, mode: sMode, code: sCode } =
            propsRef.current;
          const st = runtimeStateRef.current;

          const frame: CapturedFrame = {
            id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sketchId: sId,
            sketchName: sName,
            mode: sMode,
            elapsedMs: st.elapsedMs,
            frameCount: st.frameCount,
            width: canvas.width,
            height: canvas.height,
            capturedAt: Date.now(),
            triggerLabel,
            code: sCode,
            dataUrl,
          };
          return frame;
        } catch {
          return null;
        }
      },
      []
    );

    const evaluateScheduleAfterDraw = useCallback(() => {
      const cfg = propsRef.current.schedule;
      if (!cfg.enabled) return;

      const elapsedMs = runtimeStateRef.current.elapsedMs;

      if (cfg.mode === 'milestones' || cfg.mode === 'both') {
        for (const m of cfg.milestones) {
          if (m.enabled && !m.triggered && elapsedMs >= m.seconds * 1000) {
            propsRef.current.onMilestoneTriggered(m.id);
            m.triggered = true;
            const frame = captureCanvasData(
              `Milestone ${formatElapsedMs(m.seconds * 1000, false)}`
            );
            if (frame) {
              propsRef.current.onCapturedFrame(frame);
            }
          }
        }
      }

      if (cfg.mode === 'interval' || cfg.mode === 'both') {
        const intervalMs = Math.max(1000, cfg.intervalSeconds * 1000);
        const st = runtimeStateRef.current;
        if (
          elapsedMs >= st.nextIntervalMs &&
          (cfg.maxIntervalCaptures === 0 ||
            st.intervalCaptureCount < cfg.maxIntervalCaptures)
        ) {
          // Advance nextIntervalMs cleanly without burst-spamming if tab slept
          while (st.nextIntervalMs <= elapsedMs) {
            st.nextIntervalMs += intervalMs;
          }
          st.intervalCaptureCount += 1;
          const frame = captureCanvasData(
            `Interval #${st.intervalCaptureCount}`
          );
          if (frame) {
            propsRef.current.onCapturedFrame(frame);
          }
        }
      }
    }, [captureCanvasData]);

    // Sync interval threshold when intervalSeconds changes
    useEffect(() => {
      const intervalMs = Math.max(1000, schedule.intervalSeconds * 1000);
      const elapsed = runtimeStateRef.current.elapsedMs;
      const nextStep = Math.floor(elapsed / intervalMs) + 1;
      runtimeStateRef.current.nextIntervalMs = nextStep * intervalMs;
    }, [schedule.intervalSeconds]);

    // Build / recompile the active sketch (p5js or glsl)
    const compileAndMountSketch = useCallback(() => {
      const mount = canvasMountRef.current;
      if (!mount) return;

      // Clean up prior runners
      if (p5InstanceRef.current) {
        try {
          p5InstanceRef.current.remove();
        } catch {
          // ignore cleanup error
        }
        p5InstanceRef.current = null;
      }
      if (glCleanupRef.current) {
        glCleanupRef.current();
        glCleanupRef.current = null;
      }
      activeCanvasRef.current = null;
      renderTickRef.current = null;
      resizeHandlerRef.current = null;
      mount.innerHTML = '';

      // Reset runtime clock
      runtimeStateRef.current.elapsedMs = 0;
      runtimeStateRef.current.frameCount = 0;
      runtimeStateRef.current.lastTickWallMs = performance.now();
      runtimeStateRef.current.fpsAccumFrames = 0;
      runtimeStateRef.current.fpsLastReportWallMs = performance.now();
      runtimeStateRef.current.intervalCaptureCount = 0;
      runtimeStateRef.current.nextIntervalMs =
        Math.max(1, propsRef.current.schedule.intervalSeconds) * 1000;

      propsRef.current.onError(null);

      const { mode: activeMode, code: rawCode } = propsRef.current;
      const { w: initialW, h: initialH } = getTargetSize();

      if (activeMode === 'glsl') {
        // Pure GLSL Fragment Shader Runner
        const canvas = document.createElement('canvas');
        canvas.width = initialW;
        canvas.height = initialH;
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        mount.appendChild(canvas);
        activeCanvasRef.current = canvas;

        const gl = canvas.getContext('webgl', {
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
        });

        if (!gl) {
          propsRef.current.onError('WebGL is not supported in this browser.');
          return;
        }

        const compileShader = (type: number, source: string) => {
          const sh = gl.createShader(type);
          if (!sh) throw new Error('Could not create shader object.');
          gl.shaderSource(sh, source);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh) || 'Shader compilation failed.';
            gl.deleteShader(sh);
            throw new Error(log);
          }
          return sh;
        };

        let program: WebGLProgram | null = null;
        let vbo: WebGLBuffer | null = null;
        let mouseX = 0;
        let mouseY = 0;
        let mouseDown = 0;

        try {
          const vert = compileShader(gl.VERTEX_SHADER, DEFAULT_VERT_SHADER);
          const fragSrc = preprocessGlslDirectives(rawCode);
          const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);

          program = gl.createProgram();
          if (!program) throw new Error('Could not create WebGL program.');
          gl.attachShader(program, vert);
          gl.attachShader(program, frag);
          gl.linkProgram(program);

          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program) || 'Program link failed.';
            throw new Error(log);
          }

          gl.deleteShader(vert);
          gl.deleteShader(frag);

          vbo = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          // Interleaved position (x,y,z) and texCoord (u,v) for 2 triangles
          const vertices = new Float32Array([
            0, 0, 0, 0, 0,
            1, 0, 0, 1, 0,
            0, 1, 0, 0, 1,
            0, 1, 0, 0, 1,
            1, 0, 0, 1, 0,
            1, 1, 0, 1, 1,
          ]);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

          const posLoc = gl.getAttribLocation(program, 'aPosition');
          const texLoc = gl.getAttribLocation(program, 'aTexCoord');
          gl.useProgram(program);

          if (posLoc !== -1) {
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 20, 0);
          }
          if (texLoc !== -1) {
            gl.enableVertexAttribArray(texLoc);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 20, 12);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          propsRef.current.onError(msg);
          return;
        }

        const uRes = gl.getUniformLocation(program, 'iResolution');
        const uTime = gl.getUniformLocation(program, 'iTime');
        const uFrame = gl.getUniformLocation(program, 'iFrame');
        const uMouse = gl.getUniformLocation(program, 'iMouse');
        const uSeed = gl.getUniformLocation(program, 'u_seed');

        const onPointerMove = (e: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          mouseX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
          mouseY =
            (1 - (e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
        };
        const onPointerDown = () => {
          mouseDown = 1;
        };
        const onPointerUp = () => {
          mouseDown = 0;
        };
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);

        renderTickRef.current = () => {
          if (!program) return;
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.useProgram(program);
          if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
          if (uTime) gl.uniform1f(uTime, runtimeStateRef.current.elapsedMs / 1000);
          if (uFrame) gl.uniform1f(uFrame, runtimeStateRef.current.frameCount);
          if (uMouse) gl.uniform4f(uMouse, mouseX, mouseY, mouseDown, 0);
          if (uSeed) gl.uniform1f(uSeed, propsRef.current.seedOffset);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        resizeHandlerRef.current = (w: number, h: number) => {
          canvas.width = w;
          canvas.height = h;
          renderTickRef.current?.();
        };

        glCleanupRef.current = () => {
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointerup', onPointerUp);
          if (vbo) gl.deleteBuffer(vbo);
          if (program) gl.deleteProgram(program);
        };

        // Initial frame render
        renderTickRef.current();
        return;
      }

      // p5.js Mode (supports both WEBGL shaders and 2D generative sketches)
      try {
        const preprocessed = preprocessGlslDirectives(rawCode);
        const factory = new Function(
          '__scope',
          `with (__scope) {
            ${preprocessed}
            ;return {
              setup: typeof setup === 'function' ? setup : undefined,
              draw: typeof draw === 'function' ? draw : undefined,
              windowResized: typeof windowResized === 'function' ? windowResized : undefined,
              mousePressed: typeof mousePressed === 'function' ? mousePressed : undefined,
              mouseMoved: typeof mouseMoved === 'function' ? mouseMoved : undefined,
              keyPressed: typeof keyPressed === 'function' ? keyPressed : undefined
            };
          }`
        );

        let userHooks: {
          setup?: () => void;
          draw?: () => void;
          windowResized?: () => void;
          mousePressed?: () => void;
          mouseMoved?: () => void;
          keyPressed?: () => void;
        } = {};

        let runtimeErrorDetected: string | null = null;
        let firstDrawChecked = false;

        const instance = new p5((p: p5) => {
          const boundCache = new Map<PropertyKey, unknown>();

          const applyCanvasStyle = () => {
            const c = (p as unknown as { canvas?: HTMLCanvasElement }).canvas;
            if (c) {
              c.style.maxWidth = '100%';
              c.style.maxHeight = '100%';
              c.style.width = 'auto';
              c.style.height = 'auto';
              c.style.display = 'block';
              activeCanvasRef.current = c;
            }
          };

          const overrides: Record<PropertyKey, unknown> = {
            p5,
            get windowWidth() {
              return getTargetSize().w;
            },
            get windowHeight() {
              return getTargetSize().h;
            },
            millis: () => runtimeStateRef.current.elapsedMs,
            createCanvas: (...args: unknown[]) => {
              const renderer = args[2];
              if (renderer === p.WEBGL) {
                p.setAttributes('preserveDrawingBuffer', true);
                p.setAttributes('antialias', true);
              }
              const res = (p.createCanvas as (...a: unknown[]) => unknown)(...args);
              applyCanvasStyle();
              return res;
            },
            resizeCanvas: (w: number, h: number, noRedraw?: boolean) => {
              p.resizeCanvas(w, h, noRedraw);
              applyCanvasStyle();
            },
            createShader: (vertSrc: string, fragSrc: string) => {
              return p.createShader(
                preprocessGlslDirectives(vertSrc),
                preprocessGlslDirectives(fragSrc)
              );
            },
            noiseSeed: (seed: number) => {
              p.noiseSeed(seed + propsRef.current.seedOffset);
            },
            randomSeed: (seed: number) => {
              p.randomSeed(seed + propsRef.current.seedOffset);
            },
          };

          const scopeProxy = new Proxy(p as unknown as Record<PropertyKey, unknown>, {
            has(target, prop) {
              if (prop === Symbol.unscopables) return false;
              if (prop in overrides) return true;
              return prop in target;
            },
            get(target, prop) {
              if (prop in overrides) {
                return overrides[prop];
              }
              if (boundCache.has(prop)) {
                return boundCache.get(prop);
              }
              const val = Reflect.get(target, prop, target);
              if (typeof val === 'function') {
                const bound = val.bind(target);
                boundCache.set(prop, bound);
                return bound;
              }
              return val;
            },
            set(target, prop, value) {
              Reflect.set(target, prop, value, target);
              return true;
            },
          });

          const captureConsoleErrorsDuring = (fn: () => void) => {
            const origError = console.error;
            const collected: string[] = [];
            console.error = (...args: unknown[]) => {
              const text = args
                .map((a) => (typeof a === 'string' ? a : String(a)))
                .join(' ');
              if (text.toLowerCase().includes('shader') || text.toLowerCase().includes('error')) {
                collected.push(text);
              }
              origError.apply(console, args);
            };
            try {
              fn();
            } finally {
              console.error = origError;
            }
            if (collected.length > 0 && !runtimeErrorDetected) {
              runtimeErrorDetected = collected.join('\n');
              propsRef.current.onError(runtimeErrorDetected);
            }
          };

          p.setup = () => {
            try {
              userHooks = factory(scopeProxy) || {};
              captureConsoleErrorsDuring(() => {
                userHooks.setup?.();
              });
              applyCanvasStyle();
              p.noLoop();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              runtimeErrorDetected = msg;
              propsRef.current.onError(msg);
              p.noLoop();
            }
          };

          p.draw = () => {
            if (runtimeErrorDetected) return;
            try {
              if (!firstDrawChecked) {
                firstDrawChecked = true;
                captureConsoleErrorsDuring(() => {
                  userHooks.draw?.();
                });
              } else {
                userHooks.draw?.();
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              runtimeErrorDetected = msg;
              propsRef.current.onError(msg);
            }
          };

          p.mousePressed = () => {
            try {
              userHooks.mousePressed?.();
            } catch {
              // ignore interaction hook errors
            }
          };

          p.mouseMoved = () => {
            try {
              userHooks.mouseMoved?.();
            } catch {
              // ignore
            }
          };

          p.keyPressed = () => {
            try {
              userHooks.keyPressed?.();
            } catch {
              // ignore
            }
          };
        }, mount);

        p5InstanceRef.current = instance;

        renderTickRef.current = () => {
          try {
            instance.redraw();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            propsRef.current.onError(msg);
          }
        };

        resizeHandlerRef.current = (w: number, h: number) => {
          try {
            if (userHooks.windowResized) {
              userHooks.windowResized();
            } else {
              instance.resizeCanvas(w, h);
            }
            const c = (instance as unknown as { canvas?: HTMLCanvasElement }).canvas;
            if (c) {
              c.style.maxWidth = '100%';
              c.style.maxHeight = '100%';
              c.style.width = 'auto';
              c.style.height = 'auto';
              c.style.display = 'block';
            }
          } catch {
            // ignore resize failure
          }
        };

        // Initial render frame so paused state still displays frame 1
        renderTickRef.current();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        propsRef.current.onError(msg);
      }
    }, [getTargetSize]);

    // Trigger recompile on sketch change, mode change, seed change, or manual recompile
    useEffect(() => {
      compileAndMountSketch();
      return () => {
        if (p5InstanceRef.current) {
          try {
            p5InstanceRef.current.remove();
          } catch {
            // ignore
          }
          p5InstanceRef.current = null;
        }
        if (glCleanupRef.current) {
          glCleanupRef.current();
          glCleanupRef.current = null;
        }
      };
    }, [sketchId, mode, compileVersion, seedOffset, compileAndMountSketch]);

    // Handle resolution preset change or container resize
    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const handleResize = () => {
        const rect = host.getBoundingClientRect();
        containerSizeRef.current = {
          w: Math.max(320, Math.floor(rect.width)),
          h: Math.max(240, Math.floor(rect.height)),
        };
        const { w, h } = getTargetSize();
        resizeHandlerRef.current?.(w, h);
      };

      const observer = new ResizeObserver(handleResize);
      observer.observe(host);
      handleResize();

      return () => observer.disconnect();
    }, [resolution, getTargetSize]);

    // Main continuous execution engine (rAF when visible + Web Worker heartbeat when tab hidden)
    useEffect(() => {
      let rafId = 0;
      let worker: Worker | null = null;
      let workerUrl: string | null = null;

      const stepEngine = () => {
        const now = performance.now();
        const st = runtimeStateRef.current;
        const dt = Math.min(250, Math.max(0, now - st.lastTickWallMs));
        st.lastTickWallMs = now;

        if (propsRef.current.isPlaying) {
          st.elapsedMs += dt * propsRef.current.speed;
          st.frameCount += 1;
          renderTickRef.current?.();
          evaluateScheduleAfterDraw();

          st.fpsAccumFrames += 1;
          const fpsElapsed = now - st.fpsLastReportWallMs;
          if (fpsElapsed >= 250) {
            st.currentFps = Math.round((st.fpsAccumFrames * 1000) / fpsElapsed);
            st.fpsAccumFrames = 0;
            st.fpsLastReportWallMs = now;
          }
        }

        const c = activeCanvasRef.current;
        propsRef.current.onTelemetry({
          elapsedMs: st.elapsedMs,
          frameCount: st.frameCount,
          fps: propsRef.current.isPlaying ? st.currentFps : 0,
          canvasWidth: c?.width || 0,
          canvasHeight: c?.height || 0,
        });
      };

      const rafLoop = () => {
        if (!document.hidden) {
          stepEngine();
        }
        rafId = requestAnimationFrame(rafLoop);
      };

      runtimeStateRef.current.lastTickWallMs = performance.now();
      rafId = requestAnimationFrame(rafLoop);

      // Background tab heartbeat via inline Web Worker so scheduled captures keep running even when tab is inactive
      try {
        const workerCode = `
          let id = setInterval(() => postMessage('tick'), 50);
          self.onmessage = (e) => {
            if (e.data === 'stop') clearInterval(id);
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);
        worker.onmessage = () => {
          if (document.hidden && propsRef.current.isPlaying) {
            stepEngine();
          }
        };
      } catch {
        // Fallback if Web Workers are restricted
      }

      return () => {
        cancelAnimationFrame(rafId);
        if (worker) {
          worker.postMessage('stop');
          worker.terminate();
        }
        if (workerUrl) {
          URL.revokeObjectURL(workerUrl);
        }
      };
    }, [evaluateScheduleAfterDraw]);

    useImperativeHandle(
      ref,
      () => ({
        captureNow(triggerLabel = 'Manual Capture') {
          const frame = captureCanvasData(triggerLabel);
          if (frame) {
            propsRef.current.onCapturedFrame(frame);
          }
          return frame;
        },
        resetSimulation() {
          compileAndMountSketch();
        },
        stepFrames(count: number) {
          const safeCount = Math.min(2000, Math.max(1, Math.floor(count)));
          const st = runtimeStateRef.current;
          for (let i = 0; i < safeCount; i++) {
            st.elapsedMs += 16.6667 * propsRef.current.speed;
            st.frameCount += 1;
            renderTickRef.current?.();
            evaluateScheduleAfterDraw();
          }
          const c = activeCanvasRef.current;
          propsRef.current.onTelemetry({
            elapsedMs: st.elapsedMs,
            frameCount: st.frameCount,
            fps: 0,
            canvasWidth: c?.width || 0,
            canvasHeight: c?.height || 0,
          });
        },
      }),
      [captureCanvasData, compileAndMountSketch, evaluateScheduleAfterDraw]
    );

    return (
      <div
        ref={hostRef}
        className="relative flex-1 w-full h-full min-h-[360px] flex items-center justify-center bg-black overflow-hidden"
      >
        <div
          ref={canvasMountRef}
          className="w-full h-full flex items-center justify-center"
        />
      </div>
    );
  }
);
