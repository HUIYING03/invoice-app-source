# Engineering notes

How this app got built, and why it is the way it is.

This is not a changelog or an API reference. It is the reasoning behind the
decisions: what was considered, what was rejected, and what the mistakes taught.
Read it when you want to know *why* a piece of code looks the way it does, or
when you are about to make a similar call somewhere else.

Every example is real. The bugs described here actually shipped.

---

## 1. The problem

Before any code existed, the workflow was:

1. Dad types a job into his phone — client, work done, prices — as loose text.
2. Mum retypes it on a computer, formats it into the company's invoice layout,
   and prints it.

Step 2 is the waste. It is pure re-entry of information that already exists,
plus manual arithmetic that can go wrong.

So the goal was never "build an invoicing app". It was **delete step 2**. That
framing decided almost everything that follows: if the output does not look like
what the company already sends to clients, mum still has to reformat it, and the
app has failed no matter how nice it is.

### Start from the real artifact

The first thing done was not writing code. It was reading two real invoice PDFs
and a photo of a finished, printed invoice, and extracting their exact structure:
the header block, the ruled `ITEM | UNIT | TOTAL AMOUNT` table, the amount in
words, the cheque note, the signature line.

Then the app was tested by **re-entering those same two invoices and checking the
totals came out identical** — RM 8,550.00 and RM 6,087.00.

> **Gut to build:** when you are replacing an existing manual process, get the
> real artifact first and treat it as the specification. A test that reproduces a
> known-good real-world output is worth more than a dozen invented ones, because
> it fails when you have misunderstood the domain, not just the code.

One detail this surfaced: the original Cold Gear invoice has a typo — a line
reads `Rm4,537,50` with a comma where the decimal point belongs. The app computes
`275 × 16.50 = 4,537.50` and the document total still matches. Reproducing real
data tells you things about the domain (here: these are hand-typed, and typos
happen) that you would never invent.

---

## 2. Decisions

### D1 — Local-first first; the database came later

The first version stored everything in `localStorage`. No accounts, no server,
no database. The database arrived only in a later phase.

This looks backwards — the whole point was sharing data between two devices, and
`localStorage` cannot do that. It was still right, because:

- The risky, unknown part of this project was **whether the printed output would
  be acceptable**. Not storage. Storage is a solved problem; matching a paper
  form your family has used for years is not.
- `localStorage` is synchronous and cannot fail in interesting ways. That meant
  the early work had no loading states, no auth, no network errors, no security
  rules — nothing between an idea and seeing it on screen.
- By the time the database went in, the data model had already been reshaped
  three times by real use. Doing that against a live database with real data in
  it would have been far more expensive.

> **Gut to build:** sequence work by *risk*, not by architecture diagrams. Do the
> part that will teach you the most, as cheaply as you can, first. Infrastructure
> is easier to add to a validated design than a design is to rescue from
> premature infrastructure.

The cost of this choice was real and was paid later: converting a synchronous
storage API to an asynchronous one touched every page (§6). That was a known,
bounded cost, accepted deliberately — not an accident.

### D2 — Exactly one module is allowed to touch storage

From the first commit, `src/lib/storage.ts` was the only file that called
`localStorage`. Pages never touched it directly. The module's header said so:

```ts
/**
 * All persistence goes through this module. It is deliberately the only place
 * that touches localStorage, so swapping in a hosted database later means
 * rewriting this file and nothing else.
 */
```

When Firestore replaced it, that promise mostly held: a new `src/lib/db.ts` was
written, and the pages changed only in *how they get data* (a React context
instead of a function call), not in what they do with it. `money.ts`,
`analytics.ts`, `dates.ts`, `DocumentSheet.tsx` — the actual logic of the
app — did not change at all.

> **Gut to build:** identify the one thing most likely to be replaced, and put a
> wall around it early. The wall costs almost nothing when you build it and saves
> a rewrite when you need it. "Which decision am I least sure about?" is the
> question that tells you where the wall goes.

### D3 — Static export, no server of our own

`next.config.ts` sets `output: "export"`. The entire app is HTML, CSS and JS in a
folder. There is no backend.

