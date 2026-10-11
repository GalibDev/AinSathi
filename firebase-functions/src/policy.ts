import { HttpsError } from "firebase-functions/v2/https";
import type { Role } from "./schema.js";
export function requireVerified(
  auth: { uid: string; token: Record<string, unknown> } | undefined,
) {
  if (!auth) throw new HttpsError("unauthenticated", "লগইন করুন।");
  if (auth.token.email_verified !== true)
    throw new HttpsError("permission-denied", "ইমেইল যাচাই করুন।");
  return auth.uid;
}
export function requireRole(
  role: Role | undefined,
  operation: "read" | "edit" | "manage" | "owner" = "read",
) {
  const allowed =
    operation === "read"
      ? ["owner", "admin", "lawyer", "assistant", "viewer"]
      : operation === "edit"
        ? ["owner", "admin", "lawyer", "assistant"]
        : operation === "manage"
          ? ["owner", "admin"]
          : ["owner"];
  if (!role || !allowed.includes(role))
    throw new HttpsError("permission-denied", "এই কাজের অনুমতি নেই।");
}
export function validStatus(
  status: string,
  closedDate: string | null,
  result: string,
  receivedDate: string,
) {
  if (!["running", "pending", "closed"].includes(status))
    throw new HttpsError("invalid-argument", "মামলার অবস্থা সঠিক নয়।");
  if (
    status === "closed" &&
    (!closedDate || closedDate < receivedDate || result.trim().length < 2)
  )
    throw new HttpsError(
      "invalid-argument",
      "সঠিক নিষ্পত্তির তারিখ ও ফলাফল দিন।",
    );
}
export function fileMime(bytes: Uint8Array) {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return "image/png";
  return null;
}
export function normalizedPhone(phone: string) {
  return phone.replace(/^\+?88/, "");
}
