import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  ChevronRight,
  CalendarDays,
  MapPin,
  Phone,
  FileText,
  Edit3,
  Archive,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePath, useResource, useWorkspace } from "../lib/context";
import {
  serial,
  eventLabel,
  statusLabels,
  typeLabels,
  formatDate,
  emptyFilters,
  canEdit,
  caseFormSchema,
  closureSchema,
  today,
  clientFormSchema,
} from "../lib/schema";
import type { CaseRecord, CaseInput, ClientInput } from "../lib/schema";
import {
  Button,
  Field,
  Panel,
  PageTitle,
  Loading,
  ErrorBox,
  Empty,
  SearchBox,
  Pagination,
  Modal,
  Success,
} from "../components/ui";
import { HearingForm, HearingList, DocumentList } from "./HearingsDocuments";
export function Status({ value }: { value: CaseRecord["status"] }) {
  return (
    <span className={`status ${value}`}>
      <i />
      {statusLabels[value]}
    </span>
  );
}
export function CaseCard({ record }: { record: CaseRecord }) {
  const path = usePath();
  return (
    <Link className="case-card" to={path("/cases/" + record.id)}>
      <div className="case-card-head">
        <span className="serial">{serial(record.serial_number)}</span>
        <div>
          <h3>{record.title}</h3>
          <p>
            {typeLabels[record.case_type] ?? record.case_type} • নং{" "}
            {record.court_case_number}
          </p>
        </div>
        <Status value={record.status} />
        <ChevronRight size={19} />
      </div>
      <div className="case-card-body">
        <span>
          <MapPin size={14} />
          {record.court_name}
        </span>
        <span>
          <CalendarDays size={14} />
          {formatDate(record.next_hearing_date)}
        </span>
      </div>
    </Link>
  );
}
export function CaseList() {
  const { repo, organization, membership } = useWorkspace(),
    path = usePath(),
    [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? ""),
    [debounced, setDebounced] = useState(query),
    [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const page = Number(params.get("page") ?? 0) || 0;
  const filters = {
    ...emptyFilters,
    query: debounced,
    status: params.get("status") ?? "",
    type: params.get("type") ?? "",
    court: params.get("court") ?? "",
    lawyer: params.get("lawyer") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    hearingFrom: params.get("hearingFrom") ?? "",
    hearingTo: params.get("hearingTo") ?? "",
    sort: params.get("sort") ?? "newest",
    page,
  };
  const data = useResource(
    () => repo.listCases(organization!.id, filters),
    "cases" + organization!.id + JSON.stringify(filters),
  );
  const members = useResource(
    () => repo.members(organization!.id),
    "members" + organization!.id,
  );
  function filter(key: string, value: string) {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    setParams(p);
  }
  return (
    <>
      <PageTitle
        title="সব মামলা"
        description="আপনার চেম্বারের প্রতিটি মামলা, এক জায়গায়।"
        action={
          membership &&
          canEdit(membership.role) && (
            <Link className="button primary" to={path("/cases/new")}>
              <Plus size={18} />
              নতুন মামলা
            </Link>
          )
        }
      />
      <Panel className="filter-panel">
        <div className="filter-main">
          <SearchBox
            value={query}
            onChange={(v) => {
              setQuery(v);
              filter("q", v);
            }}
          />
          <select
            aria-label="মামলার ধরন"
            value={filters.type}
            onChange={(e) => filter("type", e.target.value)}
          >
            <option value="">সব ধরন</option>
            {Object.entries(typeLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="মামলার অবস্থা"
            value={filters.status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">সব অবস্থা</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            <SlidersHorizontal size={17} />
            ফিল্টার
          </Button>
        </div>
        {advanced && (
          <div className="form-grid advanced-filters">
            <Field label="আদালত">
              <input
                value={filters.court}
                onChange={(e) => filter("court", e.target.value)}
              />
            </Field>
            <Field label="দায়িত্বপ্রাপ্ত আইনজীবী">
              <select
                value={filters.lawyer}
                onChange={(e) => filter("lawyer", e.target.value)}
              >
                <option value="">সব সদস্য</option>
                {members.data?.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="গ্রহণের তারিখ থেকে">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => filter("from", e.target.value)}
              />
            </Field>
            <Field label="গ্রহণের তারিখ পর্যন্ত">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => filter("to", e.target.value)}
              />
            </Field>
            <Field label="শুনানির তারিখ থেকে">
              <input
                type="date"
                value={filters.hearingFrom}
                onChange={(e) => filter("hearingFrom", e.target.value)}
              />
            </Field>
            <Field label="শুনানির তারিখ পর্যন্ত">
              <input
                type="date"
                value={filters.hearingTo}
                onChange={(e) => filter("hearingTo", e.target.value)}
              />
            </Field>
            <Field label="সাজানোর ক্রম">
              <select
                value={filters.sort}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="newest">নতুন মামলা আগে</option>
                <option value="oldest">পুরোনো মামলা আগে</option>
                <option value="hearing">শুনানির তারিখ</option>
              </select>
            </Field>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setParams({});
              }}
            >
              সব ফিল্টার মুছুন
            </Button>
          </div>
        )}
      </Panel>
      <div className="list-heading">
        <span>মামলার তালিকা</span>
        <span className="muted">প্রতি পাতায় সর্বোচ্চ ২০টি</span>
      </div>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox message={data.error} retry={data.retry} />
      ) : !data.data?.length ? (
        <Empty
          title="মামলা পাওয়া যায়নি"
          description="ফিল্টার পরিবর্তন করুন অথবা নতুন মামলা যোগ করুন।"
        />
      ) : (
        <>
          <div className="case-table">
            <div className="case-table-header">
              <span>সিরিয়াল / মামলা</span>
              <span>আদালত</span>
              <span>পরবর্তী শুনানি</span>
              <span>অবস্থা</span>
            </div>
            {data.data.map((c) => (
              <CaseCard key={c.id} record={c} />
            ))}
          </div>
          <Pagination
            page={page}
            onChange={(p) => {
              const q = new URLSearchParams(params);
              q.set("page", String(p));
              setParams(q);
            }}
            hasMore={data.data.length === 20}
          />
        </>
      )}
    </>
  );
}

