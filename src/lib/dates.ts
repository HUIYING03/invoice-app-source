/** Today as yyyy-mm-dd in the browser's local timezone (not UTC). */
export function todayISO(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** "2026-08-04" -> "04 August 2026", as printed on the paper form. */
export function formatLongDate(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(day).padStart(2, "0")} ${date.toLocaleString("en-GB", {
    month: "long",
  })} ${year}`;
}

/** "2026-08-04" -> "4 Aug 2026", for compact list rows. */
export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return iso;
  return `${day} ${date.toLocaleString("en-GB", { month: "short" })} ${year}`;
}

/** "2026-08-04" -> "2026-08", the bucket key used by the dashboard. */
export function monthKey(iso: string): string {
  return iso ? iso.slice(0, 7) : "";
}

/** "2026-08" -> "Aug 2026" */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return `${new Date(year, month - 1, 1).toLocaleString("en-GB", {
    month: "short",
  })} ${year}`;
}

/** The last `count` month keys ending with the current month, oldest first. */
export function recentMonthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
