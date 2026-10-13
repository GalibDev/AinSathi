import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
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
import { connectAuthEmulator } from "firebase/auth";
import type { User } from "firebase/auth";

// Web configuration comes only from local/deployment environment variables.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
export const db = app
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : null;
export const auth = app ? getAuth(app) : null;
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
  auth
) {
  if (db) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
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
    "permission-denied":
      "Firestore অনুমতি মেলেনি। সঠিক Rules প্রকাশ করা হয়েছে কি না এবং চেম্বারের সদস্যপদ যাচাই করুন।",
    unavailable:
      "Firestore সংযোগ পাওয়া যাচ্ছে না। ইন্টারনেট যাচাই করে আবার চেষ্টা করুন।",
    "resource-exhausted":
      "Firestore ব্যবহারের সীমা শেষ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
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
  };
  return (
    messages[code] ?? (e instanceof Error ? e.message : "পুনরায় চেষ্টা করুন।")
  );
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
}
export async function logout() {
  await signOut(requireAuth());
}
