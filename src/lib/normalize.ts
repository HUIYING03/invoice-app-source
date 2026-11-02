import { fixLevels, levelOf } from "./items";
import { clampFontScale, clampSpacing } from "./print";
import type { InvoiceDoc, LineItem } from "./types";

/**
 * Fills in fields added after a document may have been written, so data from
 * an older release — on a device, in a backup file, or in Firestore — loads
 * with the shape the app expects.
 */
function normalizeItem(raw: LineItem): LineItem {
  // Written before sub-items existed: every line was a top-level item.
  const item = raw.level === levelOf(raw) ? raw : { ...raw, level: levelOf(raw) };
  if (item.pricing === "lump" || item.pricing === "unit") return item;
  // Written before `pricing` existed: recover the mode the user had chosen
  // from whichever fields they filled in.
  const looksPerUnit = item.quantity?.trim() !== "" || item.unitPrice?.trim() !== "";
  return { ...item, pricing: looksPerUnit ? "unit" : "lump" };
}

export function normalizeDocument(doc: InvoiceDoc): InvoiceDoc {
  return {
    ...doc,
    deletedAt: doc.deletedAt ?? "",
    fontScale: clampFontScale(doc.fontScale ?? 1),
    sectionSpacing: clampSpacing(doc.sectionSpacing ?? 1),
    itemSpacing: clampSpacing(doc.itemSpacing ?? 1),
    items: Array.isArray(doc.items) ? fixLevels(doc.items.map(normalizeItem)) : [],
  };
}
