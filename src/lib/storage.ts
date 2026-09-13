import { DEFAULT_COMPANY, type CompanyProfile, type InvoiceDoc, type LineItem } from "./types";
import { todayISO } from "./dates";
import { normalizeDocument } from "./normalize";
import { suggestNumberFrom } from "./numbering";

/**
 * All persistence goes through this module. It is deliberately the only place
 * that touches localStorage, so swapping in a hosted database later means
 * rewriting this file and nothing else.
 */

const DOCS_KEY = "cnwong.documents.v1";
const COMPANY_KEY = "cnwong.company.v1";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJSON<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota exceeded, or storage blocked in private browsing.
    console.error("Could not save to this device's storage", error);
    throw error;
  }
}

export function emptyItem(): LineItem {
  return {
    id: newId(),
    pricing: "lump",
    title: "",
    description: "",
    unit: "",
    quantity: "",
    unitPrice: "",
    amount: "",
  };
}

export function emptyDocument(kind: InvoiceDoc["kind"] = "invoice"): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id: newId(),
    kind,
    number: "",
    date: todayISO(),
    client: { company: "", addressLine1: "", addressLine2: "", addressLine3: "" },
    jobTitle: "",
    items: [emptyItem()],
    notes: "",
    status: "draft",
    paidDate: "",
    deletedAt: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function loadDocuments(): InvoiceDoc[] {
  const docs = readJSON<InvoiceDoc[]>(DOCS_KEY, []);
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((doc): doc is InvoiceDoc => !!doc && typeof doc.id === "string")
    .map(normalizeDocument)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function loadDocument(id: string): InvoiceDoc | null {
  return loadDocuments().find((doc) => doc.id === id) ?? null;
}

export function saveDocument(doc: InvoiceDoc): InvoiceDoc {
  const saved: InvoiceDoc = { ...doc, updatedAt: new Date().toISOString() };
  const docs = loadDocuments();
  const index = docs.findIndex((candidate) => candidate.id === saved.id);
  if (index >= 0) docs[index] = saved;
  else docs.unshift(saved);
  writeJSON(DOCS_KEY, docs);
  return saved;
}

export function deleteDocument(id: string): void {
  writeJSON(DOCS_KEY, loadDocuments().filter((doc) => doc.id !== id));
}

export function duplicateDocument(id: string): InvoiceDoc | null {
  const source = loadDocument(id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: InvoiceDoc = {
    ...source,
    id: newId(),
    number: "",
    date: todayISO(),
    status: "draft",
    paidDate: "",
    items: source.items.map((item) => ({ ...item, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
  return saveDocument(copy);
}

export function loadCompany(): CompanyProfile {
  return { ...DEFAULT_COMPANY, ...readJSON<Partial<CompanyProfile>>(COMPANY_KEY, {}) };
}

export function saveCompany(profile: CompanyProfile): void {
  writeJSON(COMPANY_KEY, profile);
}

/** Local-data variant of {@link suggestNumberFrom}, kept for the backup path. */
export function suggestNumber(kind: InvoiceDoc["kind"], date: string, excludeId?: string): string {
  return suggestNumberFrom(loadDocuments(), kind, date, excludeId);
}

export interface BackupFile {
  app: "cnwong-invoice";
  version: 1;
  exportedAt: string;
  company: CompanyProfile;
  documents: InvoiceDoc[];
}

/** Build a backup from data already in hand, rather than from this device. */
export function buildBackup(documents: InvoiceDoc[], company: CompanyProfile): BackupFile {
  return {
    app: "cnwong-invoice",
    version: 1,
    exportedAt: new Date().toISOString(),
    company,
    documents,
  };
}

/** Validate a backup file and hand back what it holds. */
export function parseBackup(raw: unknown): { documents: InvoiceDoc[]; company: CompanyProfile | null } {
  const backup = raw as Partial<BackupFile>;
  if (!backup || backup.app !== "cnwong-invoice" || !Array.isArray(backup.documents)) {
    throw new Error("That file is not a backup from this app.");
  }
  return {
    documents: backup.documents
      .filter((doc): doc is InvoiceDoc => !!doc && typeof doc.id === "string")
      .map(normalizeDocument),
    company: backup.company ? { ...DEFAULT_COMPANY, ...backup.company } : null,
  };
}
