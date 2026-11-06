# Medicine Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Android app (sideloaded APK, no login) for a medical shop. Three phones share one live inventory of Category → Company → Medicine → Batch, with expiry alerts and four ways to add stock: scan, voice, manual, bulk.

**Architecture:** Expo (React Native, TypeScript strict). Pure business rules live in `src/domain`. Repository interfaces in `src/data` have an in-memory implementation (tests) and a Firestore implementation (app). Hardware and OS services (OCR, speech, notifications) sit behind small interfaces in `src/services`. Screens are built only from the shared design-system components in `src/ui`. All four stock-intake paths produce `DraftBatch[]` and share one review-and-save pipeline.

**Tech Stack:** Expo SDK (latest stable) + Expo Router, TypeScript, @react-native-firebase (app/auth/firestore), Google ML Kit text recognition (Expo-compatible wrapper), expo-speech-recognition, expo-camera, expo-notifications, expo-document-picker, expo-sharing, SheetJS (`xlsx` from cdn.sheetjs.com), react-native-qrcode-svg, Jest + React Native Testing Library, ESLint + Prettier, EAS Build/Update, Firebase CLI + @firebase/rules-unit-testing.

**Spec:** `docs/superpowers/specs/2026-11-06-medicine-inventory-design.md`. Read it before any task. Section refs below (§n) point into it.

## Global Constraints

- Android only. Distributed as an APK via EAS Build. No Play Store, no iOS work.
- No login, no accounts. Identity = Firebase Anonymous Auth uid + a display name asked once.
- TypeScript `strict: true`. No `any` in `src/domain`, `src/data`, `src/services`.
- Screens never import `@react-native-firebase/*`, ML Kit or speech modules directly. Only `src/data/firebase/*` and `src/services/*/` implementations do.
- No screen defines its own colours, font sizes, radii or spacing. Everything comes from `src/ui/tokens.ts`.
- Tokens (verbatim, §7): ground `#f2f5f2`, surface `#ffffff`, border `#e6e6e6`, rule `#f0f0f0`, control `#d4d4d4`, text `#0a0a0a`, muted `#6b6b6b`, primary `#141414`. Expired: text `#c4242a`, pill bg `#ffedea`, pill ink `#831c1e`. Soon: text/ink `#92400e`, pill bg `#fffbeb`, pill edge `#fde68a`. Watch: pill bg `#eeeeee`, ink `#3d3d3d`. Radius card 8 / control 6 / pill 4. Font Geist. Sizes 12/14/16/20/24 only. Touch target ≥ 44. List row ≥ 56. Side margin 16.
- Button labels and figures render on one line (`numberOfLines={1}`). A row of buttons uses equal-width columns. Label/value rows use a fixed label column of 72.
- No shadows (floating sheets excepted), no gradients, no emoji, Lucide outline icons at 20.
- Default `alertDays = { first: 90, second: 30 }`, default `notifyTime = "09:00"`.
- Expiry `MM/YY` means **end of that month** (§4).
- Free quantity counts as stock: `"10+1"` → 11 (§4).
- All phones are equal. No roles (§5).
- Commit messages: conventional style. **Never add Co-Authored-By or any Claude/Anthropic attribution.**
- Package manager: npm. Path alias `@/*` → `src/*`.

## Review Focus

1. **Odd expiry text from OCR/voice/sheets** (`11/26`, `NOV-26`, `11-2026`, `2026-11`, `1126`, `13/26`). Expect a correct `YearMonth` or `null` (field marked uncertain), never a wrong date. Test: Task 2 `parseExpiry` table.
2. **The same batch entered twice** (same bill scanned twice, or a sheet row repeated in different case). Expect one batch with the qty added, not a duplicate. Test: Task 5 `saveIntake duplicate guard` and `same medicine twice in one intake`.
3. **The app left open past midnight.** Expect counts and pills to move to the new day without a restart. Test: Task 8 `useToday rolls over at midnight`.
4. **Selling or counting at the edges** (Sold 1 on qty 1, on qty 0, a negative count). Expect the batch to close at 0, the action to be refused below 0, and an event written each time. Test: Task 5 `sellOne` / `setCount` cases.
5. **Voice mishearing a batch code or name.** Expect batch and expiry always flagged for checking, with numbers spoken as words parsed. Test: Task 14 `parseVoiceEntry` cases.

---

## File Structure

```
app/                                  Expo Router routes (thin: import a screen, render it)
  _layout.tsx                         providers + onboarding gate
  (tabs)/_layout.tsx                  bottom bar: Home · Stock · Add · Check · Settings
  (tabs)/index.tsx  stock.tsx  check.tsx  settings.tsx
  alerts/[status].tsx  category/[id].tsx  medicine/[id].tsx
  intake/{scan,voice,manual,bulk,review}.tsx  check/[categoryId].tsx
  onboarding/{index,setup,join,name}.tsx
src/
  domain/      types.ts expiry.ts alerts.ts fefo.ts matching.ts draft.ts   (+ __tests__)
  data/        repositories.ts  memory/*.ts  firebase/*.ts  RepoContext.tsx
  services/    ocr/{OcrEngine.ts,mlkit.ts,billParser.ts}
               speech/{SpeechEngine.ts,native.ts,voiceParser.ts}
               bulk/{sheetParser.ts,template.ts}
               notifications/{Notifier.ts,expo.ts,message.ts}
  features/    onboarding/ home/ stock/ medicine/ intake/ check/ settings/   (screens/, components/, hooks/)
  ui/          tokens.ts + components (Task 7)
  lib/         config.ts dates.ts ids.ts
firebase/      firestore.rules firestore.indexes.json  rules.test.ts
```

