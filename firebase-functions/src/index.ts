import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  type DocumentData,
  type Transaction,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  caseFormSchema,
  clientFormSchema,
  hearingFormSchema,
  closureSchema,
  roles,
  today,
  type Role,
  type CaseRecord,
} from "./schema.js";
import {
  requireRole,
  requireVerified,
  validStatus,
  fileMime,
  normalizedPhone,
} from "./policy.js";
initializeApp();
const db = getFirestore();
const now = () => new Date().toISOString();
const idSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const inputSchema = z
  .object({ action: z.string().min(1).max(60), org: idSchema.optional() })
  .passthrough();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const root = (org: string) => db.collection("organizations").doc(org);
const memberRef = (org: string, uid: string) =>
  db.collection("organization_members").doc(org + "_" + uid);
const rec = (org: string, table: string, id: string) =>
  root(org).collection(table).doc(idSchema.parse(id));
const recordId = (v: unknown) => idSchema.parse(v);
const list = async (org: string, table: string) => {
  const result = await root(org).collection(table).limit(5001).get();
  if (result.size > 5000)
    throw new HttpsError(
      "resource-exhausted",
      "এই চেম্বারে তালিকার সীমা অতিক্রম হয়েছে। Server pagination বাড়াতে হবে।",
    );
  return result.docs.map((d) => d.data());
};
async function existing(org: string, table: string, id: string) {
  const d = await rec(org, table, id).get();
  if (!d.exists) throw new HttpsError("not-found", "রেকর্ডটি পাওয়া যায়নি।");
  return d.data()!;
}
function event(
  tx: Transaction,
  org: string,
  caseId: string,
  uid: string,
  action: string,
  closure_date: string | null = null,
  outcome: string | null = null,
) {
  const id = randomUUID();
  tx.create(rec(org, "case_events", id), {
    id,
    organization_id: org,
    case_id: caseId,
    actor_id: uid,
    action,
    closure_date,
    outcome,
    created_at: now(),
  });
}
function audit(
  tx: Transaction,
  org: string,
  uid: string,
  action: string,
  id: string,
) {
  const aid = randomUUID();
  tx.create(rec(org, "audit_logs", aid), {
    id: aid,
    organization_id: org,
    actor_id: uid,
    action,
    record_id: id,
    created_at: now(),
  });
}
async function transactionRole(
  tx: Transaction,
  org: string,
  uid: string,
  op: "edit" | "manage" | "owner" = "edit",
) {
  const m = await tx.get(memberRef(org, uid));
  requireRole(m.data()?.role, op);
  return m.data()!;
}
function notification(
  tx: Transaction,
  org: string,
  uid: string,
  caseId: string,
  title: string,
) {
  const id = randomUUID();
  tx.create(rec(org, "notifications", id), {
    id,
    organization_id: org,
    user_id: uid,
    case_id: caseId,
    title,
    read_at: null,
    created_at: now(),
  });
}
async function currentCases(org: string) {
  const [cases, hearings] = await Promise.all([
    list(org, "cases"),
    list(org, "hearings"),
  ]);
  const next = new Map<string, string>();
  for (const h of hearings)
    if (
      h.hearing_date >= today() &&
      (!next.has(h.case_id) || h.hearing_date < next.get(h.case_id)!)
    )
      next.set(h.case_id, h.hearing_date);
  return cases
    .filter((c) => !c.archived_at)
    .map((c) => ({
      ...c,
      next_hearing_date: next.get(c.id) ?? null,
    })) as CaseRecord[];
}
export const workspace = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 120,
    maxInstances: 10,
  },
  async (request) => {
    try {
      const uid = requireVerified(request.auth);
      const args = inputSchema.parse(request.data);
      const action = args.action;
      const name = () => z.string().trim().min(2).max(150).parse(args.name);
      if (action === "memberships")
        return (
          await db
            .collection("organization_members")
            .where("user_id", "==", uid)
            .limit(200)
            .get()
        ).docs.map((d) => d.data());
      if (action === "organizations") {
        const memberships = await db
          .collection("organization_members")
          .where("user_id", "==", uid)
          .limit(200)
          .get();
        if (memberships.empty) return [];
        const orgs = await db.getAll(
          ...memberships.docs.map((m) => root(m.data().organization_id)),
        );
        return orgs
          .filter((o) => o.exists)
          .map((o) => {
            const { owner_uid: _, ...data } = o.data()!;
            return data;
          });
      }
      if (action === "createChamber") {
        const chamberName = z.string().trim().min(2).max(120).parse(args.name),
          displayName = z
            .string()
            .trim()
            .min(2)
            .max(150)
            .parse(args.memberName);
        const id = randomUUID(),
          stamp = now();
        await db.runTransaction(async (tx) => {
          const quota = db.collection("creation_limits").doc(uid),
            q = await tx.get(quota);
          if ((q.data()?.count ?? 0) >= 20)
            throw new HttpsError(
              "resource-exhausted",
              "সর্বোচ্চ ২০টি চেম্বার তৈরি করা যাবে।",
            );
          tx.set(quota, { count: (q.data()?.count ?? 0) + 1 });
          tx.create(root(id), {
            id,
            name: chamberName,
            address: "",
            owner_uid: uid,
            created_at: stamp,
            updated_at: stamp,
          });
          tx.create(memberRef(id, uid), {
            organization_id: id,
            user_id: uid,
            role: "owner",
            display_name: displayName,
            created_at: stamp,
            updated_at: stamp,
          });
          tx.create(rec(id, "counters", "cases"), { value: 0 });
          audit(tx, id, uid, "chamber:create", id);
        });
        return id;
      }
      if (action === "acceptInvitation") {
        const token = z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(args.token),
          displayName = z
            .string()
            .trim()
            .min(2)
            .max(150)
            .parse(args.memberName);
        return await db.runTransaction(async (tx) => {
          const inviteRef = db.collection("invitations").doc(hash(token)),
            invite = await tx.get(inviteRef),
            i = invite.data();
          if (
            !i ||
            i.used_at ||
            i.expires_at < now() ||
            i.email !== String(request.auth!.token.email ?? "").toLowerCase()
          )
            throw new HttpsError(
              "permission-denied",
              "আমন্ত্রণের মেয়াদ শেষ বা ইমেইল মিলছে না।",
            );
          const inviter = await tx.get(
            memberRef(i.organization_id, i.created_by),
          );
          requireRole(inviter.data()?.role, "manage");
          if (i.role === "admin") requireRole(inviter.data()?.role, "owner");
          const target = memberRef(i.organization_id, uid),
            member = await tx.get(target);
          if (member.exists)
            throw new HttpsError(
              "already-exists",
              "আপনি ইতিমধ্যে এই চেম্বারের সদস্য।",
            );
          const stamp = now();
          tx.create(target, {
            organization_id: i.organization_id,
            user_id: uid,
            role: i.role,
            display_name: displayName,
            created_at: stamp,
            updated_at: stamp,
          });
          tx.update(inviteRef, { used_at: stamp });
          audit(tx, i.organization_id, uid, "invitation:accept", uid);
          return i.organization_id;
        });
      }
      if (action === "saveProfile") {
        const displayName = name(),
          members = await db
            .collection("organization_members")
            .where("user_id", "==", uid)
            .limit(200)
            .get();
        const batch = db.batch();
        for (const m of members.docs)
          batch.update(m.ref, { display_name: displayName, updated_at: now() });
        await batch.commit();
        return null;
      }
      const org = recordId(args.org);
      const membership = (await memberRef(org, uid).get()).data();
      requireRole(membership?.role);
      const id = () => recordId(args.id);
      const caseId = () => recordId(args.caseId);
      if (action === "members")
        return (
          await db
            .collection("organization_members")
            .where("organization_id", "==", org)
            .limit(200)
            .get()
        ).docs.map((d) => d.data());
      if (action === "listCases") {
        const f = z
          .object({
            query: z.string(),
            type: z.string(),
            status: z.string(),
            court: z.string(),
            lawyer: z.string(),
            from: z.string(),
            to: z.string(),
            hearingFrom: z.string(),
            hearingTo: z.string(),
            page: z.number().int().min(0),
            sort: z.string(),
          })
          .parse(args.filters);
        const [cases, clients, assignments] = await Promise.all([
          currentCases(org),
          list(org, "clients"),
          f.lawyer ? list(org, "case_assignments") : Promise.resolve([]),
        ]);
        const result = cases.filter(
          (c) =>
            (!f.query ||
              [
                c.title,
                c.court_case_number,
                c.serial_number,
                c.plaintiff,
                c.defendant,
                c.contact_phone,
                clients.find((x) => x.id === c.client_id)?.full_name ?? "",
              ]
                .join(" ")
                .toLowerCase()
                .includes(f.query.toLowerCase())) &&
            (!f.type || c.case_type === f.type) &&
            (!f.status || c.status === f.status) &&
            (!f.court || c.court_name.includes(f.court)) &&
            (!f.lawyer ||
              assignments.some(
                (a) => a.case_id === c.id && a.user_id === f.lawyer,
              )) &&
            (!f.from || c.received_date >= f.from) &&
            (!f.to || c.received_date <= f.to) &&
            (!f.hearingFrom ||
              Boolean(
                c.next_hearing_date && c.next_hearing_date >= f.hearingFrom,
              )) &&
            (!f.hearingTo ||
              Boolean(
                c.next_hearing_date && c.next_hearing_date <= f.hearingTo,
              )),
        );
        result.sort((a, b) =>
          f.sort === "oldest"
            ? a.serial_number - b.serial_number
            : f.sort === "hearing"
              ? (a.next_hearing_date ?? "9999").localeCompare(
                  b.next_hearing_date ?? "9999",
                )
              : b.serial_number - a.serial_number,
        );
        return result.slice(f.page * 20, f.page * 20 + 20);
      }
      if (action === "getCase") {
        const c = (await currentCases(org)).find((c) => c.id === id());
        if (!c) throw new HttpsError("not-found", "মামলাটি পাওয়া যায়নি।");
        return c;
      }
      if (action === "clientCases")
        return (await currentCases(org))
          .filter((c) => c.client_id === id())
          .slice(0, 100);
      if (action === "listClients") {
        const query = z
            .string()
            .max(200)
            .parse(args.query ?? ""),
          page = z
            .number()
            .int()
            .min(0)
            .parse(args.page ?? 0);
        return (await list(org, "clients"))
          .filter(
            (c) =>
              !c.archived_at &&
              (c.full_name + c.phone)
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
          .slice(page * 20, page * 20 + 20);
      }
      if (action === "getClient") {
        const c = await existing(org, "clients", id());
        if (c.archived_at)
          throw new HttpsError("not-found", "মক্কেল আর্কাইভ করা হয়েছে।");
        return c;
      }
      if (action === "saveClient") {
        requireRole(membership?.role, "edit");
        const input = clientFormSchema.parse(args.input),
          cid = args.id ? id() : randomUUID();
        return await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const ref = rec(org, "clients", cid),
            old = await tx.get(ref),
            phoneRef = rec(org, "client_phones", normalizedPhone(input.phone)),
            phone = await tx.get(phoneRef);
          if (args.id && (!old.exists || old.data()?.archived_at))
            throw new HttpsError("not-found", "মক্কেল পাওয়া যায়নি।");
          if (phone.exists && phone.data()?.client_id !== cid)
            throw new HttpsError(
              "already-exists",
              "এই মোবাইল নম্বরে মক্কেল ইতিমধ্যে আছেন।",
            );
          const value = {
            ...input,
            id: cid,
            organization_id: org,
            archived_at: null,
            created_at: old.data()?.created_at ?? now(),
            updated_at: now(),
          };
          if (
            old.exists &&
            normalizedPhone(old.data()!.phone) !== normalizedPhone(input.phone)
          )
            tx.delete(
              rec(org, "client_phones", normalizedPhone(old.data()!.phone)),
            );
          tx.set(ref, value);
          tx.set(phoneRef, { client_id: cid });
          audit(tx, org, uid, "clients:save", cid);
          return value;
        });
      }
      if (action === "saveCase") {
        requireRole(membership?.role, "edit");
        const input = caseFormSchema.parse(args.input),
          cid = args.id ? id() : randomUUID();
        return await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const ref = rec(org, "cases", cid),
            old = await tx.get(ref),
            client = await tx.get(rec(org, "clients", input.client_id)),
            counterRef = rec(org, "counters", "cases"),
            counter = await tx.get(counterRef);
          if (!client.exists || client.data()?.archived_at)
            throw new HttpsError(
              "invalid-argument",
              "এই চেম্বারের সক্রিয় মক্কেল নির্বাচন করুন।",
            );
          if (args.id && (!old.exists || old.data()?.archived_at))
            throw new HttpsError("not-found", "মামলা পাওয়া যায়নি।");
          if (
            old.data()?.closed_date &&
            old.data()!.closed_date < input.received_date
          )
            throw new HttpsError(
              "invalid-argument",
              "গ্রহণের তারিখ নিষ্পত্তির পরে হতে পারে না।",
            );
          const value = {
            ...input,
            id: cid,
            organization_id: org,
            serial_number:
              old.data()?.serial_number ?? (counter.data()?.value ?? 0) + 1,
            status: old.data()?.status ?? "running",
            closed_date: old.data()?.closed_date ?? null,
            closure_result: old.data()?.closure_result ?? "",
            next_hearing_date: null,
            archived_at: null,
            created_at: old.data()?.created_at ?? now(),
            updated_at: now(),
          };
          if (!old.exists) tx.set(counterRef, { value: value.serial_number });
          tx.set(ref, value);
          event(
            tx,
            org,
            cid,
            uid,
            old.exists ? "cases:update" : "cases:insert",
          );
          audit(tx, org, uid, "cases:save", cid);
          return value;
        });
      }
      if (action === "status") {
        const cid = id(),
          status = z.string().parse(args.status);
        if (status === "closed")
          closureSchema.parse({
            closed_date: args.closed_date,
            closure_result: args.closure_result,
          });
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const ref = rec(org, "cases", cid),
            c = await tx.get(ref);
          if (!c.exists || c.data()?.archived_at)
            throw new HttpsError("not-found", "মামলা পাওয়া যায়নি।");
          const closedDate =
              status === "closed" ? String(args.closed_date) : null,
            result = status === "closed" ? String(args.closure_result) : "";
          validStatus(status, closedDate, result, c.data()!.received_date);
          tx.update(ref, {
            status,
            closed_date: closedDate,
            closure_result: result,
            updated_at: now(),
          });
          event(
            tx,
            org,
            cid,
            uid,
            "cases:status:" + status,
            closedDate,
            result,
          );
          audit(tx, org, uid, "cases:status", cid);
        });
        return null;
      }
      if (action === "archive") {
        const table = z.enum(["cases", "clients"]).parse(args.table),
          cid = id();
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const ref = rec(org, table, cid),
            c = await tx.get(ref);
          if (!c.exists)
            throw new HttpsError("not-found", "রেকর্ড পাওয়া যায়নি।");
          tx.update(ref, { archived_at: now(), updated_at: now() });
          if (table === "clients" && !c.data()?.archived_at)
            tx.delete(
              rec(org, "client_phones", normalizedPhone(c.data()!.phone)),
            );
          if (table === "cases") event(tx, org, cid, uid, "cases:archive");
          audit(tx, org, uid, table + ":archive", cid);
        });
        return null;
      }
      if (action === "listHearings")
        return (await list(org, "hearings"))
          .filter(
            (h) =>
              (!args.caseId || h.case_id === caseId()) &&
              h.hearing_date >= String(args.from) &&
              h.hearing_date <= String(args.to),
          )
          .sort((a, b) =>
            (a.hearing_date + (a.hearing_time ?? "99:99")).localeCompare(
              b.hearing_date + (b.hearing_time ?? "99:99"),
            ),
          )
          .slice(0, 200);
      if (action === "saveHearing") {
        const input = hearingFormSchema.parse(args.input),
          hid = args.id ? id() : randomUUID();
        return await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const c = await tx.get(rec(org, "cases", input.case_id)),
            ref = rec(org, "hearings", hid),
            old = await tx.get(ref);
          if (!c.exists || c.data()?.archived_at)
            throw new HttpsError("not-found", "মামলা পাওয়া যায়নি।");
          if (args.id && (!old.exists || old.data()?.case_id !== input.case_id))
            throw new HttpsError(
              "permission-denied",
              "শুনানির মামলা পরিবর্তন করা যায় না।",
            );
          const value = {
            ...input,
            hearing_time: input.hearing_time || null,
            id: hid,
            organization_id: org,
            created_at: old.data()?.created_at ?? now(),
            updated_at: now(),
          };
          tx.set(ref, value);
          event(
            tx,
            org,
            input.case_id,
            uid,
            "hearings:" + (old.exists ? "update" : "insert"),
          );
          notification(
            tx,
            org,
            uid,
            input.case_id,
            "শুনানি: " + input.hearing_date + " — " + input.purpose,
          );
          audit(tx, org, uid, "hearings:save", hid);
          return value;
        });
      }
      if (action === "listDocuments")
        return (await list(org, "case_documents"))
          .filter(
            (d) => !d.archived_at && (!args.caseId || d.case_id === caseId()),
          )
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 100);
      if (action === "caseHistory" || action === "caseNotes")
        return (
          await list(
            org,
            action === "caseHistory" ? "case_events" : "case_notes",
          )
        )
          .filter((r) => r.case_id === caseId())
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 100);
      if (action === "addNote") {
        const cid = caseId(),
          body = z.string().trim().min(1).max(10000).parse(args.body);
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const c = await tx.get(rec(org, "cases", cid));
          if (!c.exists || c.data()?.archived_at)
            throw new HttpsError("not-found", "মামলা পাওয়া যায়নি।");
          const nid = randomUUID();
          tx.create(rec(org, "case_notes", nid), {
            id: nid,
            organization_id: org,
            case_id: cid,
            body,
            author_id: uid,
            created_at: now(),
            updated_at: now(),
          });
          event(tx, org, cid, uid, "case_notes:insert");
          audit(tx, org, uid, "case_notes:insert", nid);
        });
        return null;
      }
      if (action === "report") {
        const from = z.string().parse(args.from ?? ""),
          to = z.string().parse(args.to ?? ""),
          all = await currentCases(org),
          cases = all.filter(
            (c) =>
              (!from || c.received_date >= from) &&
              (!to || c.received_date <= to),
          );
        const group = (key: "case_type" | "court_name") =>
          Object.entries(
            cases.reduce<Record<string, number>>(
              (m, c) => ({ ...m, [c[key]]: (m[c[key]] ?? 0) + 1 }),
              {},
            ),
          ).map(([label, count]) => ({ label, count }));
        const [members, assigned] = await Promise.all([
          db
            .collection("organization_members")
            .where("organization_id", "==", org)
            .limit(200)
            .get(),
          list(org, "case_assignments"),
        ]);
        return {
          stats: {
            total: cases.length,
            running: cases.filter((c) => c.status === "running").length,
            pending: cases.filter((c) => c.status === "pending").length,
            closed: cases.filter((c) => c.status === "closed").length,
          },
          by_type: group("case_type"),
          by_court: group("court_name"),
          by_lawyer: members.docs
            .map((m) => ({
              label: m.data().display_name,
              count: assigned.filter(
                (a) =>
                  a.user_id === m.data().user_id &&
                  cases.some((c) => c.id === a.case_id),
              ).length,
            }))
            .filter((x) => x.count),
          closed_in_range: all.filter(
            (c) =>
              c.closed_date &&
              (!from || c.closed_date >= from) &&
              (!to || c.closed_date <= to),
          ).length,
        };
      }
      if (action === "listNotifications")
        return (await list(org, "notifications"))
          .filter((n) => n.user_id === uid)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 50);
      if (action === "readNotification") {
        const n = await existing(org, "notifications", id());
        if (n.user_id !== uid)
          throw new HttpsError("permission-denied", "অনুমতি নেই।");
        await rec(org, "notifications", id()).update({ read_at: now() });
        return null;
      }
      if (action === "invite") {
        const email = z.string().email().parse(args.email).toLowerCase(),
          role = z
            .enum(["admin", "lawyer", "assistant", "viewer"])
            .parse(args.role),
          token = randomBytes(32).toString("hex");
        await db.runTransaction(async (tx) => {
          await transactionRole(
            tx,
            org,
            uid,
            role === "admin" ? "owner" : "manage",
          );
          tx.create(db.collection("invitations").doc(hash(token)), {
            organization_id: org,
            email,
            role,
            created_by: uid,
            created_at: now(),
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            used_at: null,
          });
          audit(tx, org, uid, "invitation:create", hash(token));
        });
        return token;
      }
      if (action === "changeRole") {
        const target = recordId(args.userId),
          role = z.enum(roles).parse(args.role);
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid, "owner");
          const ref = memberRef(org, target),
            m = await tx.get(ref);
          if (!m.exists)
            throw new HttpsError("not-found", "সদস্য পাওয়া যায়নি।");
          if (m.data()?.role === "owner" || role === "owner")
            throw new HttpsError(
              "failed-precondition",
              "চেম্বারের প্রতিষ্ঠাতার মালিকানা পরিবর্তন করা যায় না।",
            );
          tx.update(ref, { role, updated_at: now() });
          audit(tx, org, uid, "member:role", target);
        });
        return null;
      }
      if (action === "assignments")
        return (await list(org, "case_assignments"))
          .filter((a) => a.case_id === caseId())
          .map((a) => a.user_id);
      if (action === "assign" || action === "unassign") {
        const cid = caseId(),
          target = recordId(args.userId);
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const c = await tx.get(rec(org, "cases", cid)),
            m = await tx.get(memberRef(org, target));
          if (!c.exists || c.data()?.archived_at || !m.exists)
            throw new HttpsError(
              "invalid-argument",
              "এই চেম্বারের মামলা ও সদস্য নির্বাচন করুন।",
            );
          const ref = rec(org, "case_assignments", cid + "_" + target);
          if (action === "assign") {
            tx.set(ref, {
              case_id: cid,
              user_id: target,
              organization_id: org,
            });
            event(tx, org, cid, uid, "case_assignments:insert");
            notification(tx, org, target, cid, "মামলার দায়িত্ব দেওয়া হয়েছে");
          } else tx.delete(ref);
          audit(tx, org, uid, "assignment:" + action, cid);
        });
        return null;
      }
      if (action === "saveOrganization") {
        const value = {
          name: name(),
          address: z.string().max(500).parse(args.address),
          updated_at: now(),
        };
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid, "manage");
          tx.update(root(org), value);
          audit(tx, org, uid, "chamber:update", org);
        });
        return null;
      }
      if (action === "archiveDocument") {
        const did = id();
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const ref = rec(org, "case_documents", did),
            d = await tx.get(ref);
          if (!d.exists)
            throw new HttpsError("not-found", "নথি পাওয়া যায়নি।");
          tx.update(ref, { archived_at: now(), updated_at: now() });
          event(tx, org, d.data()!.case_id, uid, "case_documents:update");
          audit(tx, org, uid, "document:archive", did);
        });
        return null;
      }
      if (action === "download") {
        const d = await existing(org, "case_documents", id());
        if (d.archived_at)
          throw new HttpsError("not-found", "নথি আর্কাইভ করা হয়েছে।");
        return (
          await getStorage()
            .bucket()
            .file(d.storage_path)
            .getSignedUrl({ action: "read", expires: Date.now() + 60000 })
        )[0];
      }
      if (action === "upload") {
        requireRole(membership?.role, "edit");
        const cid = caseId(),
          c = await existing(org, "cases", cid);
        if (c.archived_at)
          throw new HttpsError("not-found", "মামলা আর্কাইভ করা হয়েছে।");
        const filename = z.string().min(1).max(200).parse(args.name),
          base64 = z
            .string()
            .max(13981016)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/)
            .parse(args.base64),
          bytes = Buffer.from(base64, "base64"),
          mime = fileMime(bytes);
        if (
          !bytes.length ||
          bytes.length > 10 * 1024 * 1024 ||
          !mime ||
          mime !== args.mime
        )
          throw new HttpsError(
            "invalid-argument",
            "সঠিক PDF/JPG/PNG দিন (সর্বোচ্চ ১০ MB)।",
          );
        const did = randomUUID(),
          path =
            org +
            "/" +
            cid +
            "/" +
            did +
            (mime === "application/pdf"
              ? ".pdf"
              : mime === "image/png"
                ? ".png"
                : ".jpg"),
          file = getStorage().bucket().file(path);
        await db.runTransaction(async (tx) => {
          await transactionRole(tx, org, uid);
          const qref = rec(org, "upload_limits", uid),
            q = await tx.get(qref),
            window = Math.floor(Date.now() / 600000),
            count = q.data()?.window === window ? (q.data()?.count ?? 0) : 0;
          if (count >= 20)
            throw new HttpsError(
              "resource-exhausted",
              "১০ মিনিটে সর্বোচ্চ ২০টি নথি। পরে চেষ্টা করুন।",
            );
          tx.set(qref, { window, count: count + 1 });
        });
        await file.save(bytes, {
          resumable: false,
          metadata: { contentType: mime, cacheControl: "private, no-store" },
        });
        try {
          return await db.runTransaction(async (tx) => {
            await transactionRole(tx, org, uid);
            const c = await tx.get(rec(org, "cases", cid));
            if (!c.exists || c.data()?.archived_at)
              throw new HttpsError("not-found", "মামলা পাওয়া যায়নি।");
            const value = {
              id: did,
              organization_id: org,
              case_id: cid,
              name: filename,
              storage_path: path,
              mime_type: mime,
              size_bytes: bytes.length,
              uploaded_by: uid,
              archived_at: null,
              created_at: now(),
              updated_at: now(),
            };
            tx.create(rec(org, "case_documents", did), value);
            event(tx, org, cid, uid, "case_documents:insert");
            audit(tx, org, uid, "document:upload", did);
            return value;
          });
        } catch (e) {
          await file.delete({ ignoreNotFound: true }).catch(() => {});
          throw e;
        }
      }
      throw new HttpsError("invalid-argument", "Unknown action");
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e instanceof z.ZodError)
        throw new HttpsError(
          "invalid-argument",
          e.issues[0]?.message ?? "তথ্য সঠিক নয়।",
        );
      // Never include case data or upload bytes in logs or client errors.
      throw new HttpsError(
        "internal",
        "কাজটি সম্পন্ন হয়নি। Firebase deployment ও configuration যাচাই করুন।",
      );
    }
  },
);