Why: a server is a thing that costs money, breaks, needs updating, and has to be
awake at 9pm when dad wants to write an invoice. For two users and a few dozen
documents a year, that is all cost and no benefit. Firestore is spoken to
directly from the browser.

The trade this forces: **there is no trusted place to run code.** Anything you
would normally enforce on a server has to be enforced by Firestore's security
rules instead (§7). That is a real constraint, not a free lunch, and it is why
`firestore.rules` gets a whole section in this document.

### D4 — The printed page is fixed-width and scaled, never responsive

`DocumentSheet.tsx` is authored at a hard-coded **720px** — A4 (210mm) minus the
12mm print margins, at 96dpi. It does not reflow. On a phone, `SheetScaler.tsx`
measures the available width and applies a CSS `transform: scale()`.

The obvious alternative — make the invoice responsive like the rest of the UI —
was tried first and thrown away. Here is what it looked like on a phone:

```
| 1, Fabricate And    |        |          |
| Wilding GI Angle    |        | 1,980.00 |
| Bar                 |        |          |
| 1.5"x1.5" x4mm      |        |          |
| galvanized angle    |        |          |
| bar on top of gate  |        |          |
```

Readable, but it is *not the document*. Line breaks fall in different places, the
column widths differ, and the page count can differ. Someone checking a preview
on a phone before printing is checking something that does not exist.

Fixed width and scale means the phone shows the actual A4 page, shrunk. Smaller
text, but what you see is what comes out of the printer. For a preview whose only
job is to be trusted, fidelity beats legibility.

> **Gut to build:** "responsive" is a default, not a law. When the artifact has a
> fixed physical form — paper, a PDF, a slide — reflowing it destroys the one
> property the preview exists to provide.

### D5 — Derive everything that can be derived

Never stored, always computed:

- line totals (`quantity × unitPrice`)
- the document total
- the amount in words (`Ringgit Malaysia: Eight Thousand Five Hundred Fifty Only`)
- the item numbers `1,` `2,` `3,` on the printed page
- the next document number (`023/2026` → `024/2026`)

The reason is not elegance. It is that **stored duplicates drift**. If the total
were a field, an edit to a line could leave a document whose lines say 8,550 and
whose total says 7,850. That is an invoice sent to a client with wrong money on
it. Deriving makes the contradiction unrepresentable.

The cost is recomputation on every render. At this scale that is free. If it ever
were not, the fix is caching — which you can add later, whereas you cannot add
"never having sent a wrong invoice" later.

### D6 — Store what the user *chose*; never infer it from what they typed

This one was learned the hard way and is the most transferable idea here, so it
gets its own bug writeup in §3.3. The short version:

```ts
// Before — the mode is guessed from whether fields happen to be filled
const perUnit = item.quantity !== "" || item.unitPrice !== "";

// After — the mode is a thing the user picked, and is stored
type PricingMode = "lump" | "unit";
```

An empty field means "I have not typed this yet". It does not mean "I do not want
this". Conflating those two is a bug generator.

### D7 — Migrate on read, not on write

When `pricing` was added to `LineItem`, documents already existed without it.
Rather than a migration script, there is `src/lib/normalize.ts`:

```ts
function normalizeItem(item: LineItem): LineItem {
  if (item.pricing === "lump" || item.pricing === "unit") return item;
  const looksPerUnit = item.quantity?.trim() !== "" || item.unitPrice?.trim() !== "";
  return { ...item, pricing: looksPerUnit ? "unit" : "lump" };
}
```

Every path that loads a document — Firestore, browser storage, an imported backup
file — runs it through this. Benefits:

- No migration step to run, and no "did it finish?" anxiety.
- Old **backup files** keep working forever, which a one-shot database migration
  would not have covered.
- It is idempotent: already-migrated data passes through untouched.

The cost is that the normaliser accumulates cruft over the years. That is a fine
trade for an app with no ops team. Delete entries once you are confident nothing
old remains.

---

## 3. Bugs, and what they teach

These are the ones worth learning from.

