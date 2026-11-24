import { Camera } from 'lucide-react';
import { StudioView } from '../types/studio';

interface TopBarProps {
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
  onCaptureNow: () => void;
  captureCount: number;
}

const NAV_ITEMS: { id: StudioView; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'presets', label: 'Presets' },
  { id: 'reference', label: 'Reference' },
  { id: 'tutorial', label: 'Tutorial' },
];

export function TopBar({
  activeView,
  onSelectView,
  onCaptureNow,
  captureCount,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-zinc-800 bg-[#09090B] px-4 lg:px-6 flex items-center justify-between gap-8">
      <button
        type="button"
        onClick={() => onSelectView('studio')}
        className="font-display text-lg font-semibold tracking-tight text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm"
      >
        Tessera
      </button>

      <nav
        aria-label="Primary navigation"
        className="flex items-center gap-5 lg:gap-7 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const label =
            item.id === 'timeline' && captureCount > 0
              ? `${item.label} (${captureCount})`
              : item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm ${
                isActive
                  ? 'text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onCaptureNow}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
        >
          <Camera className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Capture Frame</span>
        </button>
      </div>
    </header>
  );
}
