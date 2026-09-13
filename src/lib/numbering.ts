import { todayISO } from "./dates";
import type { DocKind, InvoiceDoc } from "./types";

/**
 * Suggest the next running number for a year, e.g. "024/2026".
 * Numbers that do not follow the NNN/YYYY shape are ignored, so a hand-written
 * one does not derail the sequence.
 */
export function suggestNumberFrom(
  docs: InvoiceDoc[],
  kind: DocKind,
  date: string,
  excludeId?: string,
): string {
  const year = (date || todayISO()).slice(0, 4);
  const used = docs
    .filter((doc) => doc.kind === kind && doc.id !== excludeId)
    .map((doc) => /^(\d+)\/(\d{4})$/.exec((doc.number || "").trim()))
    .filter((match): match is RegExpExecArray => !!match && match[2] === year)
    .map((match) => parseInt(match[1], 10));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${String(next).padStart(3, "0")}/${year}`;
}
