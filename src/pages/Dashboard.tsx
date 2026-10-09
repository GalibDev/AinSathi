import { Link } from "react-router-dom";
import {
  Files,
  FolderCheck,
  Clock3,
  CalendarDays,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Scale,
  Sun,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { usePath, useResource, useWorkspace } from "../lib/context";
import { bn, formatDate, today, emptyFilters, canEdit } from "../lib/schema";
import { PageTitle, Panel, Loading, ErrorBox } from "../components/ui";
import { CaseCard } from "./Cases";
import { HearingList } from "./HearingsDocuments";
export default function Dashboard() {
  const { repo, organization, membership } = useWorkspace(),
    path = usePath();
  const date = today();
  const until = new Date(date + "T12:00:00Z");
  until.setUTCDate(until.getUTCDate() + 7);
  const data = useResource(
    async () => ({
      report: await repo.report(organization!.id),
      hearings: await repo.listHearings(
        organization!.id,
        date,
        until.toISOString().slice(0, 10),
      ),
      cases: await repo.listCases(organization!.id, emptyFilters),
    }),
    "dashboard" + organization!.id + date,
  );
  const stats = data.data?.report.stats;
  const cards = [
    ["মোট মামলা", stats?.total, Files, "blue", ""],
    ["চলমান মামলা", stats?.running, FolderCheck, "green", "running"],
    ["মুলতবি", stats?.pending, Clock3, "orange", "pending"],
    ["নিষ্পত্তি", stats?.closed, CheckCircle2, "purple", "closed"],
  ] as const;
  return (
    <>
      <PageTitle
        title={`স্বাগতম, ${membership?.display_name || "আইনজীবী"}`}
        description={formatDate(date, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
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
      <div className="welcome-banner">
        <div>
          <span className="welcome-label">
            <Sun size={16} />
            একটি সংগঠিত দিনের শুরু
          </span>
          <h2>
            প্রতিটি মামলা গুরুত্বপূর্ণ।
            <br />
            <span>প্রতিটি তারিখ থাকুক মনে।</span>
          </h2>
          <p>আপনার চেম্বারের আজকের কাজ, এক নজরে।</p>
        </div>
        <div className="welcome-scale">
          <Scale strokeWidth={1} />
        </div>
        <Link to={path("/calendar")} className="welcome-link">
          ক্যালেন্ডার দেখুন <ArrowUpRight size={17} />
        </Link>
      </div>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox message={data.error} retry={data.retry} />
      ) : (
        <>
          <div className="stats-grid">
            {cards.map(([label, count, Icon, color, status]) => (
              <Link
                className="stat-card"
                key={label}
                to={path("/cases" + (status ? "?status=" + status : ""))}
              >
                <span className={`stat-icon ${color}`}>
                  <Icon size={23} />
                </span>
                <div>
                  <p>{label}</p>
                  <strong>{bn(count ?? 0)}</strong>
                  <small>
                    বিস্তারিত দেখুন <ArrowUpRight size={12} />
                  </small>
                </div>
              </Link>
            ))}
          </div>
          <div className="dashboard-columns">
            <Panel>
              <div className="section-title">
                <div>
                  <h2>
                    আজকের শুনানি{" "}
                    <span className="count-badge">
                      {bn(
                        data.data?.hearings.filter(
                          (h) => h.hearing_date === date,
                        ).length ?? 0,
                      )}
                    </span>
                  </h2>
                  <p className="muted">{formatDate(date)}</p>
                </div>
                <Link className="text-link" to={path("/calendar")}>
                  সব দেখুন <ArrowRight size={15} />
                </Link>
              </div>
              <HearingList
                hearings={
                  data.data?.hearings.filter((h) => h.hearing_date === date) ??
                  []
                }
                cases={data.data?.cases ?? []}
              />
            </Panel>
            <div className="dashboard-aside">
              <Panel className="upcoming-panel">
                <span className="stat-icon gold">
                  <CalendarDays size={23} />
                </span>
                <h2>আসন্ন শুনানি</h2>
                <strong className="upcoming-number">
                  {bn(data.data?.hearings.length ?? 0)}
                </strong>
                <p className="muted">আজসহ আগামী ৭ দিনে</p>
                <Link className="button ghost" to={path("/calendar")}>
                  সময়সূচি দেখুন <ArrowRight size={16} />
                </Link>
              </Panel>
              <Panel className="quick-actions">
                <h3>দ্রুত কাজ</h3>
                <Link to={path("/clients")}>
                  <Plus size={16} />
                  মক্কেল যোগ করুন
                  <ChevronIcon />
                </Link>
                <Link to={path("/documents")}>
                  <FileText size={16} />
                  নথি দেখুন
                  <ChevronIcon />
                </Link>
                <Link to={path("/reports")}>
                  <Files size={16} />
                  রিপোর্ট দেখুন
                  <ChevronIcon />
                </Link>
              </Panel>
            </div>
          </div>
          <Panel>
            <div className="section-title">
              <h2>সাম্প্রতিক মামলা</h2>
              <Link className="text-link" to={path("/cases")}>
                সব মামলা <ArrowRight size={15} />
              </Link>
            </div>
            <div className="recent-cases">
              {data.data?.cases.slice(0, 3).map((c) => (
                <CaseCard record={c} key={c.id} />
              ))}
            </div>
            {!data.data?.cases.length && (
              <p className="muted">নতুন মামলা যোগ করে শুরু করুন।</p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
function ChevronIcon() {
  return <ArrowUpRight size={15} />;
}
