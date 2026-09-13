/**
 * A4 geometry, in the CSS pixels a browser uses for print (1in = 96px).
 *
 * These must stay in step with the `@page` margins in globals.css. Authoring
 * the sheet at exactly the printable width is what lets the on-screen preview
 * and the printed page agree line for line — and what makes the page count
 * shown next to the preview trustworthy rather than a guess.
 */
const MM_PER_INCH = 25.4;
const CSS_PX_PER_INCH = 96;

const mm = (value: number) => (value / MM_PER_INCH) * CSS_PX_PER_INCH;

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_X_MM = 12; // must match @page margin
const MARGIN_Y_MM = 14;

/** 186mm — the width the sheet is authored at. */
export const SHEET_WIDTH_PX = Math.round(mm(A4_WIDTH_MM - MARGIN_X_MM * 2));

/** 269mm — how much of one page the content may fill before it spills. */
export const PAGE_CONTENT_HEIGHT_PX = mm(A4_HEIGHT_MM - MARGIN_Y_MM * 2);

/** Base text size of the printed sheet, before the user's adjustment. */
export const BASE_FONT_PX = 13;

/** How far the text size can be pushed, as a multiplier of BASE_FONT_PX. */
export const MIN_FONT_SCALE = 0.75;
export const MAX_FONT_SCALE = 1.25;
export const FONT_SCALE_STEP = 0.05;

export function clampFontScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  const stepped = Math.round(scale / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Number(stepped.toFixed(2))));
}

/**
 * How many A4 pages content of this height needs. Heights are measured from
 * the sheet at its authored width, so this matches what the printer does.
 */
export function pageCount(contentHeightPx: number): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return 1;
  // A hair of tolerance: a stray sub-pixel should not claim a second page.
  return Math.max(1, Math.ceil((contentHeightPx - 1) / PAGE_CONTENT_HEIGHT_PX));
}