### 3.1 — A styling utility that silently generated nothing

**Symptom:** the dashboard's stat cards were white text on a white background.
Unreadable. The bar chart bars were invisible.

**Cause:** colours were written as `bg-[--color-brand]`. In Tailwind v4 that
syntax produces **no CSS at all**. Not an error, not a warning — nothing. The
correct form, given the tokens were declared in `@theme`, is the generated
utility `bg-brand`.

**How it was found:** by looking at a screenshot. A human would have spotted it
instantly; the build was perfectly happy.

**The lesson:** know which of your tools fail *loudly* and which fail *silently*.
A compiler error is a gift. A CSS class that does nothing, a selector that matches
nothing, an `await` you forgot, a test file that is never run — these are the
expensive ones, because the system keeps reporting success. For anything in the
silent category, you need an independent check. Here that check was:

```bash
# Does the class actually exist in the built CSS?
grep -c '\.bg-brand' out/_next/static/css/*.css
```

### 3.2 — CSS cascade layers, or: why `text-white` did nothing

**Symptom:** right after fixing 3.1, the colours were *still* wrong. `text-white`
computed to `rgb(20, 32, 46)` — the body text colour.

**Cause:** `globals.css` set base styles outside any layer:

```css
body { color: var(--color-ink); }   /* unlayered */
```

Tailwind puts its utilities inside `@layer utilities`. In the CSS cascade,
**unlayered styles beat layered ones**, regardless of specificity. So one plain
`body` rule was quietly overriding every text-colour utility in the app.

The fix was to move those rules into `@layer base`, where Tailwind expects them.

**The lesson:** when something behaves impossibly, the model in your head is
wrong, not the machine. `.text-white` losing to `body` violates the
specificity rule everyone learns — which is the signal that a *different* rule is
in play (here, layer precedence, which sits above specificity). Stop guessing and
read the actual computed value:

```js
getComputedStyle(el).color   // the ground truth, not what you think you set
```

### 3.3 — Deleting a `1` changed the mode

**Symptom, in the user's words:** *"the quantity default is 1, if i want to edit
to 2, i need to delete the 1 first, but if i delete the 1, it will switch back to
one price."*

**Cause:** two decisions that were individually defensible and together broken.

1. Tapping "Per unit" pre-filled `quantity: "1"`.
2. The mode was **derived** from whether the fields were non-empty.

Clear the `1` → both fields empty → the derivation says "lump sum" → the inputs
vanish mid-edit.

**Fix:** make the mode explicit state (`pricing: "lump" | "unit"`), and start the
quantity blank so there is nothing to delete.

**The lesson — this is the big one:** *derived state is a lie when the thing you
are deriving from is mid-edit.* Users pass through empty, invalid and half-typed
states constantly. Any inference from "is this field filled?" will fire during
those transitional states and do something the user did not ask for.

The general shape of this bug:

| You want to know | Do **not** infer from | Store instead |
| --- | --- | --- |
| which mode the user picked | which fields are filled | the mode |
| whether the form is dirty | comparing to initial values | a `dirty` flag set on edit |
| whether a record is "active" | a non-null date field | an explicit status |

Also note: **a pre-filled default that the user must delete is a design smell.**
A placeholder shows the shape without creating work. A default value creates
work every time the default is wrong.

### 3.4 — Two fixes shipped for a bug that only existed on a phone

This is the most embarrassing sequence in the project and the most instructive.

**Round 1.** The user said the date picker looked "weird". A measurement was run:

```js
date.scrollWidth - date.clientWidth   // → 0, "no overflow"
```

Both inputs reported identical 50px heights. Conclusion: nothing wrong,
just tight. Then a **screenshot at 320px** showed `13/09/202` — the year clipped,
the calendar icon overlapping the last digit.

The measurement was wrong. A native `<input type="date">` keeps its content in
shadow DOM, so `scrollWidth` never reports the clipping. *The instrument had a
blind spot exactly where the bug was.*

