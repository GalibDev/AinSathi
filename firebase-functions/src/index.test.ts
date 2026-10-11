import { beforeEach, describe, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const rows = new Map<string, Row>();
  class Ref {
    constructor(public path: string) {}
    collection(name: string) {
      return new Query(this.path + "/" + name);
    }
    async get() {
      const data = rows.get(this.path);
      return { exists: Boolean(data), data: () => data, ref: this };
    }
    async update(value: Row) {
      if (!rows.has(this.path)) throw new Error("missing");
      rows.set(this.path, { ...rows.get(this.path), ...value });
    }
  }
  class Query {
    constructor(
      public path: string,
      public filters: Array<[string, unknown]> = [],
      public cap = Infinity,
    ) {}
    doc(id: string) {
      return new Ref(this.path + "/" + id);
    }
    where(field: string, _op: string, value: unknown) {
      return new Query(this.path, [...this.filters, [field, value]], this.cap);
    }
    limit(cap: number) {
      return new Query(this.path, this.filters, cap);
    }
    async get() {
      const docs = [...rows.entries()]
        .filter(
          ([key, row]) =>
            key.startsWith(this.path + "/") &&
            key.split("/").length === this.path.split("/").length + 1 &&
            this.filters.every(([f, v]) => row[f] === v),
        )
        .slice(0, this.cap)
        .map(([path, data]) => ({
          data: () => data,
          ref: new Ref(path),
          exists: true,
        }));
      return { docs, size: docs.length, empty: !docs.length };
    }
  }
  const files = new Map<string, Uint8Array>();
  const db = {
    collection: (name: string) => new Query(name),
    getAll: (...refs: Ref[]) => Promise.all(refs.map((r) => r.get())),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
      const work: Array<() => void> = [];
      const tx = {
        get: (r: Ref) => r.get(),
        create: (r: Ref, v: Row) =>
          work.push(() => {
            if (rows.has(r.path)) throw new Error("duplicate");
            rows.set(r.path, v);
          }),
        set: (r: Ref, v: Row) => work.push(() => rows.set(r.path, v)),
        update: (r: Ref, v: Row) =>
          work.push(() => rows.set(r.path, { ...rows.get(r.path), ...v })),
        delete: (r: Ref) => work.push(() => rows.delete(r.path)),
      };
      const value = await fn(tx);
      for (const action of work) action();
      return value;
    },
    batch: () => {
      const work: Array<() => void> = [];
      return {
        update: (r: Ref, v: Row) =>
          work.push(() => rows.set(r.path, { ...rows.get(r.path), ...v })),
        commit: async () => {
          work.forEach((f) => f());
        },
      };
    },
  };
  return {
    rows,
    files,
    db,
    storage: {
      bucket: () => ({
        file: (path: string) => ({
          save: async (bytes: Uint8Array) => {
            files.set(path, bytes);
          },
          delete: async () => files.delete(path),
          getSignedUrl: async () => ["https://example.test/signed"],
        }),
      }),
    },
  };
});
vi.mock("firebase-admin/app", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => memory.db }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => memory.storage }));
import { workspace } from "./index";
import {
  requireRole,
  requireVerified,
  fileMime,
  normalizedPhone,
} from "./policy";
// Uses the real callable dispatcher with an in-memory transactional adapter.
// It does not validate Firestore IAM, emulator rules, signing, or production concurrency.
const invoke = (
  uid: string,
  action: string,
  args: Record<string, unknown> = {},
  verified = true,
) =>
  workspace.run({
    data: { action, ...args },
    auth: {
      uid,
      token: { email: uid + "@test.local", email_verified: verified },
    },
  } as never);
