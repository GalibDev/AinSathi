import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  updatePassword,
  reload,
  getIdToken,
} from "firebase/auth";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { connectAuthEmulator } from "firebase/auth";
import type { User } from "firebase/auth";

// Public Firebase web identifiers, supplied by the project owner. These are
// included in every browser build; authorization remains on the server.
// Keep a deployable default so Vercel builds work without local .env files.
const config = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyBPEeQg_GKGRON90VcibLqqr_afdH4g2JM",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ainsathi.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ainsathi",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "ainsathi.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "55594142318",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:55594142318:web:10b1bd3e501461db49f47f",
};
export const configured = Boolean(
  config.apiKey && config.projectId && config.appId,
);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const functions = app ? getFunctions(app, "asia-south1") : null;
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
  auth &&
  functions
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export interface Session {
  user: {
    id: string;
    email: string | null;
    user_metadata: { full_name: string };
    email_verified: boolean;
  };
}
export function sessionFor(user: User | null): Session | null {
  return user
    ? {
        user: {
          id: user.uid,
          email: user.email,
          user_metadata: { full_name: user.displayName ?? "" },
          email_verified: user.emailVerified,
        },
      }
    : null;
}
export function requireAuth() {
  if (!auth) throw new Error("Firebase সংযোগ দেওয়া হয়নি।");
  return auth;
}
export function authMessage(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String(e.code) : "";
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user": "Google লগইন বাতিল হয়েছে। আবার চেষ্টা করুন।",
    "auth/cancelled-popup-request":
      "আগের Google লগইন উইন্ডো বন্ধ করে আবার চেষ্টা করুন।",
    "auth/popup-blocked": "ব্রাউজারে popup অনুমতি দিয়ে আবার চেষ্টা করুন।",
    "auth/unauthorized-domain":
      "এই ঠিকানাটি Firebase Authorized domains-এ যোগ করতে হবে।",
    "auth/operation-not-allowed":
      "Firebase Console-এ এই login পদ্ধতি চালু করতে হবে।",
    "auth/configuration-not-found":
      "Firebase Console-এ Authentication চালু করতে হবে।",
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
    "auth/email-already-in-use": "এই ইমেইলে অ্যাকাউন্ট আছে। লগইন করুন।",
    "auth/account-exists-with-different-credential":
      "এই ইমেইলে অন্য পদ্ধতিতে অ্যাকাউন্ট আছে। সেই পদ্ধতিতে লগইন করুন।",
    "auth/requires-recent-login": "নিরাপত্তার জন্য আবার লগইন করে চেষ্টা করুন।",
    "auth/too-many-requests":
      "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    "auth/network-request-failed":
      "ইন্টারনেট সংযোগ যাচাই করে আবার চেষ্টা করুন।",
    "auth/expired-action-code": "লিংকের মেয়াদ শেষ। নতুন লিংক নিন।",
    "auth/invalid-action-code": "লিংকটি সঠিক নয় বা আগেই ব্যবহার হয়েছে।",
    "functions/not-found":
      "Firebase server এখনো deploy হয়নি। সেটআপ নির্দেশনা অনুসরণ করুন।",
    "functions/unavailable":
      "Firebase server-এ সংযোগ হয়নি। deployment ও ইন্টারনেট যাচাই করুন।",
    "functions/internal":
      "Server-এ কাজটি সম্পন্ন হয়নি। deployment ও configuration যাচাই করুন।",
  };
  return (
    messages[code] ?? (e instanceof Error ? e.message : "পুনরায় চেষ্টা করুন।")
  );
}
export async function call<T>(
  action: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!functions) throw new Error("Firebase সংযোগ দেওয়া হয়নি।");
  try {
    return (
      await httpsCallable<unknown, T>(
        functions,
        "workspace",
      )({ action, ...args })
    ).data;
  } catch (e) {
    throw new Error(authMessage(e), { cause: e });
  }
}
export async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(requireAuth(), provider);
}
export async function emailSignIn(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(
    requireAuth(),
    email,
    password,
  );
  await reload(user);
  await getIdToken(user, true);
}
export async function emailSignUp(
  email: string,
  password: string,
  name: string,
  returnPath: string,
) {
  const { user } = await createUserWithEmailAndPassword(
    requireAuth(),
    email,
    password,
  );
  await updateProfile(user, { displayName: name });
  await sendEmailVerification(user, { url: location.origin + returnPath });
  return user;
}
export async function verifyEmail(returnPath: string) {
  const user = requireAuth().currentUser;
  if (!user) throw new Error("লগইন করুন।");
  await sendEmailVerification(user, { url: location.origin + returnPath });
}
export async function refreshVerification() {
  const user = requireAuth().currentUser;
  if (!user) return false;
  await reload(user);
  await getIdToken(user, true);
  return user.emailVerified;
}
export async function passwordReset(email: string) {
  await sendPasswordResetEmail(requireAuth(), email);
}
export async function finishPasswordReset(code: string, password: string) {
  await confirmPasswordReset(requireAuth(), code, password);
}
export async function saveProfile(name: string, password: string) {
  const user = requireAuth().currentUser;
  if (!user) throw new Error("লগইন করুন।");
  if (password) await updatePassword(user, password);
  await updateProfile(user, { displayName: name });
  await call("saveProfile", { name });
}
export async function logout() {
  await signOut(requireAuth());
}
