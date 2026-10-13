import {
  sampleCases,
  sampleClients,
  sampleHearings,
  sampleMembers,
  sampleOrganization,
  demoOrg,
  demoUser,
} from "./demo";
import { today, validateFile } from "./schema";
import type {
  CaseRecord,
  ClientRecord,
  HearingRecord,
  DocumentRecord,
  CaseFilters,
  CaseInput,
  ClientInput,
  HearingInput,
  Role,
  CaseEvent,
  CaseNote,
  Notification,
  Report,
} from "./schema";
const timestamp = () => new Date().toISOString();
export class Repository {
  readonly demo: boolean;
  private cases = sampleCases();
  private clients = sampleClients();
  private hearings = sampleHearings();
  private documents: DocumentRecord[] = [];
  private notes: CaseNote[] = [];
  private events: CaseEvent[] = [];
  private notifications: Notification[] = [];
  private assigned: Record<string, string[]> = Object.fromEntries(
    sampleCases().map((c) => [c.id, [demoUser]]),
  );
  constructor(demo: boolean) {
    this.demo = demo;
  }
  async memberships() {
    if (this.demo) return sampleMembers.filter((m) => m.user_id === demoUser);
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async organizations() {
    if (this.demo) return [sampleOrganization];
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async members(org: string) {
    void org;
    if (this.demo) return sampleMembers;
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async listCases(org: string, f: CaseFilters) {
    void org;
    void f;
    if (this.demo) {
      let records = this.cases.filter((c) => !c.archived_at);
      records = records.filter(
        (c) =>
          (!f.query ||
            [
              c.title,
              c.court_case_number,
              String(c.serial_number),
              c.plaintiff,
              c.defendant,
              c.contact_phone,
              this.clients.find((x) => x.id === c.client_id)?.full_name ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(f.query.toLowerCase())) &&
          (!f.type || c.case_type === f.type) &&
          (!f.status || c.status === f.status) &&
          (!f.court || c.court_name.includes(f.court)) &&
          (!f.from || c.received_date >= f.from) &&
          (!f.to || c.received_date <= f.to) &&
          (!f.hearingFrom ||
            (!!c.next_hearing_date && c.next_hearing_date >= f.hearingFrom)) &&
          (!f.hearingTo ||
            (!!c.next_hearing_date && c.next_hearing_date <= f.hearingTo)),
      );
      records.sort((a, b) =>
        f.sort === "oldest"
          ? a.serial_number - b.serial_number
          : f.sort === "hearing"
            ? (a.next_hearing_date ?? "9999").localeCompare(
                b.next_hearing_date ?? "9999",
              )
            : b.serial_number - a.serial_number,
      );
      return records.slice(f.page * 20, (f.page + 1) * 20);
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async getCase(org: string, id: string) {
    void org;
    void id;
    if (this.demo) {
      const c = this.cases.find((c) => c.id === id && !c.archived_at);
      if (!c) throw new Error("মামলাটি পাওয়া যায়নি");
      return c;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async listClients(org: string, query = "", page = 0) {
    void org;
    void query;
    void page;
    if (this.demo)
      return this.clients
        .filter(
          (c) => !c.archived_at && (c.full_name + c.phone).includes(query),
        )
        .slice(page * 20, page * 20 + 20);
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async getClient(org: string, id: string) {
    void org;
    void id;
    if (this.demo) {
      const c = this.clients.find((c) => c.id === id);
      if (!c) throw new Error("মক্কেল পাওয়া যায়নি");
      return c;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async clientCases(org: string, id: string) {
    void org;
    void id;
    if (this.demo)
      return this.cases.filter((c) => c.client_id === id && !c.archived_at);
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async saveClient(org: string, input: ClientInput, id?: string) {
    void org;
    void input;
    void id;
    if (this.demo) {
      if (
        this.clients.some(
          (c) =>
            !!input.phone &&
            c.id !== id &&
            c.phone === input.phone &&
            !c.archived_at,
        )
      )
        throw new Error("এই নম্বরে মক্কেল ইতিমধ্যে আছেন");
      const c: ClientRecord = {
        ...input,
        id: id ?? crypto.randomUUID(),
        organization_id: org,
        archived_at: null,
        created_at: timestamp(),
        updated_at: timestamp(),
      };
      this.clients = id
        ? this.clients.map((x) => (x.id === id ? c : x))
        : [c, ...this.clients];
      return c;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async saveCase(org: string, input: CaseInput, id?: string) {
    void org;
    void input;
    void id;
    if (this.demo) {
      const existing = this.cases.find((c) => c.id === id);
      const c: CaseRecord = {
        ...input,
        id: id ?? crypto.randomUUID(),
        organization_id: org,
        serial_number:
          existing?.serial_number ??
          Math.max(0, ...this.cases.map((c) => c.serial_number)) + 1,
        status: existing?.status ?? "running",
        closed_date: existing?.closed_date ?? null,
        closure_result: existing?.closure_result ?? "",
        next_hearing_date: existing?.next_hearing_date ?? null,
        archived_at: null,
        created_at: existing?.created_at ?? timestamp(),
        updated_at: timestamp(),
      };
      this.cases = id
        ? this.cases.map((x) => (x.id === id ? c : x))
        : [c, ...this.cases];
      this.addEvent(c.id, id ? "cases:update" : "cases:insert");
      return c;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async status(
    org: string,
    id: string,
    status: CaseRecord["status"],
    closed_date: string | null = null,
    closure_result = "",
  ) {
    void org;
    void id;
    void status;
    void closed_date;
    void closure_result;
    if (this.demo) {
      this.cases = this.cases.map((c) =>
        c.id === id ? { ...c, status, closed_date, closure_result } : c,
      );
      this.addEvent(id, "cases:status:" + status, closed_date, closure_result);
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async archive(org: string, table: "cases" | "clients", id: string) {
    void org;
    void table;
    void id;
    if (this.demo) {
      if (table === "cases")
        this.cases = this.cases.map((c) =>
          c.id === id ? { ...c, archived_at: timestamp() } : c,
        );
      else
        this.clients = this.clients.map((c) =>
          c.id === id ? { ...c, archived_at: timestamp() } : c,
        );
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async listHearings(org: string, from: string, to: string, caseId?: string) {
    void org;
    void from;
    void to;
    void caseId;
    if (this.demo)
      return this.hearings
        .filter(
          (h) =>
            (!caseId || h.case_id === caseId) &&
            h.hearing_date >= from &&
            h.hearing_date <= to,
        )
        .sort((a, b) =>
          (a.hearing_date + (a.hearing_time ?? "99:99")).localeCompare(
            b.hearing_date + (b.hearing_time ?? "99:99"),
          ),
        );
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async saveHearing(org: string, input: HearingInput, id?: string) {
    void org;
    void input;
    void id;
    const values = {
      ...input,
      organization_id: org,
      hearing_time: input.hearing_time || null,
    };
    if (this.demo) {
      const h: HearingRecord = {
        ...values,
        id: id ?? crypto.randomUUID(),
        created_at: timestamp(),
        updated_at: timestamp(),
      };
      this.hearings = id
        ? this.hearings.map((x) => (x.id === id ? h : x))
        : [h, ...this.hearings];
      const next =
        this.hearings
          .filter(
            (x) => x.case_id === input.case_id && x.hearing_date >= today(),
          )
          .sort((a, b) => a.hearing_date.localeCompare(b.hearing_date))[0]
          ?.hearing_date ?? null;
      this.cases = this.cases.map((c) =>
        c.id === input.case_id ? { ...c, next_hearing_date: next } : c,
      );
      this.addEvent(input.case_id, "hearings:" + (id ? "update" : "insert"));
      return h;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async listDocuments(org: string, caseId?: string) {
    void org;
    void caseId;
    if (this.demo)
      return this.documents.filter(
        (d) => !d.archived_at && (!caseId || d.case_id === caseId),
      );
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async upload(org: string, caseId: string, file: File) {
    void org;
    void caseId;
    void file;
    await validateFile(file);
    if (this.demo)
      throw new Error(
        "ডেমোতে গোপন নথি আপলোড হয় না। আসল অ্যাকাউন্টে লগইন করে ব্যবহার করুন।",
      );
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async download(doc: DocumentRecord): Promise<string> {
    void doc;
    if (this.demo) throw new Error("ডেমো নথি ডাউনলোড করা যায় না");
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async archiveDocument(org: string, id: string) {
    void org;
    void id;
    if (this.demo) {
      this.documents = this.documents.map((d) =>
        d.id === id ? { ...d, archived_at: timestamp() } : d,
      );
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async caseHistory(org: string, caseId: string) {
    void org;
    void caseId;
    if (this.demo) return this.events.filter((e) => e.case_id === caseId);
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async caseNotes(org: string, caseId: string) {
    void org;
    void caseId;
    if (this.demo) return this.notes.filter((n) => n.case_id === caseId);
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async addNote(org: string, caseId: string, body: string) {
    void org;
    void caseId;
    void body;
    if (this.demo) {
      this.notes.unshift({
        id: crypto.randomUUID(),
        organization_id: org,
        case_id: caseId,
        body,
        author_id: demoUser,
        created_at: timestamp(),
        updated_at: timestamp(),
      });
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async report(org: string, from = "", to = ""): Promise<Report> {
    void org;
    void from;
    void to;
    if (this.demo) {
      const c = this.cases.filter(
        (c) =>
          !c.archived_at &&
          (!from || c.received_date >= from) &&
          (!to || c.received_date <= to),
      );
      const group = (field: "case_type" | "court_name") =>
        Object.entries(
          c.reduce<Record<string, number>>(
            (a, c) => ({ ...a, [c[field]]: (a[c[field]] ?? 0) + 1 }),
            {},
          ),
        ).map(([label, count]) => ({ label, count }));
      return {
        stats: {
          total: c.length,
          running: c.filter((x) => x.status === "running").length,
          pending: c.filter((x) => x.status === "pending").length,
          closed: c.filter((x) => x.status === "closed").length,
        },
        by_type: group("case_type"),
        by_court: group("court_name"),
        by_lawyer: [],
        closed_in_range: this.cases.filter(
          (c) =>
            !c.archived_at &&
            c.closed_date &&
            (!from || c.closed_date >= from) &&
            (!to || c.closed_date <= to),
        ).length,
      };
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async listNotifications(org: string) {
    void org;
    if (this.demo) return this.notifications;
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async readNotification(org: string, id: string) {
    void org;
    void id;
    if (this.demo) {
      this.notifications = this.notifications.map((n) =>
        n.id === id ? { ...n, read_at: timestamp() } : n,
      );
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async invite(org: string, email: string, role: Role) {
    void org;
    void email;
    void role;
    if (this.demo) throw new Error("ডেমোতে আমন্ত্রণ পাঠানো যায় না");
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async changeRole(org: string, userId: string, role: Role) {
    void org;
    void userId;
    void role;
    if (this.demo) throw new Error("ডেমোতে সদস্যের অনুমতি পরিবর্তন হয় না");
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async assignments(org: string, caseId: string) {
    void org;
    void caseId;
    if (this.demo) return this.assigned[caseId] ?? [];
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async assign(org: string, caseId: string, userId: string) {
    void org;
    void caseId;
    void userId;
    if (this.demo) {
      this.assigned[caseId] = [
        ...new Set([...(this.assigned[caseId] ?? []), userId]),
      ];
      this.addEvent(caseId, "case_assignments:insert");
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async unassign(org: string, caseId: string, userId: string) {
    void org;
    void caseId;
    void userId;
    if (this.demo) {
      this.assigned[caseId] = (this.assigned[caseId] ?? []).filter(
        (u) => u !== userId,
      );
      return;
    }
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  async saveOrganization(org: string, name: string, address: string) {
    void org;
    void name;
    void address;
    if (this.demo) throw new Error("ডেমোতে চেম্বারের সেটিংস পরিবর্তন হয় না");
    throw new Error("ডেমো ছাড়া FirebaseRepository ব্যবহার করুন।");
  }
  private addEvent(
    caseId: string,
    action: string,
    closure_date: string | null = null,
    outcome: string | null = null,
  ) {
    void caseId;
    void action;
    void closure_date;
    void outcome;
    this.events.unshift({
      id: crypto.randomUUID(),
      organization_id: demoOrg,
      case_id: caseId,
      actor_id: demoUser,
      action,
      closure_date,
      outcome,
      created_at: timestamp(),
    });
  }
}
