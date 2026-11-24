export function ReferenceView() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-4xl w-full mx-auto space-y-8">
      <div className="pb-6 border-b border-zinc-800">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
          Runtime & Shader Reference
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Everything available inside the continuous p5.js and GLSL execution engine.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium text-zinc-100">
          Endless Execution & Background Capture
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Sketches run inside an isolated loop driven by your selected speed multiplier (0.5× to 8×). When the browser tab is active, rendering uses <code className="text-amber-300">requestAnimationFrame</code>. When you switch tabs or minimize the window, an internal Web Worker heartbeat continues stepping <code className="text-amber-300">millis()</code> and <code className="text-amber-300">iTime</code> so scheduled milestone and interval screenshots keep firing reliably over hours.
        </p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          All captured PNGs are stored locally in IndexedDB so high-resolution frames persist across page reloads without hitting small storage caps.
        </p>
      </section>

      <section className="space-y-3 pt-4 border-t border-zinc-800">
        <h2 className="font-display text-lg font-medium text-zinc-100">
          p5.js / WebGL Mode
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Write standard global-style p5.js code with <code className="text-amber-300">setup()</code>, <code className="text-amber-300">draw()</code>, and <code className="text-amber-300">windowResized()</code>. Both 2D canvas and <code className="text-amber-300">WEBGL</code> shader sketches are supported with <code className="text-amber-300">preserveDrawingBuffer</code> enabled automatically so screenshots are never blank.
        </p>
        <div className="border border-zinc-800 rounded-lg bg-[#111114] p-4 font-mono text-xs text-zinc-300 space-y-2">
          <div><span className="text-amber-400">millis()</span> — returns virtual elapsed milliseconds (obeys Pause, Reset, and Speed)</div>
          <div><span className="text-amber-400">windowWidth / windowHeight</span> — tracks your chosen export resolution preset</div>
          <div><span className="text-amber-400">createShader(vert, frag)</span> — automatically normalizes pasted GLSL directives</div>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-zinc-800">
        <h2 className="font-display text-lg font-medium text-zinc-100">
          Pure GLSL Fragment Mode
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Write only the fragment shader without vertex boilerplate. A full-screen quad and the following uniforms are bound automatically every frame:
        </p>
        <div className="border border-zinc-800 rounded-lg bg-[#111114] p-4 font-mono text-xs text-zinc-300 space-y-2">
          <div><span className="text-amber-400">uniform vec2 iResolution;</span> — canvas width and height in pixels</div>
          <div><span className="text-amber-400">uniform float iTime;</span> — virtual elapsed seconds</div>
          <div><span className="text-amber-400">uniform float iFrame;</span> — total rendered frame count</div>
          <div><span className="text-amber-400">uniform vec4 iMouse;</span> — pointer x, y, and click state</div>
          <div><span className="text-amber-400">uniform float u_seed;</span> — seed offset from the Evolution controls tab</div>
          <div><span className="text-amber-400">varying vec2 vTexCoord;</span> — normalized [0..1] UV coordinates</div>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-zinc-800">
        <h2 className="font-display text-lg font-medium text-zinc-100">
          Keyboard Shortcuts
        </h2>
        <div className="border border-zinc-800 rounded-lg bg-[#111114] p-4 font-mono text-xs text-zinc-300 space-y-2">
          <div><span className="text-amber-400">Ctrl / Cmd + Enter</span> — Compile & run edited code</div>
          <div><span className="text-amber-400">Tab (in editor)</span> — Insert 2 spaces</div>
          <div><span className="text-amber-400">← / → (in Lightbox)</span> — Scrub through captured timestamps</div>
        </div>
      </section>
    </div>
  );
}
