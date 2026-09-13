import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { normalizeDocument } from "./normalize";
import { DEFAULT_COMPANY, type CompanyProfile, type InvoiceDoc } from "./types";

/**
 * Firestore access. Everything the app persists lives in two places:
 *
 *   documents/{id}   one invoice or quotation
 *   settings/company the company profile
 *
 * There is a single shared login, so documents are not scoped per user; the
 * security rules simply require that someone is signed in.
 */

const DOCUMENTS = "documents";
const SETTINGS = "settings";
const COMPANY_DOC = "company";

function sortNewestFirst(docs: InvoiceDoc[]): InvoiceDoc[] {
  return [...docs].sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""),
  );
}

/**
 * Live view of every job. Fires immediately from the offline cache, then again
 * whenever anything changes here or on the other person's device.
 */
export function subscribeDocuments(
  onChange: (docs: InvoiceDoc[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), DOCUMENTS),
    (snapshot) => {
      const docs = snapshot.docs.map((d) => normalizeDocument({ ...(d.data() as InvoiceDoc), id: d.id }));
      onChange(sortNewestFirst(docs));
    },
    onError,
  );
}

export function subscribeCompany(
  onChange: (company: CompanyProfile) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), SETTINGS, COMPANY_DOC),
    (snapshot) => {
      onChange({ ...DEFAULT_COMPANY, ...(snapshot.data() as Partial<CompanyProfile> | undefined) });
    },
    onError,
  );
}

export async function putDocument(document: InvoiceDoc): Promise<void> {
  const { id, ...rest } = document;
  await setDoc(doc(getDb(), DOCUMENTS, id), rest);
}

export async function removeDocument(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), DOCUMENTS, id));
}

export async function putCompany(company: CompanyProfile): Promise<void> {
  await setDoc(doc(getDb(), SETTINGS, COMPANY_DOC), company);
}

export async function fetchDocumentsOnce(): Promise<InvoiceDoc[]> {
  const snapshot = await getDocs(collection(getDb(), DOCUMENTS));
  return sortNewestFirst(
    snapshot.docs.map((d) => normalizeDocument({ ...(d.data() as InvoiceDoc), id: d.id })),
  );
}

/**
 * Copy jobs held on this device into Firestore. Used once, to carry across
 * whatever was created before there was an account. Documents already in
 * Firestore are left alone, so running it twice changes nothing.
 */
export async function uploadDocuments(docs: InvoiceDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  const existing = new Set((await fetchDocumentsOnce()).map((d) => d.id));
  const fresh = docs.filter((d) => !existing.has(d.id));
  if (fresh.length === 0) return 0;

  // Firestore caps a batch at 500 writes; chunk so a big upload still works.
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = writeBatch(getDb());
    for (const document of fresh.slice(i, i + 400)) {
      const { id, ...rest } = document;
      batch.set(doc(getDb(), DOCUMENTS, id), rest);
    }
    await batch.commit();
  }
  return fresh.length;
}
