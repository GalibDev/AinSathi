# AinSathi — আপনার মামলা, আপনার নিয়ন্ত্রণ

Bengali-first lawyer/chamber management app using React, strict TypeScript, Vite, Firebase Authentication, Firestore and private Cloud Storage. Navy/gold responsive desktop and mobile UI. Hosting configuration targets Vercel.

## Current status

The active app has migrated from Supabase to Firebase. The browser uses Firebase Google popup login and email/password login, registration, email verification and password recovery. All live chamber data goes through the authenticated workspace callable in asia-south1. The client never falls back to demo records. Analytics is not initialized.

Local checks are not a hosted deployment. Firebase CLI has no signed-in account on this machine. At the last unauthenticated configuration check, the supplied project's Auth API returned CONFIGURATION_NOT_FOUND; enable Authentication in the Console. Hosted Google consent, emails, Firestore CRUD, signed download IAM and Storage uploads remain unverified until Console setup and deployment.

The old Supabase migration/tests remain under supabase/ for reference. Existing Supabase records and accounts have NOT been copied to Firebase. Keep that project intact until any required data migration is reviewed. Old setup notes are in supabase/README-legacy.md; they do not configure the active Firebase app.

## Local setup

Node.js 24+ and npm. Functions deploy to Node.js 22 (a different local Node version can produce an engines warning).

~~~powershell
npm ci
npm ci --prefix firebase-functions
Copy-Item .env.example .env.local
# Set the six VITE_FIREBASE_* values from Firebase Project settings → Your apps.
npm run dev
~~~

Open http://127.0.0.1:5173/login. The explicit /demo/dashboard route is fictional, memory-only, and resets on reload. It cannot upload real files or invite members. .env.local is ignored by Git. Public web config belongs in frontend environment variables; Admin/service-account keys must never be included in VITE_* or committed.

## Firebase Console setup

1. Select project ainsathi. Build → Authentication → Get started.
2. Sign-in method: enable Google, select a support email, Save. Enable Email/Password too. No manual Google Client Secret is needed for the standard Firebase Google provider setup.
3. Authentication → Settings → Authorized domains: add localhost and 127.0.0.1. Add the exact Vercel/custom domain after frontend deployment. Configure verification and reset email templates. Firebase's hosted action handler is used for email confirmation/password reset; continue links return to the app. /reset-password also supports a valid oobCode if you configure a custom email action URL later.
4. Build → Firestore Database → Create database → Standard edition, Native mode, Production mode. Use a suitable location near users, preferably asia-south1 to match functions if available. Do not use test/open rules. If a database already exists, preserve its location and records.
5. Enable Blaze billing to deploy Cloud Functions and use Cloud Storage. This is a paid usage plan, not a promise of zero cost. Configure billing budget alerts and review quotas. No billing change has been made by the agent.
6. Build → Storage → Get started → create the default bucket in production mode. The supplied bucket is ainsathi.firebasestorage.app. Do not add public read/upload rules.
7. Sign in to the CLI locally using your Google account and deploy the prepared server and deny-all client rules:

~~~powershell
npx firebase-tools login
npm run firebase:build
npm run firebase:deploy
~~~

The deploy command explicitly targets project ainsathi. firebase.json's predeploy also builds the functions. The callable uses Firebase-managed runtime credentials; do not download a private key. Signed downloads may need the IAM Service Account Credentials API enabled and the runtime service account granted Service Account Token Creator on itself, in addition to access to its project bucket. Verify this with the first download; do not grant broad roles to users.

8. Register and verify email, or use Google. Create a chamber, then a client, then a case. Test closure/reopening, hearing date updates, team invitations, uploads and download expiry with a second account from another chamber before entering confidential records.

Official setup: https://firebase.google.com/docs/auth/web/google-signin and https://firebase.google.com/docs/functions/get-started. Storage billing: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024.

## Security and data model

Firestore and Storage rules deny all direct client access. The workspace callable verifies Firebase identity and email verification, and authorizes every organization-scoped action using organization_members. Writes recheck membership inside their transaction. Server input/result boundaries use Zod. Organization-scoped subcollections keep references in their chamber. Browser-supplied IDs cannot select records from another chamber.

