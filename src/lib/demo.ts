import type {
  CaseRecord,
  ClientRecord,
  HearingRecord,
  Member,
  Organization,
} from "./schema";
import { today } from "./schema";
export const demoOrg = "10000000-0000-4000-8000-000000000001";
export const demoUser = "20000000-0000-4000-8000-000000000001";
const now = new Date().toISOString();
export const sampleOrganization: Organization = {
  id: demoOrg,
  name: "রহিম উদ্দিন অ্যান্ড অ্যাসোসিয়েটস",
  address: "ঢাকা জজ কোর্ট, ঢাকা",
  created_at: now,
  updated_at: now,
};
export const sampleMembers: Member[] = [
  {
    organization_id: demoOrg,
    user_id: demoUser,
    role: "owner",
    display_name: "মো. রহিম উদ্দিন",
    created_at: now,
    updated_at: now,
  },
  {
    organization_id: demoOrg,
    user_id: "20000000-0000-4000-8000-000000000002",
    role: "lawyer",
    display_name: "মো. আব্দুল্লাহ",
    created_at: now,
    updated_at: now,
  },
];
const names = [
  "মো. জসিম উদ্দিন",
  "ফারহানা আক্তার",
  "মিজানুর রহমান",
  "আনিস আহমেদ",
  "মারিয়াম বেগম",
  "নুসরাত জাহান",
];
export function sampleClients(): ClientRecord[] {
  return names.map((full_name, i) => ({
    id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    organization_id: demoOrg,
    full_name,
    phone: `0171234567${i}`,
    alternative_phone: "",
    address: "ঢাকা, বাংলাদেশ",
    notes: "",
    archived_at: null,
    created_at: now,
    updated_at: now,
  }));
}
export function sampleCases(): CaseRecord[] {
  return sampleClients().map((client, i) => ({
    id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    organization_id: demoOrg,
    serial_number: i + 1,
    title: [
      `জসিম উদ্দিন বনাম করিম`,
      `রাষ্ট্র বনাম মিজান`,
      `ফারহানা বনাম সোহেল`,
      `আনিস বনাম কামাল`,
      `মারিয়াম বনাম রহিম`,
      `নুসরাত বনাম আরিফ`,
    ][i],
    court_case_number: [
      "১২৩/২০২৬",
      "৮৪/২০২৬",
      "৪২/২০২৬",
      "৬৭/২০২৬",
      "১৯/২০২৫",
      "৩৬/২০২৬",
    ][i],
    case_year: 2026,
    case_type: ["civil", "criminal", "family", "civil", "other", "family"][i],
    court_name: [
      "জেলা জজ কোর্ট",
      "চিফ জুডিশিয়াল ম্যাজিস্ট্রেট",
      "পারিবারিক আদালত",
      "যুগ্ম জেলা জজ কোর্ট",
      "জেলা জজ কোর্ট",
      "পারিবারিক আদালত",
    ][i],
    court_location: "ঢাকা",
    received_date: "2026-09-12",
    status: i === 4 ? "closed" : i === 3 ? "pending" : "running",
    closed_date: i === 4 ? "2026-10-01" : null,
    closure_result: i === 4 ? "আপসের মাধ্যমে নিষ্পত্তি" : "",
    client_id: client.id,
    plaintiff: client.full_name,
    defendant: "মো. করিম উদ্দিন",
    contact_phone: client.phone,
    next_hearing_date: i === 4 ? null : today(),
    notes: "প্রয়োজনীয় কাগজপত্র ও সাক্ষীর বিবৃতি প্রস্তুত করুন।",
    archived_at: null,
    created_at: now,
    updated_at: now,
  }));
}
export function sampleHearings(): HearingRecord[] {
  return sampleCases()
    .filter((c) => c.status !== "closed")
    .map((c, i) => ({
      id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      organization_id: demoOrg,
      case_id: c.id,
      hearing_date: today(),
      hearing_time: ["10:00", "12:30", "15:00", null, null][i],
      court_name: c.court_name,
      purpose: [
        "সাক্ষ্য গ্রহণ",
        "জামিন শুনানি",
        "যুক্তিতর্ক",
        "আদেশ",
        "সাক্ষ্য গ্রহণ",
      ][i],
      outcome: "",
      notes: "মূল কাগজপত্র সঙ্গে রাখুন",
      reminder_days: 1,
      created_at: now,
      updated_at: now,
    }));
}
