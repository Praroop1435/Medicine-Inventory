# Med Stock

An Android app for one medical shop to track medicine stock by batch and expiry. Three or so
staff each use their own phone; every phone is equal and sees the same stock within seconds.
There are no logins: a phone joins the shop by scanning the shop's QR code.

- Add stock by scanning a distributor bill (camera, gallery photo or PDF, read on the phone with
  ML Kit), by voice, by typing, or by importing a spreadsheet. Every intake ends on one review
  screen; nothing is saved until each row is confirmed.
- Home shows what has expired and what expires soon; a morning notification says the same.
- A night reminder and a per-folder stock check keep counts honest.
- Works offline. Changes sync through Firebase (Firestore with offline persistence, anonymous
  auth) when the phone is back online.

Design spec: `docs/superpowers/specs/2026-11-06-medicine-inventory-design.md`.

## Stack

Expo SDK 58, Expo Router, TypeScript (strict), React Native Firebase, ML Kit text recognition,
expo-speech-recognition, expo-notifications, expo-updates. Android only.

## Development setup

1. `npm install`
2. Copy `.env.example` to `.env`:
   - `APP_VARIANT=development` gives the app `com.medstock.app.dev`, named "Med Stock (Dev)", so
     it installs next to the production app. `production` gives `com.medstock.app`.
   - `EAS_PROJECT_ID` can stay empty; `app.config.ts` defaults it.
   - `GOOGLE_SERVICES_JSON` can stay empty. Locally the development variant reads
     `./google-services.dev.json` and the production variant reads `./google-services.json`.
3. Put both Firebase config files in the repo root (they are git-ignored):
   - `google-services.dev.json` from the dev project `medstock-anand-dev`
   - `google-services.json` from the production project `medicine-inventory-1435`
4. Build a dev client once and install it on a phone or emulator:
   `eas build -p android --profile development`
5. `npm start` and open the dev client.

Native modules (Firebase, ML Kit, speech, the local `modules/pdf-pages` PDF renderer) mean
Expo Go won't work. A dev client or a real build is needed.

### Checks

```sh
npm run lint
npm run typecheck
npm test
# Firestore security rules, against the emulator (needs Java 21):
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run test:rules
```

## Firebase

There are two projects. Both use Anonymous Auth and Firestore.

| Variant     | Project                   | Android package        |
| ----------- | ------------------------- | ---------------------- |
| development | `medstock-anand-dev`      | `com.medstock.app.dev` |
| production  | `medicine-inventory-1435` | `com.medstock.app`     |

Rules (`firebase/firestore.rules`) and indexes (`firebase/firestore.indexes.json`) are deployed
together:

```sh
npx firebase deploy --only firestore --project medstock-anand-dev
npx firebase deploy --only firestore --project medicine-inventory-1435
```

Run the rules tests before deploying a rules change.

## EAS

The EAS project id is `8b476ffd-e696-417e-ba48-61651fe305ec`. Each build profile in `eas.json`
sets `APP_VARIANT`, a channel and an EAS environment:

| Profile       | Variant     | Channel     | Environment | Use                  |
| ------------- | ----------- | ----------- | ----------- | -------------------- |
| `development` | development | development | development | dev client           |
| `test`        | development | test        | development | APK against dev data |
| `preview`     | production  | production  | production  | the shop's APK       |

### Secrets

Builds get the Firebase config from an EAS file variable named `GOOGLE_SERVICES_JSON`, one per
environment:

```sh
eas env:create --name GOOGLE_SERVICES_JSON --type file --visibility secret \
  --environment development --value ./google-services.dev.json
eas env:create --name GOOGLE_SERVICES_JSON --type file --visibility secret \
  --environment production --value ./google-services.json
```

### Building the APK

```sh
npm run build:apk
```

This builds the `preview` profile: the production app, as an installable APK. EAS keeps the
Android version code (`appVersionSource: remote`) and raises it on every build. When the build
finishes, the command prints a link and a QR code to the APK.

### Installing on the shop's phones

1. Open the build link on the phone (scan the QR from the build page, or send the link on
   WhatsApp).
2. Download the APK and open it. Android asks to allow installs from that app (Chrome or
   WhatsApp) once. Allow it, then tap Install.
3. The first phone sets up the shop and saves the shop QR image. The others choose Join and
   scan it.

Installing a newer APK over an older one keeps the shop data on the phone.

### Publishing an update (OTA)

JavaScript-only changes can go out without a new APK:

```sh
npm run update:prod
```

This publishes to the `production` channel with the production environment. Phones download it
in the background and run it after the app restarts, or straight away from Settings → Check for
update.

The runtime version follows the app `version` in `app.config.ts`, so an update only reaches APKs
built from the same version. After a native change (a new native package, a plugin or config
change, or a change in `modules/`), raise `version` and build a new APK instead.

## Device testing

Before handing out a build, go through `docs/device-checklist.md` on two phones.
