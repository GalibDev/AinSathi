# AinSathi implementation

Reference: user-supplied navy/gold Bengali mobile screen sheet and complete master prompt.
Existing repository: Figma design artifacts only; no app or existing behavior to replace.
Chosen stack: React + strict TypeScript + Vite + Tailwind + Supabase PostgreSQL/Auth/private Storage; Vercel deployment configuration.

Order: foundation and responsive navigation; schema/RLS/serial allocation; authentication/chambers; cases/clients; hearings/documents; dashboard/reports; PWA; checks.
Preview uses an explicit isolated in-memory demo. Real mode never substitutes demo statistics or reports success without a server response.
Remote configuration and live deployment require the user's Supabase project and Vercel account. No secrets are committed.
