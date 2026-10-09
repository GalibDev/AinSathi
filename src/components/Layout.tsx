import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  Scale,
  LayoutDashboard,
  Files,
  CalendarDays,
  Users,
  UserRoundCog,
  ChartNoAxesCombined,
  Settings,
  Bell,
  Plus,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Search,
} from "lucide-react";
import { usePath, useWorkspace } from "../lib/context";
import { supabase } from "../lib/supabase";
import { canEdit } from "../lib/schema";
const items = [
  ["/dashboard", "ড্যাশবোর্ড", LayoutDashboard],
  ["/cases", "সব মামলা", Files],
  ["/calendar", "শুনানি ক্যালেন্ডার", CalendarDays],
  ["/clients", "মক্কেল", Users],
  ["/documents", "নথিপত্র", Files],
  ["/members", "আইনজীবী ও স্টাফ", UserRoundCog],
  ["/reports", "রিপোর্ট", ChartNoAxesCombined],
  ["/settings", "সেটিংস", Settings],
] as const;
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <Scale size={32} strokeWidth={1.5} />
      </span>
      <div>
        <strong>
          AinSathi<span className="brand-dot">.</span>
        </strong>
        <small>আপনার মামলা, আপনার নিয়ন্ত্রণ</small>
      </div>
    </div>
  );
}
export default function Layout() {
  const [open, setOpen] = useState(false);
  const {
    demo,
    organization,
    membership,
    organizations,
    setOrganization,
    notice,
  } = useWorkspace();
  const path = usePath(),
    navigate = useNavigate();
  async function logout() {
    if (demo) {
      navigate("/login");
      return;
    }
    const { error } = await supabase!.auth.signOut();
    if (error) notice("লগ আউট করা যায়নি");
    else navigate("/login");
  }
  return (
    <div className="app-shell">
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="মেনু বন্ধ করুন"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to={path("/dashboard")} onClick={() => setOpen(false)}>
          <Brand light />
        </Link>
        <button
          className="drawer-close icon-button"
          aria-label="মেনু বন্ধ করুন"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="chamber-switch">
          <span>বর্তমান চেম্বার</span>
          <label>
            <select
              aria-label="চেম্বার নির্বাচন"
              value={organization?.id ?? ""}
              onChange={(e) => {
                setOrganization(e.target.value);
                setOpen(false);
              }}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
        <p className="nav-label">কর্মক্ষেত্র</p>
        <nav>
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={path(to)} onClick={() => setOpen(false)}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note">
            <ShieldCheck size={18} />
            <span>
              {demo
                ? "নমুনা তথ্যের ডেমো"
                : "আপনার চেম্বারের ব্যক্তিগত কর্মক্ষেত্র"}
            </span>
          </div>
          <Link to={path("/profile")} className="profile-card">
            <span className="avatar">
              {membership?.display_name.slice(0, 1) || "আ"}
            </span>
            <div>
              <strong>{membership?.display_name || "আইনজীবী"}</strong>
              <small>
                {membership?.role === "owner"
                  ? "চেম্বার মালিক"
                  : "চেম্বার সদস্য"}
              </small>
            </div>
          </Link>
          <button className="logout" onClick={() => void logout()}>
            <LogOut size={17} />
            {demo ? "ডেমো থেকে বের হন" : "লগ আউট"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="mobile-menu icon-button"
              aria-label="মেনু খুলুন"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <div className="desktop-breadcrumb">
              কর্মক্ষেত্র <span>/</span> {organization?.name}
            </div>
            <Link className="mobile-brand" to={path("/dashboard")}>
              AinSathi<span>.</span>
            </Link>
          </div>
          <div className="topbar-actions">
            <Link className="top-search" to={path("/cases")}>
              <Search size={17} />
              মামলা খুঁজুন
            </Link>
            <span className="language">বাংলা</span>
            <Link
              className="icon-button notification-bell"
              aria-label="বিজ্ঞপ্তি"
              to={path("/notifications")}
            >
              <Bell size={20} />
            </Link>
            <Link
              className="avatar small"
              aria-label="আপনার প্রোফাইল"
              to={path("/profile")}
            >
              {membership?.display_name.slice(0, 1) || "আ"}
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              ডেমো মোড — সব তথ্য কাল্পনিক; পরিবর্তন রিফ্রেশে মুছে যাবে।
            </span>
            <Link to="/login">নিজের চেম্বার সংযুক্ত করুন →</Link>
          </div>
        )}
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          © {new Date().getFullYear()} AinSathi{" "}
          <span>স্বাধীন চেম্বার ব্যবস্থাপনা অ্যাপ • সরকারি সেবা নয়</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        <NavLink to={path("/dashboard")}>
          <LayoutDashboard />
          <span>ড্যাশবোর্ড</span>
        </NavLink>
        <NavLink to={path("/cases")}>
          <Files />
          <span>মামলা</span>
        </NavLink>
        {membership && canEdit(membership.role) && (
          <Link
            className="quick-add"
            aria-label="নতুন মামলা"
            to={path("/cases/new")}
          >
            <Plus />
          </Link>
        )}
        <NavLink to={path("/calendar")}>
          <CalendarDays />
          <span>ক্যালেন্ডার</span>
        </NavLink>
        <button onClick={() => setOpen(true)}>
          <Menu />
          <span>আরও</span>
        </button>
      </nav>
    </div>
  );
}
