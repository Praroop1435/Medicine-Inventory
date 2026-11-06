# Medicine Inventory — Design

Date: 2026-11-06 · Status: draft for owner review
Mockups: `.superpowers/brainstorm/57912-1793958735/content/` (`home-direction-v2.html` option A, `screens-v1.html`)

Marking used below: **[owner]** = decided by the shop owner in conversation. **[call]** = designer's call, open to override.

---

## 1. Why this exists

A medical shop loses money because medicines expire on the shelf before anyone notices **[owner]**. The app's main job is to warn staff early enough to sell, return to the distributor, or remove stock before it expires. Its second job is to keep stock clearly organised by category, company and batch, so anyone can see what the shop has and when each lot expires.

Success means no batch reaches its expiry date without someone having been warned, with enough lead time to return it.

## 2. Users and setting

- 3 staff in one shop, each on their **own Android phone** **[owner]**. No iPhones.
- Used at the counter and while walking the shelves. Short sessions, one hand, sometimes weak internet.
- **No Play Store.** The app is installed from an APK file the owner shares **[owner]**.
- **No login** of any kind **[owner]**.
- English UI **[call]**.

## 3. Goals, non-goals, anti-goals

**Goals**
1. Expiry alerts with lead times the user can change **[owner]**.
2. Clear hierarchy: Category → Company → Medicine → Batch **[owner]**.
3. Add stock four ways **[owner]**: scan a distributor bill, **speak it (voice)**, type it (manual), or **bulk** (spreadsheet import or rapid entry). This covers new bills and the stock already on the shelves on day one.
4. Keep counts accurate through a routine stock check **[owner]**, with an optional quick "Sold 1".
5. All 3 phones see the same data, and the app works offline.
6. The best possible UI/UX: calm, clear and fast **[owner]**.

