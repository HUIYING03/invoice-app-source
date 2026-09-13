"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, Field, TextInput } from "@/components/ui";
import { exportBackup, importBackup, loadCompany, loadDocuments, saveCompany } from "@/lib/storage";
import { DEFAULT_COMPANY, type CompanyProfile } from "@/lib/types";

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [docCount, setDocCount] = useState(0);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompany(loadCompany());
    setDocCount(loadDocuments().length);
  }, []);

  const update = (patch: Partial<CompanyProfile>) => {
    const next = { ...company, ...patch };
    setCompany(next);
    saveCompany(next);
  };

  const handleExport = () => {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const result = importBackup(JSON.parse(await file.text()));
      setCompany(loadCompany());
      setDocCount(loadDocuments().length);
      setMessage(`Added ${result.added}, updated ${result.updated}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That file could not be read.");
    }
  };

  return (
    <>
      <AppHeader title="Setup" subtitle="Your company details" />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Card title="Printed at the top">
          <div className="space-y-3">
            <Field label="Company name">
              <TextInput value={company.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Address line 1">
              <TextInput
                value={company.addressLine1}
                onChange={(e) => update({ addressLine1: e.target.value })}
              />
            </Field>
            <Field label="Address line 2">
              <TextInput
                value={company.addressLine2}
                onChange={(e) => update({ addressLine2: e.target.value })}
                placeholder="(optional)"
              />
            </Field>
            <Field label="Phone">
              <TextInput
                inputMode="tel"
                value={company.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Payment note">
          <div className="space-y-3">
            <Field label="Bank">
              <TextInput
                value={company.bankName}
                onChange={(e) => update({ bankName: e.target.value })}
              />
            </Field>
            <Field label="Account number">
              <TextInput
                inputMode="numeric"
                value={company.bankAccount}
                onChange={(e) => update({ bankAccount: e.target.value })}
              />
            </Field>
            <Field label="Signature name" hint="Prints on the signing line at the bottom.">
              <TextInput
                value={company.signatureName}
                onChange={(e) => update({ signatureName: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Currency">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <TextInput
                value={company.currencyCode}
                onChange={(e) => update({ currencyCode: e.target.value })}
              />
            </Field>
            <Field label="In words">
              <TextInput
                value={company.currencyWord}
                onChange={(e) => update({ currencyWord: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Backup">
          <p className="text-sm text-muted">
            Jobs are saved on this device only. Export a backup file to keep a copy, or to move
            jobs between the phone and the computer.
          </p>
          <p className="mt-2 text-sm font-medium">
            {docCount} {docCount === 1 ? "job" : "jobs"} saved here.
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
              className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
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
      </main>
    </>
  );
}
