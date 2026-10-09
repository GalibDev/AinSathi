import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Scale,
  ShieldCheck,
  LockKeyhole,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { configured, requireSupabase } from "../lib/supabase";
import { useWorkspace } from "../lib/context";
import { Brand } from "../components/Layout";
import { Button, Field, ErrorBox, Loading } from "../components/ui";
const authSchema = z.object({
  email: z.string().email("সঠিক ইমেইল ঠিকানা দিন"),
  password: z.string().min(8, "অন্তত ৮ অক্ষরের পাসওয়ার্ড দিন"),
  full_name: z.string(),
});
type AuthValues = z.infer<typeof authSchema>;
export function AuthPage() {
  const loc = useLocation(),
    mode =
      loc.pathname === "/register"
        ? "register"
        : loc.pathname === "/forgot-password"
          ? "forgot"
          : loc.pathname === "/reset-password"
            ? "reset"
            : "login";
  const { session, authLoading } = useWorkspace();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const form = useForm<AuthValues>({
    resolver: zodResolver(
      mode === "forgot"
        ? authSchema.extend({ password: z.string() })
        : mode === "reset"
          ? authSchema.extend({ email: z.string() })
          : authSchema,
    ),
    defaultValues: { email: "", password: "", full_name: "" },
  });
  const navigate = useNavigate();
  const invitation = new URLSearchParams(loc.search).get("invite");
  const destination = invitation
    ? "/onboarding?invite=" + encodeURIComponent(invitation)
    : "/dashboard";
  if (authLoading) return <Loading />;
  if (session && mode === "login") return <Navigate to={destination} replace />;
  async function submit(values: AuthValues) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const s = requireSupabase();
      if (mode === "forgot") {
        const { error } = await s.auth.resetPasswordForEmail(values.email, {
          redirectTo: location.origin + "/reset-password",
        });
        if (error) throw error;
        setMessage(
          "অ্যাকাউন্ট থাকলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হয়েছে।",
        );
      } else if (mode === "reset") {
        const { error } = await s.auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        setMessage("পাসওয়ার্ড পরিবর্তন হয়েছে।");
        navigate(destination);
      } else if (mode === "register") {
        if (values.full_name.trim().length < 2)
          throw new Error("আপনার পূর্ণ নাম দিন");
        const { data, error } = await s.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.full_name },
            emailRedirectTo:
              location.origin +
              (invitation
                ? "/onboarding?invite=" + encodeURIComponent(invitation)
                : "/onboarding"),
          },
        });
        if (error) throw error;
        if (data.session)
          navigate(
            invitation
              ? "/onboarding?invite=" + encodeURIComponent(invitation)
              : "/onboarding",
          );
        else setMessage("ইমেইলে পাঠানো লিংক দিয়ে অ্যাকাউন্ট যাচাই করুন।");
      } else {
        const { error } = await s.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error)
          throw new Error(
            "ইমেইল বা পাসওয়ার্ড সঠিক নয়, অথবা ইমেইল যাচাই বাকি।",
          );
        navigate(destination);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "পুনরায় চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-art">
        <Brand light />
        <div className="auth-message">
          <span className="gold-line" />
          <p>আইন পেশার বিশ্বস্ত সহচর</p>
          <h1>
            আপনার মামলা,
            <br />
            <em>আপনার নিয়ন্ত্রণ।</em>
          </h1>
          <p>
            মামলা থেকে শুনানি, মক্কেল থেকে নথিপত্র—
            <br />
            আপনার পুরো চেম্বার, একটি নিরাপদ কর্মক্ষেত্রে।
          </p>
          <div className="justice-symbol">
            <Scale strokeWidth={0.8} />
          </div>
          <div className="auth-trust">
            <ShieldCheck size={21} /> ব্যক্তিগত চেম্বার <span>•</span> সংগঠিত
            প্রতিদিন
          </div>
        </div>
        <small>আইনজীবীদের জন্য তৈরি • বাংলাদেশ</small>
      </section>
      <section className="auth-form-area">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <div className="auth-icon">
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">AINSATHI-তে স্বাগতম</p>
          <h1>
            {mode === "register"
              ? "নতুন অ্যাকাউন্ট তৈরি করুন"
              : mode === "forgot"
                ? "পাসওয়ার্ড ভুলে গেছেন?"
                : mode === "reset"
                  ? "নতুন পাসওয়ার্ড দিন"
                  : "লগইন করুন"}
          </h1>
          <p className="muted">আপনার চেম্বারের কাজ শুরু করুন, নিশ্চিন্তে।</p>
          {!configured && (
            <div className="connection-note">
              <strong>Supabase সংযোগের অপেক্ষায়</strong>
              <p>
                আসল অ্যাকাউন্ট ব্যবহার করতে .env.local কনফিগার করুন। নিচের
                ডেমোতে ডিজাইন ও কার্যপ্রবাহ দেখতে পারেন।
              </p>
            </div>
          )}
          {error && <ErrorBox message={error} />}
          {message && (
            <div className="success-message" role="status">
              {message}
            </div>
          )}
          <form onSubmit={(e) => void form.handleSubmit(submit)(e)}>
            {mode === "register" && (
              <Field
                label="পূর্ণ নাম"
                error={form.formState.errors.full_name?.message}
              >
                <input
                  autoComplete="name"
                  {...form.register("full_name")}
                  placeholder="আপনার নাম"
                />
              </Field>
            )}
            {mode !== "reset" && (
              <Field
                label="ইমেইল ঠিকানা"
                error={form.formState.errors.email?.message}
              >
                <input
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                  placeholder="you@example.com"
                />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field
                label={mode === "reset" ? "নতুন পাসওয়ার্ড" : "পাসওয়ার্ড"}
                error={form.formState.errors.password?.message}
              >
                <div className="password-field">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    {...form.register("password")}
                    placeholder="অন্তত ৮ অক্ষর"
                  />
                  <button
                    type="button"
                    aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
            )}
            {mode === "login" && (
              <div className="form-meta">
                <span>
                  <ShieldCheck size={14} /> নিরাপদ লগইন
                </span>
                <Link to="/forgot-password">পাসওয়ার্ড ভুলে গেছেন?</Link>
              </div>
            )}
            <Button disabled={busy || !configured} type="submit">
              {busy
                ? "অপেক্ষা করুন…"
                : mode === "login"
                  ? "লগইন করুন"
                  : mode === "register"
                    ? "অ্যাকাউন্ট তৈরি করুন"
                    : mode === "forgot"
                      ? "রিসেট লিংক পাঠান"
                      : "পাসওয়ার্ড পরিবর্তন করুন"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="or-divider">
            <span>অথবা</span>
          </div>
          <Link className="button ghost full" to="/demo/dashboard">
            নমুনা চেম্বার দেখুন <ArrowRight size={17} />
          </Link>
          <p className="auth-link">
            {mode === "login" ? (
              <>
                নতুন ব্যবহারকারী?{" "}
                <Link
                  to={
                    "/register" +
                    (invitation
                      ? "?invite=" + encodeURIComponent(invitation)
                      : "")
                  }
                >
                  রেজিস্টার করুন
                </Link>
              </>
            ) : (
              <Link
                to={
                  "/login" +
                  (invitation
                    ? "?invite=" + encodeURIComponent(invitation)
                    : "")
                }
              >
                লগইনে ফিরে যান
              </Link>
            )}
          </p>
          <p className="privacy-note">
            আপনার চেম্বারের তথ্য আপনার নিয়ন্ত্রণে।
          </p>
        </div>
      </section>
    </div>
  );
}
export function Onboarding() {
  const {
    session,
    organization,
    refresh,
    error: workspaceError,
  } = useWorkspace();
  const [name, setName] = useState(""),
    [memberName, setMemberName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const invite = new URLSearchParams(useLocation().search).get("invite");
  if (!session)
    return (
      <Navigate
        to={"/login" + (invite ? "?invite=" + encodeURIComponent(invite) : "")}
        replace
      />
    );
  if (
    organization &&
    !invite &&
    !new URLSearchParams(location.search).has("new")
  )
    return <Navigate to="/dashboard" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (memberName.trim().length < 2 || (!invite && name.trim().length < 2))
        throw new Error("চেম্বার ও আপনার পূর্ণ নাম লিখুন");
      const result = invite
        ? await requireSupabase().rpc("accept_invitation", {
            invite_token: invite,
            member_name: memberName,
          })
        : await requireSupabase().rpc("create_chamber", {
            chamber_name: name,
            member_name: memberName,
          });
      if (result.error) throw result.error;
      refresh();
      location.assign("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "চেম্বার তৈরি হয়নি");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="standalone">
      <Brand />
      <h1>
        {invite ? "চেম্বারের আমন্ত্রণ গ্রহণ করুন" : "আপনার চেম্বার তৈরি করুন"}
      </h1>
      <p className="muted">
        চেম্বারের প্রতিষ্ঠাতা স্বয়ংক্রিয়ভাবে মালিক হবেন।
      </p>
      {(error || workspaceError) && (
        <ErrorBox message={error || workspaceError} />
      )}
      <form onSubmit={(e) => void submit(e)}>
        <Field label="আপনার নাম">
          <input
            required
            minLength={2}
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
          />
        </Field>
        {!invite && (
          <Field label="চেম্বারের নাম">
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        )}
        <Button disabled={busy}>
          {busy
            ? "অপেক্ষা করুন…"
            : invite
              ? "আমন্ত্রণ গ্রহণ করুন"
              : "চেম্বার তৈরি করুন"}
        </Button>
      </form>
    </div>
  );
}
