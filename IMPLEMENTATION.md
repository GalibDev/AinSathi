# Implementation status

Active architecture: Firebase Authentication for Google/email login; Supabase PostgreSQL/RLS/private Storage for all case and chamber data. Context selects SupabaseRepository in live mode and the memory-only Repository in demo mode. No active Firebase Functions/Firestore calls remain.

Firebase identities map to internal UUID profiles through a signature-verified Supabase Third-party Auth token and sync_firebase_profile RPC. Existing Supabase tables/UUIDs/data are preserved. The follow-up SQL migration must be run and the Firebase Third-party Auth integration enabled in Supabase Dashboard before live data access works. No remote migration or provider configuration was performed in this session. No paid Firebase functions are required.

The Supabase upload Edge Function now authenticates Firebase via a user-scoped sync RPC, then checks membership/case before using private server Storage credentials. Its deployment remains pending. README.md contains exact setup steps and verification limits. The old Firebase data implementation is retained as inactive reference only.
