import { DEFAULT_COMPANY, type CompanyProfile, type InvoiceDoc, type LineItem } from "./types";
import { todayISO } from "./dates";

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
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Fills in `pricing` for lines saved before it existed, inferring the mode the
 * user had actually chosen from whichever fields they filled in.
 */
function migrateItem(item: LineItem): LineItem {
  if (item.pricing === "lump" || item.pricing === "unit") return item;
  const looksPerUnit = item.quantity?.trim() !== "" || item.unitPrice?.trim() !== "";
  return { ...item, pricing: looksPerUnit ? "unit" : "lump" };
}

export function loadDocuments(): InvoiceDoc[] {
  const docs = readJSON<InvoiceDoc[]>(DOCS_KEY, []);
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((doc): doc is InvoiceDoc => !!doc && typeof doc.id === "string")
    .map((doc) => ({
      ...doc,
      items: Array.isArray(doc.items) ? doc.items.map(migrateItem) : [],
    }))
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

/**
 * Suggest the next running number for a year, e.g. "024/2026".
 * Existing numbers that do not follow the NNN/YYYY shape are ignored.
 */
export function suggestNumber(kind: InvoiceDoc["kind"], date: string, excludeId?: string): string {
  const year = (date || todayISO()).slice(0, 4);
  const used = loadDocuments()
    .filter((doc) => doc.kind === kind && doc.id !== excludeId)
    .map((doc) => /^(\d+)\/(\d{4})$/.exec(doc.number.trim()))
    .filter((match): match is RegExpExecArray => !!match && match[2] === year)
    .map((match) => parseInt(match[1], 10));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${String(next).padStart(3, "0")}/${year}`;
}

export interface BackupFile {
  app: "cnwong-invoice";
  version: 1;
  exportedAt: string;
  company: CompanyProfile;
  documents: InvoiceDoc[];
}

export function exportBackup(): BackupFile {
  return {
    app: "cnwong-invoice",
    version: 1,
    exportedAt: new Date().toISOString(),
    company: loadCompany(),
    documents: loadDocuments(),
  };
}

export interface ImportResult {
  added: number;
  updated: number;
}

/** Merge a backup into this device. Documents are matched by id; newest wins. */
export function importBackup(raw: unknown): ImportResult {
  const backup = raw as Partial<BackupFile>;
  if (!backup || backup.app !== "cnwong-invoice" || !Array.isArray(backup.documents)) {
    throw new Error("That file is not a backup from this app.");
  }
  const existing = loadDocuments();
  const byId = new Map(existing.map((doc) => [doc.id, doc]));
  let added = 0;
  let updated = 0;

  for (const incoming of backup.documents) {
    if (!incoming || typeof incoming.id !== "string") continue;
    const current = byId.get(incoming.id);
    if (!current) {
      byId.set(incoming.id, incoming);
      added += 1;
    } else if ((incoming.updatedAt || "") > (current.updatedAt || "")) {
      byId.set(incoming.id, incoming);
      updated += 1;
    }
  }

  writeJSON(DOCS_KEY, Array.from(byId.values()));
  if (backup.company) saveCompany({ ...DEFAULT_COMPANY, ...backup.company });
  return { added, updated };
}
