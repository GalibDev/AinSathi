import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";
import type { Database } from "./database.generated";
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL ||
    "https://nlokgndyjuajgyjjgwhw.supabase.co",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_WVRvqQUqUnMHNHrrkoW49g_qUfi8Tni",
  {
    accessToken: async () => (await auth?.currentUser?.getIdToken()) ?? null,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
export function requireSupabase() {
  return supabase;
}
export function dataError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (
    error.code === "PGRST202" &&
    error.message.includes("sync_firebase_profile")
  )
    throw new Error("Supabase-এ Firebase সংযোগের SQL migration চালাতে হবে।");
  if (
    error.message.toLowerCase().includes("jwt") ||
    error.code === "PGRST301" ||
    error.code === "PGRST303"
  )
    throw new Error(
      "Supabase Authentication → Third-party Auth-এ Firebase project ainsathi যুক্ত করতে হবে।",
    );
  throw new Error(error.message);
}
export async function syncProfile() {
  const { data, error } = await supabase.rpc("sync_firebase_profile");
  dataError(error);
  if (!data) throw new Error("Supabase পরিচয় যাচাই হয়নি।");
  return data;
}
export async function createChamber(name: string, memberName: string) {
  await syncProfile();
  const { data, error } = await supabase.rpc("create_chamber", {
    chamber_name: name,
    member_name: memberName,
  });
  dataError(error);
  return data;
}
export async function acceptInvitation(token: string, memberName: string) {
  await syncProfile();
  const { data, error } = await supabase.rpc("accept_invitation", {
    invite_token: token,
    member_name: memberName,
  });
  dataError(error);
  return data;
}
