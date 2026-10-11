import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Download,
  Users,
  ShieldCheck,
  Bell,
  Check,
  LockKeyhole,
  ArrowRight,
} from "lucide-react";
import { z } from "zod";
import { usePath, useResource, useWorkspace } from "../lib/context";
import {
  bn,
  formatDate,
  today,
  typeLabels,
  roleLabels,
  canManage,
  roles,
  toCsv,
} from "../lib/schema";
import type { Role } from "../lib/schema";
import { saveProfile, authMessage } from "../lib/firebase";
import {
  Button,
  Field,
  Panel,
  PageTitle,
  Loading,
  ErrorBox,
  Empty,
  Modal,
} from "../components/ui";
export function Reports() {
  const { repo, organization } = useWorkspace();
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const invalid = !!(from && to && from > to);
  const data = useResource(
    () =>
      invalid
        ? Promise.reject(new Error("শেষ তারিখ শুরুর তারিখের পরে হতে হবে"))
        : repo.report(organization!.id, from, to),
    "reports" + organization!.id + from + to,
  );
  function exportReport() {
    if (!data.data) return;
    const d = data.data;
    const rows: (string | number)[][] = [
      ["রিপোর্ট", "বিভাগ", "মামলার সংখ্যা"],
      ["অবস্থা", "মোট", d.stats.total],
      ["অবস্থা", "চলমান", d.stats.running],
      ["অবস্থা", "মুলতবি", d.stats.pending],
      ["অবস্থা", "নিষ্পত্তি", d.stats.closed],
      ["নিষ্পত্তির তারিখসীমা", "বন্ধ মামলা", d.closed_in_range],
      ...d.by_type.map((v) => [
        "মামলার ধরন",
        typeLabels[v.label] ?? v.label,
        v.count,
      ]),
      ...d.by_court.map((v) => ["আদালত", v.label, v.count]),
      ...d.by_lawyer.map((v) => ["দায়িত্বপ্রাপ্ত আইনজীবী", v.label, v.count]),
    ];
    const url = URL.createObjectURL(
      new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ainsathi-report-" + today() + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageTitle
        title="চেম্বার রিপোর্ট"
        description="আপনার কাজের চিত্র, পরিষ্কারভাবে।"
        action={
          <Button onClick={exportReport} disabled={!data.data || invalid}>
            <Download size={17} />
            CSV ডাউনলোড
          </Button>
        }
      />
      <Panel>
        <div className="form-grid">
          <Field label="গ্রহণের তারিখ থেকে">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="গ্রহণের তারিখ পর্যন্ত">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <p className="muted small-text">
          মূল রিপোর্ট গ্রহণের তারিখে ফিল্টার হয়; নিচের বন্ধ মামলার সংখ্যা
          নিষ্পত্তির তারিখে ফিল্টার হয়।
        </p>
      </Panel>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox message={data.error} retry={data.retry} />
      ) : (
        data.data && (
          <>
            <div className="stats-grid">
              {Object.entries(data.data.stats).map(([key, count], i) => (
                <Panel key={key}>
                  <p className="muted">
                    {["মোট মামলা", "চলমান", "মুলতবি", "নিষ্পত্তি"][i]}
                  </p>
                  <strong className="report-stat">{bn(count)}</strong>
                </Panel>
              ))}
            </div>
            <div className="report-columns">
              <Panel>
                <h2>মামলার ধরন অনুযায়ী</h2>
                <Distribution
                  values={data.data.by_type.map((v) => ({
                    ...v,
                    label: typeLabels[v.label] ?? v.label,
                  }))}
                />
              </Panel>
              <Panel>
                <h2>আদালত অনুযায়ী</h2>
                <Distribution values={data.data.by_court} />
              </Panel>
              <Panel>
                <h2>আইনজীবী অনুযায়ী</h2>
                <Distribution values={data.data.by_lawyer} />
              </Panel>
            </div>
            <Panel>
              <h3>নির্বাচিত তারিখসীমায় বন্ধ মামলা</h3>
              <strong className="report-stat">
                {bn(data.data.closed_in_range)}
              </strong>
              <p className="muted">
                এই রিপোর্টে মক্কেলের ব্যক্তিগত তথ্য রপ্তানি হয় না।
              </p>
            </Panel>
          </>
        )
      )}
    </>
  );
}
function Distribution({
  values,
}: {
  values: { label: string; count: number }[];
}) {
  const total = values.reduce((s, v) => s + v.count, 0);
  return values.length ? (
    <div className="distribution">
      {values.map((v, i) => (
        <div key={v.label}>
          <div>
            <span>
              <i
                style={{
                  background: ["#0e8377", "#d2ad57", "#498dd6", "#9d7ec4"][
                    i % 4
                  ],
                }}
              />
              {v.label}
            </span>
            <strong>
              {bn(v.count)}{" "}
              <small>({bn(Math.round((v.count / total) * 100))}%)</small>
            </strong>
          </div>
          <div className="bar">
            <span
              style={{
                width: (v.count / total) * 100 + "%",
                background: ["#0e8377", "#d2ad57", "#498dd6", "#9d7ec4"][i % 4],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty title="এই সময়ে কোনো তথ্য নেই" />
  );
}
export function Members() {
  const { repo, organization, membership, refresh, notice, demo } =
    useWorkspace();
  const [adding, setAdding] = useState(false),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<Role>("lawyer"),
    [nameQuery, setNameQuery] = useState(""),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useResource(
    () => repo.members(organization!.id),
    "team" + organization!.id,
  );
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      z.string().email().parse(email);
      const token = await repo.invite(organization!.id, email, role);
      if (!token) throw new Error("আমন্ত্রণ তৈরি হয়নি");
      setLink(location.origin + "/onboarding?invite=" + token);
      notice("আমন্ত্রণ লিংক তৈরি হয়েছে। নিজে সদস্যকে পাঠান।");
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? "সঠিক ইমেইল দিন"
          : e instanceof Error
            ? e.message
            : "আমন্ত্রণ তৈরি হয়নি",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="আইনজীবী ও স্টাফ"
        description="একটি চেম্বার, একটি সংগঠিত দল।"
        action={
          membership &&
          canManage(membership.role) && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} />
              সদস্য আমন্ত্রণ
            </Button>
          )
        }
      />
      <Panel>
        <Field label="সদস্য খুঁজুন">
          <input
            placeholder="নাম দিয়ে খুঁজুন…"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
          />
        </Field>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorBox message={data.error} />
        ) : (
          data.data
            ?.filter((m) => m.display_name.includes(nameQuery))
            .map((m) => (
              <div className="client-row" key={m.user_id}>
                <span className="avatar pale">
                  {m.display_name.slice(0, 1) || "স"}
                </span>
                <div>
                  <h3>{m.display_name}</h3>
                  <p>{roleLabels[m.role]}</p>
                </div>
                {membership?.role === "owner" && m.role !== "owner" && !demo ? (
                  <select
                    aria-label={`${m.display_name} এর অনুমতি`}
                    value={m.role}
                    onChange={(e) => {
                      const next = roles.find((r) => r === e.target.value);
                      if (next && confirm("সদস্যের অনুমতি পরিবর্তন করতে চান?"))
                        void repo
                          .changeRole(organization!.id, m.user_id, next)
                          .then(() => {
                            refresh();
                            notice("অনুমতি পরিবর্তন হয়েছে");
                          })
                          .catch((e: unknown) =>
                            setError(
                              e instanceof Error ? e.message : "পরিবর্তন হয়নি",
                            ),
                          );
                    }}
                  >
                    {roles
                      .filter((r) => r !== "owner")
                      .map((r) => (
                        <option key={r} value={r}>
                          {roleLabels[r]}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span className="status running">সক্রিয়</span>
                )}
              </div>
            ))
        )}
        {error && <ErrorBox message={error} />}
      </Panel>
      <Panel>
        <h3>অনুমতির নিয়ম</h3>
        <p className="muted">
          মালিক ও অ্যাডমিন চেম্বারের কাজ পরিচালনা করেন। আইনজীবী ও সহকারী মামলা,
          মক্কেল, শুনানি ও নথি পরিচালনা করতে পারেন। দর্শক শুধু দেখতে পারেন।
          সদস্যের ভূমিকা পরিবর্তন শুধু মালিক করতে পারেন।
        </p>
      </Panel>
      {adding && (
        <Modal title="সদস্য আমন্ত্রণ" onClose={() => setAdding(false)}>
          <form onSubmit={(e) => void invite(e)}>
            <Field label="সদস্যের ইমেইল">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="ভূমিকা">
              <select
                value={role}
                onChange={(e) =>
                  setRole(roles.find((r) => r === e.target.value) ?? "viewer")
                }
              >
                {roles
                  .filter(
                    (r) =>
                      r !== "owner" &&
                      (membership?.role === "owner" || r !== "admin"),
                  )
                  .map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="muted">
              আমন্ত্রণ ৭ দিন কার্যকর থাকবে। একই ইমেইলে যাচাইকৃত অ্যাকাউন্ট দিয়ে
              গ্রহণ করতে হবে।
            </p>
            {error && <ErrorBox message={error} />}
            <Button disabled={busy || demo}>
              {busy ? "তৈরি হচ্ছে…" : "আমন্ত্রণ লিংক তৈরি করুন"}
            </Button>
            {demo && <p className="muted">ডেমোতে আসল সদস্য আমন্ত্রণ বন্ধ।</p>}
            {link && (
              <div className="invite-result">
                <Field label="সদস্যকে এই লিংক পাঠান">
                  <input readOnly value={link} />
                </Field>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .then(() => notice("লিংক কপি হয়েছে"))
                      .catch(() =>
                        setError("কপি হয়নি। লিংক নির্বাচন করে কপি করুন।"),
                      )
                  }
                >
                  লিংক কপি করুন
                </Button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
export function Notifications() {
  const { repo, organization, refresh } = useWorkspace();
  const path = usePath();
  const date = today();
  const until = new Date(date + "T12:00:00Z");
  until.setUTCDate(until.getUTCDate() + 30);
  const data = useResource(
    async () => ({
      notifications: await repo.listNotifications(organization!.id),
      hearings: await repo.listHearings(
        organization!.id,
        date,
        until.toISOString().slice(0, 10),
      ),
    }),
    "notifications" + organization!.id + date,
  );
  const [error, setError] = useState("");
  return (
    <>
      <PageTitle
        title="বিজ্ঞপ্তি ও রিমাইন্ডার"
        description="অ্যাপের মধ্যে আসন্ন শুনানির রিমাইন্ডার। স্বয়ংক্রিয় SMS বা push চালু নেই।"
      />
      {error && <ErrorBox message={error} />}
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox message={data.error} retry={data.retry} />
      ) : (
        <>
          <Panel>
            <h2>শুনানির প্রস্তুতি</h2>
            {data.data?.hearings
              .filter((h) => {
                const days = Math.round(
                  (new Date(h.hearing_date + "T12:00:00Z").valueOf() -
                    new Date(date + "T12:00:00Z").valueOf()) /
                    86400000,
                );
                return days <= h.reminder_days;
              })
              .map((h) => (
                <Link
                  className="notification-row"
                  key={h.id}
                  to={path("/cases/" + h.case_id)}
                >
                  <span className="person-icon">
                    <Bell size={19} />
                  </span>
                  <div>
                    <h3>{h.purpose}</h3>
                    <p>
                      {formatDate(h.hearing_date)} • {h.court_name}
                    </p>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))}
            {!data.data?.hearings.length && <Empty title="আসন্ন শুনানি নেই" />}
            <p className="muted small-text">
              অ্যাপ খুললে রিমাইন্ডার হিসাব হয়। স্বয়ংক্রিয় SMS, ইমেইল বা push
              ডেলিভারি সংযুক্ত নয়।
            </p>
          </Panel>
          <Panel>
            <h2>সাম্প্রতিক পরিবর্তন</h2>
            {data.data?.notifications.length ? (
              data.data.notifications.map((n) => (
                <div
                  className={`notification-row ${n.read_at ? "read" : ""}`}
                  key={n.id}
                >
                  <Bell size={19} />
                  <div>
                    {n.case_id ? (
                      <Link to={path("/cases/" + n.case_id)}>
                        <h3>{n.title}</h3>
                      </Link>
                    ) : (
                      <h3>{n.title}</h3>
                    )}
                    <small>{formatDate(n.created_at)}</small>
                  </div>
                  {!n.read_at && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void repo
                          .readNotification(organization!.id, n.id)
                          .then(refresh)
                          .catch((e: unknown) =>
                            setError(
                              e instanceof Error ? e.message : "হালনাগাদ হয়নি",
                            ),
                          )
                      }
                    >
                      <Check size={16} />
                      পড়েছি
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <Empty title="নতুন বিজ্ঞপ্তি নেই" />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
export function Settings() {
  const { repo, organization, membership, refresh, notice, demo } =
    useWorkspace();
  const path = usePath();
  const [name, setName] = useState(organization?.name ?? ""),
    [address, setAddress] = useState(organization?.address ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (name.trim().length < 2) throw new Error("চেম্বারের নাম দিন");
      await repo.saveOrganization(organization!.id, name.trim(), address);
      refresh();
      notice("চেম্বারের তথ্য হালনাগাদ হয়েছে");
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle title="সেটিংস" description="আপনার চেম্বার, আপনার পছন্দমতো।" />
      <Panel>
        <h2>চেম্বারের তথ্য</h2>
        <form onSubmit={(e) => void save(e)}>
          <Field label="চেম্বারের নাম">
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              readOnly={!membership || !canManage(membership.role)}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="ঠিকানা">
            <textarea
              value={address}
              readOnly={!membership || !canManage(membership.role)}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          {error && <ErrorBox message={error} />}
          {membership && canManage(membership.role) && (
            <Button disabled={busy || demo}>
              {busy ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ করুন"}
            </Button>
          )}
        </form>
      </Panel>
      <Panel>
        <h2>আপনার কর্মক্ষেত্র</h2>
        <div className="settings-links">
          <Link to={path("/members")}>
            <Users size={20} />
            সদস্য ব্যবস্থাপনা
            <ArrowRight size={17} />
          </Link>
          <Link to={path("/profile")}>
            <LockKeyhole size={20} />
            প্রোফাইল ও নিরাপত্তা
            <ArrowRight size={17} />
          </Link>
          <Link to={path("/reports")}>
            <Download size={20} />
            রিপোর্ট ও CSV এক্সপোর্ট
            <ArrowRight size={17} />
          </Link>
          <Link to="/onboarding?new=1">
            <Plus size={20} />
            আরেকটি চেম্বার তৈরি করুন
            <ArrowRight size={17} />
          </Link>
        </div>
      </Panel>
      <Panel>
        <h3>
          <ShieldCheck size={20} />
          ব্যাকআপ ও ডেটা সুরক্ষা
        </h3>
        <p className="muted">
          ব্যাকআপ কনফিগার না হলে এই অ্যাপ ব্যাকআপ সফল হয়েছে বলে দেখাবে না।
          বাস্তব তথ্য ব্যবহারের আগে ডেটাবেস ও Storage ফাইলের আলাদা ব্যাকআপ এবং
          restore পরীক্ষা করুন।
        </p>
        <p className="muted">ভাষা: বাংলা • সময় অঞ্চল: Asia/Dhaka</p>
      </Panel>
    </>
  );
}
export function Profile() {
  const { session, demo, notice } = useWorkspace();
  const [name, setName] = useState(
      String(session?.user.user_metadata.full_name ?? ""),
    ),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (password && password.length < 8)
        throw new Error("পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে");
      if (name.trim().length < 2) throw new Error("পূর্ণ নাম দিন");
      await saveProfile(name, password);
      setPassword("");
      notice("প্রোফাইল হালনাগাদ হয়েছে");
    } catch (e) {
      setError(e instanceof Error ? e.message : "সংরক্ষণ হয়নি");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle title="প্রোফাইল ও নিরাপত্তা" />
      <Panel>
        <form onSubmit={(e) => void save(e)}>
          <Field label="পূর্ণ নাম">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="ইমেইল">
            <input
              readOnly
              value={session?.user.email ?? "demo@ainsathi.local"}
            />
          </Field>
          <Field label="নতুন পাসওয়ার্ড (পরিবর্তন করতে চাইলে)">
            <input
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <Button disabled={busy || demo}>
            {busy ? "সংরক্ষণ হচ্ছে…" : "প্রোফাইল সংরক্ষণ করুন"}
          </Button>
        </form>
      </Panel>
    </>
  );
}
export function NotFound() {
  const navigate = useNavigate();
  return (
    <Empty
      title="পাতাটি পাওয়া যায়নি"
      description="লিংকটি সঠিক কি না দেখুন।"
      action={<Button onClick={() => navigate(-1)}>আগের পাতায় ফিরুন</Button>}
    />
  );
}
