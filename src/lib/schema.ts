import { z } from "zod";

export const roles = [
  "owner",
  "admin",
  "lawyer",
  "assistant",
  "viewer",
] as const;
export type Role = (typeof roles)[number];
export const statuses = ["running", "pending", "closed"] as const;
export const statusLabels = {
  running: "চলমান",
  pending: "মুলতবি",
  closed: "নিষ্পত্তি",
};
export const typeLabels: Record<string, string> = {
  civil: "দেওয়ানি",
  criminal: "ফৌজদারি",
  family: "পারিবারিক",
  other: "অন্যান্য",
};
export const roleLabels: Record<Role, string> = {
  owner: "মালিক",
  admin: "অ্যাডমিন",
  lawyer: "আইনজীবী",
  assistant: "সহকারী",
  viewer: "দর্শক",
};
export const phone = z
  .string()
  .trim()
  .regex(/^(\+?88)?01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "সঠিক তারিখ দিন")
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "সঠিক তারিখ দিন");
export const clientFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(150)
    .transform((v) => v || "নামহীন মক্কেল"),
  phone: z.union([z.literal(""), phone]),
  alternative_phone: z.union([z.literal(""), phone]),
  address: z.string().max(500),
  notes: z.string().max(5000),
});
export type ClientInput = z.infer<typeof clientFormSchema>;
export const caseFormSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || "নামহীন মামলা"),
  court_case_number: z.string().trim().max(100),
  case_year: z
    .union([z.number().int().min(1900).max(2200), z.nan()])
    .transform((v) => (Number.isNaN(v) ? new Date().getFullYear() : v)),
  case_type: z.string(),
  court_name: z.string().trim().max(150),
  court_location: z.string().max(200),
  received_date: z.union([z.literal(""), date]),
  client_id: z.union([z.literal(""), z.string().uuid("মক্কেল নির্বাচন করুন")]),
  plaintiff: z.string().max(200),
  defendant: z.string().max(200),
  contact_phone: z.union([z.literal(""), phone]),
  notes: z.string().max(10000),
});
export type CaseInput = z.infer<typeof caseFormSchema>;
export const hearingFormSchema = z.object({
  case_id: z.string().uuid("মামলা নির্বাচন করুন"),
  hearing_date: date,
  hearing_time: z
    .string()
    .refine(
      (v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      "সঠিক সময় দিন",
    ),
  court_name: z.string().trim().min(2, "আদালতের নাম দিন"),
  purpose: z.string().trim().min(2, "শুনানির বিষয় দিন"),
  outcome: z.string().max(3000),
  notes: z.string().max(5000),
  reminder_days: z.number().int().min(0).max(30),
});
export type HearingInput = z.infer<typeof hearingFormSchema>;
export const closureSchema = z.object({
  closed_date: date,
  closure_result: z.string().trim().min(2, "ফলাফল লিখুন").max(3000),
});
export const caseSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  serial_number: z.number(),
  title: z.string(),
  court_case_number: z.string(),
  case_year: z.number(),
  case_type: z.string(),
  court_name: z.string(),
  court_location: z.string(),
  received_date: z.string(),
  status: z.enum(statuses),
  closed_date: z.string().nullable(),
  closure_result: z.string(),
  client_id: z.string(),
  plaintiff: z.string(),
  defendant: z.string(),
  contact_phone: z.string(),
  next_hearing_date: z.string().nullable(),
  notes: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseRecord = z.infer<typeof caseSchema>;
export const clientSchema = clientFormSchema.extend({
  id: z.string(),
  organization_id: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ClientRecord = z.infer<typeof clientSchema>;
export const hearingSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  case_id: z.string(),
  hearing_date: z.string(),
  hearing_time: z.string().nullable(),
  court_name: z.string(),
  purpose: z.string(),
  outcome: z.string(),
  notes: z.string(),
  reminder_days: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HearingRecord = z.infer<typeof hearingSchema>;
export const documentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  case_id: z.string(),
  name: z.string(),
  storage_path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  uploaded_by: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DocumentRecord = z.infer<typeof documentSchema>;
export const memberSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  role: z.enum(roles),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Member = z.infer<typeof memberSchema>;
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;
export const eventSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  case_id: z.string(),
  actor_id: z.string().nullable(),
  action: z.string(),
  closure_date: z.string().nullable(),
  outcome: z.string().nullable(),
  created_at: z.string(),
});
export type CaseEvent = z.infer<typeof eventSchema>;
export function eventLabel(action: string) {
  const labels: Record<string, string> = {
    "cases:insert": "মামলা যোগ হয়েছে",
    "cases:update": "মামলার তথ্য হালনাগাদ হয়েছে",
    "cases:status:closed": "মামলা নিষ্পত্তি হয়েছে",
    "cases:status:running": "মামলা চলমান করা হয়েছে",
    "cases:status:pending": "মামলা মুলতবি হয়েছে",
    "hearings:insert": "শুনানি যোগ হয়েছে",
    "hearings:update": "শুনানি হালনাগাদ হয়েছে",
    "case_notes:insert": "নোট যোগ হয়েছে",
    "case_documents:insert": "নথি আপলোড হয়েছে",
    "case_documents:update": "নথির তথ্য হালনাগাদ হয়েছে",
    "case_assignments:insert": "আইনজীবীকে দায়িত্ব দেওয়া হয়েছে",
  };
  return labels[action] ?? "মামলার কার্যক্রম হালনাগাদ হয়েছে";
}
export const noteSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  case_id: z.string(),
  body: z.string(),
  author_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseNote = z.infer<typeof noteSchema>;
export const notificationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  title: z.string(),
  case_id: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;
const distribution = z.array(
  z.object({ label: z.string(), count: z.number() }),
);
export const reportSchema = z.object({
  stats: z.object({
    total: z.number(),
    running: z.number(),
    pending: z.number(),
    closed: z.number(),
  }),
  by_type: distribution,
  by_court: distribution,
  by_lawyer: distribution,
  closed_in_range: z.number(),
});
export type Report = z.infer<typeof reportSchema>;
export interface CaseFilters {
  query: string;
  type: string;
  status: string;
  court: string;
  lawyer: string;
  from: string;
  to: string;
  hearingFrom: string;
  hearingTo: string;
  page: number;
  sort: string;
}
export const emptyFilters: CaseFilters = {
  query: "",
  type: "",
  status: "",
  court: "",
  lawyer: "",
  from: "",
  to: "",
  hearingFrom: "",
  hearingTo: "",
  page: 0,
  sort: "newest",
};
export function canEdit(role: Role) {
  return role !== "viewer";
}
export function canManage(role: Role) {
  return role === "owner" || role === "admin";
}
export function serial(n: number) {
  return String(n).padStart(3, "0");
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function bn(n: number) {
  return new Intl.NumberFormat("bn-BD").format(n);
}
export function formatDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  return value
    ? new Intl.DateTimeFormat("bn-BD", {
        ...options,
        timeZone: "Asia/Dhaka",
      }).format(
        new Date(value.length === 10 ? value + "T06:00:00+06:00" : value),
      )
    : "—";
}
export function toCsv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((v) => {
            let value = String(v);
            if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export async function validateFile(file: File) {
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new Error("ফাইলের আকার ১ বাইট থেকে ১০ MB হতে হবে");
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mime =
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
      ? "application/pdf"
      : b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 13 &&
          b[5] === 10 &&
          b[6] === 26 &&
          b[7] === 10
        ? "image/png"
        : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
          ? "image/jpeg"
          : null;
  if (!mime || file.type !== mime)
    throw new Error("সঠিক PDF, JPG বা PNG ফাইল দিন");
  return mime;
}
