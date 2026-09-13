import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
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
const BACKUPS = "backups";

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

/**
 * Move a job to the bin. The record is kept, with `deletedAt` set, so an
 * accidental delete can be undone. Use {@link destroyDocument} to remove it
 * for good.
 */
export async function removeDocument(document: InvoiceDoc): Promise<void> {
  const { id, ...rest } = document;
  await setDoc(doc(getDb(), DOCUMENTS, id), {
    ...rest,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/** Take a job back out of the bin. */
export async function restoreDocument(document: InvoiceDoc): Promise<void> {
  const { id, ...rest } = document;
  await setDoc(doc(getDb(), DOCUMENTS, id), {
    ...rest,
    deletedAt: "",
    updatedAt: new Date().toISOString(),
  });
}

/** Remove a job permanently. Nothing brings it back except a snapshot. */
export async function destroyDocument(id: string): Promise<void> {
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


/* ------------------------------------------------------------------ backups --
 * A snapshot of every job, kept one per day in `backups/YYYY-MM-DD`.
 *
 * Today's entry is rewritten whenever the app is opened, so it always reflects
 * the latest state; earlier days stay frozen. That combination is what makes a
 * restore useful: something deleted today can be recovered from yesterday.
 *
 * An earlier version wrote once per month and never revised it, which froze
 * whatever happened to exist the first time the app was opened that month —
 * often almost nothing.
 *
 * This guards against the likely accident, a job deleted or edited by mistake.
 * It does not guard against losing the account, since it lives in the same
 * project as the data it copies; keep exporting a file for that.
 *
 * Size: a 3-item invoice is about 1.3 KB, so a snapshot of 50 jobs is ~67 KB
 * and a year of daily snapshots is ~24 MB against a 1 GiB free allowance. One
 * snapshot has to stay under Firestore's 1 MiB document limit, which is around
 * 780 jobs.
 */

export interface BackupSnapshot {
  id: string;            // "2026-09-13"
  takenAt: string;
  documentCount: number;
  company: CompanyProfile;
  documents: InvoiceDoc[];
}

/** "2026-09-13" for the day a date falls in, in local time. */
export function backupIdFor(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Write today's snapshot, replacing any earlier one from today. Cheap enough
 * to run on every app open: one write, no read.
 */
export async function saveDailyBackup(
  documents: InvoiceDoc[],
  company: CompanyProfile,
): Promise<string | null> {
  if (documents.length === 0) return null;   // nothing worth snapshotting yet
  const id = backupIdFor();
  const snapshot: Omit<BackupSnapshot, "id"> = {
    takenAt: new Date().toISOString(),
    documentCount: documents.length,
    company,
    documents,
  };
  await setDoc(doc(getDb(), BACKUPS, id), snapshot);
  return id;
}

/** Recent snapshots, newest first. Document bodies are not loaded here. */
export async function listBackups(max = 14): Promise<Array<Pick<BackupSnapshot, "id" | "takenAt" | "documentCount">>> {
  const snapshot = await getDocs(query(collection(getDb(), BACKUPS), orderBy("takenAt", "desc"), limit(max)));
  return snapshot.docs.map((d) => {
    const data = d.data() as BackupSnapshot;
    return { id: d.id, takenAt: data.takenAt, documentCount: data.documentCount ?? 0 };
  });
}

/**
 * Put back any job from a snapshot that is no longer present.
 *
 * Deliberately additive: jobs that still exist are left exactly as they are,
 * so restoring can bring back something deleted by mistake without silently
 * undoing work done since. Returns how many were restored.
 */
export async function restoreMissingFromBackup(id: string): Promise<number> {
  const snapshot = await getDoc(doc(getDb(), BACKUPS, id));
  if (!snapshot.exists()) throw new Error("That snapshot is no longer there.");
  const { documents } = snapshot.data() as BackupSnapshot;
  return uploadDocuments((documents ?? []).map(normalizeDocument));
}
