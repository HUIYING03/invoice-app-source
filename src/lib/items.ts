import { lineAmount, round2 } from "./money";
import type { ItemLevel, LineItem } from "./types";

/**
 * Items are stored as a flat list, each with a `level`: 0 is an item, 1 a
 * sub-item, 2 a sub-sub-item. A flat list keeps reordering, saving and old
 * data simple; the tree is implied by order — a line belongs to the nearest
 * line above it with a smaller level.
 */

export const MAX_LEVEL: ItemLevel = 2;

export const LEVEL_NAMES = ["Item", "Sub-item", "Sub-sub-item"] as const;

export function levelOf(item: Pick<LineItem, "level">): ItemLevel {
  const level = Number(item.level);
  if (level >= 2) return 2;
  if (level >= 1) return 1;
  return 0;
}

/**
 * Makes the levels consistent: the first line is always an item, and no line
 * can sit more than one level deeper than the line above it. Returns the same
 * array when nothing needed fixing.
 */
export function fixLevels(items: LineItem[]): LineItem[] {
  let previous = -1;
  let changed = false;
  const fixed = items.map((item) => {
    const level = Math.min(levelOf(item), previous + 1) as ItemLevel;
    previous = level;
    if (level === item.level) return item;
    changed = true;
    return { ...item, level };
  });
  return changed ? fixed : items;
}

/** 1 -> "a", 26 -> "z", 27 -> "aa". */
function toLetters(n: number): string {
  let out = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    out = String.fromCharCode(97 + rest) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const ROMAN: Array<[number, string]> = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
  [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

/** 1 -> "i", 4 -> "iv", 12 -> "xii". */
function toRoman(n: number): string {
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

/**
 * The printed label for each line, in order: items count 1. 2. 3., sub-items
 * a. b. c. under each item, sub-sub-items i. ii. iii. under each sub-item.
 * Assumes fixed levels.
 */
export function itemNumbers(items: LineItem[]): string[] {
  const counters = [0, 0, 0];
  return items.map((item) => {
    const level = levelOf(item);
    counters[level] += 1;
    for (let deeper = level + 1; deeper < counters.length; deeper++) counters[deeper] = 0;
    const n = counters[level];
    const label = level === 0 ? String(n) : level === 1 ? toLetters(n) : toRoman(n);
    return `${label}.`;
  });
}

/** Index just past the line at `index` and everything nested under it. */
function blockEnd(items: LineItem[], index: number): number {
  const level = levelOf(items[index]);
  let end = index + 1;
  while (end < items.length && levelOf(items[end]) > level) end++;
  return end;
}

/** True when the line has sub-lines nested under it. */
export function hasChildren(items: LineItem[], index: number): boolean {
  return blockEnd(items, index) > index + 1;
}

/** The line's own amount plus everything nested under it. */
export function groupTotal(items: LineItem[], index: number): number {
  const end = blockEnd(items, index);
  let sum = 0;
  for (let i = index; i < end; i++) sum += lineAmount(items[i]);
  return round2(sum);
}

/** Index of the neighbouring line at the same level, or -1 if there is none. */
function siblingIndex(items: LineItem[], index: number, direction: -1 | 1): number {
  const level = levelOf(items[index]);
  if (direction === 1) {
    const next = blockEnd(items, index);
    return next < items.length && levelOf(items[next]) === level ? next : -1;
  }
  for (let i = index - 1; i >= 0; i--) {
    const candidate = levelOf(items[i]);
    if (candidate === level) return i;
    if (candidate < level) return -1;
  }
  return -1;
}

export function canMove(items: LineItem[], index: number, direction: -1 | 1): boolean {
  return siblingIndex(items, index, direction) >= 0;
}

/**
 * Swaps a line, together with its sub-lines, with the neighbouring line at the
 * same level (and that line's sub-lines). To move a sub-item under another
 * item, outdent it, move it, and indent it again.
 */
export function moveItem(items: LineItem[], index: number, direction: -1 | 1): LineItem[] {
  const sibling = siblingIndex(items, index, direction);
  if (sibling < 0) return items;
  const [first, second] = direction === 1 ? [index, sibling] : [sibling, index];
  const firstBlock = items.slice(first, blockEnd(items, first));
  const secondEnd = blockEnd(items, second);
  const secondBlock = items.slice(second, secondEnd);
  return [...items.slice(0, first), ...secondBlock, ...firstBlock, ...items.slice(secondEnd)];
}

export function canIndent(items: LineItem[], index: number): boolean {
  if (index === 0) return false;
  const level = levelOf(items[index]);
  return level < MAX_LEVEL && level <= levelOf(items[index - 1]);
}

export function canOutdent(items: LineItem[], index: number): boolean {
  return levelOf(items[index]) > 0;
}

/**
 * Moves a line one level deeper or shallower. Its sub-lines move with it, so a
 * group keeps its shape; anything that would end up deeper than a
 * sub-sub-item stops at that depth.
 */
export function shiftLevel(items: LineItem[], index: number, delta: -1 | 1): LineItem[] {
  if (delta === 1 ? !canIndent(items, index) : !canOutdent(items, index)) return items;
  const end = blockEnd(items, index);
  const next = items.map((item, i) => {
    if (i < index || i >= end) return item;
    const level = Math.max(0, Math.min(MAX_LEVEL, levelOf(item) + delta)) as ItemLevel;
    return { ...item, level };
  });
  return fixLevels(next);
}

/**
 * Removes one line. Its sub-lines are kept and move up a level, so deleting a
 * heading never silently throws away the priced lines under it.
 */
export function removeItem(items: LineItem[], index: number): LineItem[] {
  const end = blockEnd(items, index);
  const next = items
    .map((item, i) => {
      if (i <= index || i >= end) return item;
      return { ...item, level: Math.max(0, levelOf(item) - 1) as ItemLevel };
    })
    .filter((_, i) => i !== index);
  return fixLevels(next);
}

/**
 * Inserts a new line as the last child of the line at `index` (one level
 * deeper), after any sub-lines it already has.
 */
export function insertChild(items: LineItem[], index: number, child: LineItem): LineItem[] {
  const level = levelOf(items[index]);
  if (level >= MAX_LEVEL) return items;
  const end = blockEnd(items, index);
  const inserted = { ...child, level: (level + 1) as ItemLevel };
  return [...items.slice(0, end), inserted, ...items.slice(end)];
}