---

### Task 1: Project foundation (repo, env, tooling)

**Files:**
- Create: Expo app at repo root (`npx create-expo-app@latest . --template default`, then strip demo screens), `.gitignore`, `.env.example`, `app.config.ts`, `src/lib/config.ts`, `eas.json`, `.eslintrc.js`, `.prettierrc`, `jest.config.js`, `tsconfig.json` (strict + `@/*` alias)
- Test: `src/lib/__tests__/config.test.ts`

**Interfaces:**
- Produces: `config: { variant: 'development' | 'production'; appName: string; androidPackage: string; easProjectId: string }` from `src/lib/config.ts`. `npm run lint | typecheck | test`.

- [ ] **Step 1:** `git init`. Write `.gitignore` with exactly: `node_modules/`, `.expo/`, `dist/`, `android/`, `ios/`, `.env`, `.env.*`, `!.env.example`, `google-services.json`, `*.keystore`, `*.jks`, `coverage/`, `.DS_Store`, `.superpowers/`, `.taste-skill/`, `firebase-debug.log`.
- [ ] **Step 2:** Scaffold Expo + TS. Add scripts `lint`, `typecheck` (`tsc --noEmit`), `test` (`jest`), `build:apk` (`eas build -p android --profile preview`), `update:prod` (`eas update --channel production`).
- [ ] **Step 3: Failing test** `config.test.ts`:
  - `readConfig({ APP_VARIANT: 'development', EAS_PROJECT_ID: 'x' })` → `{ variant: 'development', appName: 'Med Stock (Dev)', androidPackage: 'com.medstock.app.dev', ... }`
  - `readConfig({ APP_VARIANT: 'production', EAS_PROJECT_ID: 'x' })` → `appName: 'Med Stock'`, `androidPackage: 'com.medstock.app'`
  - `readConfig({})` throws `/APP_VARIANT/`
- [ ] **Step 4:** Run `npm test -- config` → FAIL.
- [ ] **Step 5:** Implement `readConfig(env: Record<string, string | undefined>)` in `src/lib/config.ts`. `app.config.ts` calls it with `process.env` and passes `extra`, `android.package`, `android.googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. `.env.example` lists `APP_VARIANT=development`, `EAS_PROJECT_ID=`, `GOOGLE_SERVICES_JSON=`.
- [ ] **Step 6:** `eas.json` profiles: `development` (developmentClient, `buildType: apk`, env `APP_VARIANT=development`, channel `development`), `preview` (`buildType: apk`, `APP_VARIANT=production`, channel `production`).
- [ ] **Step 7:** Run `npm run lint && npm run typecheck && npm test` → all pass.
- [ ] **Step 8:** Commit `chore: scaffold expo app with env config, tooling and gitignore`.

### Task 2: Domain types and expiry rules

**Files:** Create `src/domain/types.ts`, `src/domain/expiry.ts`. Test `src/domain/__tests__/expiry.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `YearMonth = { year: number; month: number }` (month 1–12)
  - `BatchStatus = 'expired' | 'soon' | 'watch' | 'ok'`
  - `AlertDays = { first: number; second: number }`
  - `Unit = 'carton' | 'box' | 'strip' | 'bottle' | 'tube' | 'can' | 'piece'`
  - `Shop { id; name; alertDays; notifyTime: string; joinSecret }`, `Device { id; displayName; joinedAt: number; removed: boolean }`, `Category { id; name; order: number; lastCheckedAt: number | null }`, `Company { id; name }`, `Medicine { id; name; categoryId; companyId; unit: Unit; composition?: string; packInfo?: string }`, `Batch { id; medicineId; batchNo; expiry: YearMonth; qty: number; billId: string | null; status: 'active' | 'returned' | 'removed'; createdAt: number }`, `Bill { id; supplier; billNo; billDate: string; scannedBy: string; createdAt: number }`, `StockEvent { id; batchId; medicineId; type: 'added' | 'sold' | 'count_fixed' | 'checked' | 'returned' | 'removed' | 'edited'; delta: number; deviceId: string; at: number }`
- Produces (expiry.ts): `expiryDate(ym: YearMonth): Date`, `daysUntilExpiry(ym: YearMonth, today: Date): number`, `batchStatus(ym: YearMonth, today: Date, alertDays: AlertDays): BatchStatus`, `parseExpiry(text: string, today?: Date): YearMonth | null`, `formatExpiry(ym: YearMonth): string` ("Nov 2026")

