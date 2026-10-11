# AinSathi — আপনার মামলা, আপনার নিয়ন্ত্রণ

Bengali-first, responsive lawyer/chamber management app. The supplied navy/gold mobile design is the visual reference. This is an independent chamber tool, not an official judiciary or government service.

## Implemented

- React/TypeScript/Vite, Tailwind utilities, Lucide, self-hosted Noto Sans Bengali.
- Responsive sidebar, mobile drawer/bottom navigation, dashboard, case register, search/filter/sort/pagination, client directory/detail, case create/edit/archive/close/reopen, hearings, monthly calendar/agenda, private document flow, notes/history, team roles/invitation links, reports/CSV, notifications, settings/profile, protected auth routes.
- Supabase migrations for normalized tenant-scoped data; composite foreign keys; transactional continuous per-chamber serials; RLS; restricted role changes; private storage and validated upload Edge Function.
- Installable PWA manifest/icons and a service worker caching static assets only. API responses, private case data, HTML navigation responses and documents are not cached for offline use.
- Explicit in-memory demo at `/demo/dashboard`. It uses fictional records, resets on refresh, and cannot upload real documents, send invitations, or change real account security. Production mode never silently uses demo data.

## Requirements and local development

Node.js 24+, npm, a Supabase project. Docker Desktop is needed only for the standard local Supabase stack; database unit tests use embedded PostgreSQL (PGlite), so they work without Docker.

```powershell
npm ci
Copy-Item .env.example .env.local
# Set the project URL and publishable key in .env.local (never a service-role key).
npm run dev
```

Open the URL printed by Vite. Without `.env.local`, `/login` explains the configuration requirement and links to the isolated demo.

## Supabase setup

1. Create a Supabase project. Record its project reference. Keep database/admin credentials outside the repository.
2. Install the Supabase CLI using its supported Windows installation method, then `supabase login` and `supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply the migration with `supabase db push`. This creates all tables, functions, constraints, policies, indexes, triggers, and a **private** `case-documents` bucket with 10 MB and MIME restrictions. No migration has been applied to your hosted project by this coding session.
4. Set Auth **Site URL** to the frontend origin. Add exact redirect URLs for `/onboarding`, `/onboarding?invite=...` as permitted by your redirect configuration, and `/reset-password`. For production invite confirmation, configure an appropriate onboarding wildcard limited to your own origin, e.g. `https://YOUR_DOMAIN/onboarding**`. During development add the equivalent `http://127.0.0.1:5173` URLs.
5. Enable email/password authentication, email confirmation, suitable password rules, and rate limits. Configure custom SMTP for reliable production verification/reset delivery. Google sign-in/sign-up UI is implemented; enable the Google provider before using it (see below).
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local` and Vercel's environment variables. These browser keys are public identifiers; security relies on verified auth and RLS. Never put a secret/service-role key in `VITE_*`.
7. Deploy upload validation: `supabase functions deploy upload-document`. Set `supabase secrets set ALLOWED_ORIGINS=https://YOUR_DOMAIN,http://127.0.0.1:5173`. The Edge runtime supplies the server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; the service key is used only inside this trusted function for Storage operations **after** user, membership, case, MIME/signature and size checks. Authenticated browsers cannot bypass validation with raw Storage inserts.
8. Register, verify email, create a chamber, then create clients before cases. Serial numbers allocate on the server. Owners/admins create invitation links; a human sends the link, and the recipient signs in with the exact verified invited email.

For local Supabase: start Docker, run `supabase start`, then `supabase db reset`. Use the local URL/publishable key from CLI output. Local reset recreates local data; never run a reset against a project containing needed records.

## Types

`src/lib/database.generated.ts` is generated from the applied migration's PostgreSQL information schema by `node scripts/generate-types.ts`. It contains Supabase-compatible tables, insert/update types and the explicit function API. It does not require a remote project. To generate directly from your configured Supabase schema after deployment:

```powershell
supabase gen types typescript --linked > src/lib/database.generated.ts
npm run typecheck
```

`npm run db:types` uses the local Supabase stack. Runtime inputs/results are also checked with Zod. If you add migrations, regenerate types and rerun tests.

## Permission matrix

| Action | Owner | Admin | Lawyer | Assistant | Viewer |
|---|---|---|---|---|---|
| Read chamber records/reports | Yes | Yes | Yes | Yes | Yes |
| Manage cases/clients/hearings/notes/documents | Yes | Yes | Yes | Yes | No |
| Assign chamber members to cases | Yes | Yes | Yes | Yes | No |
| Change operational chamber settings | Yes | Yes | No | No | No |
| Invite lawyer/assistant/viewer | Yes | Yes | No | No | No |
| Invite admin | Yes | No | No | No | No |
| Change existing roles | Yes | No | No | No | No |

