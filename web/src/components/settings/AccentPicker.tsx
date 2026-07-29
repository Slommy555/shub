import { ACCENT_PRESETS, onColorFor, swatchFor, type AccentPreset } from '../../lib/accent';
import type { UseAccent } from '../../hooks/useAccent';

/**
 * Accent color picker. Choosing a preset (or any custom color) regenerates the
 * whole accent ramp, so buttons, active tabs, the dock pill, focus rings, the
 * rest timer and the page's ambient wash all re-tint together.
 */
export default function AccentPicker({ accent }: { accent: UseAccent }) {
  // Lavender is the built-in default, stored as null so it tracks the CSS.
  const selectedId =
    accent.color === null
      ? 'lavender'
      : ACCENT_PRESETS.find((p) => p.base === accent.color)?.id ?? 'custom';

  const pick = (p: AccentPreset) => accent.setColor(p.id === 'lavender' ? null : p.base);

  return (
    <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm">Accent color</p>
          <p className="text-xs text-gray-400">
            Buttons, active tabs and highlights across the app.
          </p>
        </div>
        {selectedId !== 'lavender' && (
          <button
            type="button"
            onClick={accent.reset}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((p) => {
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              aria-label={p.name}
              aria-pressed={on}
              title={p.name}
              className={[
                'grid h-10 w-10 place-items-center rounded-full transition-transform active:scale-90',
                on ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-900' : '',
              ].join(' ')}
              style={{ backgroundColor: swatchFor(p.base) }}
            >
              {on && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={onColorFor(p.base)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Anything else — the native color input drives the same ramp. */}
        <label
          className={[
            'grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-transform active:scale-90 dark:border-gray-600',
            selectedId === 'custom' ? 'ring-2 ring-gray-900 ring-offset-2 dark:ring-white dark:ring-offset-gray-900' : '',
          ].join(' ')}
          title="Custom color"
          style={
            selectedId === 'custom' && accent.color
              ? { backgroundColor: swatchFor(accent.color), borderStyle: 'solid' }
              : undefined
          }
        >
          <input
            type="color"
            value={accent.color ?? '#9b88e8'}
            onChange={(e) => accent.setColor(e.target.value)}
            className="sr-only"
            aria-label="Custom accent color"
          />
          {selectedId === 'custom' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={onColorFor(accent.color ?? '#9b88e8')} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </label>
      </div>

      {/* Live preview so the choice is obvious before leaving Settings. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="btn-accent px-3 py-1.5 text-xs font-semibold">Primary</span>
        <span className="rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-700 dark:bg-accent-900/50 dark:text-accent-200">
          Highlight
        </span>
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent-600 ring-1 ring-accent-400/70 dark:text-accent-300">
          Outline
        </span>
      </div>
    </div>
  );
}
