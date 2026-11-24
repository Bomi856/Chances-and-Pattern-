import { FilePlus2, Play, Trash2 } from 'lucide-react';
import { SketchMode, SketchPreset } from '../types/studio';

interface PresetsViewProps {
  presets: SketchPreset[];
  customSketches: SketchPreset[];
  activeSketchId: string;
  onSelectSketch: (sketch: SketchPreset) => void;
  onCreateNew: (mode: SketchMode) => void;
  onDeleteCustom: (id: string) => void;
}

export function PresetsView({
  presets,
  customSketches,
  activeSketchId,
  onSelectSketch,
  onCreateNew,
  onDeleteCustom,
}: PresetsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-[1440px] w-full mx-auto space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
            Pattern Library & Presets
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Load continuous generative algorithms, GLSL shaders, or start a fresh blank canvas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onCreateNew('p5js')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-100 transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>New p5.js Sketch</span>
          </button>
          <button
            type="button"
            onClick={() => onCreateNew('glsl')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-100 transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>New Pure GLSL Shader</span>
          </button>
        </div>
      </div>

      {customSketches.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-medium text-zinc-100">
            Saved Sketches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {customSketches.map((sketch) => {
              const isActive = sketch.id === activeSketchId;
              return (
                <article
                  key={sketch.id}
                  className={`border rounded-xl bg-[#111114] p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isActive
                      ? 'border-amber-500'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5 font-mono">
                      {sketch.mode === 'glsl' ? 'Pure GLSL' : 'p5.js / WebGL'} · Saved
                    </div>
                    <h3 className="font-display text-base font-semibold text-zinc-100">
                      {sketch.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      {sketch.description || 'Custom generative pattern sketch.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectSketch(sketch)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3 h-3" aria-hidden="true" />
                      <span>Open in Studio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteCustom(sketch.id)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete saved sketch"
                      aria-label={`Delete ${sketch.name}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-medium text-zinc-100">
          Studio Presets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {presets.map((sketch) => {
            const isActive = sketch.id === activeSketchId;
            return (
              <article
                key={sketch.id}
                className={`border rounded-xl bg-[#111114] p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isActive
                    ? 'border-amber-500'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5 font-mono">
                    {sketch.mode === 'glsl' ? 'Pure GLSL' : 'p5.js / WebGL'} ·{' '}
                    {sketch.category}
                  </div>
                  <h3 className="font-display text-base font-semibold text-zinc-100">
                    {sketch.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    {sketch.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSketch(sketch)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'bg-zinc-100 hover:bg-white text-zinc-950'
                    }`}
                  >
                    <Play className="w-3 h-3" aria-hidden="true" />
                    <span>{isActive ? 'Currently Loaded' : 'Load Sketch'}</span>
                  </button>

                  <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                    {sketch.code.split('\n').length} lines
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