**Non-goals (v1)**
- iOS, the Play Store, user accounts.
- Customer billing / point of sale. Sales aren't recorded line by line **[owner]**.
- Barcode scanning (Indian medicine barcodes aren't consistent) **[call]**.
- AI or cloud bill reading. v1 uses on-device OCR only **[owner]**. The design must allow swapping to AI later (§8).
- Reports, analytics, multiple shops, Hindi UI.

**Anti-goals (failure even if it "works")**
- A wrong expiry date saved without a human confirming it.
- Alerts that fire for stock already sold or returned, which teaches staff to ignore alerts.
- Losing data when a phone is lost, reset or offline.
- Screens that look cramped or broken: text wrapping inside buttons, misaligned columns, inconsistent spacing.

## 4. Core concepts and data

All data lives under one shop.

| Entity | Fields (essential) | Notes |
|---|---|---|
| **Shop** | id, name, alertDays `{first: 90, second: 30}`, notifyTime `09:00`, joinSecret | One per install group |
| **Device** | id (Firebase anon uid), displayName ("Ravi"), joinedAt, removed | Name asked once on first open. Used for history only, not a login |
| **Category** | id, name, lastCheckedAt | Seeded with common ones, editable **[call]**: Antibiotics, Cough syrups, Pain relief, Balms, Lotions, Eye/ear drops, Tablets (general), Vitamins, Others |
| **Company** | id, name | Created on the fly from bills |
| **Medicine** | id, name, categoryId, companyId, unit (carton / box / strip / bottle / tube / can / piece), composition? | Unit is set when the medicine is first created **[owner: each medicine has its own unit]** |
| **Batch** | id, medicineId, batchNo, expiry (year+month), qty (in the medicine's unit), billId?, status `active / returned / removed`, createdAt | One row per lot per bill |
| **Bill** | id, supplier, billNo, billDate, scannedBy, createdAt | Photo kept on the device only, not uploaded **[call]** |
| **Event** (history) | id, batchId, medicineId, type `added / sold / count_fixed / checked / returned / removed / edited`, delta, deviceId, at | Append-only audit trail shown on the medicine screen |

**Unit rule [call, from owner's "remove 1 carton when a carton is sold"]:** a medicine's unit is the pack as it appears on the bill (carton, box, bottle…), and stock is counted in those packs. Loose sales smaller than one pack aren't tracked. A bill line like "10 x 15" means qty 10 of a 15-tablet pack. `packInfo` ("15 tablets") is an optional text field for display only, not for conversion. **Free quantity** on a bill ("10+1") is real stock, so qty = paid + free.

**Expiry rule [call]:** Indian packs print `EXP 11/26`. That is treated as **expiring at the end of that month** (30 Nov 2026), and every countdown uses that date.

**Status of a batch** (pure function, unit tested):
- `expired`: expiry date < today → red
- `soon`: within `alertDays.second` (default 30) → amber
- `watch`: within `alertDays.first` (default 90) → neutral grey pill
- `ok`: otherwise → plain grey date
Only `active` batches with qty > 0 count toward alerts.

**Stock out:**
- **Routine check [owner]** is the main way counts get corrected (§6.5).
- **"Sold 1" [owner]** removes one whole unit. It takes from the active batch that expires soonest (FEFO) **[call]**. Staff can pick another batch from the medicine screen.
- **Returned / Removed** marks a batch as gone so it leaves the alerts.

## 5. Sync, no-login, and devices

- **Backend: Firebase** with Firestore (native SDK, offline persistence on) and Anonymous Auth **[call]**.
- **First phone:** "Set up shop" → enter shop name → the app creates the Shop with a random `joinSecret` and shows a **QR code** (shopId + joinSecret).
- **Other phones:** "Join shop" → scan the QR → their anonymous uid is added as a Device. Nobody logs in after that.
- **Security rules:** only uids listed as non-removed Devices of a shop can read or write that shop. Joining is checked against `joinSecret`.
- **Lost phone:** Settings → Devices → Remove. Optionally rotate the join QR.
- **Offline:** every write goes to the local cache first and syncs when the network returns. The home screen shows a sync line ("synced with 3 phones" / "offline, 4 changes waiting").
- **All phones are equal [owner].** Any device can change settings, remove other devices and rotate the QR. Every such action writes an Event, so history shows who did it.
- **Scale [owner: 500–2,000 medicines]:** expect roughly 1,000–6,000 active batches. The phone keeps one listener on active batches and computes alert counts and category summaries locally. This is fine at that size. **Cost risk:** each phone's cold start after a long gap can re-read all batches. 3 phones × ~5,000 reads, a few times a day, can pass Firestore's free daily read quota. Plan to use the pay-as-you-go plan with a budget alert, which costs very little at this volume **[call]**.
- **Recovery key [call]:** during setup the owner is asked to save the join QR as an image or print it. The app says plainly that this QR is the only way back into the shop if every phone is lost. Settings can show it again.
- **Reinstall on the same phone** = new anonymous uid, so the phone must scan the QR again. This is acceptable, and the data is safe in Firestore.

## 6. Screens

Navigation is a bottom bar with 5 items: **Home · Stock · Add (black centre button → Scan bill / Speak / Type / Bulk import) · Check · Settings**.

### 6.1 Home (option A, "Overview") **[owner]**
- Shop name (title), date + sync status.
- Search (medicine, company, batch no).
- One divided card with 3 counts: **Expired** (red number), **In 30 days** (amber), **In 90 days** (ink). Tapping a count opens a list of those batches, soonest first. The labels follow the alertDays settings.
- **Categories** list: name, medicine count and unit count, and one status pill per row (the worst status in that category: "2 expired" / "2 soon" / "3 in 90 days"). "All N" link.
- Stock-check reminder card for the category checked least recently ("Antibiotics not checked · 18 days ago · Start check").

### 6.2 Stock
The full category list with add/edit/reorder. This is the same component as the Home category list.

### 6.3 Category
- Title, meta line (medicines, units, last checked).
- Company filter chips: "All companies" plus each company in the category, scrolling sideways.
- Two groups: **Needs action** (expired / soon / watch) and **All good**. Each row shows name, company · qty (· N batches), and its soonest expiry as a pill.

### 6.4 Medicine
- Back to category, title, meta line (company · composition · unit).
- 3-cell card: In stock, Batches, Next expiry (as a date).
- **Batches** list, oldest expiry first. Each batch shows its batch no + qty, an expiry pill, "From bill" and "Expires in …" rows, and three equal buttons: **Sold 1 · Edit count · Returned**. "+ Add batch" for manual entry.
- **History** (latest 3 events, "All").

### 6.5 Stock check **[owner: routine check]**
- Pick a category (Check tab lists categories by last checked date).
- Rows are grouped by company. Each batch row has a − / count / + stepper and a ✓ "count matches" button. Progress bar plus "12 of 88 checked · Priya".
- Progress saves continuously, so a check can be paused and resumed (also from another phone).
- Finishing sets `category.lastCheckedAt`. Every change writes an Event.
- **Mismatches [call]:**
  - Stock on the shelf that the app doesn't know → "+ Add batch" inside the check, using the same form as manual add.
  - A batch counted as **0** closes automatically (status `removed`, it leaves the alerts). Its history keeps it.
  - A check can be finished with unchecked rows. Unchecked rows are left unchanged, and the category shows "partly checked · 76 of 88". `lastCheckedAt` is set only when every row is checked.
  - The check records the **absolute shelf count** at the moment of tapping (the shelf is the truth). A "Sold 1" from another phone that lands after that tap applies on top of it as a change. Counts are saved per batch as a `count_fixed` event plus the new qty, written in a Firestore transaction.

### 6.6 Scan bill → Review **[owner: OCR]**
1. Camera (with guide frame) or pick from gallery. Retake is allowed.
2. On-device OCR → bill parser → draft rows: medicine name, company, batch, expiry, qty (+ supplier, bill no, date for the header).
3. **Review screen:** each row is an editable card. Fields the parser is unsure of are **amber ("Check expiry")**. Each row is matched to an existing medicine (fuzzy name match) or marked **New**. A new medicine needs a category + unit.
4. The save button stays disabled ("Confirm 2 fields to save") until every amber field is confirmed or edited. Saving creates the Bill, Batches (and any new Medicines/Companies) and "added" Events in one batch write.
- **Manual add** is always available, with the same form as one review row.

### 6.6b Other ways to add stock **[owner: voice + manual + bulk]**
The centre button opens a small sheet: **Scan bill · Speak · Type · Bulk import**. Every path ends in the **same review card** as §6.6, with the same amber "please check" rule and the same save logic. There is one shared `DraftBatch` model and one shared `ReviewCard` component.
- **Speak:** hold the mic and say e.g. "Azithral 500, Alembic, batch A Z 8 8, expiry November 2026, 2 cartons". On-device Android speech-to-text (Indian English) → a voice parser that fills the same fields. Batch codes and unusual names are often misheard, so batch and expiry are **always amber** for voice entries **[call]**. A medicine that already exists is matched by name, so its company, category and unit fill in automatically. "Next" keeps the mic flow going for shelf-walking. Voice needs Android's speech service. If it's unavailable offline, the button says so and suggests Type.
- **Type (manual):** the review card as an empty form. Medicine name autocompletes from existing medicines. "Save & next" keeps category and company filled for fast shelf entry.
- **Bulk:**
  1. **Spreadsheet import:** the app shares a template (CSV/XLSX columns: category, company, medicine, unit, batch, expiry MM/YY, qty). The user fills it on a computer or in phone Sheets, then picks the file. Rows go through the review screen as a list, invalid rows are flagged, and all rows save together.
  2. **Rapid entry:** the Type flow in a loop, with category/company locked until changed.
  Exports from billing software (e.g. Marg) can be mapped to the template by hand. A direct importer for one software is out of scope for v1 **[call]**.
- **Duplicate guard:** saving a batch whose medicine + batchNo already exists offers "add to existing qty" instead of creating a second row.

### 6.7 Settings
- Alert lead times (first and second, in days) **[owner: customisable]**. Notification time.
- Categories and companies (rename, merge duplicates).
- Devices (list, rename self, remove others), join QR.
- App version + "check for update".

### 6.8 Alerts
- **Daily local notification** at the chosen time, computed on the phone from cached data: "3 expired · 5 expire within 30 days". It is rescheduled whenever data changes. No server is needed **[call]**.
- Tapping it opens the Home counts list.

## 7. Visual design (from the mockups)

Style: "achromatic ledger". The chrome has no colour. **Colour appears only on expiry signals.**

- **Tokens:** ground `#f2f5f2` (pale sage), surface `#fff`, border `#e6e6e6`, row rule `#f0f0f0`, control border `#d4d4d4`, text `#0a0a0a`, muted `#6b6b6b`, primary (buttons) `#141414`. Status: expired text `#c4242a`, pill `#ffedea`/`#831c1e`. Soon `#92400e`, pill `#fffbeb` + `#fde68a` edge. Watch pill `#eeeeee`/`#3d3d3d`.
- **Type:** Geist (one family). Sizes 12 / 14 / 16 / 20–24 only. Title 24/600, section 16/600, body 14, meta 12. Tabular figures on all numbers.
- **Shape:** card radius 8, control radius 6, pill radius 4. 1px borders, **no shadows** (except floating sheets), no gradients, no emoji. Outline icons (Lucide), 20px.
- **Spacing rules (owner flagged spacing as critical):**
  - 4px base grid. Screen side margin 16. Card padding 12–14. Gap between cards 8–12. Section gap 18–24.
  - Touch targets ≥ 44px tall. List rows ≥ 56px.
  - **Text never wraps inside buttons or numbers.** Buttons are `nowrap`, and a row of buttons uses equal-width columns.
  - Label/value rows use a **fixed label column** so values line up across cards.
  - Long names truncate with an ellipsis on one line. Pills never shrink.
  - Every screen is checked at 360dp and 412dp widths before it's done.
- **States:** each list has empty, loading (grey bars at final size, no layout jump) and error ("Couldn't sync. Last synced 09:14 · Retry") states.

## 8. Engineering **[owner: proper env, .gitignore, modular, reuse, abstraction]**

### Stack **[call]**
- **Expo (React Native) + TypeScript (strict)**, Expo Router, development build (not Expo Go, because native modules are needed).
- **@react-native-firebase** (app, auth, firestore). The native SDK is chosen for real offline persistence.
- On-device OCR via **Google ML Kit text recognition** (an Expo-compatible wrapper). The builder picks the exact package.
- Voice: Android speech recognition through an Expo-compatible module (e.g. expo-speech-recognition), `en-IN`.
- Bulk: expo-document-picker + a CSV/XLSX parser. Template file shared via expo-sharing.
- expo-camera, expo-notifications, react-native-qrcode-svg (+ camera QR scan).
- Tests: Jest + React Native Testing Library. Lint/format: ESLint + Prettier.
- **Distribution:** EAS Build `preview` profile → APK. **EAS Update** for over-the-air fixes, so phones don't need reinstalling for JS changes.

### Structure (feature-based, layered)
```
app/                      # Expo Router routes only, thin; each file renders a feature screen
src/
  domain/                 # pure TS, no React/Firebase: types, expiry status, FEFO, alert counts, matching
  data/
    repositories/         # interfaces: ShopRepo, InventoryRepo, BillRepo, EventRepo
    firebase/             # Firestore implementations + converters
  services/
    ocr/                  # OcrEngine interface + MlKitOcrEngine; billParser (pure, tested)
    notifications/        # Notifier interface + expo-notifications impl
  features/
    home/ stock/ medicine/ intake/ (scan, voice, manual, bulk adapters + shared review) check/ settings/ onboarding/
      components/  hooks/  screens/
  ui/                     # shared design-system components (one source of truth)
    tokens.ts  Screen  Card  ListRow  Pill  StatusPill  CountStrip  Button  Stepper
    Field  Chip  ChipRow  SectionHeader  KeyValueRow  EmptyState  ErrorState  Skeleton
  lib/                    # small shared helpers (dates, formatting, ids)
```

### Reuse and abstraction rules
- **Abstraction at boundaries only:** repositories (DB), `OcrEngine` (so AI reading can replace ML Kit later without touching screens), `SpeechEngine`, `Notifier`.
- **One intake pipeline:** scan, voice, manual and bulk are input adapters that each produce `DraftBatch[]`. Validation, matching, review UI and saving are shared code (`features/intake/`). Screens never import Firebase or ML Kit directly.
- **Business rules are pure functions in `domain/`** with unit tests: expiry status, end-of-month expiry, FEFO deduction, alert counts, bill-line parsing, fuzzy matching.
- **One component per pattern.** For example, `ListRow` is used by Home categories, Category medicines, the check list and history. `StatusPill` is the only place status → colour mapping exists. No screen defines its own colours or spacing; everything comes from `ui/tokens.ts`.
- No speculative abstraction beyond the above.

### Environment and repo hygiene
- `git init`. Commits follow the owner's global rules (no AI attribution lines).
- `.env` (gitignored) + committed `.env.example`. Config is read through `app.config.ts` → `extra`, then a typed `src/lib/config.ts`. Values: Firebase project ids, EAS project id, app variant.
- `google-services.json` is **gitignored** and supplied to EAS as a file secret **[call]**.
- Two app variants **[call]**: `development` (separate Firebase project, different app id so it installs beside the real one) and `production`.
- `.gitignore` covers: node_modules, .expo, dist, android/, ios/ (prebuild output), .env*, !.env.example, google-services.json, *.keystore/*.jks, coverage, .DS_Store, .superpowers/, .taste-skill/.
- Scripts: `lint`, `typecheck`, `test`, `build:apk`, `update:prod`.
- Firestore security rules + indexes are kept in the repo (`firebase/`) and deployed with the Firebase CLI.

## 9. Left to the builder
- Exact OCR wrapper package, fuzzy-match algorithm, and bill parser heuristics (to be tuned once real bill photos arrive **[owner will provide]**).
- Firestore document layout and indexes, consistent with §4 and the security model in §5.
- State handling on top of Firestore listeners (small hooks are enough; add no state library without a reason).
- Animation details (subtle, ≤ 200 ms, respecting reduce-motion).
- Category seed list wording.

## 10. Open items
- Real distributor bill photos: needed to tune the OCR parser and decide whether OCR alone is accurate enough **[owner will provide]**.

---

## 11. Changes requested by the owner (2026-11-06, after first build pass)

### 11.1 Nested categories ("files and folders") **[owner]**
- A category can contain **sub-categories and medicines at the same time**, to any depth, like folders containing folders and files. `Category` gains `parentId: string | null` (null = top level).
- **Stock tab = the top-level folder.** Opening a category shows, in order: its sub-folders (each with rolled-up counts and worst-status pill), then its own medicines (Needs action / All good, as before). Back goes to the parent folder; the header shows the path ("Syrups › Cough").
- **"+ New folder" inside any category** creates a sub-category there **[owner]**. Each folder row has a ⋯ menu: Rename · Move to… · Delete. Delete is allowed only when the folder is empty (no sub-folders, no medicines) **[call]** — safe, no accidental loss.
- **Counts roll up:** a folder's medicine/unit counts and its worst-status pill include everything inside it, recursively **[call]**. Home shows top-level folders only, with rolled-up pills.
- **Stock check of a folder covers everything inside it, recursively** **[call]**, grouped by sub-folder then company.
- Intake's category picker becomes a folder picker showing paths ("Syrups › Cough"); "+ New folder" is available there too.
- Ordering (Edit order / Up–Down) is per sibling group.

### 11.2 Any unit type **[owner]**
- `Unit` becomes a free string. Each shop keeps a units list (`Shop.units: string[]`), seeded with: strip, tablet, capsule, bottle, carton, box, tube, can, piece, sachet, vial, ampoule, jar, inhaler, drops, packet **[call]**.
- Wherever a unit is picked (review card, manual entry), the chips show the shop's units plus **"+ Add unit"**, which adds a new unit to the shop list for everyone **[owner: "so I can add any type"]**.
- Plurals: known units use their proper plural; custom units add "s" (or "es" after s/x/ch/sh) **[call]**.
- Bulk import and voice accept any unit in the shop list (singular or plural); an unknown unit in bulk is an error row, in voice it leaves unit empty (review asks).

### 11.3 Minimal Settings **[owner]**
Settings shows only four things **[call]**:
1. **Expiry alerts** — first and second warning (days) and the daily notification time.
2. **Phones** — list of joined phones, remove one, show the join QR (recovery key).
3. **This phone's name.**
4. **App** — version and "Check for update".
Category and company management move out of Settings: categories are managed inside the Stock folders (§11.1); company rename/merge is dropped from v1 (companies are corrected on the review card) **[call]**.