export function CaseForm() {
  const { id } = useParams();
  const { repo, organization, membership, refresh, notice } = useWorkspace(),
    path = usePath(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [saved, setSaved] = useState<CaseRecord | null>(null),
    [clientQuery, setClientQuery] = useState("");
  const form = useForm<CaseInput>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      title: "",
      court_case_number: "",
      case_year: new Date().getFullYear(),
      case_type: "civil",
      court_name: "",
      court_location: "ঢাকা",
      received_date: today(),
      client_id: "",
      plaintiff: "",
      defendant: "",
      contact_phone: "",
      notes: "",
    },
  });
  const existing = useResource(
    async () => (id ? repo.getCase(organization!.id, id) : null),
    "edit-case" + organization!.id + id,
  );
  const clients = useResource(
    () => repo.listClients(organization!.id, clientQuery),
    "client-choices" + organization!.id + clientQuery,
  );
  useEffect(() => {
    if (existing.data) form.reset(existing.data);
  }, [existing.data, form]);
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const block = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", block);
    return () => window.removeEventListener("beforeunload", block);
  }, [form.formState.isDirty]);
  if (!membership || !canEdit(membership.role))
    return <ErrorBox message="মামলা সম্পাদনার অনুমতি নেই" />;
  if (id && existing.loading) return <Loading />;
  if (existing.error) return <ErrorBox message={existing.error} />;
  async function submit(values: CaseInput) {
    setError("");
    try {
      const c = await repo.saveCase(organization!.id, values, id);
      refresh();
      form.reset(values);
      if (id) {
        notice("মামলার তথ্য হালনাগাদ হয়েছে");
        navigate(path("/cases/" + c.id));
      } else setSaved(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "সংরক্ষণ হয়নি");
    }
  }
  if (saved)
    return (
      <Panel>
        <Success title="মামলা সফলভাবে যোগ করা হয়েছে">
          <p className="muted">চেম্বার সিরিয়াল নম্বর</p>
          <strong className="success-serial">
            {serial(saved.serial_number)}
          </strong>
          <Link className="button primary" to={path("/cases/" + saved.id)}>
            মামলার বিস্তারিত দেখুন <ArrowUpRight size={18} />
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              setSaved(null);
              form.reset();
            }}
          >
            আরেকটি মামলা যোগ করুন
          </Button>
        </Success>
      </Panel>
    );
  return (
    <>
      <PageTitle
        title={id ? "মামলা সম্পাদনা" : "নতুন মামলা"}
        description="যেকোনো ঘর খালি রেখেও সংরক্ষণ করুন; পরে সম্পাদনা করতে পারবেন। শিরোনাম না দিলে নামহীন মামলা এবং বছর না দিলে চলতি বছর হবে।"
      />
      <form onSubmit={(e) => void form.handleSubmit(submit)(e)}>
        <Panel>
          <h2>মামলার মৌলিক তথ্য</h2>
          <div className="form-grid">
            <Field label="চেম্বার সিরিয়াল">
              <input
                readOnly
                value={
                  existing.data
                    ? serial(existing.data.serial_number)
                    : "সংরক্ষণের সময় স্বয়ংক্রিয়ভাবে তৈরি হবে"
                }
              />
            </Field>
            <Field
              label="মামলার শিরোনাম"
              error={form.formState.errors.title?.message}
            >
              <input
                {...form.register("title")}
                placeholder="বাদী বনাম বিবাদী"
              />
            </Field>
            <Field
              label="আদালতের মামলা নম্বর"
              error={form.formState.errors.court_case_number?.message}
            >
              <input
                {...form.register("court_case_number")}
                placeholder="১২৩/২০২৬"
              />
            </Field>
            <Field
              label="মামলার বছর"
              error={form.formState.errors.case_year?.message}
            >
              <input
                type="number"
                {...form.register("case_year", { valueAsNumber: true })}
              />
            </Field>
            <Field label="মামলার ধরন">
              <select {...form.register("case_type")}>
                {Object.entries(typeLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="আদালত"
              error={form.formState.errors.court_name?.message}
            >
              <input
                {...form.register("court_name")}
                placeholder="জেলা জজ কোর্ট"
              />
            </Field>
            <Field label="আদালতের অবস্থান">
              <input {...form.register("court_location")} />
            </Field>
            <Field
              label="মামলা গ্রহণের তারিখ"
              error={form.formState.errors.received_date?.message}
            >
              <input type="date" {...form.register("received_date")} />
            </Field>
          </div>
        </Panel>
        <Panel>
          <h2>মক্কেল ও পক্ষগুলোর তথ্য</h2>
          <div className="form-grid">
            <div>
              <Field label="মক্কেল খুঁজুন">
                <input
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="নাম বা মোবাইল"
                />
              </Field>
              <Field
                label="মক্কেল নির্বাচন"
                error={form.formState.errors.client_id?.message}
              >
                <select {...form.register("client_id")}>
                  <option value="">নির্বাচন করুন</option>
                  {existing.data?.client_id &&
                    !clients.data?.some(
                      (c) => c.id === existing.data!.client_id,
                    ) && (
                      <option value={existing.data.client_id}>
                        বর্তমান মক্কেল
                      </option>
                    )}
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} — {c.phone}
                    </option>
                  ))}
                </select>
              </Field>
              <Link className="text-link" to={path("/clients")}>
                + প্রথমে নতুন মক্কেল যোগ করুন
              </Link>
            </div>
            <Field
              label="যোগাযোগের নম্বর"
              error={form.formState.errors.contact_phone?.message}
            >
              <input type="tel" {...form.register("contact_phone")} />
            </Field>
            <Field label="বাদীর নাম">
              <input {...form.register("plaintiff")} />
            </Field>
            <Field label="বিবাদীর নাম">
              <input {...form.register("defendant")} />
            </Field>
          </div>
          <Field label="মামলার নোট">
            <textarea rows={4} {...form.register("notes")} />
          </Field>
        </Panel>
        {error && <ErrorBox message={error} />}
        <div className="form-actions">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              if (
                !form.formState.isDirty ||
                confirm("অসংরক্ষিত তথ্য বাদ দিতে চান?")
              )
                navigate(path("/cases"));
            }}
          >
            বাতিল
          </Button>
          <Button
            variant="gold"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "সংরক্ষণ হচ্ছে…"
              : "মামলা সংরক্ষণ করুন"}
            <ArrowUpRight size={18} />
          </Button>
        </div>
      </form>
    </>
  );
}

