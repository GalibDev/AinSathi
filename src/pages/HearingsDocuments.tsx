import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Archive,
  Upload,
  Edit3,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePath, useResource, useWorkspace } from "../lib/context";
import {
  bn,
  formatDate,
  today,
  canEdit,
  emptyFilters,
  hearingFormSchema,
} from "../lib/schema";
import type {
  HearingInput,
  HearingRecord,
  CaseRecord,
  DocumentRecord,
} from "../lib/schema";
import {
  Button,
  Field,
  Panel,
  PageTitle,
  Loading,
  ErrorBox,
  Empty,
  Modal,
  SearchBox,
} from "../components/ui";

export function HearingForm({
  caseRecord,
  existing,
  onSaved,
}: {
  caseRecord?: CaseRecord;
  existing?: HearingRecord;
  onSaved: () => void;
}) {
  const { repo, organization, notice } = useWorkspace();
  const [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const cases = useResource(
    () => repo.listCases(organization!.id, { ...emptyFilters, query }),
    "hearing-case-choice" + organization!.id + query,
  );
  const form = useForm<HearingInput>({
    resolver: zodResolver(hearingFormSchema),
    defaultValues: existing
      ? { ...existing, hearing_time: existing.hearing_time?.slice(0, 5) ?? "" }
      : {
          case_id: caseRecord?.id ?? "",
          hearing_date: today(),
          hearing_time: "",
          court_name: caseRecord?.court_name ?? "",
          purpose: "",
          outcome: "",
          notes: "",
          reminder_days: 1,
        },
  });
  async function submit(v: HearingInput) {
    setError("");
    try {
      await repo.saveHearing(organization!.id, v, existing?.id);
      notice(existing ? "শুনানি হালনাগাদ হয়েছে" : "শুনানি যোগ হয়েছে");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "শুনানি সংরক্ষণ হয়নি");
    }
  }
  return (
    <form onSubmit={(e) => void form.handleSubmit(submit)(e)}>
      {!caseRecord && (
        <>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="মামলা খুঁজুন…"
          />
          <Field label="মামলা *" error={form.formState.errors.case_id?.message}>
            <select
              {...form.register("case_id")}
              onChange={(e) => {
                form.setValue("case_id", e.target.value);
                form.setValue(
                  "court_name",
                  cases.data?.find((c) => c.id === e.target.value)
                    ?.court_name ?? "",
                );
              }}
            >
              <option value="">মামলা নির্বাচন করুন</option>
              {cases.data
                ?.filter((c) => c.status !== "closed")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} • {c.court_case_number}
                  </option>
                ))}
            </select>
          </Field>
          {cases.error && <ErrorBox message={cases.error} />}
        </>
      )}
      <div className="form-grid">
        <Field
          label="শুনানির তারিখ *"
          error={form.formState.errors.hearing_date?.message}
        >
          <input type="date" {...form.register("hearing_date")} />
        </Field>
        <Field
          label="সময় (ঐচ্ছিক)"
          error={form.formState.errors.hearing_time?.message}
        >
          <input type="time" {...form.register("hearing_time")} />
        </Field>
      </div>
      <Field label="আদালত *" error={form.formState.errors.court_name?.message}>
        <input {...form.register("court_name")} />
      </Field>
      <Field
        label="শুনানির বিষয় *"
        error={form.formState.errors.purpose?.message}
      >
        <input
          {...form.register("purpose")}
          placeholder="সাক্ষ্য গ্রহণ / যুক্তিতর্ক / আদেশ"
        />
      </Field>
      <Field label="ফলাফল">
        <textarea rows={2} {...form.register("outcome")} />
      </Field>
      <Field label="পরবর্তী প্রস্তুতির নোট">
        <textarea rows={2} {...form.register("notes")} />
      </Field>
      <Field label="কত দিন আগে রিমাইন্ডার">
        <input
          type="number"
          min={0}
          max={30}
          {...form.register("reminder_days", { valueAsNumber: true })}
        />
      </Field>
      <p className="muted small-text">
        শুনানি ও রিমাইন্ডার অ্যাপে দেখা যাবে। SMS বা ইমেইল ডেলিভারি এখনো সংযুক্ত
        নয়।
      </p>
      {error && <ErrorBox message={error} />}
      <Button disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "সংরক্ষণ হচ্ছে…" : "শুনানি সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}
