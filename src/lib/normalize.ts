import type { InvoiceDoc, LineItem } from "./types";

/**
 * Fills in fields added after a document may have been written, so data from
 * an older release — on a device, in a backup file, or in Firestore — loads
 * with the shape the app expects.
 */
function normalizeItem(item: LineItem): LineItem {
  if (item.pricing === "lump" || item.pricing === "unit") return item;
  // Written before `pricing` existed: recover the mode the user had chosen
  // from whichever fields they filled in.
  const looksPerUnit = item.quantity?.trim() !== "" || item.unitPrice?.trim() !== "";
  return { ...item, pricing: looksPerUnit ? "unit" : "lump" };
}

export function normalizeDocument(doc: InvoiceDoc): InvoiceDoc {
  return {
    ...doc,
    items: Array.isArray(doc.items) ? doc.items.map(normalizeItem) : [],
  };
}