export function CaseDetails() {
  const { id = "" } = useParams();
  const { repo, organization, membership, refresh, notice } = useWorkspace(),
    path = usePath(),
    navigate = useNavigate();
  const [tab, setTab] = useState("overview"),
    [hearing, setHearing] = useState(false),
    [closing, setClosing] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useResource(
    () => repo.getCase(organization!.id, id),
    "case" + organization!.id + id,
  );
  const details = useResource(
    async () => {
      const c = await repo.getCase(organization!.id, id);
      return {
        client: c.client_id
          ? await repo.getClient(organization!.id, c.client_id)
          : null,
        hearings: await repo.listHearings(
          organization!.id,
          "1900-01-01",
          "2200-12-31",
          id,
        ),
        events: await repo.caseHistory(organization!.id, id),
        notes: await repo.caseNotes(organization!.id, id),
        members: await repo.members(organization!.id),
        assignments: await repo.assignments(organization!.id, id),
      };
    },
    "case-related" + organization!.id + id,
  );
  const closeForm = useForm<{ closed_date: string; closure_result: string }>({
    resolver: zodResolver(closureSchema),
    defaultValues: { closed_date: today(), closure_result: "" },
  });
  const edit = !!membership && canEdit(membership.role);
  if (data.loading) return <Loading />;
  if (data.error || !data.data)
    return (
      <ErrorBox
        message={data.error || "মামলা পাওয়া যায়নি"}
        retry={data.retry}
      />
    );
  const c = data.data;
  async function action(run: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await run();
      refresh();
      notice(message);
      setClosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "কাজটি সম্পন্ন হয়নি");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="breadcrumb">
        <Link to={path("/cases")}>সব মামলা</Link>
        <ChevronRight size={14} />
        <span>{serial(c.serial_number)}</span>
      </div>
      <PageTitle
        title={c.title}
        description={`${typeLabels[c.case_type] ?? c.case_type} • মামলা নং ${c.court_case_number}`}
        action={
          edit && (
            <Link className="button ghost" to={path("/cases/" + id + "/edit")}>
              <Edit3 size={16} />
              সম্পাদনা
            </Link>
          )
        }
      />
      <Panel className="case-summary">
        <div className="summary-top">
          <span className="serial large">{serial(c.serial_number)}</span>
          <div>
            <p className="muted">চেম্বার সিরিয়াল</p>
            <strong>{c.court_case_number}</strong>
          </div>
          <Status value={c.status} />
        </div>
        <div className="summary-grid">
          <div>
            <span>মামলা গ্রহণ</span>
            <strong>{formatDate(c.received_date)}</strong>
          </div>
          <div>
            <span>নিষ্পত্তির তারিখ</span>
            <strong>{formatDate(c.closed_date)}</strong>
          </div>
          <div>
            <span>আদালত</span>
            <strong>{c.court_name}</strong>
          </div>
          <div>
            <span>পরবর্তী শুনানি</span>
            <strong>
              {c.status === "closed"
                ? "—"
                : formatDate(
                    details.data?.hearings.filter(
                      (h) => h.hearing_date >= today(),
                    )[0]?.hearing_date ?? c.next_hearing_date,
                  )}
            </strong>
          </div>
        </div>
        {c.status === "closed" && (
          <p className="closure-result">ফলাফল: {c.closure_result}</p>
        )}
      </Panel>
      <div className="tabs" role="tablist" aria-label="মামলার বিস্তারিত">
        {[
          ["overview", "তথ্য"],
          ["hearings", "শুনানি"],
          ["documents", "নথি"],
          ["notes", "নোট"],
          ["history", "ইতিহাস"],
        ].map(([v, l]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} />}
      {details.loading ? (
        <Loading />
      ) : details.error ? (
        <ErrorBox message={details.error} retry={details.retry} />
      ) : tab === "overview" ? (
        <div className="detail-columns">
          <Panel>
            <h2>পক্ষগুলোর তথ্য</h2>
            {[
              ["মক্কেল", details.data?.client?.full_name],
              ["বাদী", c.plaintiff],
              ["বিবাদী", c.defendant],
            ].map(([label, value]) => (
              <div className="person-row" key={label}>
                <span className="person-icon">
                  {label === "মক্কেল" ? (
                    <Phone size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </span>
                <div>
                  <small>{label}</small>
                  <strong>{value || "—"}</strong>
                </div>
              </div>
            ))}
            {details.data?.client?.phone && (
              <a
                className="text-link"
                href={"tel:" + details.data.client.phone}
              >
                <Phone size={15} />
                {details.data.client.phone}
              </a>
            )}
            <p className="muted">{details.data?.client?.address}</p>
            <p>{c.notes || "আলাদা নোট যোগ করা হয়নি"}</p>
          </Panel>
          <Panel>
            <h2>দায়িত্বপ্রাপ্ত আইনজীবী</h2>
            {details.data?.members
              .filter((m) => details.data?.assignments.includes(m.user_id))
              .map((m) => (
                <div className="member-assignment" key={m.user_id}>
                  <span>{m.display_name}</span>
                  {edit && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void action(
                          () => repo.unassign(organization!.id, id, m.user_id),
                          "দায়িত্ব থেকে সরানো হয়েছে",
                        )
                      }
                    >
                      সরান
                    </Button>
                  )}
                </div>
              ))}
            {edit && (
              <Field label="সদস্য যুক্ত করুন">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      void action(
                        () => repo.assign(organization!.id, id, e.target.value),
                        "দায়িত্ব দেওয়া হয়েছে",
                      );
                  }}
                >
                  <option value="">নির্বাচন করুন</option>
                  {details.data?.members
                    .filter(
                      (m) =>
                        !details.data?.assignments.includes(m.user_id) &&
                        m.role !== "viewer",
                    )
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <div className="case-controls">
              {edit && c.status !== "closed" && (
                <>
                  <Button disabled={busy} onClick={() => setHearing(true)}>
                    <Plus size={16} />
                    শুনানি যোগ করুন
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () =>
                          repo.status(
                            organization!.id,
                            id,
                            c.status === "pending" ? "running" : "pending",
                          ),
                        "অবস্থা পরিবর্তন হয়েছে",
                      )
                    }
                  >
                    {c.status === "pending" ? "চলমান করুন" : "মুলতবি করুন"}
                  </Button>
                  <Button variant="ghost" onClick={() => setClosing(true)}>
                    <CheckCircle2 size={16} />
                    মামলা বন্ধ করুন
                  </Button>
                </>
              )}
              {edit && c.status === "closed" && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "মামলাটি আবার চালু করতে চান? আগের নিষ্পত্তির ইতিহাস থাকবে।",
                      )
                    )
                      void action(
                        () => repo.status(organization!.id, id, "running"),
                        "মামলা পুনরায় চালু হয়েছে",
                      );
                  }}
                >
                  <RotateCcw size={16} />
                  পুনরায় চালু করুন
                </Button>
              )}
              {edit && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm("মামলাটি আর্কাইভ করতে চান? স্থায়ীভাবে মুছবে না।")
                    )
                      void action(async () => {
                        await repo.archive(organization!.id, "cases", id);
                        navigate(path("/cases"));
                      }, "মামলা আর্কাইভ হয়েছে");
                  }}
                >
                  <Archive size={16} />
                  আর্কাইভ
                </Button>
              )}
            </div>
          </Panel>
        </div>
      ) : tab === "hearings" ? (
        <Panel>
          <div className="section-title">
            <h2>শুনানির ইতিহাস</h2>
            {edit && c.status !== "closed" && (
              <Button onClick={() => setHearing(true)}>
                <Plus size={16} />
                শুনানি যোগ করুন
              </Button>
            )}
          </div>
          <HearingList
            hearings={details.data?.hearings ?? []}
            cases={[c]}
            allowEdit
          />
        </Panel>
      ) : tab === "documents" ? (
        <DocumentList caseId={id} />
      ) : tab === "notes" ? (
        <Panel>
          <h2>ব্যক্তিগত নোট</h2>
          {edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim())
                  void action(async () => {
                    await repo.addNote(organization!.id, id, note.trim());
                    setNote("");
                  }, "নোট যোগ হয়েছে");
              }}
            >
              <Field label="নতুন নোট">
                <textarea
                  required
                  maxLength={5000}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <Button disabled={busy}>নোট সংরক্ষণ করুন</Button>
            </form>
          )}
          {details.data?.notes.map((n) => (
            <div className="timeline-item" key={n.id}>
              <small>{formatDate(n.created_at)}</small>
              <p>{n.body}</p>
            </div>
          ))}
        </Panel>
      ) : (
        <Panel>
          <h2>মামলার কার্যক্রম</h2>
          {details.data?.events.length ? (
            <div className="timeline">
              {details.data.events.map((e) => (
                <div className="timeline-item" key={e.id}>
                  <small>{formatDate(e.created_at)}</small>
                  <p>{eventLabel(e.action)}</p>
                  {e.closure_date && (
                    <small>নিষ্পত্তি: {formatDate(e.closure_date)}</small>
                  )}
                  {e.outcome && <p>{e.outcome}</p>}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="এখনো কোনো কার্যক্রম নেই" />
          )}
        </Panel>
      )}
      {hearing && (
        <Modal title="নতুন শুনানি" onClose={() => setHearing(false)}>
          <HearingForm
            caseRecord={c}
            onSaved={() => {
              setHearing(false);
              refresh();
            }}
          />
        </Modal>
      )}
      {closing && (
        <Modal title="মামলা বন্ধ করুন" onClose={() => setClosing(false)}>
          <form
            onSubmit={(e) =>
              void closeForm.handleSubmit((values) =>
                action(
                  () =>
                    repo.status(
                      organization!.id,
                      id,
                      "closed",
                      values.closed_date,
                      values.closure_result,
                    ),
                  "মামলা বন্ধ হয়েছে",
                ),
              )(e)
            }
          >
            <Field
              label="নিষ্পত্তির তারিখ *"
              error={closeForm.formState.errors.closed_date?.message}
            >
              <input
                type="date"
                min={c.received_date}
                {...closeForm.register("closed_date")}
              />
            </Field>
            <Field
              label="ফলাফল / চূড়ান্ত আদেশ *"
              error={closeForm.formState.errors.closure_result?.message}
            >
              <textarea rows={4} {...closeForm.register("closure_result")} />
            </Field>
            <Button disabled={busy}>নিষ্পত্তি সংরক্ষণ করুন</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Clients() {
  const { repo, organization, membership, refresh } = useWorkspace();
  const path = usePath();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [editing, setEditing] = useState<string | true | null>(null);
  const data = useResource(
    () => repo.listClients(organization!.id, search, page),
    "clients" + organization!.id + search + page,
  );
  return (
    <>
      <PageTitle
        title="মক্কেল"
        description="মানুষ ও তাঁদের মামলার তথ্য, একসঙ্গে।"
        action={
          membership &&
          canEdit(membership.role) && (
            <Button onClick={() => setEditing(true)}>
              <Plus size={18} />
              নতুন মক্কেল
            </Button>
          )
        }
      />
      <Panel>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="মক্কেলের নাম বা মোবাইল নম্বর…"
        />
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorBox message={data.error} retry={data.retry} />
        ) : !data.data?.length ? (
          <Empty title="মক্কেল পাওয়া যায়নি" />
        ) : (
          <div className="client-list">
            {data.data.map((c) => (
              <Link
                className="client-row"
                key={c.id}
                to={path("/clients/" + c.id)}
              >
                <span className="avatar pale">{c.full_name.slice(0, 1)}</span>
                <div>
                  <h3>{c.full_name}</h3>
                  <p>{c.phone}</p>
                  <small>{c.address}</small>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        )}
        <Pagination
          page={page}
          onChange={setPage}
          hasMore={data.data?.length === 20}
        />
      </Panel>
      {editing && (
        <Modal title="নতুন মক্কেল" onClose={() => setEditing(null)}>
          <ClientForm
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
export function ClientForm({
  id,
  onSaved,
}: {
  id?: string;
  onSaved: () => void;
}) {
  const { repo, organization } = useWorkspace();
  const [error, setError] = useState("");
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      alternative_phone: "",
      address: "",
      notes: "",
    },
  });
  const existing = useResource(
    async () => (id ? repo.getClient(organization!.id, id) : null),
    "edit-client" + organization!.id + id,
  );
  useEffect(() => {
    if (existing.data) form.reset(existing.data);
  }, [existing.data, form]);
  async function submit(v: ClientInput) {
    try {
      await repo.saveClient(organization!.id, v, id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "সংরক্ষণ হয়নি");
    }
  }
  return (
    <form onSubmit={(e) => void form.handleSubmit(submit)(e)}>
      {existing.loading && id ? (
        <Loading />
      ) : existing.error ? (
        <ErrorBox message={existing.error} />
      ) : (
        <>
          {(
            [
              "full_name",
              "phone",
              "alternative_phone",
              "address",
              "notes",
            ] as const
          ).map((key, i) => (
            <Field
              key={key}
              label={
                ["পূর্ণ নাম", "মোবাইল নম্বর", "বিকল্প মোবাইল", "ঠিকানা", "নোট"][
                  i
                ]
              }
              error={form.formState.errors[key]?.message}
            >
              <input
                type={key.includes("phone") ? "tel" : "text"}
                {...form.register(key)}
              />
            </Field>
          ))}
          {error && <ErrorBox message={error} />}
          <Button disabled={form.formState.isSubmitting}>
            মক্কেল সংরক্ষণ করুন
          </Button>
        </>
      )}
    </form>
  );
}
export function ClientDetails() {
  const { id = "" } = useParams();
  const { repo, organization, membership, refresh, notice } = useWorkspace();
  const navigate = useNavigate(),
    path = usePath();
  const [edit, setEdit] = useState(false),
    [error, setError] = useState("");
  const data = useResource(
    async () => ({
      client: await repo.getClient(organization!.id, id),
      cases: await repo.clientCases(organization!.id, id),
    }),
    "client-details" + organization!.id + id,
  );
  if (data.loading) return <Loading />;
  if (data.error || !data.data)
    return <ErrorBox message={data.error || "মক্কেল পাওয়া যায়নি"} />;
  return (
    <>
      <PageTitle
        title={data.data.client.full_name}
        action={
          membership &&
          canEdit(membership.role) && (
            <Button variant="ghost" onClick={() => setEdit(true)}>
              <Edit3 size={16} />
              সম্পাদনা
            </Button>
          )
        }
      />
      <Panel>
        <a className="text-link" href={"tel:" + data.data.client.phone}>
          <Phone size={18} />
          {data.data.client.phone}
        </a>
        <p>{data.data.client.address}</p>
        <p>{data.data.client.notes}</p>
        {membership && canEdit(membership.role) && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("মক্কেলকে আর্কাইভ করতে চান?"))
                void repo
                  .archive(organization!.id, "clients", id)
                  .then(() => {
                    refresh();
                    notice("মক্কেল আর্কাইভ হয়েছে");
                    navigate(path("/clients"));
                  })
                  .catch((e: unknown) =>
                    setError(e instanceof Error ? e.message : "আর্কাইভ হয়নি"),
                  );
            }}
          >
            আর্কাইভ
          </Button>
        )}
      </Panel>
      {error && <ErrorBox message={error} />}
      <h2>সম্পর্কিত মামলা</h2>
      {data.data.cases.length ? (
        data.data.cases.map((c) => <CaseCard key={c.id} record={c} />)
      ) : (
        <Empty title="এখনো কোনো মামলা যুক্ত নেই" />
      )}
      {edit && (
        <Modal title="মক্কেল সম্পাদনা" onClose={() => setEdit(false)}>
          <ClientForm
            id={id}
            onSaved={() => {
              setEdit(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
