"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useData } from "@/components/DataProvider";
import { Card, Field, TextInput } from "@/components/ui";
import { listBackups, restoreMissingFromBackup, uploadDocuments } from "@/lib/db";
import { buildBackup, loadDocuments as loadDeviceDocuments, parseBackup } from "@/lib/storage";
import { formatShortDate } from "@/lib/dates";
import { documentTotal, formatCurrency } from "@/lib/money";
import type { CompanyProfile } from "@/lib/types";

export default function SettingsPage() {
  const { company, documents, deletedDocuments, saveCompany, restoreJob, destroyJob, user, signOutNow } = useData();
  const [draft, setDraft] = useState<CompanyProfile>(company);
  const [deviceCount, setDeviceCount] = useState(0);
  const [message, setMessage] = useState("");
  const [snapshots, setSnapshots] = useState<Array<{ id: string; takenAt: string; documentCount: number }>>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Keep the form in step with Firestore, but never overwrite a field mid-edit.
  useEffect(() => setDraft(company), [company]);

  // Jobs created before this device had an account, still in browser storage.
  useEffect(() => setDeviceCount(loadDeviceDocuments().length), []);

  // Monthly snapshots. Reloaded after a restore so the list stays truthful.
  const refreshSnapshots = () => {
    void listBackups().then(setSnapshots).catch(() => setSnapshots([]));
  };
  useEffect(refreshSnapshots, [documents.length]);

  const update = (patch: Partial<CompanyProfile>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void saveCompany(next).catch(() => setMessage("Could not save company details."));
  };

  const handleExport = () => {
    const backup = buildBackup(documents, company);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runTask = async (task: () => Promise<string>) => {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await task());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = (file: File) =>
    runTask(async () => {
      const { documents: incoming, company: incomingCompany } = parseBackup(JSON.parse(await file.text()));
      const added = await uploadDocuments(incoming);
      if (incomingCompany) await saveCompany(incomingCompany);
      return added ? `Added ${added} job${added === 1 ? "" : "s"}.` : "Nothing new to add.";
    });

  const handleUploadDevice = () =>
    runTask(async () => {
      const added = await uploadDocuments(loadDeviceDocuments());
      setDeviceCount(loadDeviceDocuments().length);
      return added
        ? `Moved ${added} job${added === 1 ? "" : "s"} into the shared account.`
        : "Those jobs are already in the account.";
    });

  return (
    <>
      <AppHeader title="Setup" subtitle={user?.email ?? undefined} />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Card title="Printed at the top">
          <div className="space-y-3">
            <Field label="Company name">
              <TextInput value={draft.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Address line 1">
              <TextInput
                value={draft.addressLine1}
                onChange={(e) => update({ addressLine1: e.target.value })}
              />
            </Field>
            <Field label="Address line 2">
              <TextInput
                value={draft.addressLine2}
                onChange={(e) => update({ addressLine2: e.target.value })}
                placeholder="(optional)"
              />
            </Field>
            <Field label="Phone">
              <TextInput
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Payment note">
          <div className="space-y-3">
            <Field label="Bank">
              <TextInput value={draft.bankName} onChange={(e) => update({ bankName: e.target.value })} />
            </Field>
            <Field label="Account number">
              <TextInput
                inputMode="numeric"
                value={draft.bankAccount}
                onChange={(e) => update({ bankAccount: e.target.value })}
              />
            </Field>
            <Field label="Signature name" hint="Prints on the signing line at the bottom.">
              <TextInput
                value={draft.signatureName}
                onChange={(e) => update({ signatureName: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Currency">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <TextInput
                value={draft.currencyCode}
                onChange={(e) => update({ currencyCode: e.target.value })}
              />
            </Field>
            <Field label="In words">
              <TextInput
                value={draft.currencyWord}
                onChange={(e) => update({ currencyWord: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        {deviceCount > 0 && (
          <Card title="Jobs still on this device">
            <p className="text-sm text-muted">
              {deviceCount} job{deviceCount === 1 ? "" : "s"} {deviceCount === 1 ? "was" : "were"}{" "}
              saved here before you signed in. Move {deviceCount === 1 ? "it" : "them"} into the
              account so both of you can see {deviceCount === 1 ? "it" : "them"}.
            </p>
            <button
              type="button"
              onClick={handleUploadDevice}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Working…" : "Move them into the account"}
            </button>
          </Card>
        )}

        <Card title="Backup">
          <p className="text-sm text-muted">
            Jobs live in the shared account, so both phone and computer already see the same list.
            A backup file is a copy you keep yourself.
          </p>
          <p className="mt-2 text-sm font-medium">
            {documents.length} job{documents.length === 1 ? "" : "s"} in the account.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              Export backup
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              Import backup
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = "";
            }}
          />
          {message && <p className="mt-3 text-sm font-medium text-good">{message}</p>}
        </Card>

        <Card title="Bin">
          <p className="text-sm text-muted">
            Deleted jobs are kept here rather than thrown away, so a mistake can be undone.
          </p>
          {deletedDocuments.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing deleted.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {deletedDocuments.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.client.company || "(no client)"}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(documentTotal(job.items), company.currencyCode)} · deleted{" "}
                      {formatShortDate(job.deletedAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runTask(async () => { await restoreJob(job); return "Put back."; })}
                      className="rounded-lg border border-line px-3 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      Put back
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Delete this for good? This cannot be undone.")) return;
                        void runTask(async () => { await destroyJob(job.id); return "Deleted for good."; });
                      }}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60"
                    >
                      Forever
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Saved snapshots">
          <p className="text-sm text-muted">
            A copy of every job is saved each day the app is used. Restoring puts back
            anything that has since been deleted; jobs you still have are left untouched.
          </p>
          {snapshots.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              None yet — the first is saved next time the app is opened with at least one job.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {snapshots.map((snap) => (
                <li key={snap.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{snap.id}</p>
                    <p className="text-xs text-muted">
                      {snap.documentCount} job{snap.documentCount === 1 ? "" : "s"} ·{" "}
                      {formatShortDate(snap.takenAt.slice(0, 10))}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runTask(async () => {
                        const restored = await restoreMissingFromBackup(snap.id);
                        refreshSnapshots();
                        return restored
                          ? `Put back ${restored} job${restored === 1 ? "" : "s"}.`
                          : "Nothing was missing.";
                      })
                    }
                    className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Account">
          <p className="text-sm text-muted">Signed in as {user?.email}.</p>
          <button
            type="button"
            onClick={() => void signOutNow()}
            className="mt-4 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
          >
            Sign out
          </button>
        </Card>
      </main>
    </>
  );
}
