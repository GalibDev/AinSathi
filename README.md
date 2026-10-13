# AinSathi — Firebase Spark edition

The active application uses Firebase Authentication (Google/email) and direct Cloud Firestore. It does not call Supabase, Cloud Functions or Cloud Storage. Blaze is not required for these features within Spark quotas. Document upload/download is disabled. Existing Supabase data is untouched and is not automatically migrated.

## Finish setup

1. Firebase Console → project `ainsathi` → Firestore Database → Create database → **Standard edition**, choose a region, **Production mode**. If the database already exists, keep it.
2. Firestore Database → Rules: replace the editor with the entire contents of `firebase/firestore.rules`, then Publish. Never use open/test rules for client information.
3. Authentication → Sign-in method: enable Google and Email/Password. Add your deployed hostname under Settings → Authorized domains. Email accounts must verify their email before using a chamber.
4. Vercel → Settings → Environment Variables: set the six `VITE_FIREBASE_*` values shown in `.env.example`, using your Firebase web app configuration. Redeploy the latest commit. Supabase variables are no longer needed by the active app.
5. Sign in, create a chamber, add a client and case, then a hearing. A new Firestore chamber starts empty. Verify access using a second account before entering real client records.

Alternatively deploy rules from an authenticated CLI: `npx firebase-tools login`, then `npm run firebase:deploy:rules`. No Functions or Storage deployment is configured in `firebase.json`. This session has not published the hosted rules or changed Console settings.

## Development

`npm ci`, copy `.env.example` to ignored `.env.local`, fill in Firebase configuration, then `npm run dev`.

Checks: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
Rules integration tests require Java 21 and Firestore Emulator:
`npx firebase-tools emulators:exec --only firestore --project demo-ainsathi "npm run test:rules"`.

## Behavior and limits

- Organization membership is enforced by Firestore Rules. Owner/admin manage invitations, roles and assignments; viewers cannot write. Founder ownership cannot be changed by the app.
- Case numbers use an atomic transaction and a per-chamber counter. Case edits and status changes append immutable activity entries. Activity timestamps come from clients; this is not a tamper-proof regulatory audit system. Archive and hearing changes do not produce activity entries.
- Invitations are single use, expire in seven days, and require the invited verified email. The app creates a link for you to share; it does not send emails.
- Upcoming hearing reminders appear inside the app. No background push, SMS or automatic scheduled email is provided.
- Each collection read is capped at 1,000 records and fails explicitly beyond that. Search/filter/report computation happens in the browser. Reads count toward Spark quotas; repeated searches consume reads. This version needs server pagination before scaling to a large practice.
- Duplicate client phone numbers are allowed. Case/client records can be archived; this does not delete them. Documents and previous Supabase files remain outside this version.
- Offline private-data persistence and service-worker API caching are disabled. Authentication persistence follows Firebase Auth defaults.
- `firebase-functions/` and `supabase/` are legacy reference/test code, not deployed or called by the active application.

## Credentials

Never commit `.env.local`, service-account JSON, admin keys or real configuration literals. `npm run security:scan` runs before production builds. Browser Firebase configuration is shipped in the frontend bundle; security depends on Rules and appropriate API restrictions. A Google API key appeared in an older Git commit; deleting it from current source does not revoke it or remove it from history. Rotation/restriction and any Git history cleanup remain separate tasks. No service-account key is required for this Spark app.

## Mobile loading and installation

Dashboard data loads use two parallel collection reads rather than repeated report/search queries. Firestore uses long polling for browser/network compatibility and server reads to avoid silently showing stale cached results. Resource and workspace loads time out after 20 seconds with a retry action; this does not cancel underlying SDK work or prove hosted connectivity is healthy.

The install button triggers the native browser prompt when available and otherwise explains installation. On iPhone, open in Safari, Share → Add to Home Screen → Add. Installed mode hides the install button. The manifest uses standalone display and the dashboard start URL; an Apple touch icon is included. A waiting service-worker update offers an explicit update action to avoid losing unsaved form data. PWA installation does not provide offline case access; Firestore still needs an internet connection.

Case and client forms accept blank fields so incomplete records can be saved and edited later. Empty names use visible unnamed placeholders; an empty case year defaults to the current year. Cases may omit a linked client and received date. Nonempty phone numbers, dates and client IDs still need valid formats. Publish the latest firebase/firestore.rules to enable these changes on the hosted database. Hearing dates and case-closure details remain required for those separate actions.
