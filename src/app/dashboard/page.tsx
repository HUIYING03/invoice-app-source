"use client";

import Link from "next/link";
import { useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, EmptyState } from "@/components/ui";
import { formatMonthKey } from "@/lib/dates";
import { formatCurrency, formatMoney } from "@/lib/money";
import { summarise } from "@/lib/analytics";
import { useData } from "@/components/DataProvider";

const MONTHS_SHOWN = 6;

export default function DashboardPage() {
  const { documents, company, loading } = useData();
  const docs = loading ? null : documents;

  const summary = useMemo(() => summarise(docs ?? [], MONTHS_SHOWN), [docs]);
  const code = company.currencyCode;

  if (docs === null) {
    return (
      <>
        <AppHeader title="Money" />
        <p className="px-4 py-16 text-center text-sm text-muted">Loading…</p>
      </>
    );
  }

  if (docs.length === 0) {
    return (
      <>
        <AppHeader title="Money" />
        <main className="mx-auto max-w-3xl px-4 py-4">
          <EmptyState
            title="No numbers yet"
            body="Once you save a few invoices, this page shows what you billed, what came in and what is still owed."
            action={
              <Link
                href="/editor?new=invoice"
                className="inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
              >
                New invoice
              </Link>
            }
          />
        </main>
      </>
    );
  }

  const peak = Math.max(1, ...summary.months.map((month) => month.invoiced));

  return (
    <>
      <AppHeader title="Money" subtitle={`Last ${MONTHS_SHOWN} months`} />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Invoiced" value={formatCurrency(summary.invoicedTotal, code)} tone="brand" />
          <Stat label="Collected" value={formatCurrency(summary.collectedTotal, code)} tone="good" />
          <Stat
            label="Still owed"
            value={formatCurrency(summary.outstandingTotal, code)}
            tone={summary.outstandingTotal > 0 ? "warn" : "plain"}
          />
          <Stat label="Quoted" value={formatCurrency(summary.quotedTotal, code)} tone="plain" />
        </div>

        <Card title="Invoiced by month">
          <ul className="space-y-3">
            {summary.months.map((month) => (
              <li key={month.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{formatMonthKey(month.key)}</span>
                  <span className="tabular-nums text-muted">
                    {month.invoiced ? formatMoney(month.invoiced) : "—"}
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-canvas"
                  role="img"
                  aria-label={`${formatMonthKey(month.key)}: invoiced ${formatCurrency(month.invoiced, code)}, collected ${formatCurrency(month.collected, code)}`}
                >
                  <div
                    className="h-full rounded-full bg-brand/25"
                    style={{ width: `${(month.invoiced / peak) * 100}%` }}
                  >
                    <div
                      className="h-full rounded-full bg-good"
                      style={{
                        width: month.invoiced ? `${(month.collected / month.invoiced) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            <Legend className="bg-good" label="Collected" />
            <Legend className="bg-brand/25" label="Invoiced, not yet paid" />
          </p>
        </Card>

        <Card title="Biggest clients">
          {summary.topClients.length === 0 ? (
            <p className="text-sm text-muted">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.topClients.map((client) => (
                <li key={client.company} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{client.company}</p>
                    <p className="text-xs text-muted">
                      {client.count} {client.count === 1 ? "invoice" : "invoices"} ·{" "}
                      {formatCurrency(client.collected, code)} collected
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatMoney(client.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="At a glance">
          <dl className="divide-y divide-line text-sm">
            <Row label="Invoices" value={String(summary.invoiceCount)} />
            <Row label="Quotations" value={String(summary.quotationCount)} />
            <Row label="Paid / unpaid" value={`${summary.paidCount} / ${summary.unpaidCount}`} />
            <Row label="Average invoice" value={formatCurrency(summary.averageInvoice, code)} />
            <Row label="Biggest invoice" value={formatCurrency(summary.largestInvoice, code)} />
          </dl>
        </Card>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "good" | "warn" | "plain";
}) {
  const tones = {
    brand: "bg-brand text-white",
    good: "bg-good text-white",
    warn: "bg-amber-50 text-warn border border-amber-200",
    plain: "bg-white border border-line",
  } as const;
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
