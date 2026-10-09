import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Repository } from "./repository";
import { supabase, configured } from "./supabase";
import type { Member, Organization } from "./schema";
import { sampleMembers, sampleOrganization } from "./demo";

interface Workspace {
  repo: Repository;
  demo: boolean;
  session: Session | null;
  authLoading: boolean;
  workspaceLoading: boolean;
  memberships: Member[];
  organizations: Organization[];
  organization: Organization | null;
  membership: Member | null;
  setOrganization: (id: string) => void;
  revision: number;
  refresh: () => void;
  notice: (message: string) => void;
  error: string;
  reload: () => void;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({
  demo,
  children,
}: {
  demo: boolean;
  children: ReactNode;
}) {
  const repo = useMemo(() => new Repository(demo), [demo]);
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(!demo && configured),
    [workspaceLoading, setWorkspaceLoading] = useState(!demo && configured),
    [memberships, setMemberships] = useState<Member[]>(
      demo ? [sampleMembers[0]] : [],
    ),
    [organizations, setOrganizations] = useState<Organization[]>(
      demo ? [sampleOrganization] : [],
    ),
    [orgId, setOrgId] = useState(demo ? sampleOrganization.id : ""),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (demo || !supabase) return;
    let live = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (live) {
          setSession(data.session);
          if (error) setError("সেশন যাচাই করা যায়নি");
          setAuthLoading(false);
          if (!data.session) setWorkspaceLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setError("সেশন যাচাই করা যায়নি");
          setAuthLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
      if (!s) {
        setMemberships([]);
        setOrganizations([]);
        setOrgId("");
        setWorkspaceLoading(false);
      } else if (_event === "SIGNED_IN" || _event === "INITIAL_SESSION") {
        setWorkspaceLoading(true);
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [demo]);
  useEffect(() => {
    if (demo || !session) return;
    let live = true;
    setError("");
    Promise.all([repo.memberships(), repo.organizations()])
      .then(([m, o]) => {
        if (live) {
          setMemberships(m);
          setOrganizations(o);
          setOrgId((prev) =>
            o.some((x) => x.id === prev) ? prev : (o[0]?.id ?? ""),
          );
          setWorkspaceLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setError("চেম্বারের তথ্য লোড হয়নি। আবার চেষ্টা করুন।");
          setWorkspaceLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [demo, repo, session, revision]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  const organization = organizations.find((o) => o.id === orgId) ?? null,
    membership = memberships.find((m) => m.organization_id === orgId) ?? null;
  return (
    <Context.Provider
      value={{
        repo,
        demo,
        session,
        authLoading,
        workspaceLoading,
        memberships,
        organizations,
        organization,
        membership,
        setOrganization: setOrgId,
        revision,
        refresh,
        notice: setToast,
        error,
        reload: refresh,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="বার্তা বন্ধ করুন" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const c = useContext(Context);
  if (!c) throw new Error("Workspace missing");
  return c;
}
export function useResource<T>(load: () => Promise<T>, key: string) {
  const { revision } = useWorkspace();
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: "" });
    load()
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            data: null,
            loading: false,
            error:
              error instanceof Error ? error.message : "তথ্য লোড করা যায়নি",
          });
      });
    return () => {
      active = false;
    };
    // Callers explicitly describe request identity in key; changing revisions invalidates all data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, retry]);
  return { ...state, retry: () => setRetry((x) => x + 1) };
}
export function usePath() {
  const { demo } = useWorkspace();
  return (path: string) => `${demo ? "/demo" : ""}${path}`;
}
