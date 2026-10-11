# Implementation status

Active stack: React + strict TypeScript + Vite + Tailwind + Firebase Authentication/Firestore/private Storage, with Vercel frontend configuration. Google popup sign-in, email signup/verification/login/reset and profile/password management are integrated.

Live data uses FirebaseRepository and the authenticated workspace callable in asia-south1. Demo Repository is explicitly in-memory. Server covers clients/cases/archive/close/reopen, serial transactions, hearing calendar, document uploads/downloads/archive, notes/history, reports/CSV, assignments, roles/invitations and chamber settings. Private direct client reads/writes are denied by rules.

Firebase Console setup, Blaze billing, CLI login and server/rule deployment are pending. Real Google consent, email delivery, hosted CRUD, production concurrency/IAM/signing and Storage need verification after deployment. No billing or deployment was performed. Supabase data/accounts were not migrated or deleted. See README.md for setup, permissions, bounded queries, costs and launch limitations.