- [ ] **Step 1: Failing tests** (today = 6 Nov 2026 local, alertDays {90,30}):
  - `expiryDate({2026,11})` is 30 Nov 2026. `expiryDate({2028,2})` is 29 Feb 2028.
  - `daysUntilExpiry({2026,11}, today)` = 24. `daysUntilExpiry({2026,10}, today)` < 0.
  - `batchStatus`: `{2026,10}` → expired. `{2026,11}` → soon. `{2027,1}` (86 d) → watch. `{2027,8}` → ok. Expiry day itself (0 days) → soon. Exactly 30 days → soon. Exactly 90 → watch. 91 → ok.
  - `parseExpiry`: `'11/26'`, `'11/2026'`, `'11-26'`, `'NOV-26'`, `'Nov 2026'`, `'november 2026'`, `'2026-11'` → `{2026,11}`. `'1126'`, `'13/26'`, `'00/26'`, `''`, `'abc'` → `null`.
  - `formatExpiry({2027,8})` = `'Aug 2027'`.
- [ ] **Step 2:** `npm test -- expiry` → FAIL.
- [ ] **Step 3:** Implement. Two-digit years map to 20YY. Days are counted on local calendar dates (not ms/86400000 across DST).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit `feat(domain): batch types and expiry rules`.

### Task 3: Alerts, summaries, FEFO

**Files:** Create `src/domain/alerts.ts`, `src/domain/fefo.ts`. Test `src/domain/__tests__/alerts.test.ts`, `fefo.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `batchStatus`.
- Produces:
  - `isLive(b: Batch): boolean` (status active && qty > 0)
  - `alertCounts(batches: Batch[], today: Date, d: AlertDays): { expired: number; soon: number; watch: number }`. **Disjoint buckets**: watch excludes soon.
  - `batchesByStatus(batches, today, d, status: Exclude<BatchStatus,'ok'>): Batch[]`, soonest first
  - `medicineSummary(medicineId, batches, today, d): { qty: number; batchCount: number; next: YearMonth | null; worst: BatchStatus | null }`
  - `categorySummary(categoryId, medicines: Medicine[], batches, today, d): { medicineCount; unitCount; worst: BatchStatus | null; worstCount: number }`
  - `pickBatchForSale(batches: Batch[]): Batch | null`: earliest expiry among live batches, tie broken by older `createdAt`

- [ ] **Step 1: Failing tests:**
  - Fixture with 3 expired, 5 soon, 14 watch, 10 ok live batches, plus 2 returned and 1 qty-0 expired. `alertCounts` → `{3,5,14}`.
  - `categorySummary` for a category holding 2 expired + 1 soon → `worst 'expired', worstCount 2`. All ok → `worst 'ok'`. No batches → `worst null, unitCount 0`.
  - `medicineSummary` for AZ88 (2, Nov 2026) + AZ94 (3, Aug 2027) → `{ qty 5, batchCount 2, next {2026,11}, worst 'soon' }`.
  - `pickBatchForSale` picks AZ88. Skips qty 0 and returned. Returns null when nothing is live.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(domain): alert counts, summaries, FEFO`.

### Task 4: Matching and drafts

**Files:** Create `src/domain/matching.ts`, `src/domain/draft.ts`. Test `matching.test.ts`, `draft.test.ts`

**Interfaces:**
- Produces:
  - `normalizeName(s: string): string` (lowercase, strip punctuation, collapse spaces, `500mg` → `500 mg`)
  - `findMedicineMatch(name: string, medicines: Medicine[]): Medicine | null`
  - `DraftField = 'medicineName' | 'companyName' | 'batchNo' | 'expiry' | 'qty' | 'categoryId' | 'unit'`
  - `DraftBatch { key: string; source: 'scan' | 'voice' | 'manual' | 'bulk'; medicineName: string; companyName: string; categoryId: string | null; unit: Unit | null; batchNo: string; expiry: YearMonth | null; qty: number | null; matchedMedicineId: string | null; uncertain: DraftField[] }`
  - `emptyDraft(source): DraftBatch`
  - `applyMatch(d: DraftBatch, medicines: Medicine[], companies: Company[]): DraftBatch` (fills company/category/unit from the match)
  - `draftIssues(d: DraftBatch): DraftField[]`: missing or invalid fields. Category and unit are required only when unmatched.
  - `confirmField(d, f): DraftBatch` (removes f from uncertain)
  - `canSave(ds: DraftBatch[]): boolean`: non-empty, no issues, no uncertain fields

- [ ] **Step 1: Failing tests:**
  - `findMedicineMatch('AZITHRAL-500', [Azithral 500])` → match. `'Azithral 250'` vs `Azithral 500` → null (numbers must be equal). `'Benadril syrup 100ml'` vs `'Benadryl syrup 100 ml'` → match (bigram Dice ≥ 0.8 once numbers match).
  - `draftIssues` on an unmatched draft with no category → includes `'categoryId'`. `qty 0` → `'qty'`. `expiry null` → `'expiry'`.
  - `canSave([])` false. A draft with `uncertain:['expiry']` → false until `confirmField(d,'expiry')`.
- [ ] **Step 2–4:** FAIL → implement (Dice coefficient on character bigrams of normalized names, after requiring the multiset of numeric tokens to be equal) → PASS.
- [ ] **Step 5:** Commit `feat(domain): medicine matching and draft validation`.

### Task 5: Repository interfaces + in-memory implementation

**Files:** Create `src/data/repositories.ts`, `src/data/memory/createMemoryRepos.ts`. Test `src/data/__tests__/inventoryRepo.contract.test.ts`

