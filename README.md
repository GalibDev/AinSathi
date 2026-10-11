# AinSathi — আপনার মামলা, আপনার নিয়ন্ত্রণ

React + TypeScript + Vite lawyer/chamber app. **Firebase handles Google/email authentication. Supabase handles PostgreSQL case data, RLS permissions and private Storage.** The active app does not call Firebase Cloud Functions or Firestore. Their previous implementation remains in firebase-functions/ and firebase/ as inactive reference only; do not deploy it for this setup.

## Status

The Supabase initial schema was already run by the owner. The follow-up Firebase identity migration is prepared and tested locally, but has NOT been applied to the hosted project in this session. Supabase must also be configured to accept the Firebase project's signed tokens. Real data access after login depends on both steps below. Google sign-in is already enabled by the owner. Existing Supabase case data and UUIDs are preserved; no tables or cases are dropped.

## Two required dashboard steps

1. Supabase project nlokgndyjuajgyjjgwhw → Authentication → Third-party Auth → Add provider → Firebase. Enter Firebase **Project ID: ainsathi**, then Save. This is the project name ID, not the numeric sender ID. Supabase must verify the Firebase token before Postgres sees it. A browser cannot safely bypass this configuration.
2. Supabase SQL Editor: run the complete file supabase/migrations/202610110001_firebase_identity.sql. Run this AFTER the initial schema, not instead of it. It adds a private Firebase-subject → UUID mapping, keeps old records, updates application permissions, and preserves the original serial allocator and auditing. Do not reset the database or rerun the original CREATE TABLE migration against existing tables.

Official integration: https://supabase.com/docs/guides/auth/third-party/firebase-auth.

The standard Supabase guide uses a Firebase custom role claim. This app instead deliberately supports verified Firebase tokens arriving with Postgres anon, avoiding a paid Firebase claim-setting function. Every existing tenant policy is protected by an additional restrictive gate: exact Firebase issuer, exact project audience, email_verified=true and a mapped identity. Public keys alone, unverified users, other Firebase projects and unrelated chamber members are denied. Supabase still verifies the token's signature via the Third-party Auth integration. Never remove these restrictive policies or replace them with open policies.

Then reload the app, sign in with Google, and create a chamber, client and case. Old Supabase-auth accounts remain valid under their original issuer. Firebase identities are not automatically linked to old accounts by email; if old chambers need access transfer, review and assign membership explicitly rather than taking over an account by email.

## Local development and Vercel

~~~powershell
npm ci
npm run dev
~~~

All Firebase and Supabase web configuration must be supplied through .env.local and Vercel environment variables, using the names in .env.example. No real API keys or publishable keys are hardcoded in tracked source. Never use NEXT_PUBLIC_* in this Vite app. Never put a service-role key or private key in frontend environment variables or Git. .env.local is ignored.

Firebase Authentication → Settings → Authorized domains must include localhost, 127.0.0.1 and ain-sathi.vercel.app (hostname only). Google and optional Email/Password providers should be enabled. Verification/password recovery use Firebase's hosted email action handler. Analytics is not initialized.

Vercel builds with npm run build, output dist. vercel.json supplies SPA rewrites. Git pushes can deploy the frontend; they do not apply SQL or deploy Supabase Edge Functions. /demo/dashboard is isolated in-memory fictional data, resets on refresh, and cannot upload/invite. Production never silently falls back to demo data.

## Private document uploads

Supabase stores files in the existing private case-documents bucket. Deploy the upload validation function separately after the identity migration and provider configuration:

~~~powershell
npx supabase login
npx supabase link --project-ref nlokgndyjuajgyjjgwhw
npx supabase functions deploy upload-document --no-verify-jwt
npx supabase secrets set ALLOWED_ORIGINS=https://ain-sathi.vercel.app,http://127.0.0.1:5173
~~~

Gateway legacy JWT verification is disabled for this function because Firebase uses different signing keys. The function itself requires a bearer token and calls sync_firebase_profile through the user-scoped Supabase client; Supabase validates the signature/project and SQL requires verified email before any service-role storage work. It then checks chamber membership, editor role, case, size (10 MB), MIME and file magic. The service-role key is only the Supabase-managed server environment secret. It is never returned or used in the frontend. Browser raw Storage INSERT remains denied. Do not disable this in-function authorization.

PDF/JPEG/PNG file checks are not antivirus scanning. Downloads use a 60-second signed link; archived files remain stored for retention. Upload quota is a non-atomic metadata count (20 uploads per user / ten minutes); production gateway/rate protection remains a launch task. Unusual failed cleanup can leave an orphan that requires admin reconciliation.

No Firebase Blaze plan is required by this architecture. Supabase hosting/storage/Edge quotas and pricing still apply.

## Permissions and workflows

All chamber members can read their chamber records. Owner/admin/lawyer/assistant edit operational records; viewer is read-only. Owner/admin manage chamber settings and invite ordinary members; only owner invites admins and changes existing roles. The last owner cannot be demoted. Assignments organize work and are not an additional read boundary.

Case serials allocate atomically in PostgreSQL per chamber. Close/reopen retains disposal history. Hearings derive the next date at read time. Notes/audit history are server attributed to the internal mapped UUID. Invitations expire after seven days and require an exact verified email. A human sends the invitation link.

Cases/clients use 20-row server pagination; hearings 200 per range; notes/history/documents and related cases 100; members 200; notifications 50. Reports export CSV. In-app notifications/reminders are implemented; scheduled SMS/email/push, fee/payment, PDF reports and private offline access are not implemented. PWA caches static files only.

## Checks and limits

~~~powershell
npm run typecheck
npm run lint
npm test
npm run build
# With npm run dev running:
npm run test:e2e
~~~

Tests apply the real initial SQL and Firebase identity migration to embedded PostgreSQL with stubbed auth/storage schemas. They exercise Postgres anon Firebase identities, non-UUID UID mapping, anonymous denial, unverified/wrong-project denial, tenant isolation, viewer restrictions, note/audit attribution, invitations, private storage and legacy Supabase records, in addition to the initial serial/status/RLS tests. They do not validate hosted token signature verification, live Google consent, deployed Edge uploads, email delivery or production concurrency. Browser tests cover UI/demo flows and mocked auth errors. Hosted verification is still required after dashboard setup.

Keep PostgreSQL AND private Storage backups, preserve paths and file hashes, and test restoration in a separate project. Database dumps do not contain uploaded files. Configure monitoring, rate limits, retention and accessibility/security review before confidential production use.

## Credential alert remediation

The previously committed Google API key remains in older Git commits until an explicitly authorized history rewrite. Removing current source does not revoke a key or clear history. Review the affected Google Cloud API key's API/application restrictions and usage. Rotate/replace it if it was unrestricted or used for non-Firebase Google APIs; update .env.local and Vercel, redeploy, then revoke the old key. Never paste replacement keys into committed source. Do not dismiss a GitHub alert as revoked until actual revocation is confirmed.

Firebase web config is still visible to browsers after deployment, even when supplied through environment variables. Environment variables prevent repository hardcoding; they do not make frontend keys secret. Access control relies on verified identity, RLS and key restrictions. See https://firebase.google.com/docs/projects/api-keys.

Production builds fail with the missing environment variable names instead of shipping disabled login buttons. Run npm run security:scan to check tracked/nonignored text files for credential patterns; this is a targeted guard, not a complete security audit.
