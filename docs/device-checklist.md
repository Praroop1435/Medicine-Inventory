# Device checklist

Run this on two physical Android phones (A and B) with the build you plan to hand out
(`npm run build:apk`). Tick each line, or write down what went wrong and open a fix task.

Build: ________ Phones: A ________ (Android __) B ________ (Android __) Date: ________

## Setup and joining

- [ ] A: fresh install → Set up shop → shop name → phone name → the shop QR shows. "Save QR
      image" opens the share sheet and the saved image scans.
- [ ] A: "Stay on top of expiry" → Allow notifications shows the Android prompt (Android 13+).
- [ ] B: Join → camera permission is asked with its reason → scan A's QR → phone name → Home.
- [ ] Join with no internet says it needs the internet; it works on retry once online.
- [ ] Settings → Phones lists both phones and marks "(this phone)".

## Sync between phones

- [ ] A change on one phone (Sold 1, a new batch, a renamed folder) shows on the other in under
      5 seconds.
- [ ] Airplane mode on A: Sold 1 on one batch and add a new batch. The sync line shows pending
      changes. Reconnect: both phones agree, with no duplicate batch and no lost sale.
- [ ] Both phones offline: each sells from the same batch. Reconnect: the quantity reflects both
      sales.
- [ ] Phone B sells the last unit of a batch while A is offline; A, still offline, counts it on
      the shelf as 2. Reconnect: the batch is live with 2.

## Adding stock

- [ ] Scan a real bill with the camera, from a sideways and a slightly skewed angle: rows,
      batch numbers and expiries read; uncertain fields are amber.
- [ ] Photo from gallery: the same bill reads the same.
- [ ] PDF file (a bill received on WhatsApp): every page is read and all rows land on one review
      screen. A long multi-page PDF doesn't crash.
- [ ] Voice: microphone permission is asked with its reason. Speak 3 entries ("Azithral 500,
      Alembic, batch A Z 8 8, expiry November 2026, 2 cartons"). Batch and expiry are always
      amber. With speech unavailable offline, the button says so and suggests Type.
- [ ] Bulk import: download the template, fill 10 rows, import. Bad rows are reported, good rows
      go to review.
- [ ] Review: a near-name match says "Matches existing …" and "New medicine instead" works; a row
      that tops up a batch says "Adds to existing batch …"; an expired or far-future expiry is
      flagged. Save goes Home with a toast.
- [ ] Type: "+ Add batch" from a medicine starts from that medicine.

## Stock check

- [ ] Start a folder check on A, tick some rows, leave. Resume on B: A's ticks are there with
      A's name.
- [ ] A count of 0 asks before closing the batch. Finish check with rows left asks first.
- [ ] A folder with many batches scrolls smoothly.

## Notifications

- [ ] The morning alert fires at the set time with the right counts, and opens the matching
      alert list when tapped.
- [ ] Change the morning time in Settings → Reminders: the next alert comes at the new time.
- [ ] Don't open the app for a day: the next morning's alert still has that day's counts.
- [ ] The night reminder fires at its time, names the folder due for a check and opens it.
- [ ] Notifications denied: Settings shows "Notifications are off · Turn on".

## Removing a phone

- [ ] A: Settings → Phones → Remove B with "Also make a new join code" left on. B shows "This
      phone was removed from the shop." once and goes to the welcome screen. The old QR image no
      longer joins; the new one does.

## Layout

- [ ] Spacing pass at 360dp and 412dp (Android display size small and default): no wrapped
      button text, aligned label columns, no clipped pills, every touch target at least 44.

## Updates

- [ ] `npm run update:prod` with a visible change: the installed phone shows it after a restart,
      or at once from Settings → Check for update.
