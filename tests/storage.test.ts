import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
// Side-effect import: installs window.localStorage before the module under test.
import { storage } from "./helpers/memory-storage.ts";

import {
  deleteDocument,
  duplicateDocument,
  emptyDocument,
  buildBackup,
  parseBackup,
  loadCompany,
  loadDocument,
  loadDocuments,
  saveCompany,
  saveDocument,
  suggestNumber,
} from "../src/lib/storage.ts";

function make(date: string, number: string, amount: string, company = "Acme") {
  const doc = emptyDocument("invoice");
  doc.date = date;
  doc.number = number;
  doc.client.company = company;
  doc.items[0].amount = amount;
  return saveDocument(doc);
}

beforeEach(() => storage.clear());

test("a saved document can be read back", () => {
  const saved = make("2026-08-04", "023/2026", "8550", "Lam Soon");
  const found = loadDocument(saved.id);
  assert.ok(found);
  assert.equal(found.client.company, "Lam Soon");
  assert.equal(found.items[0].amount, "8550");
});

test("saving the same document twice updates rather than duplicates", () => {
  const saved = make("2026-08-04", "023/2026", "8550");
  saveDocument({ ...saved, client: { ...saved.client, company: "Renamed" } });
  const all = loadDocuments();
  assert.equal(all.length, 1);
  assert.equal(all[0].client.company, "Renamed");
});

test("documents come back newest first", () => {
  make("2026-06-01", "001/2026", "100");
  make("2026-08-04", "002/2026", "200");
  make("2026-07-15", "003/2026", "300");
  assert.deepEqual(
    loadDocuments().map((d) => d.date),
    ["2026-08-04", "2026-07-15", "2026-06-01"],
  );
});

test("deleting removes only the one document", () => {
  const first = make("2026-08-04", "001/2026", "100");
  make("2026-08-05", "002/2026", "200");
  deleteDocument(first.id);
  const all = loadDocuments();
  assert.equal(all.length, 1);
  assert.equal(all[0].number, "002/2026");
});

test("suggestNumber starts a fresh year at 001", () => {
  assert.equal(suggestNumber("invoice", "2026-01-05"), "001/2026");
});

test("suggestNumber continues from the highest number used that year", () => {
  make("2026-08-04", "023/2026", "100");
  make("2026-03-04", "007/2026", "100");
  assert.equal(suggestNumber("invoice", "2026-09-01"), "024/2026");
});

test("suggestNumber counts each year and kind separately", () => {
  make("2026-08-04", "023/2026", "100");
  assert.equal(suggestNumber("invoice", "2027-01-01"), "001/2027");
  assert.equal(suggestNumber("quotation", "2026-08-04"), "001/2026");
});

test("suggestNumber ignores numbers that are not NNN/YYYY", () => {
  make("2026-08-04", "hand-written", "100");
  assert.equal(suggestNumber("invoice", "2026-08-04"), "001/2026");
});

test("a copy is a new draft with a cleared number", () => {
  const source = make("2026-08-04", "023/2026", "8550", "Lam Soon");
  const copy = duplicateDocument(source.id);
  assert.ok(copy);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.number, "");
  assert.equal(copy.status, "draft");
  assert.equal(copy.client.company, "Lam Soon");
  assert.notEqual(copy.items[0].id, source.items[0].id);
  assert.equal(loadDocuments().length, 2);
});

test("company details round-trip and fall back to the defaults", () => {
  assert.equal(loadCompany().currencyCode, "RM");
  saveCompany({ ...loadCompany(), phone: "0123456789" });
  assert.equal(loadCompany().phone, "0123456789");
  assert.equal(loadCompany().name, "CN WONG RENOVATION COMPANY");
});

test("a backup carries the jobs and the company details", () => {
  const saved = make("2026-08-04", "023/2026", "8550", "Lam Soon");
  const backup = buildBackup(loadDocuments(), loadCompany());

  assert.equal(backup.app, "cnwong-invoice");
  assert.equal(backup.documents.length, 1);
  assert.equal(backup.documents[0].id, saved.id);
  assert.equal(backup.company.name, "CN WONG RENOVATION COMPANY");
});

test("a backup round-trips through parseBackup", () => {
  make("2026-08-04", "023/2026", "8550", "Lam Soon");
  const backup = buildBackup(loadDocuments(), loadCompany());

  const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(parsed.documents.length, 1);
  assert.equal(parsed.documents[0].client.company, "Lam Soon");
  assert.equal(parsed.company?.currencyCode, "RM");
});

test("parseBackup fills in fields added after the file was written", () => {
  const backup = buildBackup([], loadCompany()) as unknown as Record<string, unknown>;
  backup.documents = [
    {
      id: "legacy",
      kind: "invoice",
      number: "001/2026",
      date: "2026-08-04",
      client: { company: "Old", addressLine1: "", addressLine2: "", addressLine3: "" },
      jobTitle: "",
      items: [
        { id: "a", title: "Rate", description: "", unit: "ft", quantity: "65", unitPrice: "18.30", amount: "" },
      ],
      notes: "",
      status: "draft",
      paidDate: "",
      createdAt: "",
      updatedAt: "",
    },
  ];

  const parsed = parseBackup(backup);
  assert.equal(parsed.documents[0].items[0].pricing, "unit");
});

test("a file from somewhere else is rejected", () => {
  assert.throws(() => parseBackup({ hello: "world" }), /not a backup/);
  assert.throws(() => parseBackup(null), /not a backup/);
});

test("lines saved before pricing existed get the mode they were using", () => {
  // Documents written by the previous version have no `pricing` field. The
  // mode has to be inferred once, on load, from whichever fields were filled.
  const doc = emptyDocument("invoice");
  doc.client.company = "Legacy";
  doc.items = [
    { id: "a", title: "Lump", description: "", unit: "", quantity: "", unitPrice: "", amount: "850" },
    { id: "b", title: "Rate", description: "", unit: "ft run", quantity: "65", unitPrice: "18.30", amount: "" },
  ] as never;
  saveDocument(doc);

  const [lump, rate] = loadDocuments()[0].items;
  assert.equal(lump.pricing, "lump");
  assert.equal(rate.pricing, "unit");
});

test("an explicit pricing mode is never overwritten on load", () => {
  const doc = emptyDocument("invoice");
  // Per-unit, but mid-edit with the quantity cleared: must stay per-unit.
  doc.items = [{ ...doc.items[0], pricing: "unit", quantity: "", unitPrice: "18.30" }];
  saveDocument(doc);

  assert.equal(loadDocuments()[0].items[0].pricing, "unit");
});
