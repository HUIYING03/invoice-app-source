import assert from "node:assert/strict";
import { test } from "node:test";
import { summarise } from "../src/lib/analytics.ts";
import { formatLongDate, formatMonthKey, monthKey, recentMonthKeys } from "../src/lib/dates.ts";
import type { DocStatus, InvoiceDoc } from "../src/lib/types.ts";

function doc(
  id: string,
  kind: InvoiceDoc["kind"],
  date: string,
  amount: string,
  status: DocStatus,
  company = "Acme",
): InvoiceDoc {
  return {
    id,
    kind,
    number: id,
    date,
    client: { company, addressLine1: "", addressLine2: "", addressLine3: "" },
    jobTitle: "",
    items: [
      {
        id: `${id}-1`,
        pricing: "lump",
        title: "Work",
        description: "",
        unit: "",
        quantity: "",
        unitPrice: "",
        amount,
      },
    ],
    notes: "",
    status,
    paidDate: status === "paid" ? date : "",
    deletedAt: "",
    createdAt: date,
    updatedAt: date,
  };
}

const docs: InvoiceDoc[] = [
  doc("a", "invoice", "2026-08-04", "8550", "paid", "Lam Soon"),
  doc("b", "invoice", "2026-08-20", "1000", "sent", "Lam Soon"),
  doc("c", "invoice", "2026-07-01", "2000", "draft", "Cold Gear"),
  doc("d", "quotation", "2026-08-10", "5000", "draft", "Someone Else"),
];

test("revenue splits into invoiced, collected and outstanding", () => {
  const s = summarise(docs);
  assert.equal(s.invoicedTotal, 11550);
  assert.equal(s.collectedTotal, 8550);
  assert.equal(s.outstandingTotal, 3000);
});

test("quotations are counted separately and never as revenue", () => {
  const s = summarise(docs);
  assert.equal(s.quotedTotal, 5000);
  assert.equal(s.quotationCount, 1);
  assert.equal(s.invoiceCount, 3);
});

test("paid and unpaid invoices are tallied", () => {
  const s = summarise(docs);
  assert.equal(s.paidCount, 1);
  assert.equal(s.unpaidCount, 2);
});

test("averages and the largest invoice ignore quotations", () => {
  const s = summarise(docs);
  assert.equal(s.averageInvoice, 3850);
  assert.equal(s.largestInvoice, 8550);
});

test("clients are ranked by total billed, biggest first", () => {
  const s = summarise(docs);
  assert.deepEqual(
    s.topClients.map((c) => [c.company, c.total, c.collected, c.count]),
    [
      ["Lam Soon", 9550, 8550, 2],
      ["Cold Gear", 2000, 0, 1],
    ],
  );
});

test("client names are grouped case-insensitively", () => {
  const s = summarise([
    doc("a", "invoice", "2026-08-04", "100", "paid", "Lam Soon"),
    doc("b", "invoice", "2026-08-05", "200", "paid", "LAM SOON"),
  ]);
  assert.equal(s.topClients.length, 1);
  assert.equal(s.topClients[0].total, 300);
});

test("an empty ledger summarises to zeroes rather than NaN", () => {
  const s = summarise([]);
  assert.equal(s.invoicedTotal, 0);
  assert.equal(s.averageInvoice, 0);
  assert.equal(s.largestInvoice, 0);
  assert.equal(s.topClients.length, 0);
});

test("the monthly trend keeps a fixed window in chronological order", () => {
  const s = summarise(docs, 6);
  assert.equal(s.months.length, 6);
  const keys = s.months.map((m) => m.key);
  assert.deepEqual([...keys].sort(), keys);
});

test("month buckets add up invoiced and collected separately", () => {
  const s = summarise(docs, 24);
  const august = s.months.find((m) => m.key === "2026-08");
  assert.ok(august);
  assert.equal(august.invoiced, 9550);
  assert.equal(august.collected, 8550);
  assert.equal(august.count, 2);
});

test("date helpers format the way the paper form does", () => {
  assert.equal(formatLongDate("2026-08-04"), "04 August 2026");
  assert.equal(formatLongDate(""), "");
  assert.equal(monthKey("2026-08-04"), "2026-08");
  assert.equal(formatMonthKey("2026-08"), "Aug 2026");
});

test("recentMonthKeys ends on the current month", () => {
  const keys = recentMonthKeys(3, new Date(2026, 7, 15));
  assert.deepEqual(keys, ["2026-06", "2026-07", "2026-08"]);
});
