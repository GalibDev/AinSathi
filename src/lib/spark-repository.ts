import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db, requireAuth } from "./firebase";
import {
  caseFormSchema,
  clientFormSchema,
  hearingFormSchema,
  closureSchema,
  today,
} from "./schema";
import type {
  CaseRecord,
  ClientRecord,
  HearingRecord,
  DocumentRecord,
  Member,
  Organization,
  CaseEvent,
  CaseNote,
  Notification,
  Report,
  CaseFilters,
  CaseInput,
  ClientInput,
  HearingInput,
  Role,
} from "./schema";
const now = () => new Date().toISOString();
function store() {
  if (!db) throw new Error("Firebase সংযোগ দেওয়া হয়নি।");
  return db;
}
function user() {
  const u = requireAuth().currentUser;
  if (!u?.emailVerified) throw new Error("যাচাইকৃত অ্যাকাউন্টে লগইন করুন।");
  return u;
}
const ref = (org: string, table: string, id: string) =>
  doc(store(), "organizations", org, table, id);
async function rows<T>(org: string, table: string): Promise<T[]> {
  const r = await getDocs(
    query(collection(store(), "organizations", org, table), limit(1001)),
  );
  if (r.size > 1000)
    throw new Error("এই সংস্করণে প্রতি তালিকায় ১০০০ রেকর্ডের সীমা।");
  return r.docs.map((d) => d.data() as T);
}
async function one<T>(org: string, table: string, id: string): Promise<T> {
  const s = await getDoc(ref(org, table, id));
  if (!s.exists()) throw new Error("রেকর্ড পাওয়া যায়নি।");
  return s.data() as T;
}
export async function createChamber(name: string, display_name: string) {
  const u = user(),
    id = crypto.randomUUID(),
    stamp = now();
  const b = writeBatch(store());
  b.set(doc(store(), "organizations", id), {
    id,
    name,
    address: "",
    owner_uid: u.uid,
    created_at: stamp,
    updated_at: stamp,
  });
  b.set(doc(store(), "organization_members", id + "_" + u.uid), {
    organization_id: id,
    user_id: u.uid,
    role: "owner",
    display_name,
    created_at: stamp,
    updated_at: stamp,
  });
  b.set(ref(id, "counters", "cases"), { value: 0, last_case_id: "" });
  await b.commit();
}
export async function acceptInvitation(token: string, display_name: string) {
  const u = user();
  await runTransaction(store(), async (t) => {
    const ir = doc(store(), "invitations", token),
      s = await t.get(ir);
    if (!s.exists()) throw new Error("আমন্ত্রণ পাওয়া যায়নি।");
    const i = s.data();
    if (
      i.email !== u.email?.toLowerCase() ||
      i.expires_at < Date.now() ||
      i.used_by
    )
      throw new Error("আমন্ত্রণের ইমেইল বা মেয়াদ সঠিক নয়।");
    const stamp = now();
    t.set(
      doc(store(), "organization_members", i.organization_id + "_" + u.uid),
      {
        organization_id: i.organization_id,
        user_id: u.uid,
        role: i.role,
        display_name,
        invitation_id: token,
        created_at: stamp,
        updated_at: stamp,
      },
    );
    t.update(ir, { used_by: u.uid });
  });
}
export class SparkRepository {
  readonly demo = false;
  async memberships(): Promise<Member[]> {
    const s = await getDocs(
      query(
        collection(store(), "organization_members"),
        where("user_id", "==", user().uid),
      ),
    );
    return s.docs.map((d) => d.data() as Member);
  }
  async organizations(): Promise<Organization[]> {
    return Promise.all(
      (await this.memberships()).map(async (m) => {
        const d = await getDoc(
          doc(store(), "organizations", m.organization_id),
        );
        return d.data() as Organization;
      }),
    );
  }
  async members(org: string): Promise<Member[]> {
    const s = await getDocs(
      query(
        collection(store(), "organization_members"),
        where("organization_id", "==", org),
      ),
    );
    return s.docs.map((d) => d.data() as Member);
  }
  async listCases(org: string, f: CaseFilters) {
    const [all, clients, assigned] = await Promise.all([
      rows<CaseRecord>(org, "cases"),
      rows<ClientRecord>(org, "clients"),
      f.lawyer
        ? rows<{ case_id: string; user_id: string }>(org, "assignments")
        : Promise.resolve([]),
    ]);
    const hearings = await rows<HearingRecord>(org, "hearings");
    for (const c of all)
      c.next_hearing_date =
        hearings
          .filter((h) => h.case_id === c.id && h.hearing_date >= today())
          .map((h) => h.hearing_date)
          .sort()[0] ?? null;
    return all
      .filter(
        (c) =>
          !c.archived_at &&
          (!f.query ||
            [
              c.title,
              c.court_case_number,
              c.serial_number,
              c.plaintiff,
              c.defendant,
              c.contact_phone,
              clients.find((x) => x.id === c.client_id)?.full_name,
            ]
              .join(" ")
              .toLowerCase()
              .includes(f.query.toLowerCase())) &&
          (!f.type || c.case_type === f.type) &&
          (!f.status || c.status === f.status) &&
          (!f.court || c.court_name.includes(f.court)) &&
          (!f.lawyer ||
            assigned.some(
              (a) => a.case_id === c.id && a.user_id === f.lawyer,
            )) &&
          (!f.from || c.received_date >= f.from) &&
          (!f.to || c.received_date <= f.to) &&
          (!f.hearingFrom ||
            (!!c.next_hearing_date && c.next_hearing_date >= f.hearingFrom)) &&
          (!f.hearingTo ||
            (!!c.next_hearing_date && c.next_hearing_date <= f.hearingTo)),
      )
      .sort((a, b) =>
        f.sort === "oldest"
          ? a.serial_number - b.serial_number
          : f.sort === "hearing"
            ? (a.next_hearing_date ?? "9999").localeCompare(
                b.next_hearing_date ?? "9999",
              )
            : b.serial_number - a.serial_number,
      )
      .slice(f.page * 20, f.page * 20 + 20);
  }
  async getCase(org: string, id: string) {
    const c = await one<CaseRecord>(org, "cases", id);
    c.next_hearing_date =
      (await this.listHearings(org, today(), "", id))
        .map((h) => h.hearing_date)
        .sort()[0] ?? null;
    return c;
  }
  async listClients(org: string, q = "", page = 0) {
    return (await rows<ClientRecord>(org, "clients"))
      .filter(
        (c) =>
          !c.archived_at &&
          (c.full_name + c.phone).toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(page * 20, page * 20 + 20);
  }
  async getClient(org: string, id: string) {
    return one<ClientRecord>(org, "clients", id);
  }
  async clientCases(org: string, id: string) {
    return (await rows<CaseRecord>(org, "cases")).filter(
      (c) => c.client_id === id && !c.archived_at,
    );
  }
  async saveClient(org: string, input: ClientInput, id?: string) {
    const data = clientFormSchema.parse(input),
      stamp = now();
    const existing = id ? await this.getClient(org, id) : null;
    const c: ClientRecord = {
      ...data,
      id: id ?? crypto.randomUUID(),
      organization_id: org,
      archived_at: existing?.archived_at ?? null,
      created_at: existing?.created_at ?? stamp,
      updated_at: stamp,
    };
    await setDoc(ref(org, "clients", c.id), c);
    return c;
  }
  async saveCase(org: string, input: CaseInput, id?: string) {
    const data = caseFormSchema.parse(input),
      cid = id ?? crypto.randomUUID();
    await runTransaction(store(), async (t) => {
      const cr = ref(org, "cases", cid),
        counter = ref(org, "counters", "cases");
      const s = await t.get(cr),
        n = await t.get(counter),
        stamp = now();
      const old = s.exists() ? (s.data() as CaseRecord) : null;
      if (id && !old) throw new Error("মামলা পাওয়া যায়নি।");
      const c: CaseRecord = {
        ...data,
        id: cid,
        organization_id: org,
        serial_number: old?.serial_number ?? Number(n.data()?.value ?? 0) + 1,
        status: old?.status ?? "running",
        closed_date: old?.closed_date ?? null,
        closure_result: old?.closure_result ?? "",
        next_hearing_date: old?.next_hearing_date ?? null,
        archived_at: old?.archived_at ?? null,
        created_at: old?.created_at ?? stamp,
        updated_at: stamp,
      };
      if (!old) t.set(counter, { value: c.serial_number, last_case_id: cid });
      const eid = crypto.randomUUID();
      t.set(cr, { ...c, last_event_id: eid });
      t.set(ref(org, "events", eid), {
        id: eid,
        organization_id: org,
        case_id: cid,
        actor_id: user().uid,
        action: old ? "cases:update" : "cases:insert",
        closure_date: c.closed_date,
        outcome: c.status === "closed" ? c.closure_result : null,
        created_at: stamp,
      });
    });
    return this.getCase(org, cid);
  }
  async status(
    org: string,
    id: string,
    status: CaseRecord["status"],
    closed_date: string | null = null,
    closure_result = "",
  ) {
    if (status === "closed")
      closureSchema.parse({ closed_date, closure_result });
    const stamp = now(),
      eid = crypto.randomUUID(),
      b = writeBatch(store());
    b.update(ref(org, "cases", id), {
      last_event_id: eid,
      status,
      closed_date: status === "closed" ? closed_date : null,
      closure_result: status === "closed" ? closure_result : "",
      updated_at: stamp,
    });
    b.set(ref(org, "events", eid), {
      id: eid,
      organization_id: org,
      case_id: id,
      actor_id: user().uid,
      action: "cases:status:" + status,
      closure_date: status === "closed" ? closed_date : null,
      outcome: status === "closed" ? closure_result : null,
      created_at: stamp,
    });
    await b.commit();
  }
  async archive(org: string, table: "cases" | "clients", id: string) {
    await updateDoc(ref(org, table, id), {
      archived_at: now(),
      updated_at: now(),
    });
  }
  async listHearings(org: string, from: string, to: string, caseId?: string) {
    return (await rows<HearingRecord>(org, "hearings"))
      .filter(
        (h) =>
          (!from || h.hearing_date >= from) &&
          (!to || h.hearing_date <= to) &&
          (!caseId || h.case_id === caseId),
      )
      .sort((a, b) =>
        (a.hearing_date + (a.hearing_time ?? "")).localeCompare(
          b.hearing_date + (b.hearing_time ?? ""),
        ),
      );
  }
  async saveHearing(org: string, input: HearingInput, id?: string) {
    const data = hearingFormSchema.parse(input),
      stamp = now(),
      hid = id ?? crypto.randomUUID();
    const old = id ? await one<HearingRecord>(org, "hearings", id) : null;
    if (old && old.case_id !== data.case_id)
      throw new Error("শুনানির মামলা পরিবর্তন করা যাবে না।");
    const h: HearingRecord = {
      ...data,
      id: hid,
      organization_id: org,
      hearing_time: data.hearing_time || null,
      created_at: old?.created_at ?? stamp,
      updated_at: stamp,
    };
    const existing = await this.listHearings(org, "", "", data.case_id);
    const next =
      [...existing.filter((x) => x.id !== hid), h]
        .filter((x) => x.hearing_date >= today())
        .sort((a, b) => a.hearing_date.localeCompare(b.hearing_date))[0]
        ?.hearing_date ?? null;
    const b = writeBatch(store());
    b.set(ref(org, "hearings", hid), h);
    b.update(ref(org, "cases", data.case_id), {
      next_hearing_date: next,
      updated_at: stamp,
    });
    await b.commit();
    return h;
  }
  async listDocuments(
    _org: string,
    _caseId?: string,
  ): Promise<DocumentRecord[]> {
    void _caseId;
    void _org;
    return [];
  }
  async upload(_org: string, _caseId: string, _file: File): Promise<never> {
    void _org;
    void _caseId;
    void _file;
    throw new Error("Spark সংস্করণে নথি আপলোড বন্ধ।");
  }
  async download(_doc: DocumentRecord): Promise<string> {
    void _doc;
    throw new Error("নথি সংরক্ষণ চালু নেই।");
  }
  async archiveDocument(_org: string, _id: string): Promise<never> {
    void _org;
    void _id;
    throw new Error("নথি সংরক্ষণ চালু নেই।");
  }
  async caseHistory(org: string, id: string) {
    return (await rows<CaseEvent>(org, "events"))
      .filter((e) => e.case_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async caseNotes(org: string, id: string) {
    return (await rows<CaseNote>(org, "notes"))
      .filter((e) => e.case_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async addNote(org: string, caseId: string, body: string) {
    if (!body.trim() || body.length > 5000) throw new Error("সঠিক নোট লিখুন।");
    const id = crypto.randomUUID(),
      stamp = now();
    await setDoc(ref(org, "notes", id), {
      id,
      organization_id: org,
      case_id: caseId,
      body,
      author_id: user().uid,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  async report(org: string, from = "", to = ""): Promise<Report> {
    const all = (await rows<CaseRecord>(org, "cases")).filter(
        (c) => !c.archived_at,
      ),
      c = all.filter(
        (c) =>
          (!from || c.received_date >= from) && (!to || c.received_date <= to),
      );
    const group = (key: "case_type" | "court_name") =>
      Object.entries(
        c.reduce<Record<string, number>>((r, x) => {
          r[x[key]] = (r[x[key]] ?? 0) + 1;
          return r;
        }, {}),
      ).map(([label, count]) => ({ label, count }));
    const [assignments, members] = await Promise.all([
      rows<{ case_id: string; user_id: string }>(org, "assignments"),
      this.members(org),
    ]);
    const counts = new Map<string, number>();
    for (const a of assignments)
      if (c.some((x) => x.id === a.case_id))
        counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
    return {
      stats: {
        total: c.length,
        running: c.filter((x) => x.status === "running").length,
        pending: c.filter((x) => x.status === "pending").length,
        closed: c.filter((x) => x.status === "closed").length,
      },
      by_type: group("case_type"),
      by_court: group("court_name"),
      by_lawyer: [...counts].map(([uid, count]) => ({
        label:
          members.find((m) => m.user_id === uid)?.display_name ?? "অজানা সদস্য",
        count,
      })),
      closed_in_range: all.filter(
        (x) =>
          !!x.closed_date &&
          (!from || x.closed_date >= from) &&
          (!to || x.closed_date <= to),
      ).length,
    };
  }
  async listNotifications(_org: string): Promise<Notification[]> {
    void _org;
    return [];
  }
  async readNotification(_org: string, _id: string) {
    void _org;
    void _id;
    return;
  }
  async invite(org: string, email: string, role: Role) {
    if (role === "owner")
      throw new Error("মালিকের ভূমিকা আমন্ত্রণে দেওয়া যাবে না।");
    const token = crypto.randomUUID() + crypto.randomUUID();
    await setDoc(doc(store(), "invitations", token), {
      organization_id: org,
      email: email.trim().toLowerCase(),
      role,
      created_by: user().uid,
      expires_at: Date.now() + 7 * 86400000,
      used_by: null,
    });
    return token;
  }
  async changeRole(org: string, uid: string, role: Role) {
    await updateDoc(doc(store(), "organization_members", org + "_" + uid), {
      role,
      updated_at: now(),
    });
  }
  async assignments(org: string, id: string) {
    return (
      await rows<{ case_id: string; user_id: string }>(org, "assignments")
    )
      .filter((x) => x.case_id === id)
      .map((x) => x.user_id);
  }
  async assign(org: string, id: string, uid: string) {
    await setDoc(ref(org, "assignments", id + "_" + uid), {
      organization_id: org,
      case_id: id,
      user_id: uid,
    });
  }
  async unassign(org: string, id: string, uid: string) {
    await deleteDoc(ref(org, "assignments", id + "_" + uid));
  }
  async saveOrganization(org: string, name: string, address: string) {
    await updateDoc(doc(store(), "organizations", org), {
      name,
      address,
      updated_at: now(),
    });
  }
}
