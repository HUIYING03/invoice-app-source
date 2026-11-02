"use client";

import { amountInWords, documentTotal, formatMoney, lineAmount, unitLabel } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";
import { fixLevels, hasChildren, itemNumbers, levelOf } from "@/lib/items";
import {
  BASE_FONT_PX,
  SHEET_WIDTH_PX,
  clampFontScale,
  clampSpacing,
  clampTopSpace,
  mmToPx,
} from "@/lib/print";
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
  // Spacing is in px at 1x — the same gaps the sheet always had — and is
  // stretched or tightened by the user's layout setting.
  const sectionScale = clampSpacing(doc.sectionSpacing ?? 1);
  const itemScale = clampSpacing(doc.itemSpacing ?? 1);
  const gap = (px: number) => ({ marginTop: `${px * sectionScale}px` });
  const rowPad = (px: number) => ({ paddingTop: `${px * itemScale}px`, paddingBottom: `${px * itemScale}px` });
  const total = documentTotal(doc.items);
  const heading = doc.kind === "invoice" ? "INVOICE" : "QUOTATION";
  const numberLabel = doc.kind === "invoice" ? "INV NO" : "QUO NO";
  // Blank lines are left off the page; re-check the nesting afterwards so a
  // sub-item whose blank parent was dropped still numbers sensibly.
  const visibleItems = fixLevels(
    doc.items.filter(
      (item) => item.title.trim() || item.description.trim() || lineAmount(item) !== 0,
    ),
  );
  const numbers = itemNumbers(visibleItems);

  return (
    <article
      // No padding here, deliberately: the sheet *is* the printable content
      // box, so it must measure the same on screen as on paper. The page's
      // margins come from @page; the breathing room in the preview comes from
      // the card around it.
      className="print-sheet bg-white leading-snug text-black print:w-full"
      style={{
        width: SHEET_WIDTH_PX,
        fontSize: `${fontSize}px`,
        // Padding, not margin, so the space is part of the measured sheet and
        // the page count still tells the truth.
        paddingTop: `${mmToPx(clampTopSpace(doc.topSpace ?? 0))}px`,
      }}
    >
      <header className="text-center">
        <h1 className="text-[1.35em] font-bold tracking-wide">{company.name}</h1>
        {company.addressLine1 && <p className="mt-0.5">{company.addressLine1}</p>}
        {company.addressLine2 && <p>{company.addressLine2}</p>}
        {company.phone && <p>TEL {company.phone}</p>}
      </header>

      <div className="flex flex-wrap items-start justify-between gap-6" style={gap(24)}>
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

      <table className="w-full border-collapse border border-black" style={gap(20)}>
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
              <td
                className="border-x border-black px-2 font-bold uppercase"
                style={{ paddingTop: `${8 * itemScale}px` }}
              >
                {doc.jobTitle.trim()}
              </td>
              {/* Empty cells keep the column rules running the full table height. */}
              <td className="border-x border-black" />
              <td className="border-x border-black" />
            </tr>
          )}

          {visibleItems.map((item, index) => {
            const level = levelOf(item);
            const amount = lineAmount(item);
            // A heading over priced sub-items, or an unpriced sub-point, leaves
            // the amount column blank rather than printing 0.00.
            const blankAmount = amount === 0 && (level > 0 || hasChildren(visibleItems, index));
            const pad = rowPad(level === 0 ? 8 : 4);
            const title = item.title.trim();
            const description = item.description.trim();
            return (
              <tr key={item.id} className="print-avoid-break align-top">
                <td
                  className="border-x border-black px-2"
                  style={level > 0 ? { ...pad, paddingLeft: `${0.5 + level * 1.5}em` } : pad}
                >
                  {title && (
                    <p className={level === 0 ? "font-semibold" : "font-medium"}>
                      {numbers[index]} {title}
                    </p>
                  )}
                  {description && (
                    <p className="whitespace-pre-line">
                      {/* Untitled sub-points still need their a. / i. label. */}
                      {!title && level > 0 ? `${numbers[index]} ` : ""}
                      {description}
                    </p>
                  )}
                </td>
                <td className="border-x border-black px-2 text-center" style={pad}>
                  {unitLabel(item)}
                </td>
                <td className="border-x border-black px-2 text-right tabular-nums" style={pad}>
                  {blankAmount ? "" : formatMoney(amount)}
                </td>
              </tr>
            );
          })}

          {/* Blank tail row, so the ruled box keeps the shape of the paper form. */}
          <tr style={{ height: `${24 * itemScale}px` }}>
            <td className="border-x border-b border-black" />
            <td className="border-x border-b border-black" />
            <td className="border-x border-b border-black" />
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

      <p className="font-semibold" style={gap(12)}>{amountInWords(total, company.currencyWord)}</p>

      {(company.bankAccount || company.bankName) && (
        <section className="print-avoid-break" style={gap(20)}>
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
        <section className="whitespace-pre-line print-avoid-break" style={gap(16)}>{doc.notes.trim()}</section>
      )}

      <footer className="print-avoid-break" style={gap(40)}>
        <p>For {company.name}</p>
        <div className="w-56 border-t border-black pt-1" style={gap(40)}>
          {company.signatureName && <p>{company.signatureName}</p>}
        </div>
      </footer>
    </article>
  );
}