Per-chamber counters and case inserts commit in one Firestore transaction; editing cannot change serials. Closing requires a valid date on/after receipt and a disposal result. Reopening clears current disposal fields while append-only event records retain the previous result. History and audit rows are written atomically with changes. Direct clients cannot alter them.

All members can read their chamber's records. Owners/admins/lawyers/assistants edit records; viewers only read. Owner/admin can edit chamber settings and invite ordinary members; only the owner invites admins and changes roles. The founding owner cannot be demoted or replaced in this version, and creating additional owners is disabled. Case assignment organizes work; it is not an extra confidentiality boundary.

Invitations use 256-bit random tokens stored only as SHA-256 hashes, expire in seven days, and require an exact verified email. Acceptance is transactional and one-use. Memberships and organizations are capped at 200 per user; chamber creation is capped at 20 per user. Invitation links are copied for a human to send, never automatically messaged.

Uploads accept valid PDF/JPEG/PNG up to 10 MB. The function verifies bytes/MIME, user role and a live case, applies a transactional 20-upload quota in fixed ten-minute windows per user/chamber, then writes private bytes and metadata. File signature checks are not malware scanning. A failed metadata transaction attempts to remove the uploaded object; backups/admin reconciliation should account for rare cleanup failures. Archives preserve files for retention. Downloads use a 60-second signed URL. It remains usable until expiry even if membership is revoked in that interval.

The app caches static assets only through its PWA service worker, never private API data/documents. No Firestore offline persistence is enabled. Authentication tokens use Firebase browser persistence. Launch work still includes App Check enforcement, platform request limits, monitoring, retention policy, malware scanning if required, backup/restore drills, and accessibility/security review.

## Bounded lists and reports

The initial Firebase server reads at most 5,000 records per chamber subcollection for filtering/search/report calculations, and fails explicitly above that limit instead of returning misleading totals. This can incur Firestore reads per request; larger chambers need indexed server pagination/search and aggregate reports before scaling. Case/client UI pages use 20 records; hearings 200; documents/history/notes/related cases 100; notifications 50; members 200. Narrow date/search filters where possible. Reports export CSV; there is no PDF renderer or fee/payment module.

Hearing reminders appear in the app. Save-hearing notifications go to the saving user; assignments notify the assigned member. Scheduled email/SMS/push reminders are not deployed.

## Checks

~~~powershell
npm run typecheck
npm run lint
npm test
npm run firebase:build
npm run build
# With npm run dev running:
npx playwright install chromium
npm run test:e2e
~~~

Firebase tests execute the real callable dispatcher against an in-memory transactional adapter: verified identity, tenant isolation, viewer writes, serial preservation, cross-org references, normalized phone uniqueness, close/reopen history, immutable owner, invitation email/replay, hearings, assignments and server file validation. These do not verify Firestore transaction contention, IAM, deployed rules, Google popups, live emails, storage signatures or hosted isolation. Historical Supabase tests run embedded PostgreSQL and do not validate the Firebase deployment.

For full local emulator testing install a current Java runtime supported by Firebase CLI, then run npx firebase-tools emulators:start --project demo-ainsathi after building functions; set VITE_FIREBASE_EMULATORS=true and use an isolated demo-ainsathi frontend config. Never run an emulator client with real patient/client/case data. Full emulator/hosted integration tests remain a deployment task.

## Vercel and backups

Import GalibDev/AinSathi. Build command npm run build; output dist. The owner-supplied public Firebase web config for ainsathi is included as a deployment default. Vercel can build without .env.local. To use another Firebase project, set all six VITE_FIREBASE_* environment variables (not NEXT_PUBLIC_*) and redeploy. Add the deployed hostname to Firebase Authorized domains. vercel.json provides SPA rewrites and baseline headers. No Vercel deployment has been performed in this session.

Back up Firestore records AND private Storage objects; one is not a backup of the other. Preserve document keys, associations and file hashes. Test restoration into a separate restricted project before relying on the system. Review billing/retention and configure scheduled backups under the chamber owner's policy.
