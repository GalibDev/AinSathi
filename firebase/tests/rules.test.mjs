import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ainsathi",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "organizations/a"), {
      id: "a",
      owner_uid: "owner",
      name: "Chamber",
      address: "",
      created_at: "t",
      updated_at: "t",
    });
    for (const [uid, role] of [
      ["owner", "owner"],
      ["viewer", "viewer"],
      ["lawyer", "lawyer"],
    ])
      await setDoc(doc(db, "organization_members/a_" + uid), {
        organization_id: "a",
        user_id: uid,
        role,
        display_name: uid,
        created_at: "t",
        updated_at: "t",
      });
    await setDoc(doc(db, "organizations/a/counters/cases"), {
      value: 0,
      last_case_id: "",
    });
    await setDoc(doc(db, "organizations/a/clients/client"), {
      id: "client",
      organization_id: "a",
      full_name: "Client",
      phone: "01712345678",
      notes: "",
      created_at: "t",
      updated_at: "t",
      archived_at: null,
    });
  });
});
after(async () => {
  await env?.cleanup();
});
const db = (uid) =>
  env
    .authenticatedContext(uid, {
      email: uid + "@example.com",
      email_verified: true,
    })
    .firestore();
test("outsiders and anonymous cannot read private client", async () => {
  await assertFails(
    getDoc(doc(db("outsider"), "organizations/a/clients/client")),
  );
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "organizations/a/clients/client",
      ),
    ),
  );
});
test("unverified account cannot read", async () => {
  await assertFails(
    getDoc(
      doc(
        env
          .authenticatedContext("owner", { email_verified: false })
          .firestore(),
        "organizations/a/clients/client",
      ),
    ),
  );
});
test("viewer can read but cannot edit", async () => {
  await assertSucceeds(
    getDoc(doc(db("viewer"), "organizations/a/clients/client")),
  );
  await assertFails(
    updateDoc(doc(db("viewer"), "organizations/a/clients/client"), {
      notes: "changed",
    }),
  );
});
test("lawyer cannot escalate or edit owner", async () => {
  await assertFails(
    updateDoc(doc(db("lawyer"), "organization_members/a_lawyer"), {
      role: "admin",
    }),
  );
  await assertFails(
    updateDoc(doc(db("owner"), "organization_members/a_owner"), {
      role: "viewer",
    }),
  );
});
test("own memberships query is permitted", async () => {
  await assertSucceeds(
    getDocs(
      query(
        collection(db("owner"), "organization_members"),
        where("user_id", "==", "owner"),
      ),
    ),
  );
});
test("atomic chamber bootstrap succeeds", async () => {
  const d = db("newowner"),
    b = writeBatch(d);
  b.set(doc(d, "organizations/new"), {
    id: "new",
    owner_uid: "newowner",
    name: "New chamber",
    address: "",
    created_at: "t",
    updated_at: "t",
  });
  b.set(doc(d, "organization_members/new_newowner"), {
    organization_id: "new",
    user_id: "newowner",
    role: "owner",
    display_name: "New owner",
    created_at: "t",
    updated_at: "t",
  });
  b.set(doc(d, "organizations/new/counters/cases"), {
    value: 0,
    last_case_id: "",
  });
  await assertSucceeds(b.commit());
});
test("standalone owner membership forgery fails", async () => {
  await assertFails(
    setDoc(doc(db("outsider"), "organization_members/a_outsider"), {
      organization_id: "a",
      user_id: "outsider",
      role: "owner",
      display_name: "Bad owner",
    }),
  );
});
test("case serial and history are atomic, cannot be edited", async () => {
  const d = db("owner"),
    c = {
      id: "case",
      organization_id: "a",
      title: "Case title",
      client_id: "client",
      status: "running",
      closed_date: null,
      closure_result: "",
      archived_at: null,
      serial_number: 1,
      created_at: "t",
      updated_at: "u",
      last_event_id: "event",
    };
  await assertFails(setDoc(doc(d, "organizations/a/cases/case"), c));
  const b = writeBatch(d);
  b.set(doc(d, "organizations/a/counters/cases"), {
    value: 1,
    last_case_id: "case",
  });
  b.set(doc(d, "organizations/a/cases/case"), c);
  b.set(doc(d, "organizations/a/events/event"), {
    id: "event",
    organization_id: "a",
    case_id: "case",
    actor_id: "owner",
    action: "cases:insert",
    closure_date: null,
    outcome: null,
    created_at: "u",
  });
  await assertSucceeds(b.commit());
  await assertFails(
    updateDoc(doc(d, "organizations/a/cases/case"), { serial_number: 99 }),
  );
  await assertFails(
    updateDoc(doc(d, "organizations/a/events/event"), { action: "changed" }),
  );
  await assertFails(
    updateDoc(doc(d, "organizations/a/cases/case"), {
      status: "closed",
      closed_date: "2026-10-11",
      closure_result: "Done",
    }),
  );
});
test("cross tenant case references fail", async () => {
  await assertFails(
    setDoc(doc(db("owner"), "organizations/a/hearings/h"), {
      id: "h",
      organization_id: "a",
      case_id: "other",
      hearing_date: "2026-10-11",
      purpose: "Hearing",
      reminder_days: 1,
    }),
  );
});
test("document writes are disabled", async () => {
  await assertFails(
    setDoc(doc(db("owner"), "organizations/a/documents/d"), { name: "file" }),
  );
});
test("member directory query permits members and rejects outsiders", async () => {
  await assertSucceeds(
    getDocs(
      query(
        collection(db("owner"), "organization_members"),
        where("organization_id", "==", "a"),
      ),
    ),
  );
  await assertFails(
    getDocs(
      query(
        collection(db("outsider"), "organization_members"),
        where("organization_id", "==", "a"),
      ),
    ),
  );
});
test("invitation acceptance is email-bound, atomic and single use", async () => {
  const owner = db("owner"),
    guest = db("guest"),
    token = "invitation-token";
  await assertSucceeds(
    setDoc(doc(owner, "invitations/" + token), {
      organization_id: "a",
      email: "guest@example.com",
      role: "viewer",
      created_by: "owner",
      expires_at: Date.now() + 600000,
      used_by: null,
    }),
  );
  await assertFails(getDoc(doc(db("outsider"), "invitations/" + token)));
  const b = writeBatch(guest);
  b.set(doc(guest, "organization_members/a_guest"), {
    organization_id: "a",
    user_id: "guest",
    role: "viewer",
    display_name: "Guest",
    invitation_id: token,
    created_at: "t",
    updated_at: "t",
  });
  b.update(doc(guest, "invitations/" + token), { used_by: "guest" });
  await assertSucceeds(b.commit());
  await assertFails(
    updateDoc(doc(guest, "invitations/" + token), { used_by: "guest" }),
  );
});
test("closing and reopening require matching immutable activity", async () => {
  const d = db("owner");
  for (const [status, stamp, eid, date, outcome] of [
    ["closed", "v", "closed-event", "2026-10-11", "Disposed"],
    ["running", "w", "reopened-event", null, null],
  ]) {
    const b = writeBatch(d);
    b.update(doc(d, "organizations/a/cases/case"), {
      status,
      closed_date: date,
      closure_result: outcome ?? "",
      last_event_id: eid,
      updated_at: stamp,
    });
    b.set(doc(d, "organizations/a/events/" + eid), {
      id: eid,
      organization_id: "a",
      case_id: "case",
      actor_id: "owner",
      action: "cases:status:" + status,
      closure_date: date,
      outcome,
      created_at: stamp,
    });
    await assertSucceeds(b.commit());
  }
});
test("lawyer can save hearings and notes but cannot assign staff", async () => {
  const d = db("lawyer");
  await assertSucceeds(
    setDoc(doc(d, "organizations/a/hearings/h"), {
      id: "h",
      organization_id: "a",
      case_id: "case",
      hearing_date: "2026-10-11",
      purpose: "Hearing",
      reminder_days: 1,
      created_at: "t",
      updated_at: "t",
    }),
  );
  await assertSucceeds(
    setDoc(doc(d, "organizations/a/notes/n"), {
      id: "n",
      organization_id: "a",
      case_id: "case",
      body: "Client note",
      author_id: "lawyer",
      created_at: "t",
      updated_at: "t",
    }),
  );
  await assertFails(
    setDoc(doc(d, "organizations/a/assignments/case_lawyer"), {
      organization_id: "a",
      case_id: "case",
      user_id: "lawyer",
    }),
  );
  await assertSucceeds(
    setDoc(doc(db("owner"), "organizations/a/assignments/case_lawyer"), {
      organization_id: "a",
      case_id: "case",
      user_id: "lawyer",
    }),
  );
});
test("client create accepts valid phone and rejects invalid phone", async () => {
  const d = db("owner"),
    c = {
      id: "client2",
      organization_id: "a",
      full_name: "Second client",
      phone: "+8801712345678",
      notes: "",
      created_at: "t",
      updated_at: "t",
      archived_at: null,
    };
  await assertSucceeds(setDoc(doc(d, "organizations/a/clients/client2"), c));
  await assertFails(
    updateDoc(doc(d, "organizations/a/clients/client2"), { phone: "123" }),
  );
});
test("partial clients and unlinked partial cases can be saved", async () => {
  const d = db("owner");
  await assertSucceeds(
    setDoc(doc(d, "organizations/a/clients/partial-client"), {
      id: "partial-client",
      organization_id: "a",
      full_name: "নামহীন মক্কেল",
      phone: "",
      notes: "",
      created_at: "t",
      updated_at: "t",
      archived_at: null,
    }),
  );
  const b = writeBatch(d);
  b.set(doc(d, "organizations/a/counters/cases"), {
    value: 2,
    last_case_id: "partial-case",
  });
  b.set(doc(d, "organizations/a/cases/partial-case"), {
    id: "partial-case",
    organization_id: "a",
    title: "নামহীন মামলা",
    client_id: "",
    status: "running",
    closed_date: null,
    closure_result: "",
    archived_at: null,
    serial_number: 2,
    created_at: "p",
    updated_at: "p",
    last_event_id: "partial-event",
    court_case_number: "",
    court_name: "",
    received_date: "",
  });
  b.set(doc(d, "organizations/a/events/partial-event"), {
    id: "partial-event",
    organization_id: "a",
    case_id: "partial-case",
    actor_id: "owner",
    action: "cases:insert",
    closure_date: null,
    outcome: null,
    created_at: "p",
  });
  await assertSucceeds(b.commit());
});
