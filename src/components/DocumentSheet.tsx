"use client";

import { amountInWords, documentTotal, formatMoney, lineAmount, unitLabel } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";
import { BASE_FONT_PX, SHEET_WIDTH_PX, clampFontScale } from "@/lib/print";
import type { CompanyProfile, InvoiceDoc } from "@/lib/types";

/**
 * The printable document. This is a faithful reproduction of the layout the
 * company already sends to clients, so the output stays familiar: company
 * header, client block, bordered item table, total, amount in words, payment
 * note and signature line.
 */
export default function DocumentSheet({
  doc,
  company,
}: {
  doc: InvoiceDoc;
  company: CompanyProfile;
}) {
  // Everything inside the sheet is sized in em, so this single value scales the
  // whole document — which is what lets a long job be squeezed onto one page.
  const fontSize = BASE_FONT_PX * clampFontScale(doc.fontScale ?? 1);
  const total = documentTotal(doc.items);
  const heading = doc.kind === "invoice" ? "INVOICE" : "QUOTATION";
  const numberLabel = doc.kind === "invoice" ? "INV NO" : "QUO NO";
  const visibleItems = doc.items.filter(
    (item) => item.title.trim() || item.description.trim() || lineAmount(item) !== 0,
  );

  return (
    <article
      // No padding here, deliberately: the sheet *is* the printable content
      // box, so it must measure the same on screen as on paper. The page's
      // margins come from @page; the breathing room in the preview comes from
      // the card around it.
      className="print-sheet bg-white leading-snug text-black print:w-full"
      style={{ width: SHEET_WIDTH_PX, fontSize: `${fontSize}px` }}
    >
      <header className="text-center">
        <h1 className="text-[1.35em] font-bold tracking-wide">{company.name}</h1>
        {company.addressLine1 && <p className="mt-0.5">{company.addressLine1}</p>}
        {company.addressLine2 && <p>{company.addressLine2}</p>}
        {company.phone && <p>TEL {company.phone}</p>}
      </header>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[45%]">
          <p className="font-bold">{doc.client.company || "—"}</p>
          {doc.client.addressLine1 && <p>{doc.client.addressLine1}</p>}
          {doc.client.addressLine2 && <p>{doc.client.addressLine2}</p>}
          {doc.client.addressLine3 && <p>{doc.client.addressLine3}</p>}
        </div>
        <div className="text-left">
          <p className="text-[1.25em] font-bold tracking-wide">{heading}</p>
          <p className="mt-1">Date: {formatLongDate(doc.date) || "—"}</p>
          {doc.number.trim() && (
            <p>
              {numberLabel}: {doc.number.trim()}
            </p>
          )}
        </div>
      </div>

      <table className="mt-5 w-full border-collapse border border-black">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-center font-normal">ITEM</th>
            <th className="w-[80px] border border-black px-2 py-1 text-center font-normal sm:w-[110px]">
              UNIT
            </th>
            <th className="w-[100px] border border-black px-2 py-1 text-center font-normal sm:w-[130px]">
              TOTAL AMOUNT
              <span className="block">{company.currencyCode}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {doc.jobTitle.trim() && (
            <tr className="print-avoid-break">
              <td className="border-x border-black px-2 pt-2 font-bold uppercase">
                {doc.jobTitle.trim()}
              </td>
              {/* Empty cells keep the column rules running the full table height. */}
              <td className="border-x border-black" />
              <td className="border-x border-black" />
            </tr>
          )}

          {visibleItems.map((item, index) => (
            <tr key={item.id} className="print-avoid-break align-top">
              <td className="border-x border-black px-2 py-2">
                {item.title.trim() && (
                  <p className="font-semibold">
                    {index + 1}, {item.title.trim()}
                  </p>
                )}
                {item.description.trim() && (
                  <p className="whitespace-pre-line">{item.description.trim()}</p>
                )}
              </td>
              <td className="border-x border-black px-2 py-2 text-center">{unitLabel(item)}</td>
              <td className="border-x border-black px-2 py-2 text-right tabular-nums">
                {formatMoney(lineAmount(item))}
              </td>
            </tr>
          ))}

          {/* Blank tail row, so the ruled box keeps the shape of the paper form. */}
          <tr>
            <td className="h-6 border-x border-b border-black" />
            <td className="h-6 border-x border-b border-black" />
            <td className="h-6 border-x border-b border-black" />
          </tr>

          <tr className="print-avoid-break">
            <td className="border border-black px-2 py-1.5 font-semibold">Total Amount</td>
            <td className="border border-black px-2 py-1.5" />
            <td className="border-2 border-black px-2 py-1.5 text-right font-bold tabular-nums">
              {formatMoney(total)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 font-semibold">{amountInWords(total, company.currencyWord)}</p>

      {(company.bankAccount || company.bankName) && (
        <section className="mt-5 print-avoid-break">
          <p className="font-semibold">Note:</p>
          <p>
            *All cheque shall be crossed with &ldquo;A/C PAYEE ONLY&rdquo; and made payable to{" "}
            {company.name}.
          </p>
          <p>*All cash payment shall transfer directly to our bank account</p>
          <p className="mt-1">
            <span>{company.bankName}</span>
            <span className="ml-6 font-bold tracking-wide">{company.bankAccount}</span>
          </p>
        </section>
      )}

      {doc.notes.trim() && (
        <section className="mt-4 whitespace-pre-line print-avoid-break">{doc.notes.trim()}</section>
      )}

      <footer className="mt-10 print-avoid-break">
        <p>For {company.name}</p>
        <div className="mt-10 w-56 border-t border-black pt-1">
          {company.signatureName && <p>{company.signatureName}</p>}
        </div>
      </footer>
    </article>
  );
}
