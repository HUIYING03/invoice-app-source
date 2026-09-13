"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, EmptyState, StatusPill, TextInput } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { documentTotal, formatCurrency } from "@/lib/money";
import { loadCompany, loadDocuments } from "@/lib/storage";
import { DEFAULT_COMPANY, type CompanyProfile, type InvoiceDoc } from "@/lib/types";

type Filter = "all" | "invoice" | "quotation" | "unpaid";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "invoice", label: "Invoices" },
  { id: "quotation", label: "Quotations" },
  { id: "unpaid", label: "Not paid" },
];

export default function JobsPage() {
  const [docs, setDocs] = useState<InvoiceDoc[] | null>(null);
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setDocs(loadDocuments());
    setCompany(loadCompany());
  }, []);

  const visible = useMemo(() => {
    if (!docs) return [];
    const needle = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (filter === "invoice" && doc.kind !== "invoice") return false;
      if (filter === "quotation" && doc.kind !== "quotation") return false;
      if (filter === "unpaid" && (doc.kind !== "invoice" || doc.status === "paid")) return false;
      if (!needle) return true;
      return [doc.client.company, doc.jobTitle, doc.number, doc.client.addressLine1]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [docs, filter, query]);

  const outstanding = useMemo(() => {
    if (!docs) return 0;
    return docs
      .filter((doc) => doc.kind === "invoice" && doc.status !== "paid")
      .reduce((sum, doc) => sum + documentTotal(doc.items), 0);
  }, [docs]);

  return (
    <>
      <AppHeader
        title="Jobs"
        subtitle={company.name}
        action={
          <Link
            href="/editor?new=invoice"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95"
          >
            + New
          </Link>
        }
      />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {docs === null ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : docs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            body="Create your first invoice or quotation. Type the client, the work and the prices — the app does the formatting and the adding up."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/editor?new=invoice"
                  className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white"
                >
                  New invoice
                </Link>
                <Link
                  href="/editor?new=quotation"
                  className="rounded-xl border border-line px-5 py-3 text-sm font-semibold"
                >
                  New quotation
                </Link>
              </div>
            }
          />
        ) : (
          <>
            {outstanding > 0 && (
              <Card className="!bg-brand !border-transparent text-white">
                <p className="text-xs uppercase tracking-wide text-white/70">Still to collect</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {formatCurrency(outstanding, company.currencyCode)}
                </p>
              </Card>
            )}

            <TextInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, job or number"
              aria-label="Search jobs"
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    filter === option.id
                      ? "bg-ink text-white"
                      : "border border-line bg-white text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <EmptyState title="Nothing matches" body="Try a different search or filter." />
            ) : (
              <ul className="space-y-3">
                {visible.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/editor?id=${doc.id}`}
                      className="block rounded-2xl border border-line bg-white p-4 shadow-sm transition active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {doc.client.company || "(no client)"}
                          </p>
                          <p className="truncate text-sm text-muted">
                            {doc.jobTitle || "(no job description)"}
                          </p>
                        </div>
                        <StatusPill status={doc.status} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="truncate text-xs text-muted">
                          {doc.kind === "invoice" ? "Invoice" : "Quotation"}
                          {doc.number ? ` ${doc.number}` : ""} · {formatShortDate(doc.date)}
                        </p>
                        <p className="shrink-0 whitespace-nowrap text-lg font-bold tabular-nums">
                          {formatCurrency(documentTotal(doc.items), company.currencyCode)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
