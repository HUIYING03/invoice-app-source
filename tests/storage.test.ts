import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
// Side-effect import: installs window.localStorage before the module under test.
import { storage } from "./helpers/memory-storage.ts";

import {
  deleteDocument,
  duplicateDocument,
  emptyDocument,
  exportBackup,
  importBackup,
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

test("a backup exported on one device imports onto another", () => {
  make("2026-08-04", "023/2026", "8550", "Lam Soon");
  const backup = exportBackup();

  storage.clear();
  const result = importBackup(JSON.parse(JSON.stringify(backup)));

  assert.equal(result.added, 1);
  assert.equal(result.updated, 0);
  assert.equal(loadDocuments()[0].client.company, "Lam Soon");
});

test("importing keeps the newer copy of a document that exists on both", () => {
  const saved = make("2026-08-04", "023/2026", "8550", "Original");
  const backup = exportBackup();
  backup.documents[0] = {
    ...saved,
    client: { ...saved.client, company: "Newer" },
    updatedAt: "2099-01-01T00:00:00.000Z",
  };

  const result = importBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.updated, 1);
  assert.equal(loadDocument(saved.id)?.client.company, "Newer");
});

test("importing does not overwrite a document that is newer here", () => {
  const saved = make("2026-08-04", "023/2026", "8550", "Mine");
  const backup = exportBackup();
  backup.documents[0] = {
    ...saved,
    client: { ...saved.client, company: "Stale" },
    updatedAt: "2000-01-01T00:00:00.000Z",
  };

  importBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(loadDocument(saved.id)?.client.company, "Mine");
});

test("importing a file from somewhere else is rejected", () => {
  assert.throws(() => importBackup({ hello: "world" }), /not a backup/);
  assert.throws(() => importBackup(null), /not a backup/);
});
