"use client";

import {
  FONT_SCALE_STEP,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  clampFontScale,
  pageCount,
} from "@/lib/print";

/**
 * Text size for the printed document, with the page count beside it.
 *
 * The count is the point: it turns "make it smaller and hope" into a visible
 * target. Because the sheet is authored at the exact printable width and never
 * reflows, the number shown here is the number of pages that will come out.
 */
export default function TextSizeControl({
  value,
  naturalHeight,
  onChange,
}: {
  value: number;
  /** Unscaled height of the rendered sheet, from SheetScaler. */
  naturalHeight: number;
  onChange: (next: number) => void;
}) {
  const scale = clampFontScale(value);
  const pages = pageCount(naturalHeight);
  const percent = Math.round(scale * 100);

  const step = (delta: number) => onChange(clampFontScale(scale + delta));

  return (
    <div className="no-print rounded-2xl border border-line bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Text size</p>
          <p className="text-xs text-muted">
            {naturalHeight === 0
              ? "Measuring…"
              : pages === 1
                ? "Fits on one page"
                : `Spills onto ${pages} pages`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => step(-FONT_SCALE_STEP)}
            disabled={scale <= MIN_FONT_SCALE}
            aria-label="Smaller text"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg font-semibold disabled:opacity-40"
          >
            −
          </button>
          <span className="w-12 text-center text-sm font-semibold tabular-nums">{percent}%</span>
          <button
            type="button"
            onClick={() => step(FONT_SCALE_STEP)}
            disabled={scale >= MAX_FONT_SCALE}
            aria-label="Bigger text"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg font-semibold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {pages > 1 && scale > MIN_FONT_SCALE && (
        <p className="mt-2 text-xs text-warn">Make the text smaller to pull it back to one page.</p>
      )}
      {pages > 1 && scale <= MIN_FONT_SCALE && (
        <p className="mt-2 text-xs text-muted">
          Too long for one page even at the smallest size. Shortening the item details will help.
        </p>
      )}
      {scale !== 1 && (
        <button
          type="button"
          onClick={() => onChange(1)}
          className="mt-2 text-xs font-semibold text-brand"
        >
          Reset to 100%
        </button>
      )}
    </div>
  );
}
