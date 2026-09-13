import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountInWords,
  documentTotal,
  formatMoney,
  isPerUnit,
  lineAmount,
  numberToWords,
  num,
  round2,
  unitLabel,
} from "../src/lib/money.ts";
import type { LineItem } from "../src/lib/types.ts";

function item(patch: Partial<LineItem> = {}): LineItem {
  return {
    id: "x",
    pricing: "lump",
    title: "",
    description: "",
    unit: "",
    quantity: "",
    unitPrice: "",
    amount: "",
    ...patch,
  };
}

test("num tolerates the ways people type money", () => {
  assert.equal(num("1,980.00"), 1980);
  assert.equal(num(" 18.30 "), 18.3);
  assert.equal(num(""), 0);
  assert.equal(num("abc"), 0);
  assert.equal(num(undefined), 0);
});

test("round2 avoids binary-float drift", () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(1.005), 1.01);
});

test("a lump-sum line uses its amount", () => {
  const line = item({ amount: "1980" });
  assert.equal(isPerUnit(line), false);
  assert.equal(lineAmount(line), 1980);
});

test("a metered line multiplies quantity by rate", () => {
  // From the real invoice: 65 ft run @ 18.30 = 1,189.50
  const line = item({ pricing: "unit", quantity: "65", unit: "ft run", unitPrice: "18.30" });
  assert.equal(isPerUnit(line), true);
  assert.equal(lineAmount(line), 1189.5);
  assert.equal(unitLabel(line), "65 ft run @ 18.30");
});

test("clearing the quantity keeps the line in per-unit mode", () => {
  // The bug this guards: the mode used to be inferred from the fields being
  // non-empty, so deleting the quantity to retype it snapped the line back to
  // a lump sum and hid the inputs mid-edit.
  const line = item({ pricing: "unit", quantity: "", unit: "ft run", unitPrice: "18.30" });
  assert.equal(isPerUnit(line), true);
  assert.equal(lineAmount(line), 0);
});

test("a per-unit line with no rate yet still shows its measure", () => {
  const line = item({ pricing: "unit", quantity: "2", unit: "nos", unitPrice: "" });
  assert.equal(unitLabel(line), "2 nos");
  assert.equal(lineAmount(line), 0);
});

test("a lump-sum line ignores any leftover quantity and rate", () => {
  // Switching back to "One price" keeps the typed values so the toggle is
  // reversible, but they must not affect the amount or the printed unit.
  const line = item({ pricing: "lump", quantity: "2", unit: "nos", unitPrice: "180", amount: "360" });
  assert.equal(lineAmount(line), 360);
  assert.equal(unitLabel(line), "nos");
});

test("the metered rate is rounded per line, then summed", () => {
  // 275 sq ft @ 16.50 = 4,537.50
  const total = documentTotal([
    item({ pricing: "unit", quantity: "65", unit: "ft run", unitPrice: "18.30" }),
    item({ pricing: "unit", quantity: "275", unit: "sq ft", unitPrice: "16.50" }),
    item({ pricing: "unit", quantity: "2", unit: "nos", unitPrice: "180.00" }),
  ]);
  assert.equal(total, 6087); // matches the Cold Gear invoice
});

test("documentTotal reproduces the Lam Soon invoice", () => {
  const total = documentTotal(
    ["1980", "3020", "850", "2700"].map((amount) => item({ amount })),
  );
  assert.equal(total, 8550);
});

test("blank lines contribute nothing", () => {
  assert.equal(documentTotal([item(), item({ title: "Note only" })]), 0);
});

test("formatMoney always shows two decimals with thousands separators", () => {
  assert.equal(formatMoney(8550), "8,550.00");
  assert.equal(formatMoney(1189.5), "1,189.50");
  assert.equal(formatMoney(0), "0.00");
});

test("numberToWords covers the shapes that show up on invoices", () => {
  assert.equal(numberToWords(0), "Zero");
  assert.equal(numberToWords(15), "Fifteen");
  assert.equal(numberToWords(50), "Fifty");
  assert.equal(numberToWords(87), "Eighty-Seven");
  assert.equal(numberToWords(100), "One Hundred");
  assert.equal(numberToWords(8550), "Eight Thousand Five Hundred Fifty");
  assert.equal(numberToWords(6087), "Six Thousand Eighty-Seven");
  assert.equal(numberToWords(1000000), "One Million");
});

test("amountInWords matches the wording already used on paper", () => {
  assert.equal(
    amountInWords(8550),
    "Ringgit Malaysia: Eight Thousand Five Hundred Fifty Only",
  );
});

test("amountInWords spells out sen when there are any", () => {
  assert.equal(
    amountInWords(1189.5),
    "Ringgit Malaysia: One Thousand One Hundred Eighty-Nine And Fifty Sen Only",
  );
});

test("amountInWords honours a different currency word", () => {
  assert.equal(amountInWords(5, "Singapore Dollars"), "Singapore Dollars: Five Only");
});
