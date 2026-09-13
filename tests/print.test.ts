import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  PAGE_CONTENT_HEIGHT_PX,
  SHEET_WIDTH_PX,
  clampFontScale,
  pageCount,
} from "../src/lib/print.ts";

test("the sheet is authored at A4 width minus the print margins", () => {
  // 210mm - 12mm x 2 = 186mm at 96dpi. Authoring at exactly this is what keeps
  // the preview and the printed page identical, and the page count honest.
  assert.equal(SHEET_WIDTH_PX, 703);
});

test("one page holds A4 height minus the print margins", () => {
  // 297mm - 14mm x 2 = 269mm at 96dpi.
  assert.ok(Math.abs(PAGE_CONTENT_HEIGHT_PX - 1016.69) < 0.1);
});

test("content shorter than a page is one page", () => {
  assert.equal(pageCount(500), 1);
  assert.equal(pageCount(PAGE_CONTENT_HEIGHT_PX), 1);
});

test("a sub-pixel overshoot does not claim a second page", () => {
  assert.equal(pageCount(PAGE_CONTENT_HEIGHT_PX + 0.4), 1);
});

test("content past a page spills to the next", () => {
  assert.equal(pageCount(PAGE_CONTENT_HEIGHT_PX + 50), 2);
  assert.equal(pageCount(PAGE_CONTENT_HEIGHT_PX * 2 + 10), 3);
});

test("an empty or broken height still reports one page", () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(-10), 1);
  assert.equal(pageCount(Number.NaN), 1);
});

test("the text scale is held inside its limits", () => {
  assert.equal(clampFontScale(0.1), MIN_FONT_SCALE);
  assert.equal(clampFontScale(99), MAX_FONT_SCALE);
  assert.equal(clampFontScale(1), 1);
});

test("the text scale snaps to whole steps, so the percentage stays tidy", () => {
  assert.equal(clampFontScale(0.9231), 0.9);
  assert.equal(clampFontScale(1.0249), 1);
});

test("a missing or nonsense scale falls back to normal size", () => {
  assert.equal(clampFontScale(Number.NaN), 1);
  assert.equal(clampFontScale(Number.POSITIVE_INFINITY), 1);
});