Membership is the explicit record-access boundary: all members may read their chamber's records. Case-assignment visibility restrictions are not implemented; assignments are organizational rather than an additional confidentiality boundary. The last owner cannot be demoted. There is no frontend-owned role field or ownership-transfer shortcut. Records are archived, not hard-deleted. Legal history is retained.

## Documents

Uploads are authenticated, checked against the user's chamber and an existing case, limited to 10 MB, and validated by magic bytes and declared MIME in the Edge Function. This is file-type validation, not antivirus scanning. The function stores metadata only after the object succeeds and attempts object cleanup if metadata fails; an unusual cleanup failure is reported for administrator reconciliation. Downloads use a 60-second signed link subject to Storage RLS. Do not share these links. Archived documents are hidden from normal lists; archived objects remain stored for retention rather than being erased. Upload UI is indeterminate progress, not a fabricated percentage.

The upload rate check limits recorded uploads to 20 per user/10 minutes but is not an atomic distributed rate limiter; configure platform/gateway protection for hostile traffic before public launch. No private data should be added to a service-worker runtime cache.

## Verification

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
# With the dev server running:
npx playwright install chromium
npx playwright test
```

Database tests apply the actual migration to embedded PostgreSQL with stubbed Supabase auth/storage schemas. They exercise RLS as authenticated roles, cross-tenant isolation, privilege escalation, viewer writes, foreign-key isolation, serial sequencing/immutability, closure/reopening, hearings and private storage. This validates SQL behavior but does not substitute for testing hosted Auth, Storage, Edge Functions and concurrent multi-connection production behavior. PGlite serializes its own query execution; review the atomic UPSERT allocator and run live concurrency tests before production.

## Build and Vercel

Build command: `npm run build`. Output: `dist`. Use Vercel's Vite preset; `vercel.json` contains SPA rewrites and baseline security headers. Set the two public environment variables, configure your domain and Supabase redirect/origin allowlists, then deploy using your Vercel account. HTTPS is required for PWA installation outside loopback. No Vercel deployment has been performed in this session.

## Backups and restore

Back up **both** PostgreSQL and private Storage objects. A database dump includes metadata, not the uploaded binary files. Configure scheduled database backups/PITR according to the chosen Supabase plan, plus an authenticated object backup to a separately controlled encrypted destination. Retain object paths and metadata associations. Test restoration into a separate project, restore files at their original keys, rerun RLS/auth checks and compare file hashes/counts. Do not assume a free tier is a complete disaster-recovery solution. Determine legal retention and deletion policy with the chamber before enabling destructive cleanup.

## Remaining deployment verification

- Hosted Supabase project, credentials and Vercel account were not provided. Real registration/email verification/reset, hosted CRUD, signed downloads, deployed Edge upload behavior and production isolation must be tested after setup.
- Automatic SMS/email/push hearing delivery and background scheduling are not configured. In-app hearing reminders calculate when the app is opened; stored hearing/assignment notifications are generated by database triggers.
- No confidential offline access, antivirus service, billing/subscriptions, fee/payment module or PDF report rendering is advertised as implemented. Reports export CSV.
- Bounded lists: cases/clients use 20-row pagination; hearings 200 per requested range; case history/notes and related cases/documents 100; notifications 50; members 200. Search or narrow the period when needed. Case-specific pages retrieve older individual records. These limits are visible where relevant and can be expanded with pagination later.
- Recovery email delivery, CSP tailored to your deployed origin/Supabase endpoints, penetration testing, accessibility testing with assistive technology, restore drills, and platform monitoring remain launch tasks. Do not treat passing local checks as production-readiness certification.

See `IMPLEMENTATION.md` for scope and `design/` for prior Figma artifacts and the current browser previews.

## Google login setup

The login and registration screens use Supabase Google OAuth. When the provider is disabled, the app displays a Bengali message and keeps email login available. Successful Google sign-in returns to /login, preserves invitation tokens, and uses existing chamber onboarding for new users.

1. In Google Cloud create a Web application OAuth client and configure its consent screen. If the app is in Testing, add the intended Google accounts as test users.
2. Authorized JavaScript origin for local testing: http://127.0.0.1:5173. Add the exact production origin when deployed.
3. Authorized redirect URI: https://nlokgndyjuajgyjjgwhw.supabase.co/auth/v1/callback (use your project's callback if the project changes).
4. Supabase Dashboard → Authentication → Sign In / Providers → Google: enable Google and enter the Google Client ID and Client Secret. Keep the client secret in Supabase only, outside frontend files and Git.
5. In Supabase redirect allowlist add http://127.0.0.1:5173/login and http://127.0.0.1:5173/login?invite=* (or a local-only /** wildcard). Add corresponding exact production URLs later.
6. Verify both a new user creating a chamber and an existing member returning to the dashboard. Hosted Google consent/callback verification remains pending provider setup.
