import { z } from "zod";
import { requireSupabase } from "./supabase";
import {
  sampleCases,
  sampleClients,
  sampleHearings,
  sampleMembers,
  sampleOrganization,
  demoOrg,
  demoUser,
} from "./demo";
import {
  caseSchema,
  clientSchema,
  hearingSchema,
  documentSchema,
  memberSchema,
  organizationSchema,
  eventSchema,
  noteSchema,
  notificationSchema,
  reportSchema,
  today,
  validateFile,
} from "./schema";
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
import type { Database } from "./database.generated";
type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
const check = (error: { message: string } | null) => {
  if (error)
    throw new Error(
      error.message.includes("duplicate")
        ? "এই মোবাইল নম্বরে একটি মক্কেল ইতিমধ্যে আছেন।"
        : error.message.includes("row-level") ||
            error.message.includes("Permission")
          ? "এই কাজের অনুমতি নেই।"
          : error.message,
    );
};
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
    const { data, error } = await requireSupabase()
      .from("organization_members")
      .select("*")
      .eq(
        "user_id",
        (await requireSupabase().auth.getUser()).data.user?.id ?? "",
      );
    check(error);
    return z.array(memberSchema).parse(data);
  }
  async organizations() {
    if (this.demo) return [sampleOrganization];
    const { data, error } = await requireSupabase()
      .from("organizations")
      .select("*")
      .order("name");
    check(error);
    return z.array(organizationSchema).parse(data);
  }
  async members(org: string) {
    if (this.demo) return sampleMembers;
    const { data, error } = await requireSupabase()
      .from("organization_members")
      .select("*")
      .eq("organization_id", org)
      .order("display_name")
      .limit(200);
    check(error);
    return z.array(memberSchema).parse(data);
  }
  async listCases(org: string, f: CaseFilters) {
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
    const { data, error } = await requireSupabase().rpc("search_cases", {
      org,
      query: f.query,
      type_filter: f.type,
      status_filter: f.status,
      court_filter: f.court,
      ...(f.lawyer ? { lawyer_filter: f.lawyer } : {}),
      ...(f.from ? { date_from: f.from } : {}),
      ...(f.to ? { date_to: f.to } : {}),
      ...(f.hearingFrom ? { hearing_from: f.hearingFrom } : {}),
      ...(f.hearingTo ? { hearing_to: f.hearingTo } : {}),
      page_number: f.page,
      sort_order: f.sort,
    });
    check(error);
    return z.array(caseSchema).parse(data);
  }
  async getCase(org: string, id: string) {
    if (this.demo) {
      const c = this.cases.find((c) => c.id === id && !c.archived_at);
      if (!c) throw new Error("মামলাটি পাওয়া যায়নি");
      return c;
    }
    const { data, error } = await requireSupabase().rpc("get_case", {
      org,
      case_id: id,
    });
    check(error);
    if (!data?.length) throw new Error("মামলাটি পাওয়া যায়নি");
    return caseSchema.parse(data[0]);
  }
  async listClients(org: string, query = "", page = 0) {
    if (this.demo)
      return this.clients
        .filter(
          (c) => !c.archived_at && (c.full_name + c.phone).includes(query),
        )
        .slice(page * 20, page * 20 + 20);
    const safe = query.replaceAll(/[%_,()]/g, "");
    let req = requireSupabase()
      .from("clients")
      .select("*")
      .eq("organization_id", org)
      .is("archived_at", null)
      .order("full_name")
      .range(page * 20, page * 20 + 19);
    if (safe) req = req.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    const { data, error } = await req;
    check(error);
    return z.array(clientSchema).parse(data);
  }
  async getClient(org: string, id: string) {
    if (this.demo) {
      const c = this.clients.find((c) => c.id === id);
      if (!c) throw new Error("মক্কেল পাওয়া যায়নি");
      return c;
    }
    const { data, error } = await requireSupabase()
      .from("clients")
      .select("*")
      .eq("organization_id", org)
      .eq("id", id)
      .single();
    check(error);
    return clientSchema.parse(data);
  }
  async clientCases(org: string, id: string) {
    if (this.demo)
      return this.cases.filter((c) => c.client_id === id && !c.archived_at);
    const { data, error } = await requireSupabase()
      .from("cases")
      .select("*")
      .eq("organization_id", org)
      .eq("client_id", id)
      .is("archived_at", null)
      .order("serial_number", { ascending: false })
      .limit(100);
    check(error);
    return z.array(caseSchema).parse(data);
  }
  async saveClient(org: string, input: ClientInput, id?: string) {
    if (this.demo) {
      if (
        this.clients.some(
          (c) => c.id !== id && c.phone === input.phone && !c.archived_at,
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
    const values: Insert<"clients"> = { ...input, organization_id: org };
    const { data, error } = id
      ? await requireSupabase()
          .from("clients")
          .update(values)
          .eq("organization_id", org)
          .eq("id", id)
          .select()
          .single()
      : await requireSupabase()
          .from("clients")
          .insert(values)
          .select()
          .single();
    check(error);
    return clientSchema.parse(data);
  }
  async saveCase(org: string, input: CaseInput, id?: string) {
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
    const values: Insert<"cases"> = { ...input, organization_id: org };
    const { data, error } = id
      ? await requireSupabase()
          .from("cases")
          .update(input)
          .eq("organization_id", org)
          .eq("id", id)
          .select()
          .single()
      : await requireSupabase().from("cases").insert(values).select().single();
    check(error);
    return caseSchema.parse(data);
  }
  async status(
    org: string,
    id: string,
    status: CaseRecord["status"],
    closed_date: string | null = null,
    closure_result = "",
  ) {
    if (this.demo) {
      this.cases = this.cases.map((c) =>
        c.id === id ? { ...c, status, closed_date, closure_result } : c,
      );
      this.addEvent(id, "cases:status:" + status, closed_date, closure_result);
      return;
    }
    const { error } = await requireSupabase()
      .from("cases")
      .update({ status, closed_date, closure_result })
      .eq("organization_id", org)
      .eq("id", id)
      .select()
      .single();
    check(error);
  }
  async archive(org: string, table: "cases" | "clients", id: string) {
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
    const { error } = await requireSupabase()
      .from(table)
      .update({ archived_at: timestamp() })
      .eq("organization_id", org)
      .eq("id", id)
      .select()
      .single();
    check(error);
  }
  async listHearings(org: string, from: string, to: string, caseId?: string) {
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
    let req = requireSupabase()
      .from("hearings")
      .select("*")
      .eq("organization_id", org)
      .gte("hearing_date", from)
      .lte("hearing_date", to)
      .order("hearing_date")
      .order("hearing_time")
      .limit(200);
    if (caseId) req = req.eq("case_id", caseId);
    const { data, error } = await req;
    check(error);
    return z.array(hearingSchema).parse(data);
  }
  async saveHearing(org: string, input: HearingInput, id?: string) {
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
    const { data, error } = id
      ? await requireSupabase()
          .from("hearings")
          .update(values)
          .eq("organization_id", org)
          .eq("id", id)
          .select()
          .single()
      : await requireSupabase()
          .from("hearings")
          .insert(values)
          .select()
          .single();
    check(error);
    return hearingSchema.parse(data);
  }
  async listDocuments(org: string, caseId?: string) {
    if (this.demo)
      return this.documents.filter(
        (d) => !d.archived_at && (!caseId || d.case_id === caseId),
      );
    let req = requireSupabase()
      .from("case_documents")
      .select("*")
      .eq("organization_id", org)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (caseId) req = req.eq("case_id", caseId);
    const { data, error } = await req;
    check(error);
    return z.array(documentSchema).parse(data);
  }
  async upload(org: string, caseId: string, file: File) {
    await validateFile(file);
    if (this.demo)
      throw new Error(
        "ডেমোতে গোপন নথি আপলোড হয় না। Supabase সংযোগ দিয়ে ব্যবহার করুন।",
      );
    const body = new FormData();
    body.set("organization_id", org);
    body.set("case_id", caseId);
    body.set("file", file);
    const { data, error } = await requireSupabase().functions.invoke(
      "upload-document",
      { body },
    );
    check(error);
    if (!data || typeof data !== "object" || !("document" in data))
      throw new Error("আপলোডের ফলাফল পাওয়া যায়নি");
    return documentSchema.parse(data.document);
  }
  async download(doc: DocumentRecord) {
    if (this.demo) throw new Error("ডেমো নথি ডাউনলোড করা যায় না");
    const { data, error } = await requireSupabase()
      .storage.from("case-documents")
      .createSignedUrl(doc.storage_path, 60);
    check(error);
    if (!data) throw new Error("ডাউনলোড লিংক তৈরি হয়নি");
    return data.signedUrl;
  }
  async archiveDocument(org: string, id: string) {
    if (this.demo) {
      this.documents = this.documents.map((d) =>
        d.id === id ? { ...d, archived_at: timestamp() } : d,
      );
      return;
    }
    const { error } = await requireSupabase()
      .from("case_documents")
      .update({ archived_at: timestamp() })
      .eq("organization_id", org)
      .eq("id", id)
      .select()
      .single();
    check(error);
  }
  async caseHistory(org: string, caseId: string) {
    if (this.demo) return this.events.filter((e) => e.case_id === caseId);
    const { data, error } = await requireSupabase()
      .from("case_events")
      .select("*")
      .eq("organization_id", org)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(100);
    check(error);
    return z.array(eventSchema).parse(data);
  }
  async caseNotes(org: string, caseId: string) {
    if (this.demo) return this.notes.filter((n) => n.case_id === caseId);
    const { data, error } = await requireSupabase()
      .from("case_notes")
      .select("*")
      .eq("organization_id", org)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(100);
    check(error);
    return z.array(noteSchema).parse(data);
  }
  async addNote(org: string, caseId: string, body: string) {
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
    const { error } = await requireSupabase()
      .from("case_notes")
      .insert({ organization_id: org, case_id: caseId, body })
      .select()
      .single();
    check(error);
  }
  async report(org: string, from = "", to = ""): Promise<Report> {
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
    const { data, error } = await requireSupabase().rpc("chamber_report", {
      org,
      ...(from ? { date_from: from } : {}),
      ...(to ? { date_to: to } : {}),
    });
    check(error);
    return reportSchema.parse(data);
  }
  async listNotifications(org: string) {
    if (this.demo) return this.notifications;
    const { data, error } = await requireSupabase()
      .from("notifications")
      .select("*")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(50);
    check(error);
    return z.array(notificationSchema).parse(data);
  }
  async readNotification(org: string, id: string) {
    if (this.demo) {
      this.notifications = this.notifications.map((n) =>
        n.id === id ? { ...n, read_at: timestamp() } : n,
      );
      return;
    }
    const { error } = await requireSupabase()
      .from("notifications")
      .update({ read_at: timestamp() })
      .eq("organization_id", org)
      .eq("id", id)
      .select()
      .single();
    check(error);
  }
  async invite(org: string, email: string, role: Role) {
    if (this.demo) throw new Error("ডেমোতে আমন্ত্রণ পাঠানো যায় না");
    const { data, error } = await requireSupabase().rpc("invite_member", {
      org,
      recipient_email: email,
      member_role: role,
    });
    check(error);
    return data;
  }
  async changeRole(org: string, userId: string, role: Role) {
    if (this.demo) throw new Error("ডেমোতে সদস্যের অনুমতি পরিবর্তন হয় না");
    const { error } = await requireSupabase().rpc("set_member_role", {
      org,
      member: userId,
      new_role: role,
    });
    check(error);
  }
  async assignments(org: string, caseId: string) {
    if (this.demo) return this.assigned[caseId] ?? [];
    const { data, error } = await requireSupabase()
      .from("case_assignments")
      .select("user_id")
      .eq("organization_id", org)
      .eq("case_id", caseId);
    check(error);
    return (data ?? []).map((x) => x.user_id);
  }
  async assign(org: string, caseId: string, userId: string) {
    if (this.demo) {
      this.assigned[caseId] = [
        ...new Set([...(this.assigned[caseId] ?? []), userId]),
      ];
      this.addEvent(caseId, "case_assignments:insert");
      return;
    }
    const { error } = await requireSupabase()
      .from("case_assignments")
      .insert({ organization_id: org, case_id: caseId, user_id: userId })
      .select()
      .single();
    check(error);
  }
  async unassign(org: string, caseId: string, userId: string) {
    if (this.demo) {
      this.assigned[caseId] = (this.assigned[caseId] ?? []).filter(
        (u) => u !== userId,
      );
      return;
    }
    const { error } = await requireSupabase()
      .from("case_assignments")
      .delete()
      .eq("organization_id", org)
      .eq("case_id", caseId)
      .eq("user_id", userId)
      .select()
      .single();
    check(error);
  }
  async saveOrganization(org: string, name: string, address: string) {
    if (this.demo) throw new Error("ডেমোতে চেম্বারের সেটিংস পরিবর্তন হয় না");
    const { error } = await requireSupabase()
      .from("organizations")
      .update({ name, address })
      .eq("id", org)
      .select()
      .single();
    check(error);
  }
  private addEvent(
    caseId: string,
    action: string,
    closure_date: string | null = null,
    outcome: string | null = null,
  ) {
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