export function HearingList({
  hearings,
  cases = [],
  allowEdit = false,
}: {
  hearings: HearingRecord[];
  cases?: CaseRecord[];
  allowEdit?: boolean;
}) {
  const path = usePath();
  const { membership, refresh } = useWorkspace();
  const [editing, setEditing] = useState<HearingRecord | null>(null);
  if (!hearings.length)
    return (
      <Empty
        title="এই সময়ে কোনো শুনানি নেই"
        description="শুনানি যোগ করলে তালিকা ও ক্যালেন্ডারে দেখতে পাবেন।"
      />
    );
  return (
    <>
      <div className="hearing-list">
        {hearings.map((h) => {
          const c = cases.find((c) => c.id === h.case_id);
          return (
            <div className="hearing-row" key={h.id}>
              <div className="hearing-time">
                <strong>
                  {h.hearing_time?.slice(0, 5) ?? "সময় অনির্ধারিত"}
                </strong>
                <small>
                  {formatDate(h.hearing_date, {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </div>
              <Link to={path("/cases/" + h.case_id)}>
                <h3>{c?.title ?? h.purpose}</h3>
                <p>
                  {c?.court_case_number
                    ? `মামলা নং ${c.court_case_number} • `
                    : ""}
                  {h.court_name}
                </p>
                <span>
                  {h.purpose}
                  {h.outcome ? " • " + h.outcome : ""}
                </span>
              </Link>
              {allowEdit && membership && canEdit(membership.role) ? (
                <button
                  className="icon-button"
                  aria-label="শুনানি সম্পাদনা"
                  onClick={() => setEditing(h)}
                >
                  <Edit3 size={17} />
                </button>
              ) : (
                <ChevronRight size={17} />
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <Modal title="শুনানি সম্পাদনা" onClose={() => setEditing(null)}>
          <HearingForm
            existing={editing}
            caseRecord={cases.find((c) => c.id === editing.case_id)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    from: month + "-01",
    to: month + "-" + String(new Date(year, m, 0).getDate()).padStart(2, "0"),
    year,
    month: m - 1,
  };
}
export function Calendar() {
  const { repo, organization, membership, refresh } = useWorkspace();
  const [month, setMonth] = useState(today().slice(0, 7)),
    [selected, setSelected] = useState(today()),
    [view, setView] = useState("month"),
    [court, setCourt] = useState(""),
    [adding, setAdding] = useState(false);
  const r = monthRange(month);
  const data = useResource(
    () => repo.listHearings(organization!.id, r.from, r.to),
    "calendar" + organization!.id + month,
  );
  const cases = useResource(
    () =>
      repo.listCases(organization!.id, { ...emptyFilters, sort: "hearing" }),
    "calendar-cases" + organization!.id,
  );
  const hearings =
    data.data?.filter((h) => !court || h.court_name.includes(court)) ?? [];
  const days: (number | null)[] = [
    ...Array.from(
      { length: new Date(r.year, r.month, 1).getDay() },
      () => null,
    ),
    ...Array.from({ length: Number(r.to.slice(-2)) }, (_, i) => i + 1),
  ];
  function shift(delta: number) {
    const d = new Date(r.year, r.month + delta, 1, 12);
    const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    setMonth(m);
    setSelected(m + "-01");
  }
  return (
    <>
      <PageTitle
        title="শুনানি ক্যালেন্ডার"
        description="প্রতিটি তারিখের প্রস্তুতি থাকুক আপনার হাতের মুঠোয়।"
        action={
          membership &&
          canEdit(membership.role) && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} />
              নতুন শুনানি
            </Button>
          )
        }
      />
      <Panel>
        <div className="calendar-toolbar">
          <div>
            <Button
              variant="ghost"
              aria-label="আগের মাস"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <h2>{formatDate(r.from, { month: "long", year: "numeric" })}</h2>
            <Button
              variant="ghost"
              aria-label="পরের মাস"
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setMonth(today().slice(0, 7));
                setSelected(today());
              }}
            >
              আজ
            </Button>
            <div className="segmented">
              <button
                className={view === "month" ? "active" : ""}
                onClick={() => setView("month")}
              >
                মাস
              </button>
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
              >
                তালিকা
              </button>
            </div>
          </div>
        </div>
        <SearchBox
          value={court}
          onChange={setCourt}
          placeholder="আদালতের নাম দিয়ে ফিল্টার করুন…"
        />
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorBox message={data.error} retry={data.retry} />
        ) : view === "month" ? (
          <div className="calendar-layout">
            <div>
              <div className="calendar-weekdays">
                {["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"].map(
                  (x) => (
                    <span key={x}>{x}</span>
                  ),
                )}
              </div>
              <div className="calendar-grid">
                {days.map((d, i) => {
                  const day = d ? month + "-" + String(d).padStart(2, "0") : "";
                  const count = hearings.filter(
                    (h) => h.hearing_date === day,
                  ).length;
                  return d ? (
                    <button
                      key={day}
                      aria-label={`${formatDate(day)} — ${bn(count)}টি শুনানি`}
                      aria-pressed={selected === day}
                      className={`${day === selected ? "selected" : ""} ${day === today() ? "today" : ""}`}
                      onClick={() => setSelected(day)}
                    >
                      <span>{bn(d)}</span>
                      {count > 0 && (
                        <small>
                          <i />
                          {bn(count)} শুনানি
                        </small>
                      )}
                    </button>
                  ) : (
                    <span key={i} />
                  );
                })}
              </div>
            </div>
            <div className="day-agenda">
              <h3>
                {formatDate(selected, {
                  day: "numeric",
                  month: "long",
                  weekday: "long",
                })}
              </h3>
              <HearingList
                hearings={hearings.filter((h) => h.hearing_date === selected)}
                cases={cases.data ?? []}
                allowEdit
              />
            </div>
          </div>
        ) : (
          <HearingList hearings={hearings} cases={cases.data ?? []} allowEdit />
        )}
        <p className="muted small-text">
          একবারে সর্বোচ্চ ২০০টি শুনানি দেখানো হয়। প্রয়োজনে মাস ও আদালতের
          ফিল্টার ব্যবহার করুন।
        </p>
      </Panel>
      {adding && (
        <Modal title="নতুন শুনানি" onClose={() => setAdding(false)}>
          <HearingForm
            onSaved={() => {
              setAdding(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}

export function DocumentList({ caseId }: { caseId?: string }) {
  const { repo, organization, membership, demo, refresh, notice } =
    useWorkspace();
  const [query, setQuery] = useState(""),
    [caseSearch, setCaseSearch] = useState(""),
    [chosen, setChosen] = useState(caseId ?? ""),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [pendingFile, setPendingFile] = useState<File | null>(null);
  const data = useResource(
    () => repo.listDocuments(organization!.id, caseId),
    "documents" + organization!.id + caseId,
  );
  const cases = useResource(
    () =>
      repo.listCases(organization!.id, { ...emptyFilters, query: caseSearch }),
    "document-cases" + organization!.id + caseSearch,
  );
  const documents =
    data.data?.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFile || !chosen) {
      setError("মামলা ও ফাইল নির্বাচন করুন");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await repo.upload(organization!.id, chosen, pendingFile);
      setPendingFile(null);
      refresh();
      notice("নথি আপলোড হয়েছে");
    } catch (e) {
      setError(e instanceof Error ? e.message : "আপলোড হয়নি");
    } finally {
      setUploading(false);
    }
  }
  async function download(doc: DocumentRecord) {
    setError("");
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    try {
      const url = await repo.download(doc);
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : "ডাউনলোড হয়নি");
    }
  }
  return (
    <Panel>
      <div className="section-title">
        <div>
          <h2>মামলার নথিপত্র</h2>
          <p className="muted">
            ব্যক্তিগত নথি • PDF, JPG ও PNG • সর্বোচ্চ ১০ MB
          </p>
        </div>
        <FileText size={24} />
      </div>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="নথির নাম দিয়ে খুঁজুন…"
      />
      {error && <ErrorBox message={error} />}
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox message={data.error} retry={data.retry} />
      ) : !documents.length ? (
        <Empty
          title="এখনো কোনো নথি নেই"
          description={
            demo
              ? "ডেমোতে গোপন নথি আপলোড বন্ধ। আসল অ্যাকাউন্টে লগইন করে ব্যবহার করুন।"
              : "নিচের ফর্ম দিয়ে মামলার নথি যুক্ত করুন।"
          }
        />
      ) : (
        <div>
          {documents.map((d) => (
            <div className="document-row" key={d.id}>
              <span
                className={`document-icon ${d.mime_type.includes("pdf") ? "pdf" : "image"}`}
              >
                <FileText size={22} />
              </span>
              <div>
                <h3>{d.name}</h3>
                <p>
                  {(d.size_bytes / 1024 / 1024).toFixed(2)} MB •{" "}
                  {formatDate(d.created_at)}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label={`${d.name} ডাউনলোড`}
                onClick={() => void download(d)}
              >
                <Download size={18} />
              </button>
              {membership && canEdit(membership.role) && (
                <button
                  className="icon-button"
                  aria-label={`${d.name} আর্কাইভ`}
                  onClick={() => {
                    if (
                      confirm(
                        "নথির তালিকা থেকে আর্কাইভ করবেন? মূল ফাইল সংরক্ষিত থাকবে।",
                      )
                    )
                      void repo
                        .archiveDocument(organization!.id, d.id)
                        .then(() => {
                          refresh();
                          notice("নথি আর্কাইভ হয়েছে");
                        })
                        .catch((e: unknown) =>
                          setError(
                            e instanceof Error ? e.message : "আর্কাইভ হয়নি",
                          ),
                        );
                  }}
                >
                  <Archive size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {membership && canEdit(membership.role) && (
        <form className="upload-form" onSubmit={(e) => void upload(e)}>
          {!caseId && (
            <>
              <SearchBox
                value={caseSearch}
                onChange={setCaseSearch}
                placeholder="আপলোডের মামলা খুঁজুন…"
              />
              <Field label="মামলা নির্বাচন *">
                <select
                  required
                  value={chosen}
                  onChange={(e) => setChosen(e.target.value)}
                >
                  <option value="">নির্বাচন করুন</option>
                  {cases.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} — {c.court_case_number}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="নথি নির্বাচন *">
            <input
              type="file"
              required
              disabled={demo || uploading}
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          {uploading && (
            <div role="status">
              <progress aria-label="নথি আপলোড হচ্ছে" /> আপলোড হচ্ছে…
            </div>
          )}
          <Button disabled={demo || uploading}>
            <Upload size={17} />
            {uploading ? "আপলোড হচ্ছে…" : "নথি আপলোড করুন"}
          </Button>
          <small className="muted">
            সর্বোচ্চ ১০০টি সাম্প্রতিক নথি দেখানো হয়। অন্য নথি মামলার বিস্তারিত
            থেকে খুলুন।
          </small>
        </form>
      )}
    </Panel>
  );
}
export function Documents() {
  const [params] = useSearchParams();
  return (
    <>
      <PageTitle
        title="নথিপত্র"
        description="প্রতিটি মামলার গুরুত্বপূর্ণ কাগজপত্র, সঠিক জায়গায়।"
      />
      <DocumentList caseId={params.get("case") ?? undefined} />
    </>
  );
}
