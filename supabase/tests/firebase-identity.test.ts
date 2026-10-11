import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "../../scripts/database";
import type { PGlite } from "@electric-sql/pglite";
let db: PGlite, alice: string, org: string, client: string, caseId: string;
async function firebase(sub: string, verified = true, project = "ainsathi") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      iss: "https://securetoken.google.com/" + project,
      aud: project,
      sub,
      email: sub + "@example.test",
      email_verified: verified,
      name: sub,
    }),
  ]);
  // Simulate real auth.uid() failing on a non-UUID Firebase subject.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
  await db.exec("set role anon");
}
async function sync() {
  return (
    await db.query<{ id: string }>("select public.sync_firebase_profile() id")
  ).rows[0].id;
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.exec(
    `create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$; grant usage on schema auth to anon; grant execute on function auth.jwt() to anon,authenticated;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../migrations/202610110001_firebase_identity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await firebase("firebaseAlice");
  alice = await sync();
  org = (
    await db.query<{ id: string }>(
      "select public.create_chamber('Alice Chamber','Alice') id",
    )
  ).rows[0].id;
  client = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,full_name,phone) values($1,'Rahim','01712345678') returning id",
      [org],
    )
  ).rows[0].id;
  caseId = (
    await db.query<{ id: string }>(
      "insert into public.cases(organization_id,client_id,court_case_number,case_year,title,case_type,court_name,received_date) values($1,$2,'123',2026,'Rahim vs Karim','civil','Dhaka Court','2026-10-01') returning id",
      [org, client],
    )
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Firebase identity on existing Supabase RLS", () => {
  it("maps non-UUID subjects to stable internal UUIDs", async () => {
    await firebase("firebaseAlice");
    expect(await sync()).toBe(alice);
    expect(alice).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (await db.query("select * from public.cases where id=$1", [caseId])).rows,
    ).toHaveLength(1);
  });
  it("denies an anonymous public key and unverified or wrong-project identities", async () => {
    for (const [sub, verified, project] of [
      ["unverified", false, "ainsathi"],
      ["other", true, "foreign"],
    ] as const) {
      await firebase(sub, verified, project);
      await expect(sync()).rejects.toThrow();
      expect((await db.query("select * from public.cases")).rows).toHaveLength(
        0,
      );
      await expect(
        db.query("select public.create_chamber('Bad Chamber','Bad')"),
      ).rejects.toThrow();
    }
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims','{}',false)");
    await db.exec("set role anon");
    expect((await db.query("select * from public.cases")).rows).toHaveLength(0);
    await expect(sync()).rejects.toThrow();
  });
  it("isolates another verified Firebase user and denies elevation", async () => {
    await firebase("firebaseBob");
    const bob = await sync();
    expect(bob).not.toBe(alice);
    expect(
      (await db.query("select * from public.cases where id=$1", [caseId])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.set_member_role($1,$2,'owner')", [org, bob]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
        [org, bob],
      ),
    ).rejects.toThrow();
  });
  it("retains viewer read-only permissions under anon Postgres role", async () => {
    await firebase("viewerUid");
    const viewer = await sync();
    await db.exec("reset role");
    await db.query(
      "insert into public.organization_members(organization_id,user_id,role,display_name) values($1,$2,'viewer','Viewer')",
      [org, viewer],
    );
    await firebase("viewerUid");
    expect((await db.query("select * from public.cases")).rows).toHaveLength(1);
    await expect(
      db.query(
        "insert into public.clients(organization_id,full_name,phone) values($1,'Bad','01912345678')",
        [org],
      ),
    ).rejects.toThrow();
  });
  it("attributes notes and closure history to the mapped user", async () => {
    await firebase("firebaseAlice");
    await db.query(
      "insert into public.case_notes(organization_id,case_id,body) values($1,$2,'Test note')",
      [org, caseId],
    );
    expect(
      (
        await db.query<{ author_id: string }>(
          "select author_id from public.case_notes",
        )
      ).rows[0].author_id,
    ).toBe(alice);
    await db.query(
      "update public.cases set status='closed',closed_date='2026-10-11',closure_result='Disposed' where id=$1",
      [caseId],
    );
    expect(
      (
        await db.query<{ actor_id: string }>(
          "select actor_id from public.case_events where action='cases:status:closed'",
        )
      ).rows[0].actor_id,
    ).toBe(alice);
  });
  it("accepts invitations using verified Firebase email, not auth.users", async () => {
    await firebase("firebaseAlice");
    const token = (
      await db.query<{ token: string }>(
        "select public.invite_member($1,'invited@example.test','lawyer') token",
        [org],
      )
    ).rows[0].token;
    await firebase("wrongRecipient");
    await sync();
    await expect(
      db.query("select public.accept_invitation($1,'Wrong')", [token]),
    ).rejects.toThrow();
    await firebase("invited");
    await sync();
    expect(
      (
        await db.query<{ id: string }>(
          "select public.accept_invitation($1,'Invited') id",
          [token],
        )
      ).rows[0].id,
    ).toBe(org);
  });
  it("keeps private Storage isolated without granting raw uploads", async () => {
    await db.exec("reset role");
    const path = org + "/" + caseId + "/test.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name) values('case-documents',$1)",
      [path],
    );
    await firebase("firebaseAlice");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('case-documents',$1)",
        [org + "/" + caseId + "/bad.pdf"],
      ),
    ).rejects.toThrow();
    await firebase("firebaseBob");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("preserves legacy Supabase accounts and records", async () => {
    await db.exec("reset role");
    const uid = "a0000000-0000-4000-8000-000000000009";
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'legacy@example.test',now())",
      [uid],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        iss: "https://nlokgndyjuajgyjjgwhw.supabase.co/auth/v1",
        role: "authenticated",
        sub: uid,
      }),
    ]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid,
    ]);
    await db.exec("set role authenticated");
    const oldOrg = (
      await db.query<{ id: string }>(
        "select public.create_chamber('Legacy Chamber','Legacy') id",
      )
    ).rows[0].id;
    expect(
      (
        await db.query("select * from public.organizations where id=$1", [
          oldOrg,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.cases where id=$1", [caseId])).rows,
    ).toHaveLength(0);
  });
});
