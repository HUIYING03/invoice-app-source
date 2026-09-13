import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestNumberFrom } from "../src/lib/numbering.ts";
import type { InvoiceDoc } from "../src/lib/types.ts";

function doc(number: string, deletedAt = ""): InvoiceDoc {
  return {
    id: number,
    kind: "invoice",
    number,
    date: "2026-08-04",
    client: { company: "", addressLine1: "", addressLine2: "", addressLine3: "" },
    jobTitle: "",
    items: [],
    notes: "",
    status: "draft",
    paidDate: "",
    deletedAt,
    fontScale: 1,
    createdAt: "",
    updatedAt: "",
  };
}

test("a fresh year starts at 001", () => {
  assert.equal(suggestNumberFrom([], "invoice", "2026-01-05"), "001/2026");
});

test("continues from the highest number used that year", () => {
  assert.equal(suggestNumberFrom([doc("023/2026"), doc("007/2026")], "invoice", "2026-09-01"), "024/2026");
});

test("a number belonging to a binned job is not handed out again", () => {
  // The editor passes every job, bin included, precisely so that deleting an
  // invoice cannot cause its number to be reused on a different one.
  const docs = [doc("001/2026"), doc("002/2026", "2026-09-13T00:00:00.000Z")];
  assert.equal(suggestNumberFrom(docs, "invoice", "2026-09-13"), "003/2026");
});

test("numbers that are not NNN/YYYY are ignored", () => {
  assert.equal(suggestNumberFrom([doc("hand-written")], "invoice", "2026-08-04"), "001/2026");
});

test("each year and kind counts separately", () => {
  const docs = [doc("023/2026")];
  assert.equal(suggestNumberFrom(docs, "invoice", "2027-01-01"), "001/2027");
  assert.equal(suggestNumberFrom(docs, "quotation", "2026-08-04"), "001/2026");
});