let org: string, client: string, caseId: string;
const clientInput = {
  full_name: "Rahim",
  phone: "01712345678",
  alternative_phone: "",
  address: "Dhaka",
  notes: "",
};
const caseInput = () => ({
  title: "Rahim vs Karim",
  court_case_number: "123/2026",
  case_year: 2026,
  case_type: "civil",
  court_name: "Dhaka Court",
  court_location: "Dhaka",
  received_date: "2026-10-01",
  client_id: client,
  plaintiff: "Rahim",
  defendant: "Karim",
  contact_phone: "",
  notes: "",
});
beforeEach(async () => {
  memory.rows.clear();
  memory.files.clear();
  org = (await invoke("alice", "createChamber", {
    name: "Alice Chamber",
    memberName: "Alice",
  })) as string;
  const c = (await invoke("alice", "saveClient", {
    org,
    input: clientInput,
  })) as { id: string };
  client = c.id;
  const record = (await invoke("alice", "saveCase", {
    org,
    input: caseInput(),
  })) as { id: string };
  caseId = record.id;
});
describe("Firebase callable authorization and workflows", () => {
  it("requires authentication and verified email", async () => {
    expect(() => requireVerified(undefined)).toThrow();
    await expect(invoke("alice", "memberships", {}, false)).rejects.toThrow(
      "ইমেইল যাচাই",
    );
  });
  it("rejects outsiders for reads, writes, downloads and role changes", async () => {
    for (const action of [
      "listClients",
      "getCase",
      "saveCase",
      "download",
      "changeRole",
    ])
      await expect(
        invoke("bob", action, {
          org,
          id: caseId,
          input: caseInput(),
          userId: "bob",
          role: "admin",
        }),
      ).rejects.toThrow("অনুমতি নেই");
  });
  it("allows viewers to read and refuses writes", async () => {
    memory.rows.set("organization_members/" + org + "_viewer", {
      organization_id: org,
      user_id: "viewer",
      role: "viewer",
    });
    expect(
      (
        (await invoke("viewer", "getCase", { org, id: caseId })) as {
          id: string;
        }
      ).id,
    ).toBe(caseId);
    await expect(
      invoke("viewer", "saveClient", {
        org,
        input: { ...clientInput, phone: "01812345678" },
      }),
    ).rejects.toThrow("অনুমতি নেই");
  });
  it("allocates serials and preserves them on edit; rejects foreign clients", async () => {
    const next = (await invoke("alice", "saveCase", {
      org,
      input: caseInput(),
    })) as { id: string; serial_number: number };
    expect(next.serial_number).toBe(2);
    const edited = (await invoke("alice", "saveCase", {
      org,
      id: caseId,
      input: { ...caseInput(), title: "Updated" },
    })) as { serial_number: number };
    expect(edited.serial_number).toBe(1);
    await expect(
      invoke("alice", "saveCase", {
        org,
        input: { ...caseInput(), client_id: crypto.randomUUID() },
      }),
    ).rejects.toThrow("মক্কেল নির্বাচন");
    const third = (await invoke("alice", "saveCase", {
      org,
      input: caseInput(),
    })) as { serial_number: number };
    expect(third.serial_number).toBe(3);
  });
  it("enforces normalized phone uniqueness", async () => {
    expect(normalizedPhone("+8801712345678")).toBe("01712345678");
    await expect(
      invoke("alice", "saveClient", {
        org,
        input: { ...clientInput, phone: "+8801712345678" },
      }),
    ).rejects.toThrow("ইতিমধ্যে");
  });
  it("preserves closure outcome after reopening", async () => {
    await expect(
      invoke("alice", "status", {
        org,
        id: caseId,
        status: "closed",
        closed_date: "2026-09-01",
        closure_result: "Disposed",
      }),
    ).rejects.toThrow("সঠিক নিষ্পত্তি");
    await invoke("alice", "status", {
      org,
      id: caseId,
      status: "closed",
      closed_date: "2026-10-10",
      closure_result: "Disposed",
    });
    await invoke("alice", "status", { org, id: caseId, status: "running" });
    const c = (await invoke("alice", "getCase", { org, id: caseId })) as {
      closed_date: null;
    };
    expect(c.closed_date).toBeNull();
    const history = (await invoke("alice", "caseHistory", {
      org,
      caseId,
    })) as Array<{ action: string; outcome: string }>;
    expect(
      history.find((e) => e.action === "cases:status:closed")?.outcome,
    ).toBe("Disposed");
  });
  it("keeps the founder as owner and disallows admin escalating roles", async () => {
    await expect(
      invoke("alice", "changeRole", { org, userId: "alice", role: "viewer" }),
    ).rejects.toThrow("প্রতিষ্ঠাতার");
    memory.rows.set("organization_members/" + org + "_admin", {
      organization_id: org,
      user_id: "admin",
      role: "admin",
    });
    await expect(
      invoke("admin", "changeRole", { org, userId: "admin", role: "owner" }),
    ).rejects.toThrow("অনুমতি নেই");
    await expect(
      invoke("admin", "invite", {
        org,
        email: "bob@test.local",
        role: "admin",
      }),
    ).rejects.toThrow("অনুমতি নেই");
  });
  it("binds invitations to verified email and prevents replay", async () => {
    const token = await invoke("alice", "invite", {
      org,
      email: "bob@test.local",
      role: "lawyer",
    });
    await expect(
      invoke("charlie", "acceptInvitation", { token, memberName: "Charlie" }),
    ).rejects.toThrow("ইমেইল মিলছে না");
    expect(
      await invoke("bob", "acceptInvitation", { token, memberName: "Bob" }),
    ).toBe(org);
    await expect(
      invoke("bob", "acceptInvitation", { token, memberName: "Bob" }),
    ).rejects.toThrow();
  });
  it("derives next hearing and records assignments/notifications", async () => {
    await invoke("alice", "saveHearing", {
      org,
      input: {
        case_id: caseId,
        hearing_date: "2099-01-01",
        hearing_time: "10:00",
        court_name: "Dhaka",
        purpose: "Evidence",
        outcome: "",
        notes: "",
        reminder_days: 1,
      },
    });
    const c = (await invoke("alice", "getCase", { org, id: caseId })) as {
      next_hearing_date: string;
    };
    expect(c.next_hearing_date).toBe("2099-01-01");
    await invoke("alice", "assign", { org, caseId, userId: "alice" });
    expect(await invoke("alice", "assignments", { org, caseId })).toEqual([
      "alice",
    ]);
    expect(
      ((await invoke("alice", "listNotifications", { org })) as unknown[])
        .length,
    ).toBe(2);
    await invoke("alice", "unassign", { org, caseId, userId: "alice" });
    expect(await invoke("alice", "assignments", { org, caseId })).toEqual([]);
  });
  it("validates file signatures on the server and archives metadata", async () => {
    expect(fileMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    await expect(
      invoke("alice", "upload", {
        org,
        caseId,
        name: "bad.pdf",
        mime: "application/pdf",
        base64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).rejects.toThrow("PDF/JPG/PNG");
    const d = (await invoke("alice", "upload", {
      org,
      caseId,
      name: "sample.pdf",
      mime: "application/pdf",
      base64: Buffer.from("%PDF-1.7 test").toString("base64"),
    })) as { id: string };
    expect(memory.files.size).toBe(1);
    expect(await invoke("alice", "download", { org, id: d.id })).toContain(
      "signed",
    );
    await invoke("alice", "archiveDocument", { org, id: d.id });
    expect(await invoke("alice", "listDocuments", { org, caseId })).toEqual([]);
    expect(memory.files.size).toBe(1);
  });
  it("reports totals and rejects path traversal", async () => {
    expect(
      (
        (await invoke("alice", "report", { org })) as {
          stats: { total: number };
        }
      ).stats.total,
    ).toBe(1);
    await expect(
      invoke("alice", "getCase", { org, id: "../another" }),
    ).rejects.toThrow();
    expect(() => requireRole("viewer", "edit")).toThrow();
  });
});