**Round 2.** The layout was fixed and a hint added showing how the date would
print (`13 September 2026`), verified in Chrome. On the user's iPhone this read
as a stray duplicate, because iOS Safari renders the input as `13 Sep 2026`
already. The hint only made sense against Chrome's `13/09/2026`. **A fix designed
for a platform the users do not use.**

**Round 3.** The actual complaint: *"why its cross the box of the document"* —
the date field stretched past the card's edge. Cause: iOS gives
`input[type="date"]` a native minimum width that `width: 100%` cannot override.
Chrome does not, so it had been invisible in every check so far.

**The lessons:**

- **Verify where the user is.** "It works on my machine" scales down to "it works
  in my browser at my viewport". The users here are on iPhones. Every check that
  mattered should have been on iOS, or on nothing.
- **Your instrument has blind spots, and they cluster around the weird cases** —
  native controls, shadow DOM, canvas, iframes. When a measurement says "fine"
  and a human says "broken", the human is right and you should go look.
- **Screenshots caught all three.** Numbers agreed with the bug twice.
- When you cannot reproduce on the real platform, **say so**. The commit message
  for the final fix states plainly that iOS could not be verified locally and
  needs a check on the phone. A fix you could not test is not the same kind of
  object as one you could, and pretending otherwise spends someone's trust.

### 3.5 — The environment is part of the system

Three separate failures that had nothing to do with application code:

**Node too old.** `npm run dev` refused: Next 16 needs ≥ 20.9. The machine had
Node 20.19.4 installed via nvm, but no `default` alias, so every new shell fell
back to a system Node 18.17.0. Fixed with `.nvmrc` plus an `engines` field, so
the requirement is declared rather than remembered.

