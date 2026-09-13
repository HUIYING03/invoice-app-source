# Invoice & Quotation

A small phone-first web app for writing up renovation jobs: type the client, the
work and the prices, and get a printable invoice or quotation in the same layout
the company already sends out.

It replaces a two-step routine — one person typing the job on a phone, another
retyping and formatting it on a computer — with a single form that does the
formatting and the arithmetic itself.

## What it does

- **Write a job** on a phone: client, address, date, number, and any number of
  items. Each item can be a lump sum (`RM 1,980.00`) or a rate
  (`65 ft run @ 18.30`), which the app multiplies out.
- **Preview exactly what prints.** The preview is the A4 page itself, scaled to
  fit the screen, so nothing shifts between phone, computer and paper.
- **Print or save as PDF** with the browser's own print dialog — handy for
  sending over WhatsApp.
- **Keep every job** in a searchable list, filterable by invoice, quotation or
  unpaid, with a running total of what is still owed.
- **See the money** on a dashboard: invoiced, collected, outstanding and quoted;
  a six-month trend; biggest clients; averages.

The totals, the amount in words (`Ringgit Malaysia: Eight Thousand Five Hundred
Fifty Only`) and the payment note are all generated, so they cannot drift out of
step with the figures above them.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Static production build into `out/` |
| `npm test` | Unit tests for the money, analytics and storage logic |
| `npm run typecheck` | TypeScript, no emit |
| `npm run check` | Typecheck, tests and build together |

## Deploying

`npm run build` produces a plain static site in `out/`. There is no server and
no database, so it can be hosted free on Vercel, Netlify, GitHub Pages or any
static host. On a phone, open the site and use **Add to Home Screen** to get an
app icon.

## Where the data lives

Jobs are saved in the browser's `localStorage` **on the device that created
them**. Nothing is uploaded anywhere.

That means a job written on the phone will not appear on the computer by itself.
**Setup → Backup** exports a JSON file covering every job and the company
details, and importing it on another device merges the two — matching jobs by
id and keeping whichever copy was edited most recently.

If shared, always-in-sync data is wanted later, `src/lib/storage.ts` is the only
file that touches storage; swapping it for an API client is the whole change.

## How it is put together

```
src/
  app/
    page.tsx              Job list, search and filters
    editor/               Edit/preview screen — the main form
    dashboard/            Revenue and client analytics
    settings/             Company details, currency, backup
  components/
    DocumentSheet.tsx     The printable A4 document
    SheetScaler.tsx       Fits the fixed-width sheet onto small screens
    ItemEditor.tsx        One line of work
  lib/
    money.ts              Line/document totals, formatting, number-to-words
    analytics.ts          Dashboard roll-ups
    storage.ts            Persistence, numbering, backup import/export
    dates.ts              Date formatting and month buckets
tests/                    Unit tests for lib/
```

Built with Next.js (static export), React and Tailwind CSS.

### Notes on the printed page

`DocumentSheet` is authored at a fixed 720px — A4 (210mm) less the 12mm print
margins, at 96dpi — rather than as a responsive layout, so the on-screen preview
and the paper output cannot disagree. Printing hides everything except
`.print-sheet`; `SheetScaler`'s transform is dropped at print time.

Item numbering, the total, the amount in words and the bank note are derived
from the document, so only real content needs typing.