**Interfaces:**
- Produces in `repositories.ts` (`Unsub = () => void`):
  ```ts
  interface ShopRepo {
    createShop(name: string, displayName: string): Promise<{ shopId: string; joinSecret: string; deviceId: string }>;
    joinShop(shopId: string, joinSecret: string, displayName: string): Promise<{ deviceId: string }>;
    watchShop(shopId: string, cb: (s: Shop) => void): Unsub;
    updateShop(shopId: string, patch: Partial<Pick<Shop, 'name' | 'alertDays' | 'notifyTime'>>, deviceId: string): Promise<void>;
    watchDevices(shopId: string, cb: (d: Device[]) => void): Unsub;
    renameDevice(shopId: string, deviceId: string, name: string): Promise<void>;
    removeDevice(shopId: string, deviceId: string, byDeviceId: string): Promise<void>;
    rotateJoinSecret(shopId: string, byDeviceId: string): Promise<string>;
  }
  interface InventoryRepo {
    watchCategories(shopId, cb: (c: Category[]) => void): Unsub;
    watchCompanies(shopId, cb: (c: Company[]) => void): Unsub;
    watchMedicines(shopId, cb: (m: Medicine[]) => void): Unsub;
    watchLiveBatches(shopId, cb: (b: Batch[]) => void): Unsub;          // status == 'active'
    watchMedicineEvents(shopId, medicineId, limit: number, cb: (e: StockEvent[]) => void): Unsub;
    saveIntake(shopId, drafts: DraftBatch[], bill: Omit<Bill, 'id' | 'createdAt'> | null, deviceId): Promise<void>;
    sellOne(shopId, batchId, deviceId): Promise<void>;
    setCount(shopId, batchId, qty: number, deviceId, type: 'count_fixed' | 'checked'): Promise<void>;
    markReturned(shopId, batchId, deviceId): Promise<void>;
    upsertCategory(shopId, c: Omit<Category, 'id'> & { id?: string }): Promise<string>;
    renameCompany(shopId, companyId, name): Promise<void>;
    mergeCompanies(shopId, fromId, intoId): Promise<void>;           // repoints medicines, deletes fromId
    mergeCategories(shopId, fromId, intoId): Promise<void>;
  }
  interface Repos { shop: ShopRepo; inventory: InventoryRepo; check: CheckRepo /* Task 16 */ }
  ```
- Produces: `createMemoryRepos(now?: () => number): Repos`. New shops are seeded with the §4 category list.

- [ ] **Step 1: Failing contract tests**, written as `runInventoryContract(make: () => Repos)` so Task 6 can reuse them:
  - `saveIntake` with one unmatched draft creates the Company, Medicine, Batch and one `added` event (delta = qty).
  - **duplicate guard:** a second `saveIntake` with the same medicine + batchNo adds qty to the existing batch (one batch, qty summed, second `added` event).
  - **same medicine twice in one intake:** `'Azithral 500'` and `'azithral-500'` with different batchNos → one Medicine, two Batches.
  - Free qty: a draft with qty 11 stores 11.
  - `sellOne` on qty 2 → 1 with a `sold` event of delta −1. On qty 1 → 0 and status `removed`. On qty 0 → rejects `/no stock/`.
  - `setCount(…, 0, …, 'checked')` → status `removed`. `setCount(…, -1, …)` rejects. Event delta = new − old.
  - `markReturned` → status `returned`, gone from `watchLiveBatches`.
  - `joinShop` with a wrong secret rejects `/invalid/`. After `removeDevice`, that device's writes reject `/not a member/`.
