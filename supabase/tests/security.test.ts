import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createTestDatabase } from "../../scripts/database.ts";
import type { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const alice = "a0000000-0000-4000-8000-000000000001",
  bob = "b0000000-0000-4000-8000-000000000001",
  viewer = "c0000000-0000-4000-8000-000000000001",
  lawyer = "d0000000-0000-4000-8000-000000000001";
let orgA: string, orgB: string, clientA: string, clientB: string, caseA: string;
async function as(user: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function insertCase(org: string, client: string) {
  return db.query<{ id: string; serial_number: number }>(
    `insert into public.cases(organization_id,client_id,court_case_number,case_year,title,case_type,court_name,received_date) values($1,$2,'123/2026',2026,'Rahim vs Karim','civil','Dhaka Court','2026-09-12') returning id,serial_number`,
    [org, client],
  );
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [id, email] of [
    [alice, "alice@test.local"],
    [bob, "bob@test.local"],
    [viewer, "viewer@test.local"],
    [lawyer, "lawyer@test.local"],
  ])
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, email],
    );
  await as(alice);
  orgA = (
    await db.query<{ id: string }>(
      "select public.create_chamber('Chamber A','Alice') id",
    )
  ).rows[0].id;
  clientA = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,full_name,phone) values($1,'Rahim','01712345678') returning id",
      [orgA],
    )
  ).rows[0].id;
  caseA = (await insertCase(orgA, clientA)).rows[0].id;
  await as(bob);
  orgB = (
    await db.query<{ id: string }>(
      "select public.create_chamber('Chamber B','Bob') id",
    )
  ).rows[0].id;
  clientB = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,full_name,phone) values($1,'Karim','01812345678') returning id",
      [orgB],
    )
  ).rows[0].id;
  await db.exec("reset role");
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role,display_name) values($1,$2,'viewer','Viewer'),($1,$3,'lawyer','Lawyer')",
    [orgA, viewer, lawyer],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("migrated PostgreSQL security and consistency", () => {
  it("isolates organizations in SELECT and report RPC", async () => {
    await as(bob);
    expect(
      (
        await db.query("select * from public.cases where organization_id=$1", [
          orgA,
        ])
      ).rows,
    ).toHaveLength(0);
    const report = await db.query<{ r: { stats: { total: number } } }>(
      "select public.chamber_report($1) r",
      [orgA],
    );
    expect(report.rows[0].r.stats.total).toBe(0);
  });
  it("denies outsider updates and role escalation including NULL role", async () => {
    await as(bob);
    expect(
      (
        await db.query(
          "update public.cases set title=$1 where id=$2 returning id",
          ["Stolen", caseA],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.set_member_role($1,$2,$3)", [orgA, bob, "owner"]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
        [orgA, bob],
      ),
    ).rejects.toThrow();
  });
  it("does not let a viewer write cases or notes", async () => {
    await as(viewer);
    await expect(insertCase(orgA, clientA)).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.case_notes(organization_id,case_id,body) values($1,$2,'Unauthorized')",
        [orgA, caseA],
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.cases where id=$1", [caseA])).rows,
    ).toHaveLength(1);
  });
  it("rejects cross-organization client references", async () => {
    await as(alice);
    await expect(insertCase(orgA, clientB)).rejects.toThrow();
  });
  it("allocates a continuous unique serial sequence per chamber", async () => {
    await as(alice);
    const inserts = await Promise.all(
      Array.from({ length: 12 }, () => insertCase(orgA, clientA)),
    );
    const serials = inserts.map((x) => Number(x.rows[0].serial_number));
    expect(new Set(serials).size).toBe(12);
    expect(serials.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 2),
    );
    await as(bob);
    expect(
      Number((await insertCase(orgB, clientB)).rows[0].serial_number),
    ).toBe(1);
  });
  it("preserves serials on edit and denies explicit serial changes", async () => {
    await as(alice);
    await db.query(
      "update public.cases set title='Updated title' where id=$1",
      [caseA],
    );
    expect(
      Number(
        (
          await db.query<{ serial_number: number }>(
            "select serial_number from public.cases where id=$1",
            [caseA],
          )
        ).rows[0].serial_number,
      ),
    ).toBe(1);
    await expect(
      db.query("update public.cases set serial_number=999 where id=$1", [
        caseA,
      ]),
    ).rejects.toThrow();
  });
  it("validates closure and retains closure/reopen history", async () => {
    await as(alice);
    await expect(
      db.query("update public.cases set status='closed' where id=$1", [caseA]),
    ).rejects.toThrow();
    await db.query(
      "update public.cases set status='closed',closed_date='2026-10-10',closure_result='Disposed' where id=$1",
      [caseA],
    );
    await db.query("update public.cases set status='running' where id=$1", [
      caseA,
    ]);
    const row = (
      await db.query<{ closed_date: null }>(
        "select closed_date from public.cases where id=$1",
        [caseA],
      )
    ).rows[0];
    expect(row.closed_date).toBeNull();
    const actions = (
      await db.query<{ action: string }>(
        "select action from public.case_events where case_id=$1",
        [caseA],
      )
    ).rows.map((r) => r.action);
    expect(actions).toContain("cases:status:closed");
    expect(actions).toContain("cases:status:running");
  });
  it("links hearings to authorized cases and updates next date", async () => {
    await as(lawyer);
    const d = "2099-01-01";
    await db.query(
      "insert into public.hearings(organization_id,case_id,hearing_date,court_name,purpose) values($1,$2,$3,'Dhaka','Evidence')",
      [orgA, caseA, d],
    );
    expect(
      (
        await db.query<{ next_hearing_date: string }>(
          "select next_hearing_date::text from public.cases where id=$1",
          [caseA],
        )
      ).rows[0].next_hearing_date,
    ).toBe(d);
    await as(bob);
    await expect(
      db.query(
        "insert into public.hearings(organization_id,case_id,hearing_date,court_name,purpose) values($1,$2,$3,'Dhaka','Evidence')",
        [orgB, caseA, d],
      ),
    ).rejects.toThrow();
  });
  it("derives current next hearing and keeps read RPC tenant isolation", async () => {
    await as(alice);
    await db.query(
      "update public.cases set next_hearing_date='2000-01-01' where id=$1",
      [caseA],
    );
    const row = (
      await db.query<{ next_hearing_date: string }>(
        "select next_hearing_date::text from public.get_case($1,$2)",
        [orgA, caseA],
      )
    ).rows[0];
    expect(row.next_hearing_date).toBe("2099-01-01");
    await as(bob);
    expect(
      (await db.query("select * from public.get_case($1,$2)", [orgA, caseA]))
        .rows,
    ).toHaveLength(0);
  });
  it("retains disposal outcome after reopening", async () => {
    await as(alice);
    const event = (
      await db.query<{ outcome: string; closure_date: string }>(
        "select outcome,closure_date::text from public.case_events where case_id=$1 and action='cases:status:closed'",
        [caseA],
      )
    ).rows[0];
    expect(event.outcome).toBe("Disposed");
    expect(event.closure_date).toBe("2026-10-10");
  });
  it("private storage denies outsider access and browser upload bypass", async () => {
    await db.exec("reset role");
    const path = orgA + "/" + caseA + "/sample.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name) values('case-documents',$1)",
      [path],
    );
    await as(bob);
    expect(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows,
    ).toHaveLength(0);
    await as(alice);
    expect(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('case-documents',$1)",
        [orgA + "/" + caseA + "/bypass.pdf"],
      ),
    ).rejects.toThrow();
  });
  it("prevents removal of the last owner and audit modification", async () => {
    await as(alice);
    await expect(
      db.query("select public.set_member_role($1,$2,$3)", [
        orgA,
        alice,
        "viewer",
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.audit_logs set action='tampered' where organization_id=$1",
        [orgA],
      ),
    ).rejects.toThrow();
  });
});
