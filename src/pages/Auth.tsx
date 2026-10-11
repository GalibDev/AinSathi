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
import {
  configured,
  googleSignIn,
  emailSignIn,
  emailSignUp,
  passwordReset,
  finishPasswordReset,
  authMessage,
  verifyEmail,
  refreshVerification,
  logout,
} from "../lib/firebase";
import { createChamber, acceptInvitation } from "../lib/supabase";
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
  const [error, setError] = useState(() => {
      const params = new URLSearchParams(loc.hash.slice(1));
      return params.has("error") || new URLSearchParams(loc.search).has("error")
        ? "Google দিয়ে প্রবেশ সম্পন্ন হয়নি। আবার চেষ্টা করুন।"
        : "";
    }),
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
  if (session?.user.email_verified && mode === "login")
    return <Navigate to={destination} replace />;
  async function googleLogin() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await googleSignIn();
      navigate(destination);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(values: AuthValues) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        await passwordReset(values.email);
        setMessage(
          "অ্যাকাউন্ট থাকলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হয়েছে।",
        );
      } else if (mode === "reset") {
        const code = new URLSearchParams(loc.search).get("oobCode");
        if (!code) throw new Error("ইমেইলের পাসওয়ার্ড রিসেট লিংক খুলুন।");
        await finishPasswordReset(code, values.password);
        setMessage("পাসওয়ার্ড পরিবর্তন হয়েছে। লগইন করুন।");
        navigate("/login");
      } else if (mode === "register") {
        if (values.full_name.trim().length < 2)
          throw new Error("আপনার পূর্ণ নাম দিন");
        await emailSignUp(
          values.email,
          values.password,
          values.full_name,
          "/login" +
            (invitation ? "?invite=" + encodeURIComponent(invitation) : ""),
        );
        setMessage("ইমেইলে পাঠানো লিংক দিয়ে অ্যাকাউন্ট যাচাই করুন।");
      } else {
        await emailSignIn(values.email, values.password);
        navigate(destination);
      }
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (
    session &&
    !session.user.email_verified &&
    (mode === "login" || mode === "register")
  )
    return <VerifyAccount destination={destination} />;
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
              <strong>Firebase সংযোগের অপেক্ষায়</strong>
              <p>
                আসল অ্যাকাউন্ট ব্যবহার করতে Firebase সংযোগ দিন। নিচের ডেমোতে
                ডিজাইন ও কার্যপ্রবাহ দেখতে পারেন।
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
          {(mode === "login" || mode === "register") && (
            <Button
              type="button"
              variant="ghost"
              className="full google-auth-button"
              disabled={busy || !configured}
              onClick={() => void googleLogin()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>
              Google দিয়ে{" "}
              {mode === "register" ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}
            </Button>
          )}
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
  if (!session || !session.user.email_verified)
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
      if (invite) await acceptInvitation(invite, memberName);
      else await createChamber(name, memberName);
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

function VerifyAccount({ destination }: { destination: string }) {
  const { session } = useWorkspace();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function check() {
    setBusy(true);
    setError("");
    try {
      if (await refreshVerification()) navigate(destination);
      else
        setMessage(
          "ইমেইল এখনো যাচাই হয়নি। ইমেইলের লিংক চাপুন, তারপর আবার যাচাই করুন।",
        );
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      await verifyEmail("/login" + location.search);
      setMessage("যাচাইয়ের ইমেইল পাঠানো হয়েছে। Spam ফোল্ডারও দেখুন।");
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="standalone">
      <Brand />
      <h1>ইমেইল যাচাই করুন</h1>
      <p>
        {session?.user.email} ঠিকানায় পাঠানো লিংক দিয়ে অ্যাকাউন্ট যাচাই করুন।
      </p>
      {error && <ErrorBox message={error} />}
      {message && <p role="status">{message}</p>}
      <Button disabled={busy} onClick={() => void check()}>
        যাচাই করেছি — এগিয়ে যান
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => void resend()}>
        আবার ইমেইল পাঠান
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void logout().catch((e) => setError(authMessage(e)))}
      >
        অন্য অ্যাকাউন্ট ব্যবহার করুন
      </Button>
    </div>
  );
}