- [ ] **Step 2:** FAIL → **Step 3:** implement the memory repos (Maps + listener sets, synchronous notify) → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(data): repository contracts with in-memory implementation`.

### Task 6: Firebase implementation + security rules

**Files:** Create `src/data/firebase/{createFirebaseRepos.ts,converters.ts,paths.ts}`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `firebase.json`, `firebase/rules.test.ts`. Modify `app.config.ts` (RNFirebase config plugins).

**Interfaces:**
- Consumes: Task 5 interfaces.
- Produces: `createFirebaseRepos(): Repos`. Layout: `shops/{shopId}` with subcollections `devices`, `categories`, `companies`, `medicines`, `batches`, `bills`, `events`, `checks`. `YearMonth` is stored as `expiryKey: number` (YYYYMM) so it sorts and indexes.

- [ ] **Step 1:** Install @react-native-firebase/{app,auth,firestore} + config plugin. Enable Firestore persistence (`cacheSizeBytes: CACHE_SIZE_UNLIMITED`). Sign in anonymously on start.
- [ ] **Step 2: Failing rules tests** (`@firebase/rules-unit-testing`, emulator):
  - A non-member can't read `shops/s1/batches/*`.
  - A member device can read and write. A removed device can't.
  - Creating `devices/{uid}` (doc id == `request.auth.uid`) succeeds only when `request.resource.data.joinSecret == get(shop).data.joinSecret`. A wrong secret is denied. Keeping the secret on the device doc is acceptable, because members can already read it on the shop doc. After `rotateJoinSecret`, old device docs stay valid and only new joins need the new secret.
- [ ] **Step 3:** `npx firebase emulators:exec --only firestore "npx jest firebase/rules.test.ts"` → FAIL → write the rules → PASS.
- [ ] **Step 4:** Implement `createFirebaseRepos`. `saveIntake`, `sellOne`, `setCount` and `markReturned` use transactions. Each mutation writes its `StockEvent` in the same transaction or batch. Duplicate guard: query `batches` where `medicineId ==` and `batchNo ==` inside the transaction.
- [ ] **Step 5:** The contract tests run against the memory implementation only (RNFirebase can't run in Jest). The Firestore implementation is verified by the rules tests above and the Task 18 device checklist. Keep `createFirebaseRepos` a thin mapping so behaviour lives in shared domain functions.
- [ ] **Step 6:** Commit `feat(data): firestore repositories and security rules`.

### Task 7: Design-system UI kit

**Files:** Create `src/ui/tokens.ts` and `src/ui/{Screen,Card,ListRow,Pill,StatusPill,CountStrip,Button,ButtonRow,Stepper,Field,Chip,ChipRow,SectionHeader,KeyValueRow,ProgressBar,EmptyState,ErrorState,Skeleton,Icon,index}.tsx`. Test `src/ui/__tests__/ui.test.tsx`

**Interfaces:**
- Produces: `tokens` (`color`, `space` = 4-step scale `{1:4,2:8,3:12,4:16,5:20,6:24}`, `radius {card:8, control:6, pill:4}`, `font {12,14,16,20,24}`, `touch: 44`, `row: 56`, `labelCol: 72`) with the Global Constraints values.
  - `StatusPill({ status: BatchStatus; label: string })`. The single status → colour map.
  - `CountStrip({ items: {label: string; value: number | string; tone?: 'expired' | 'soon' | 'ink'}[]; selectedIndex?: number; onPress?(i) })`
  - `ListRow({ title; subtitle?; right?: ReactNode; chevron?: boolean; onPress? })`
  - `Button({ label; variant?: 'primary' | 'secondary'; onPress; disabled?; full? })`, `ButtonRow({ children })` (equal columns)
  - `Stepper({ value: number; onChange(n) ; min?: number })`, `KeyValueRow({ label; value })`
  - `Field({ label; value; onChangeText; uncertain?: boolean; uncertainLabel?: string; keyboardType? })`
  - `Icon({ name: 'home' | 'package' | 'scan' | 'check' | 'sliders' | 'search' | 'chevron-right' | 'back' | 'close' | 'mic' | 'keyboard' | 'file' | 'plus' | 'tick' })` (lucide-react-native)
  - `Screen({ title?; meta?; back?: string; children; footer? })` (16 side margin, safe area, ground colour)
- [ ] **Step 1: Failing tests:**
  - `StatusPill status='expired'` → background `#ffedea`, text colour `#831c1e`. `'soon'` → bg `#fffbeb` + border `#fde68a`. `'ok'` → no background, colour `#6b6b6b`.
  - `Button` label `Text` has `numberOfLines === 1`. `ButtonRow` children each have `flex: 1`.
  - `Stepper` with `min 0` at value 0: the − press doesn't call `onChange`.
  - `Field uncertain` shows `uncertainLabel` and the amber border `#d97706`.
  - `CountStrip` renders `tone 'expired'` values in `#c4242a`.
- [ ] **Step 2:** FAIL → **Step 3:** implement and load Geist via `expo-font` (`@expo-google-fonts/geist` if available, else bundle the TTFs) → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): design-system tokens and components`.

### Task 8: App shell, providers, onboarding

**Files:** Create `src/data/RepoContext.tsx`, `src/features/onboarding/{SessionContext.tsx,screens/*.tsx}`, `src/features/shared/hooks/{useToday.ts,useInventory.ts,useShop.ts}`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/onboarding/*`. Test `src/features/shared/__tests__/useToday.test.ts`, `src/features/onboarding/__tests__/onboarding.test.tsx`

**Interfaces:**
- Consumes: `Repos`, UI kit.
- Produces:
  - `RepoProvider({ repos })`, `useRepos(): Repos`
  - `SessionProvider` persisting `{ shopId, deviceId, displayName }` in expo-secure-store. `useSession(): { session: Session | null; setSession(s) ; clear() }`
  - `useToday(): Date` (local midnight-based, re-renders at the next midnight)
  - `useShop(): Shop | null`
  - `useInventory(): { categories; companies; medicines; batches; loading: boolean }`, memoized, one listener each
  - QR payload: `JSON.stringify({ v: 1, shopId, joinSecret })`
- [ ] **Step 1: Failing tests:**
  - **useToday rolls over at midnight:** fake timers at 23:59:30 on 6 Nov → after advancing 60 s, the hook returns 7 Nov.
  - Onboarding (memory repos): "Set up shop" → name → device name → the QR screen shows and stays until "I saved it" is pressed. Then the tabs render. "Join shop" with a scanned payload (inject via prop) → device name → tabs.
- [ ] **Step 2:** FAIL → **Step 3:** implement. The tabs layout is a bottom bar with Home · Stock · Add (black 52px circle, opens a bottom sheet with Scan bill / Speak / Type / Bulk import, each pushing `intake/*`) · Check · Settings. The root layout picks `createFirebaseRepos()` in the app and memory repos in tests. → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(app): providers, session, onboarding and tab shell`.

### Task 9: Home and alert lists

**Files:** Create `src/features/home/screens/{HomeScreen,AlertListScreen}.tsx`, `src/features/home/components/{CategoryList,CheckReminder,SyncLine}.tsx`, `src/features/home/hooks/useSyncState.ts`, routes `app/(tabs)/index.tsx`, `app/alerts/[status].tsx`. Test `src/features/home/__tests__/home.test.tsx`

**Interfaces:**
- Consumes: `useInventory`, `useShop`, `useToday`, `alertCounts`, `categorySummary`, `batchesByStatus`.
- Produces: `CategoryList({ limit?: number })`, reused by the Stock tab. `useSyncState(): { online: boolean; pending: number }` (Firestore `hasPendingWrites` / network). The memory impl returns `{online: true, pending: 0}`.
- [ ] **Step 1: Failing tests** (Task 3 fixture in memory repos, today 6 Nov 2026):
  - The strip shows Expired 3 / In 30 days 5 / In 90 days 14, with labels derived from `alertDays` (setting second = 60 → "In 60 days").
  - Category rows show one pill: Antibiotics "2 expired". All-ok categories show no warning pill.
  - Tapping "In 30 days" navigates to `alerts/soon`, which lists 5 rows, soonest first, each row "name · company · batch" with a date pill and a qty line.
  - The check reminder names the category with the oldest (or null) `lastCheckedAt`.
  - Empty shop: the strip shows 0 / 0 / 0, and the categories list shows the seeded categories with "0 medicines".
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(home): overview with alert counts, categories and check reminder`.

### Task 10: Stock tab and category screen

**Files:** Create `src/features/stock/screens/{StockScreen,CategoryScreen}.tsx`, `src/features/stock/components/{CompanyChips,CategoryEditor}.tsx`, routes. Test `src/features/stock/__tests__/category.test.tsx`

**Interfaces:**
- Consumes: `CategoryList`, `medicineSummary`, `upsertCategory`.
- [ ] **Step 1: Failing tests:**
  - Category screen meta: "88 medicines · 214 units · checked 18 days ago" (computed; "never checked" when null).
  - Company chips: "All companies" plus companies present in this category only. Selecting "Cipla" filters rows.
  - Rows are split into "Needs action" (worst ∈ expired/soon/watch, sorted by next expiry) and "All good". The row subtitle reads "Alembic · 5 cartons · 2 batches" (unit pluralised, batch count only when > 1).
  - Stock tab: "+ Add category" creates one. Reorder persists `order`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(stock): category list and category screen with company filter`.

### Task 11: Medicine screen

**Files:** Create `src/features/medicine/screens/MedicineScreen.tsx`, `src/features/medicine/components/{BatchCard,HistoryList,EditCountSheet}.tsx`, route. Test `src/features/medicine/__tests__/medicine.test.tsx`

**Interfaces:**
- Consumes: `medicineSummary`, `sellOne`, `setCount(…,'count_fixed')`, `markReturned`, `watchMedicineEvents`, `formatExpiry`.
- [ ] **Step 1: Failing tests:**
  - Strip: In stock 5 / Batches 2 / Next expiry "Nov 2026" (month precision), amber when soon.
  - Batch cards are oldest first. KeyValueRows "From bill: Raj Pharma · #4471 · 4 Nov" (or "Added by hand") and "Expires: in 24 days" / "in 9 months".
  - Each card has a `ButtonRow` of Sold 1 · Edit count · Returned. Sold 1 lowers qty by 1. Returned removes the card.
  - History shows the latest 3 events as "+5 cartons from bill #4471", "4 Nov · Ravi".
  - "+ Add batch" opens `intake/manual?medicineId=…` with the medicine prefilled.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(medicine): batches, actions and history`.

### Task 12: Intake pipeline — review screen + manual entry

**Files:** Create `src/features/intake/{IntakeContext.tsx,screens/ReviewScreen.tsx,screens/ManualScreen.tsx,components/ReviewCard.tsx,components/MedicineAutocomplete.tsx}`, routes `intake/review.tsx`, `intake/manual.tsx`. Test `src/features/intake/__tests__/review.test.tsx`

**Interfaces:**
- Consumes: `DraftBatch`, `applyMatch`, `draftIssues`, `confirmField`, `canSave`, `saveIntake`.
- Produces: `useIntake(): { drafts: DraftBatch[]; bill: BillHeader | null; setDrafts(ds, bill?) ; update(key, patch) ; confirm(key, field) ; remove(key) ; save(): Promise<void> }` where `BillHeader = { supplier: string; billNo: string; billDate: string }`. Every adapter (Tasks 13–15) calls `setDrafts` and then pushes `intake/review`.
- [ ] **Step 1: Failing tests:**
  - The review header says "6 items read · 2 need a look". The save button label is "Confirm 2 fields to save" and is disabled. After confirming both fields it reads "Save 6 items" and is enabled.
  - Uncertain fields render `Field uncertain` with "Check expiry" / "Check quantity".
  - An unmatched row shows a "New" tag and requires category + unit pickers. A matched row shows the category name read-only.
  - Save calls `saveIntake` once with all drafts, then returns to the previous screen with a toast "Saved 6 items".
  - Manual: "Save & next" saves one draft and clears only medicine name, batch, expiry and qty (category/company kept). Typing "azith" suggests "Azithral 500".
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(intake): shared review pipeline and manual entry`.

### Task 13: Bulk import

**Files:** Create `src/services/bulk/{sheetParser.ts,template.ts}`, `src/features/intake/screens/BulkScreen.tsx`, route. Test `src/services/bulk/__tests__/sheetParser.test.ts`

**Interfaces:**
- Produces: `TEMPLATE_HEADERS = ['category','company','medicine','unit','batch','expiry','qty']`, `parseSheetRows(rows: string[][], categories: Category[]): { drafts: DraftBatch[]; errors: { row: number; message: string }[] }`, `readSheetFile(uri: string): Promise<string[][]>` (SheetJS, CSV + XLSX), `shareTemplate(): Promise<void>`
- [ ] **Step 1: Failing tests:**
  - Headers are matched case-insensitively in any order. A missing `batch` column returns one error, "Missing column: batch".
  - A row with expiry `'13/26'` → error row 3 "Expiry not readable". Qty `'10+1'` → 11. An unknown unit → error. A blank row is skipped.
  - A category name that isn't in the shop → the draft has `categoryId null` (review asks for it).
  - Bulk drafts have `uncertain: []` (typed by a person).
- [ ] **Step 2–4:** FAIL → implement → PASS. Screen: "Get template" (share), "Pick file" (document picker) → errors list (if any) → "Review N rows" → `intake/review`.
- [ ] **Step 5:** Commit `feat(intake): spreadsheet bulk import with template`.

### Task 14: Voice entry

**Files:** Create `src/services/speech/{SpeechEngine.ts,native.ts,voiceParser.ts}`, `src/features/intake/screens/VoiceScreen.tsx`, route. Test `src/services/speech/__tests__/voiceParser.test.ts`

**Interfaces:**
- Produces: `interface SpeechEngine { isAvailable(): Promise<boolean>; start(onPartial: (t: string) => void): Promise<void>; stop(): Promise<string> }`, `nativeSpeechEngine` (expo-speech-recognition, `lang: 'en-IN'`), `parseVoiceEntry(transcript: string, medicines: Medicine[], companies: Company[]): DraftBatch`
- [ ] **Step 1: Failing tests:**
  - `"Azithral 500, Alembic, batch A Z 8 8, expiry November 2026, 2 cartons"` → name "Azithral 500", company "Alembic", batchNo "AZ88", expiry {2026,11}, qty 2, unit carton.
  - `"benadryl syrup batch k two two three one expiry eleven twenty six six bottles"` → batchNo "K2231", expiry {2026,11}, qty 6, unit bottle.
  - Always `uncertain ⊇ ['batchNo','expiry']`. A missing qty adds 'qty'.
  - A transcript matching an existing medicine fills company/category/unit via `applyMatch`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Screen: a hold-to-talk mic Button with the live transcript, "Next" (appends a draft, keeps listening), "Review N". If `isAvailable()` is false: the message "Voice isn't available right now. Use Type instead." plus a Type button.
- [ ] **Step 5:** Commit `feat(intake): voice entry with spoken-batch parser`.

### Task 15: Bill scan (OCR)

**Files:** Create `src/services/ocr/{OcrEngine.ts,mlkit.ts,billParser.ts}`, `src/services/ocr/__fixtures__/bill-raj-pharma.txt`, `src/features/intake/screens/ScanScreen.tsx`, route. Test `src/services/ocr/__tests__/billParser.test.ts`

**Interfaces:**
- Produces: `OcrLine = { text: string; top: number; left: number }`, `interface OcrEngine { recognize(imageUri: string): Promise<OcrLine[]> }`, `mlkitOcrEngine`, `parseBillText(lines: OcrLine[]): { header: Partial<BillHeader>; drafts: DraftBatch[] }`, `qtyFromToken(t: string): number | null`
- [ ] **Step 1: Failing tests** with a synthetic fixture (columns: product, pack, batch, exp, qty, free, rate) **until the owner supplies real bills**:
  - The header finds supplier (first line), bill no (`Bill No|Inv No|Invoice` followed by a token) and date.
  - Each product line → a draft with batchNo, expiry, qty = qty + free.
  - Lines whose expiry is unparseable → `expiry null` + `'expiry'` uncertain. Qty unparseable → `'qty'` uncertain.
  - Totals/GST lines (`Total`, `CGST`, `SGST`, `Round`) produce no draft.
  - `qtyFromToken('10+1')` = 11, `'10'` = 10, `'x'` = null.
- [ ] **Step 2–4:** FAIL → implement (group OcrLines into rows by `top` within a tolerance, then token rules) → PASS. Screen: expo-camera with a guide frame, capture / pick from gallery, retake, "Reading bill…" state, then `setDrafts` + push review. The photo stays in the app cache only.
- [ ] **Step 5:** Commit `feat(intake): bill scanning with on-device OCR`.

### Task 16: Stock check

**Files:** Modify `src/data/repositories.ts`, `src/data/memory/*`, `src/data/firebase/*`, `firebase/firestore.rules`. Create `src/features/check/screens/{CheckListScreen,CheckScreen}.tsx`, routes. Test: extend the contract test with a `check` block, plus `src/features/check/__tests__/check.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type CheckSession = { categoryId: string; startedAt: number; checked: Record<string, { by: string; at: number }> };
  interface CheckRepo {
    watchCheck(shopId, categoryId, cb: (s: CheckSession | null) => void): Unsub;
    markChecked(shopId, categoryId, batchId, qty: number, deviceId): Promise<void>; // calls setCount(…,'checked') + records the row
    finishCheck(shopId, categoryId, totalLiveBatchIds: string[]): Promise<{ complete: boolean }>;
  }
  ```
- [ ] **Step 1: Failing tests:**
  - `markChecked` with the same qty writes a `checked` event with delta 0. With a new qty, `delta = new − old`. With 0 → batch `removed`.
  - `finishCheck` with all ids checked → `complete true`, `lastCheckedAt` set, session cleared. With some unchecked → `complete false`, `lastCheckedAt` unchanged, the session is kept, and the category shows "partly checked · 76 of 88".
  - A `sellOne` from another device after `markChecked` lowers qty by 1 more (it's applied as a change).
  - Screen: the progress text is "12 of 88 medicines checked · Priya". Rows are grouped by company. The ✓ button fills black once checked. "+ Add batch" opens manual entry with the category preset.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(check): resumable shared stock check`.

### Task 17: Notifications and Settings

**Files:** Create `src/services/notifications/{Notifier.ts,expo.ts,message.ts}`, `src/features/settings/screens/{SettingsScreen,DevicesScreen,CategoriesCompaniesScreen,JoinQrScreen}.tsx`, `src/features/shared/hooks/useDailyAlert.ts`, routes. Test `src/services/notifications/__tests__/message.test.ts`, `src/features/settings/__tests__/settings.test.tsx`

**Interfaces:**
- Produces: `dailyMessage(c: { expired; soon; watch }, d: AlertDays): string | null`, `interface Notifier { requestPermission(): Promise<boolean>; scheduleDaily(time: string, body: string): Promise<void>; cancelAll(): Promise<void> }`, `useDailyAlert()` (reschedules when counts, alertDays or notifyTime change)
- [ ] **Step 1: Failing tests:**
  - `dailyMessage({3,5,14},{90,30})` = `"3 expired · 5 expire within 30 days"`. `({0,0,4})` = `"4 expire within 90 days"`. `({0,0,0})` = `null` (no notification scheduled).
  - Settings: setting second ≥ first is rejected with "Second alert must be fewer days than first". Saving calls `updateShop` and Home labels update.
  - Devices: lists devices with "(this phone)". Remove asks for confirmation and then calls `removeDevice`. "New join code" rotates the secret and shows the new QR.
  - Categories/companies: rename, plus merge ("Merge Sun into Sun Pharma?" → `mergeCompanies`).
  - Version row shows `expo-application` version + the EAS Update id. "Check for update" calls `Updates.checkForUpdateAsync` / `fetchUpdateAsync` / `reloadAsync`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Tapping the notification opens `alerts/soon` (or `alerts/expired` if any are expired).
- [ ] **Step 5:** Commit `feat(settings): alert settings, devices, merging and daily notification`.

### Task 18: Build, distribute, device verification

**Files:** Create `README.md` (setup, env, Firebase project steps, build and update commands, how to share the APK), `docs/device-checklist.md`

- [ ] **Step 1:** Create two Firebase projects (dev, prod). Enable Anonymous Auth and Firestore. Deploy rules + indexes (`npx firebase deploy --only firestore`). Upload each `google-services.json` as an EAS file env var `GOOGLE_SERVICES_JSON`.
- [ ] **Step 2:** `npm run build:apk` → the APK URL prints. Install it on a physical Android phone.
- [ ] **Step 3:** Work through `docs/device-checklist.md` on two phones. Each line passes or gets a fix task:
  - Setup + QR save, then join from the second phone. A change on one phone shows on the other in < 5 s.
  - Airplane mode: Sold 1 and add a batch, reconnect, and both sync with no duplicates.
  - Scan a real bill, speak 3 entries, import a 10-row sheet, then review and save.
  - Stock check paused on phone A and resumed on phone B.
  - The notification fires at the set time with the correct text.
  - **Spacing pass at 360dp and 412dp** (Android display size small/default): no wrapped button text, aligned label columns, no clipped pills, every touch target ≥ 44.
  - `eas update --channel production` reaches an installed phone after restart.
- [ ] **Step 4:** Commit `docs: readme and device checklist`.

---

## Self-review notes

- Spec coverage: §3 goals → Tasks 9–17. §4 data/rules → 2–5. §5 sync/no-login/equal phones/recovery/scale → 6, 8, 17, 18. §6.1–6.8 screens → 9–17. §7 visual → 7 + 18 spacing pass. §8 engineering → 1, 5, 6, 7, 12. §10 real bills → the Task 15 fixture is replaced when bills arrive.
- Type names are consistent across tasks: `DraftBatch`, `YearMonth`, `BatchStatus`, `AlertDays`, `Repos`, `CheckRepo`, `BillHeader`.
- One correction made inline: the medicine screen's "Next expiry" shows month precision ("Nov 2026"), because expiry is stored as a month. The mockup's "20 Nov" was sample data.