**npm skipped a native binary.** The CSS build died with `Cannot find native
binding`. Cause: npm 9 hits a [known optional-dependency bug](https://github.com/npm/cli/issues/4828)
and silently omitted Tailwind's `oxide-darwin-arm64`. The lockfile listed it
correctly; npm just did not install it. Reinstalling with npm 10 fixed it.

**Next 16 blocked the phone.** Opening the LAN URL on a phone loaded the HTML but
the page sat on "Loading…" forever. The server logged plenty of `200`s, which is
what made it confusing. The dev log had the answer:

```
⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "192.168.0.5"
```

Next blocks cross-origin dev assets by default; `localhost` is trusted,
`192.168.0.5` is not. The HTML arrived, the client bundle did not, React never
hydrated, and the page stayed in its initial "Loading…" state. Fixed with
`allowedDevOrigins`.

**The lesson:** when something does not work, the bug is not necessarily in the
code you wrote. Runtime versions, package managers, and framework defaults are
all part of the running system. Two habits pay for themselves here:

1. **Read the logs you already have** before forming theories. The cross-origin
   block was printed, in plain English, the whole time.
2. **Distinguish "no response" from "wrong response".** `200` responses plus a
   blank page means delivery worked and *execution* failed — which points at the
   client, not the network. That distinction cut the search space immediately.

---

## 4. How things were verified

A throughline worth naming on its own.

### Reproduce before fixing

For the per-unit bug, the reported flow was driven in a real browser and each
step asserted — mode after tapping, mode after clearing, the total after typing,
the value after toggling away and back. Only then was the fix written, and the
same script proved it.

Fixing without reproducing means you never learn whether you fixed *the* bug or
*a* bug. Those feel identical from the inside.

### Test the mechanism, not just the symptom

When Chrome would not reproduce the iOS overflow, the next move was to test the
*mechanism* — force a large intrinsic width and confirm `min-width: 0` contains
it. That test **failed to reproduce too**, which was itself informative: it ruled
out the grid-shrink theory and pointed at the native control minimum instead.

A test that fails to reproduce is not a wasted test. It eliminates a hypothesis.

### Prove the negative

For the security rules, it is not enough to check that a signed-in user can read.
The whole point is that a signed-out one cannot. So both were checked, in both
directions, including a collection that should be unreachable to everyone:

```
NOT signed in : readDocuments DENIED, readSettings DENIED, write DENIED
Signed in     : readDocuments ALLOWED, readSettings ALLOWED, readOther DENIED
```

> **Gut to build:** for anything security-shaped, the test that matters is the one
> asserting the thing *fails*. "It works" tells you nothing about who else it
> works for.

### Re-verify when the ground moves

Midway through, `npm audit fix --force` was run, taking Next from 15 to 16 — a
major version. Earlier verification had all been done on 15, so it no longer
proved anything. Everything was re-run: tests, build, routes, and a check that
the emitted CSS still carried the theme utilities and print rules.

> **Gut to build:** verification is a claim about a specific state of the world.
> When the state changes underneath you — a dependency bump, a config change,
> someone else's commit — your evidence expires. Re-run it rather than assuming.

### On `npm audit fix --force`

The audit reported high-severity `postcss` advisories. The advice given was
**ignore them**, because:

- The vulnerable `postcss` was pinned inside Next's own tree, not a direct
  dependency.
- Every advisory required *processing attacker-controlled CSS*. The only CSS here
  is authored in this repo and compiled on a developer's machine. There is no
  path for hostile input.
- The "fix" was a major framework upgrade.

> **Gut to build:** a vulnerability is only a risk if there is a path from an
> attacker to the vulnerable code. Read the advisory, find the entry point, ask
> whether it exists in your system. Reflexively taking breaking upgrades to clear
> a dashboard is how stable projects get destabilised.

(The upgrade happened anyway, and Next 16 turned out fine — so the outcome was
good. The reasoning still stands: it was an unforced risk, and it was only known
to be safe *after* re-verifying.)

---

## 5. The data model

```ts
InvoiceDoc {
  id, kind: "invoice" | "quotation", number, date,
  client: { company, addressLine1..3 },
  jobTitle,                 // bold heading above the items
  items: LineItem[],
  notes, status: "draft" | "sent" | "paid", paidDate,
  createdAt, updatedAt
}

LineItem {
  id,
  pricing: "lump" | "unit", // §D6 — the user's explicit choice
  title, description, unit,
  quantity, unitPrice,      // used when pricing === "unit"
  amount                    // used when pricing === "lump"
}
```

Two choices worth explaining.

**Numbers are stored as strings.** `quantity: string`, not `number`. This looks
wrong and is deliberate. A controlled text input holds strings; a user mid-typing
has `""`, `"1."`, `"0.0"` — none of which survive a round trip through `number`
intact. Converting on every keystroke fights the user's cursor. So the raw string
is stored and parsed only where arithmetic happens:

```ts
export function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[, ]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
```

That `replace` exists because people type `1,980.00`. Meeting users where they
are is cheaper than training them.

**Money is rounded per line, then summed.**

```ts
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

Each line is rounded to sen before adding, matching how the figures appear on
paper — so the printed lines always add to the printed total. The `Number.EPSILON`
nudge handles binary float representation, where `1.005 * 100` is `100.49999...`
and would otherwise round down. There is a test pinning exactly this.

> **Gut to build:** with money, decide *where* rounding happens and write it down.
> "Round each line, then sum" and "sum, then round" give different answers, and
> the right one is whichever matches the document a human will check by hand.

---

## 6. The Firestore migration

The interesting part is not Firestore. It is what happens when a synchronous API
becomes asynchronous.

### Why it rippled

`loadDocuments()` returned an array. `getDocs()` returns a promise. Every caller
had to change — and with it, each page gained states it never had: loading,
error, not-yet-authenticated.

This is the deferred cost from §D1, arriving as expected.

### The shape chosen

A single `DataProvider` context owns auth state and one live subscription, and
hands pages plain values:

```ts
const { documents, company, loading, error, saveDocument } = useData();
```

Alternatives rejected:

- **Each page fetches its own data.** Three subscriptions instead of one, three
  loading states to keep consistent, and the dashboard and job list could briefly
  disagree.
- **A data-fetching library.** Real benefits, but Firestore's `onSnapshot` is
  already a live subscription with its own cache. Two caching layers that do not
  know about each other is a category of bug not worth inviting for two users.

### One subtle guard worth understanding

```ts
useEffect(() => {
  if (doc || loading) return;   // ← seed once, then never again
  ...
}, [doc, loading, documents, idParam, newKind]);
```

The editor seeds its form from the live document list, but only while its local
state is still empty. Without that guard, every Firestore update would overwrite
the form — so if mum opened the same job while dad was typing, his half-finished
edits would vanish under her version.

This is the classic tension between **live data** and **local edits**. The
resolution here is deliberately simple: the form takes a snapshot when it opens
and owns it until saved. Last write wins.

For two family members who are rarely in the same document, that is the right
trade. It would be the wrong trade for a team of ten, where you would want field
-level merging or at least a "this changed elsewhere" warning. Know which one you
are building.

### What did not change

`money.ts`, `analytics.ts`, `dates.ts`, `normalize.ts`, `DocumentSheet.tsx` — the
domain logic — were untouched. They are pure functions over plain data with no
idea where it came from. That is the payoff from §D2, and it is why the unit
tests kept passing through a storage-engine swap.

> **Gut to build:** pure functions over plain data survive infrastructure changes.
> The more of your logic that looks like `(data) => result` with no I/O in it, the
> less a migration can hurt you.

---

## 7. The security model

Worth understanding properly, because it is easy to get wrong in a browser-only app.

**The Firebase config is not a secret.** `NEXT_PUBLIC_FIREBASE_API_KEY` and
friends ship inside the JavaScript bundle. Anyone can read them. That is by
design — they identify the project, they do not authorise anything.

**`firestore.rules` is the entire access control.** There is no server to check
anything (§D3), so this file is the only thing between the internet and the
client addresses, amounts, and company bank account number:

```
match /documents/{documentId} {
  allow read, write: if request.auth != null;
}
match /{document=**} {
  allow read, write: if false;   // deny by default
}
```

Two properties to notice:

- **Default deny.** The last rule closes everything not explicitly opened. New
  collections are unreachable until someone deliberately opens them — the failure
  mode is "my feature does not work", not "our data was public".
- **It is tested, in both directions** (§4). The check that matters is the one
  proving a signed-out client is refused.

**Known limitation, stated honestly:** with one shared login, anyone signed in can
do anything. There is no audit trail and no way to know which parent changed
what. That is a deliberate trade for two people who trust each other and want one
password between them. If a third person ever needs access, this is the first
thing to revisit.

---

## 8. Principles, distilled

1. **Sequence by risk.** Do the part that teaches you most, first, as cheaply as
   you can.
2. **Wall off what will change.** One module owned storage, so replacing it cost
   one module plus wiring.
3. **Derive anything that can be derived.** Duplicated state drifts, and drifted
   money gets sent to clients.
4. **Store intent, never infer it from emptiness.** Users spend a lot of time in
   half-typed states.
5. **Know which tools fail silently** and add an independent check for those.
6. **Look at the artifact.** Screenshots caught what measurements missed, three
   times.
7. **Test where the user is.** Verifying on the wrong platform is close to not
   verifying.
8. **Prove the negative** for anything security-shaped.
9. **Evidence expires.** When the ground moves, re-run the checks.
10. **Say what you did not verify.** An untested fix is a different kind of thing
    from a tested one, and the person relying on it deserves to know which they
    have.

---

## 9. Known weak spots

Honest list of what is not great, for whoever picks this up next.

- **No tests above the unit level.** `money`, `analytics`, `storage` and
  `numbering` are well covered; components and pages are not. Every UI bug in §3
  was caught by a human looking at a screen. A few Playwright tests over the real
  flows would have caught most of them earlier.
- **Last-write-wins on concurrent edits** (§6). Fine for two people, wrong for
  more.
- **One shared login** (§7). No audit trail.
- **The normaliser will accumulate** (§D7). Prune it once old data is gone.
- **No error reporting.** If the app breaks on dad's phone, nobody finds out
  unless he says so.
- **`suggestNumberFrom` can collide.** Two devices creating an invoice offline at
  the same time can pick the same number. Harmless here — the number is editable
  and a human notices — but it is not a guarantee.
