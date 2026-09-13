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
- **Share one list.** Both people sign in to the same account, so a job typed on
  the phone appears on the computer at once, with no file passing in between.

The totals, the amount in words (`Ringgit Malaysia: Eight Thousand Five Hundred
Fifty Only`) and the payment note are all generated, so they cannot drift out of
step with the figures above them.

## Running it

Needs **Node 20.9 or newer** (Next 16 refuses to build on anything older, and the
test runner's `--import` flag needs >= 18.19). With nvm:

```bash
nvm use         # reads .nvmrc
npm install
npm run dev     # http://localhost:3000
```

If the build stops with `Cannot find native binding`, npm skipped Tailwind's
platform-specific binary ([npm#4828](https://github.com/npm/cli/issues/4828)) —
older npm versions do this. `rm -rf node_modules && npm ci` with npm 10+ fixes
it; the lockfile already lists every platform.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Static production build into `out/` |
| `npm test` | Unit tests for the money, analytics and storage logic |
| `npm run typecheck` | TypeScript, no emit |
| `npm run check` | Typecheck, tests and build together |

### Opening it on a phone

`npm run dev` prints a Network URL (e.g. `http://192.168.0.5:3000`). Next blocks
cross-origin requests to dev assets and the HMR socket, so that URL loads the
HTML but never hydrates — the page sits on "Loading…" — unless the address is
listed in `allowedDevOrigins` in `next.config.ts`. The `192.168.*` entries there
cover a typical home network; if the Mac's address falls outside them, add it
(hostname only, no `http://` and no port) and restart the dev server.

For everyday use, prefer the real build over the dev server. `npm run build`
produces `out/`, a plain static site that none of this applies to — serve it on
the network, or deploy it and skip the laptop entirely.

## Where the data lives

Jobs live in **Firebase Firestore** under a single shared login, so whatever is
typed on the phone shows up on the computer straight away, and the other way
round. Firestore's offline cache means the app still works with no signal and
catches up when the connection returns.

`src/lib/db.ts` is the only file that talks to Firestore. `src/lib/storage.ts`
still reads the browser storage used before there was an account, so those jobs
can be moved across once from **Setup → Jobs still on this device**.

### Setting up the database

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Firestore Database → Create database.** Pick a region near you
   (`asia-southeast1` for Malaysia). Start in production mode; the rules below
   replace whatever it starts with.
3. **Build → Authentication → Get started → Email/Password → Enable.**
   Then **Users → Add user** and create the one shared login your parents will
   both use.
4. **Project settings → General → Your apps → Web (`</>`)**. Register the app
   and copy the config values.
5. `cp .env.example .env.local` and paste those values in.
6. **Firestore Database → Rules**, paste the contents of `firestore.rules`, and
   press Publish. Without this step the database is either wide open or shut.

The values in `.env.local` are not secrets — a Firebase web config is meant to
ship in the browser bundle. What protects the data is `firestore.rules` plus
signing in. Verified behaviour: signed out, every read and write is denied;
signed in, only `documents` and `settings` are reachable.

### Trying it without touching real data

With Java 21+ and the Firebase CLI:

```bash
firebase emulators:start --project demo-invoice --only auth,firestore
```

Set `NEXT_PUBLIC_FIREBASE_EMULATOR=1` in `.env.local` and the app talks to the
emulators instead of the real project. Remember to remove that line afterwards.

## Deploying

The app is a static site, so it can go anywhere. On Vercel:

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo. The framework is
   detected; no build settings need changing.
3. **Settings → Environment Variables**: add the same six
   `NEXT_PUBLIC_FIREBASE_*` values from `.env.local`. Do **not** add
   `NEXT_PUBLIC_FIREBASE_EMULATOR`.
4. Deploy. Every later `git push` redeploys on its own.
5. Back in Firebase, **Authentication → Settings → Authorised domains**, add the
   Vercel domain, or sign-in will be refused there.

On a phone, open the URL and use **Add to Home Screen** for an app icon.

## How it is put together

```
src/
  app/
    page.tsx              Job list, search and filters
    editor/               Edit/preview screen — the main form
    dashboard/            Revenue and client analytics
    settings/             Company details, currency, backup
  components/
    DataProvider.tsx      Auth state and the live view of Firestore
    AuthGate.tsx          Sign-in screen; everything else sits behind it
    DocumentSheet.tsx     The printable A4 document
    SheetScaler.tsx       Fits the fixed-width sheet onto small screens
    ItemEditor.tsx        One line of work
  lib/
    firebase.ts           SDK setup, offline cache, emulator switch
    db.ts                 Firestore reads, writes and live subscriptions
    money.ts              Line/document totals, formatting, number-to-words
    analytics.ts          Dashboard roll-ups
    numbering.ts          Next running number for a year
    normalize.ts          Fills in fields added after a document was written
    storage.ts            Pre-account browser storage, and backup files
    dates.ts              Date formatting and month buckets
firestore.rules           Who may read and write; the only access control
tests/                    Unit tests for lib/
```

Built with Next.js (static export), React, Tailwind CSS and Firebase. The whole
app runs in the browser — there is no server of our own, which is why the
Firestore rules carry the weight.

### Notes on the printed page

`DocumentSheet` is authored at a fixed 720px — A4 (210mm) less the 12mm print
margins, at 96dpi — rather than as a responsive layout, so the on-screen preview
and the paper output cannot disagree. Printing hides everything except
`.print-sheet`; `SheetScaler`'s transform is dropped at print time.

Item numbering, the total, the amount in words and the bank note are derived
from the document, so only real content needs typing.
