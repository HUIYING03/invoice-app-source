"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { firebaseConfigError, getFirebaseAuth } from "@/lib/firebase";
import {
  destroyDocument,
  putCompany,
  putDocument,
  removeDocument,
  restoreDocument,
  saveDailyBackup,
  subscribeCompany,
  subscribeDocuments,
} from "@/lib/db";
import { DEFAULT_COMPANY, type CompanyProfile, type InvoiceDoc } from "@/lib/types";

interface DataState {
  /** null while auth is still resolving, so the UI can avoid flashing sign-in. */
  user: User | null;
  authResolved: boolean;
  configError: string | null;
  loading: boolean;
  error: string | null;
  /** Live jobs, with anything in the bin filtered out. */
  documents: InvoiceDoc[];
  /** Jobs in the bin, newest deletion first. */
  deletedDocuments: InvoiceDoc[];
  /** Everything, bin included — used for numbering so ids are never reused. */
  allDocuments: InvoiceDoc[];
  company: CompanyProfile;
  signIn: (email: string, password: string) => Promise<void>;
  signOutNow: () => Promise<void>;
  saveDocument: (doc: InvoiceDoc) => Promise<InvoiceDoc>;
  /** Moves a job to the bin; reversible with restoreJob. */
  deleteDocument: (doc: InvoiceDoc) => Promise<void>;
  restoreJob: (doc: InvoiceDoc) => Promise<void>;
  destroyJob: (id: string) => Promise<void>;
  saveCompany: (company: CompanyProfile) => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

export function useData(): DataState {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside <DataProvider>");
  return context;
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const configError = useMemo(() => firebaseConfigError(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [documents, setDocuments] = useState<InvoiceDoc[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configError) {
      setAuthResolved(true);
      setLoading(false);
      return undefined;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setAuthResolved(true);
      if (!next) {
        setDocuments([]);
        setCompany(DEFAULT_COMPANY);
        setLoading(false);
      }
    });
  }, [configError]);

  // Live subscriptions, torn down on sign-out so a later user starts clean.
  useEffect(() => {
    if (configError || !user) return undefined;
    setLoading(true);
    let gotDocuments = false;

    const fail = (cause: Error) => {
      setError(cause.message);
      setLoading(false);
    };

    const stopDocuments = subscribeDocuments((next) => {
      setDocuments(next);
      gotDocuments = true;
      setLoading(false);
      setError(null);
    }, fail);

    const stopCompany = subscribeCompany((next) => {
      setCompany(next);
      if (gotDocuments) setLoading(false);
    }, fail);

    return () => {
      stopDocuments();
      stopCompany();
    };
  }, [configError, user]);

  // Snapshot today's data once per session, after the data has settled.
  // A failure here must never interrupt the app, so it only logs.
  const backupAttempted = useRef(false);
  useEffect(() => {
    if (configError || !user || loading || documents.length === 0) return;
    if (backupAttempted.current) return;
    backupAttempted.current = true;
    saveDailyBackup(documents, company)   // includes binned jobs, deliberately
      .then((id) => id && console.info(`Backup saved: ${id}`))
      .catch((cause) => console.warn("Could not save the backup", cause));
  }, [configError, user, loading, documents, company]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const saveDocument = useCallback(async (document: InvoiceDoc) => {
    const saved = { ...document, updatedAt: new Date().toISOString() };
    await putDocument(saved);
    return saved;
  }, []);

  const deleteDocument = useCallback(async (document: InvoiceDoc) => {
    await removeDocument(document);
  }, []);

  const restoreJob = useCallback(async (document: InvoiceDoc) => {
    await restoreDocument(document);
  }, []);

  const destroyJob = useCallback(async (id: string) => {
    await destroyDocument(id);
  }, []);

  const saveCompany = useCallback(async (next: CompanyProfile) => {
    setCompany(next); // optimistic, so typing in Setup stays responsive
    await putCompany(next);
  }, []);

  const live = useMemo(() => documents.filter((d) => !d.deletedAt), [documents]);
  const binned = useMemo(
    () => documents.filter((d) => !!d.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [documents],
  );

  const value = useMemo<DataState>(
    () => ({
      user,
      authResolved,
      configError,
      loading,
      error,
      documents: live,
      deletedDocuments: binned,
      allDocuments: documents,
      company,
      signIn,
      signOutNow,
      saveDocument,
      deleteDocument,
      restoreJob,
      destroyJob,
      saveCompany,
    }),
    [user, authResolved, configError, loading, error, live, binned, documents, company, signIn, signOutNow, saveDocument, deleteDocument, restoreJob, destroyJob, saveCompany],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
