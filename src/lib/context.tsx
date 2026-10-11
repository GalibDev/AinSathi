import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { SparkRepository } from "./spark-repository";
import type { Session } from "./firebase";
import { Repository } from "./repository";
import { auth, configured, sessionFor, authMessage } from "./firebase";
import type { Member, Organization } from "./schema";
import { sampleMembers, sampleOrganization } from "./demo";

interface Workspace {
  repo: Repository | SparkRepository;
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
  const repo = useMemo(
    () => (demo ? new Repository(true) : new SparkRepository()),
    [demo],
  );
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
    if (demo || !auth) return;
    return onIdTokenChanged(
      auth,
      (user) => {
        const next = sessionFor(user);
        setSession(next);
        setAuthLoading(false);
        setError("");
        setWorkspaceLoading(Boolean(next?.user.email_verified));
        if (!next || !next.user.email_verified) {
          setMemberships([]);
          setOrganizations([]);
          setOrgId("");
        }
      },
      (e) => {
        setAuthLoading(false);
        setWorkspaceLoading(false);
        setError(authMessage(e));
      },
    );
  }, [demo]);
  useEffect(() => {
    if (demo || !session?.user.email_verified) return;
    let live = true;
    setError("");
    repo
      .memberships()
      .then(async (m) => [m, await repo.organizations()] as const)
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
      .catch((e) => {
        if (live) {
          setError(authMessage(e));
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
