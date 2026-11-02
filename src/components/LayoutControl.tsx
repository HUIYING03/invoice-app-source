"use client";

import {
  FONT_SCALE_STEP,
  MAX_FONT_SCALE,
  MAX_SPACING,
  MIN_FONT_SCALE,
  MIN_SPACING,
  SPACING_STEP,
  clampFontScale,
  clampSpacing,
  pageCount,
  pageFill,
} from "@/lib/print";

export interface LayoutSettings {
  fontScale: number;
  sectionSpacing: number;
  itemSpacing: number;
}

/**
 * Text size and spacing for the printed document, with the page count beside
 * them.
 *
 * The count is the point: it turns "adjust and hope" into a visible target.
 * Because the sheet is authored at the exact printable width and never
 * reflows, the number shown here is the number of pages that will come out —
 * so a short job can be spread out to fill the page, and a long one tightened
 * back onto it.
 */
export default function LayoutControl({
  value,
  naturalHeight,
  onChange,
}: {
  value: LayoutSettings;
  /** Unscaled height of the rendered sheet, from SheetScaler. */
  naturalHeight: number;
  onChange: (patch: Partial<LayoutSettings>) => void;
}) {
  const fontScale = clampFontScale(value.fontScale);
  const sectionSpacing = clampSpacing(value.sectionSpacing);
  const itemSpacing = clampSpacing(value.itemSpacing);
  const pages = pageCount(naturalHeight);
  const fill = pageFill(naturalHeight);
  const atDefaults = fontScale === 1 && sectionSpacing === 1 && itemSpacing === 1;
  const atTightest =
    fontScale <= MIN_FONT_SCALE && sectionSpacing <= MIN_SPACING && itemSpacing <= MIN_SPACING;

  return (
    <div className="no-print rounded-2xl border border-line bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Page layout</p>
        <p className={`text-xs ${pages > 1 ? "text-warn" : "text-muted"}`}>
          {naturalHeight === 0
            ? "Measuring…"
            : pages === 1
              ? `Fits on one page · ${fill}% full`
              : `Spills onto ${pages} pages`}
        </p>
      </div>

      <div className="divide-y divide-line">
        <Stepper
          label="Text size"
          value={fontScale}
          min={MIN_FONT_SCALE}
          max={MAX_FONT_SCALE}
          step={FONT_SCALE_STEP}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ fontScale: clampFontScale(v) })}
        />
        <Stepper
          label="Space between sections"
          hint="Header, client, table, note, signature"
          value={sectionSpacing}
          min={MIN_SPACING}
          max={MAX_SPACING}
          step={SPACING_STEP}
          format={(v) => `${v}×`}
          onChange={(v) => onChange({ sectionSpacing: clampSpacing(v) })}
        />
        <Stepper
          label="Space between items"
          hint="Room around each line in the table"
          value={itemSpacing}
          min={MIN_SPACING}
          max={MAX_SPACING}
          step={SPACING_STEP}
          format={(v) => `${v}×`}
          onChange={(v) => onChange({ itemSpacing: clampSpacing(v) })}
        />
      </div>

      {pages === 1 && naturalHeight > 0 && fill < 70 && (
        <p className="mt-2 text-xs text-muted">
          Plenty of room left. Add space between sections or items to spread it out.
        </p>
      )}
      {pages > 1 && !atTightest && (
        <p className="mt-2 text-xs text-warn">
          Make the text smaller or the spacing tighter to pull it back to one page.
        </p>
      )}
      {pages > 1 && atTightest && (
        <p className="mt-2 text-xs text-muted">
          Too long for one page even at the tightest layout. Shortening the item details will help.
        </p>
      )}
      {!atDefaults && (
        <button
          type="button"
          onClick={() => onChange({ fontScale: 1, sectionSpacing: 1, itemSpacing: 1 })}
          className="mt-2 text-xs font-semibold text-brand"
        >
          Reset layout
        </button>
      )}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(value - step)}
          disabled={value <= min}
          aria-label={`Less ${label.toLowerCase()}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg font-semibold disabled:opacity-40"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-semibold tabular-nums">{format(value)}</span>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg font-semibold disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
