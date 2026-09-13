import type { LineItem } from "./types";

/** Parse a user-typed number, tolerating commas, spaces and blanks. */
export function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[, ]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to 2 decimals without binary-float drift (1.005 -> 1.01). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** True when the line is priced as quantity x rate rather than as a lump sum. */
export function isPerUnit(item: LineItem): boolean {
  return item.pricing === "unit";
}

/** The amount a single line contributes to the total. */
export function lineAmount(item: LineItem): number {
  if (isPerUnit(item)) {
    // A blank quantity or rate mid-edit simply contributes nothing yet.
    return round2(num(item.quantity) * num(item.unitPrice));
  }
  return round2(num(item.amount));
}

export function documentTotal(items: LineItem[]): number {
  return round2(items.reduce((sum, item) => sum + lineAmount(item), 0));
}

/** 8550 -> "8,550.00" */
export function formatMoney(value: number): string {
  return round2(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 8550 -> "RM 8,550.00" */
export function formatCurrency(value: number, code = "RM"): string {
  return `${code} ${formatMoney(value)}`;
}

/**
 * The unit-column text, e.g. 65 + "ft run" + 18.30 -> "65 ft run @ 18.30".
 * Returns "" for lump-sum lines so the column stays blank, as on the paper form.
 */
export function unitLabel(item: LineItem): string {
  const measureOnly = item.unit.trim();
  if (!isPerUnit(item)) return measureOnly;
  const qty = item.quantity.trim();
  const price = item.unitPrice.trim();
  if (!qty) return measureOnly;
  const measure = item.unit.trim() ? ` ${item.unit.trim()}` : "";
  if (!price) return `${qty}${measure}`;
  return `${qty}${measure} @ ${formatMoney(num(price))}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

/** 0-999 in words. */
function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const tens = TENS[Math.floor(rest / 10)];
      const ones = rest % 10;
      parts.push(ones ? `${tens}-${ONES[ones]}` : tens);
    }
  }
  return parts.join(" ");
}

const SCALES: Array<[number, string]> = [
  [1_000_000_000, "Billion"],
  [1_000_000, "Million"],
  [1_000, "Thousand"],
];

/** 8550 -> "Eight Thousand Five Hundred Fifty" */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [scaleValue, scaleName] of SCALES) {
    if (n >= scaleValue) {
      parts.push(`${underThousand(Math.floor(n / scaleValue))} ${scaleName}`);
      n %= scaleValue;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ");
}

/**
 * The "amount in words" line on the printed document, e.g.
 * "Ringgit Malaysia: Eight Thousand Five Hundred Fifty Only".
 */
export function amountInWords(value: number, currencyWord = "Ringgit Malaysia"): string {
  const rounded = round2(Math.abs(value));
  const ringgit = Math.floor(rounded);
  const sen = Math.round((rounded - ringgit) * 100);
  const words = sen
    ? `${numberToWords(ringgit)} And ${numberToWords(sen)} Sen`
    : numberToWords(ringgit);
  return `${currencyWord}: ${words} Only`;
}
