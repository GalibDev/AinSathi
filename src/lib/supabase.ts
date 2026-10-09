import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.generated";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = Boolean(
  url &&
  key &&
  !url.includes("your-project") &&
  !key.includes("your-publishable"),
);
export const supabase = configured
  ? createClient<Database>(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase সংযোগ দেওয়া হয়নি। README অনুযায়ী .env.local সেট করুন।",
    );
  return supabase;
}
