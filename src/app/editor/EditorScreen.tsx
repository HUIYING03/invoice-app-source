"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import DocumentSheet from "@/components/DocumentSheet";
import SheetScaler from "@/components/SheetScaler";
import ItemEditor from "@/components/ItemEditor";
import { Card, Field, STATUS_LABELS, TextArea, TextInput } from "@/components/ui";
import { documentTotal, formatCurrency } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { useData } from "@/components/DataProvider";
import { emptyDocument, emptyItem, newId } from "@/lib/storage";
import { suggestNumberFrom } from "@/lib/numbering";
import type { CompanyProfile, DocKind, DocStatus, InvoiceDoc, LineItem } from "@/lib/types";

type Tab = "edit" | "preview";

export default function EditorScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const idParam = params.get("id");
  const newKind = params.get("new") as DocKind | null;

  const {
    documents,
    company,
    loading,
    saveDocument: persistDocument,
    deleteDocument: removeDocument,
  } = useData();
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [dirty, setDirty] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Seed the form once: an existing job, or a new one with the next number.
  // Later updates from other devices must not clobber what is being typed, so
  // this deliberately runs only while `doc` is still empty.
  useEffect(() => {
    if (doc || loading) return;
    if (idParam) {
      const found = documents.find((candidate) => candidate.id === idParam);
      if (found) setDoc(found);
      else setNotFound(true);
      return;
    }
    const kind: DocKind = newKind === "quotation" ? "quotation" : "invoice";
    const fresh = emptyDocument(kind);
    fresh.number = suggestNumberFrom(documents, kind, fresh.date);
    setDoc(fresh);
    setDirty(true);
  }, [doc, loading, documents, idParam, newKind]);

  const total = useMemo(() => (doc ? documentTotal(doc.items) : 0), [doc]);

  const update = useCallback((patch: Partial<InvoiceDoc>) => {
    setDoc((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  }, []);

  const updateItem = useCallback((itemId: string, patch: Partial<LineItem>) => {
    setDoc((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
    setDirty(true);
  }, []);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setDoc((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.items.length) return current;
      const items = [...current.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
    setDirty(true);
  }, []);

  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!doc || saving) return;
    setSaving(true);
    try {
      const saved = await persistDocument(doc);
      setDoc(saved);
      setDirty(false);
      showToast("Saved");
      if (!idParam) router.replace(`/editor?id=${saved.id}`);
    } catch (cause) {
      showToast(cause instanceof Error ? `Could not save: ${cause.message}` : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [doc, saving, persistDocument, idParam, router, showToast]);

  // Warn before losing unsaved edits to a refresh or a closed tab.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-base font-semibold">This job was not found.</p>
        <p className="mt-1 text-sm text-muted">
          It may have been deleted, or saved on another device.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
        >
          Back to jobs
        </Link>
      </main>
    );
  }

  if (!doc) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Loading…</p>;
  }

  const kindLabel = doc.kind === "invoice" ? "Invoice" : "Quotation";

  return (
    <>
      <AppHeader
        title={doc.client.company || `New ${kindLabel.toLowerCase()}`}
        subtitle={doc.number ? `${kindLabel} ${doc.number}` : kindLabel}
        back={{ href: "/", label: "Back to jobs" }}
        action={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-60 ${
              dirty ? "bg-brand text-white" : "bg-canvas text-muted"
            }`}
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        }
      />

      <div className="no-print sticky top-[57px] z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 px-4 py-2">
          {(["edit", "preview"] as Tab[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              aria-pressed={tab === option}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition ${
                tab === option
                  ? "bg-ink text-white"
                  : "bg-canvas text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-4 print:max-w-none print:p-0">
        {tab === "edit" ? (
          <EditForm
            doc={doc}
            company={company}
            update={update}
            updateItem={updateItem}
            moveItem={moveItem}
            onAddItem={() => update({ items: [...doc.items, emptyItem()] })}
            onRemoveItem={(itemId) =>
              update({ items: doc.items.filter((item) => item.id !== itemId) })
            }
            onDuplicate={async () => {
              if (dirty) {
                showToast("Save first, then make a copy.");
                return;
              }
              const now = new Date().toISOString();
              const copy: InvoiceDoc = {
                ...doc,
                id: newId(),
                number: suggestNumberFrom(documents, doc.kind, todayISO()),
                date: todayISO(),
                status: "draft",
                paidDate: "",
                items: doc.items.map((item) => ({ ...item, id: newId() })),
                createdAt: now,
                updatedAt: now,
              };
              try {
                await persistDocument(copy);
                router.push(`/editor?id=${copy.id}`);
              } catch {
                showToast("Could not make a copy.");
              }
            }}
            onDelete={async () => {
              if (!window.confirm("Delete this job for good?")) return;
              try {
                await removeDocument(doc.id);
                router.push("/");
              } catch {
                showToast("Could not delete.");
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="no-print flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                Print / Save as PDF
              </button>
            </div>
            <p className="no-print text-center text-xs text-muted">
              On a phone, choose “Save as PDF” in the print dialog to send it by WhatsApp.
            </p>
            <div className="rounded-2xl border border-line bg-white p-2 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
              <SheetScaler>
                <DocumentSheet doc={doc} company={company} />
              </SheetScaler>
            </div>
          </div>
        )}
      </main>

      {/* Running total, always visible above the tab bar. */}
      <div
        className="no-print fixed inset-x-0 bottom-[64px] z-20 border-t border-line bg-white/95 backdrop-blur"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-sm font-medium text-muted">Total</span>
          <span className="text-xl font-bold tabular-nums">
            {formatCurrency(total, company.currencyCode)}
          </span>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="no-print fixed inset-x-0 bottom-32 z-40 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}

function EditForm({
  doc,
  company,
  update,
  updateItem,
  moveItem,
  onAddItem,
  onRemoveItem,
  onDuplicate,
  onDelete,
}: {
  doc: InvoiceDoc;
  company: CompanyProfile;
  update: (patch: Partial<InvoiceDoc>) => void;
  updateItem: (itemId: string, patch: Partial<LineItem>) => void;
  moveItem: (index: number, direction: -1 | 1) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 pb-28">
      <Card title="Document">
        <div className="space-y-3">
          <div className="flex gap-2 rounded-xl bg-canvas p-1">
            {(["invoice", "quotation"] as DocKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => update({ kind })}
                aria-pressed={doc.kind === kind}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                  doc.kind === kind ? "bg-white shadow-sm" : "text-muted"
                }`}
              >
                {kind}
              </button>
            ))}
          </div>

          {/* Side by side only when there is room: a native date input needs
              roughly 140px, and below that the year is clipped by the calendar
              icon. */}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {/* No hint here: iOS renders this input as "13 Sep 2026" already,
                so echoing the long form underneath just reads as a duplicate. */}
            <Field label="Date">
              <TextInput
                type="date"
                value={doc.date}
                onChange={(event) => update({ date: event.target.value || todayISO() })}
              />
            </Field>
            <Field label="Number" hint="Counts up on its own.">
              <TextInput
                value={doc.number}
                onChange={(event) => update({ number: event.target.value })}
                placeholder="023/2026"
              />
            </Field>
          </div>

          <Field label="Status">
            <div className="flex gap-2 rounded-xl bg-canvas p-1">
              {(["draft", "sent", "paid"] as DocStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    update({
                      status,
                      paidDate: status === "paid" ? doc.paidDate || todayISO() : "",
                    })
                  }
                  aria-pressed={doc.status === status}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    doc.status === status ? "bg-white shadow-sm" : "text-muted"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Client">
        <div className="space-y-3">
          <Field label="Company or name">
            <TextInput
              value={doc.client.company}
              onChange={(event) => update({ client: { ...doc.client, company: event.target.value } })}
              placeholder="Lam Soon @ KKIP"
            />
          </Field>
          <Field label="Address" hint="Three lines, exactly as it should print.">
            <div className="space-y-2">
              <TextInput
                value={doc.client.addressLine1}
                onChange={(event) =>
                  update({ client: { ...doc.client, addressLine1: event.target.value } })
                }
                placeholder="No 11, JLN Timur"
              />
              <TextInput
                value={doc.client.addressLine2}
                onChange={(event) =>
                  update({ client: { ...doc.client, addressLine2: event.target.value } })
                }
                placeholder="Zone 13"
              />
              <TextInput
                value={doc.client.addressLine3}
                onChange={(event) =>
                  update({ client: { ...doc.client, addressLine3: event.target.value } })
                }
                placeholder="(optional)"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card title="The job">
        <Field label="Heading" hint="Prints in bold above the items.">
          <TextInput
            value={doc.jobTitle}
            onChange={(event) => update({ jobTitle: event.target.value })}
            placeholder={'Sliding gate upgrade and repaint (36’0" wide x 6’0" high)'}
          />
        </Field>
      </Card>

      <div className="space-y-3">
        <h2 className="px-1 text-base font-semibold">Items</h2>
        {doc.items.map((item, index) => (
          <ItemEditor
            key={item.id}
            item={item}
            index={index}
            currencyCode={company.currencyCode}
            canRemove={doc.items.length > 1}
            onChange={(patch) => updateItem(item.id, patch)}
            onRemove={() => onRemoveItem(item.id)}
            onMove={(direction) => moveItem(index, direction)}
          />
        ))}
        <button
          type="button"
          onClick={onAddItem}
          className="w-full rounded-2xl border-2 border-dashed border-line bg-white py-4 text-sm font-semibold text-brand transition active:scale-[0.99]"
        >
          + Add another item
        </button>
      </div>

      <Card title="Extra note" >
        <Field label="Anything else to print" hint="Leave blank if not needed.">
          <TextArea
            rows={3}
            value={doc.notes}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="e.g. Work to start after deposit received."
          />
        </Field>
      </Card>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDuplicate}
          className="flex-1 rounded-xl border border-line bg-white py-3 text-sm font-semibold"
        >
          Make a copy
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
