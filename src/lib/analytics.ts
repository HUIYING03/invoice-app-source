import { documentTotal, round2 } from "./money";
import { monthKey, recentMonthKeys } from "./dates";
import type { InvoiceDoc } from "./types";

export interface MonthBucket {
  key: string;
  invoiced: number;
  collected: number;
  count: number;
}

export interface ClientBucket {
  company: string;
  total: number;
  collected: number;
  count: number;
}

export interface Summary {
  /** Invoices only — quotations are proposals, not earnings. */
  invoicedTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  quotedTotal: number;
  invoiceCount: number;
  quotationCount: number;
  paidCount: number;
  unpaidCount: number;
  averageInvoice: number;
  largestInvoice: number;
  months: MonthBucket[];
  topClients: ClientBucket[];
}

function isInvoice(doc: InvoiceDoc): boolean {
  return doc.kind === "invoice";
}

/**
 * Roll documents up for the dashboard. `monthsBack` controls the width of the
 * monthly trend; empty months are included so the chart keeps a steady rhythm.
 */
export function summarise(docs: InvoiceDoc[], monthsBack = 6): Summary {
  const invoices = docs.filter(isInvoice);
  const quotations = docs.filter((doc) => !isInvoice(doc));

  const totalOf = (doc: InvoiceDoc) => documentTotal(doc.items);

  const invoicedTotal = round2(invoices.reduce((sum, doc) => sum + totalOf(doc), 0));
  const collectedTotal = round2(
    invoices.filter((doc) => doc.status === "paid").reduce((sum, doc) => sum + totalOf(doc), 0),
  );
  const quotedTotal = round2(quotations.reduce((sum, doc) => sum + totalOf(doc), 0));

  const buckets = new Map<string, MonthBucket>();
  for (const key of recentMonthKeys(monthsBack)) {
    buckets.set(key, { key, invoiced: 0, collected: 0, count: 0 });
  }
  for (const doc of invoices) {
    const key = monthKey(doc.date);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { key, invoiced: 0, collected: 0, count: 0 };
    bucket.invoiced = round2(bucket.invoiced + totalOf(doc));
    if (doc.status === "paid") bucket.collected = round2(bucket.collected + totalOf(doc));
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const months = Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-monthsBack);

  const clients = new Map<string, ClientBucket>();
  for (const doc of invoices) {
    const company = doc.client.company.trim() || "(no client name)";
    const key = company.toLowerCase();
    const bucket = clients.get(key) ?? { company, total: 0, collected: 0, count: 0 };
    bucket.total = round2(bucket.total + totalOf(doc));
    if (doc.status === "paid") bucket.collected = round2(bucket.collected + totalOf(doc));
    bucket.count += 1;
    clients.set(key, bucket);
  }

  const amounts = invoices.map(totalOf);
  const paidCount = invoices.filter((doc) => doc.status === "paid").length;

  return {
    invoicedTotal,
    collectedTotal,
    outstandingTotal: round2(invoicedTotal - collectedTotal),
    quotedTotal,
    invoiceCount: invoices.length,
    quotationCount: quotations.length,
    paidCount,
    unpaidCount: invoices.length - paidCount,
    averageInvoice: invoices.length ? round2(invoicedTotal / invoices.length) : 0,
    largestInvoice: amounts.length ? round2(Math.max(...amounts)) : 0,
    months,
    topClients: Array.from(clients.values()).sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
