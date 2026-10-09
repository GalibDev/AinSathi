import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./lib/context";
import Layout from "./components/Layout";
import { Loading, ErrorBox } from "./components/ui";
import { AuthPage, Onboarding } from "./pages/Auth";
import {
  CaseList,
  CaseForm,
  CaseDetails,
  Clients,
  ClientDetails,
} from "./pages/Cases";
import { Calendar, Documents } from "./pages/HearingsDocuments";
import {
  Reports,
  Members,
  Notifications,
  Settings,
  Profile,
  NotFound,
} from "./pages/Administration";
const Dashboard = lazy(() => import("./pages/Dashboard"));
function Guard() {
  const {
    authLoading,
    workspaceLoading,
    session,
    demo,
    organization,
    membership,
    error,
    reload,
  } = useWorkspace();
  if (authLoading || workspaceLoading) return <Loading />;
  if (!demo && !session) return <Navigate to="/login" replace />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!organization || !membership) {
    if (demo) return <Loading />;
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
function AppRoutes() {
  const { pathname } = useLocation();
  const demo = pathname === "/demo" || pathname.startsWith("/demo/");
  const prefix = demo ? "/demo" : "";
  return (
    <WorkspaceProvider key={demo ? "demo" : "live"} demo={demo}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/forgot-password" element={<AuthPage />} />
          <Route path="/reset-password" element={<AuthPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<Guard />}>
            <Route element={<Layout />}>
              <Route path={prefix + "/dashboard"} element={<Dashboard />} />
              <Route path={prefix + "/cases"} element={<CaseList />} />
              <Route path={prefix + "/cases/new"} element={<CaseForm />} />
              <Route path={prefix + "/cases/:id/edit"} element={<CaseForm />} />
              <Route path={prefix + "/cases/:id"} element={<CaseDetails />} />
              <Route path={prefix + "/calendar"} element={<Calendar />} />
              <Route path={prefix + "/clients"} element={<Clients />} />
              <Route
                path={prefix + "/clients/:id"}
                element={<ClientDetails />}
              />
              <Route path={prefix + "/documents"} element={<Documents />} />
              <Route path={prefix + "/members"} element={<Members />} />
              <Route path={prefix + "/reports"} element={<Reports />} />
              <Route
                path={prefix + "/notifications"}
                element={<Notifications />}
              />
              <Route path={prefix + "/settings"} element={<Settings />} />
              <Route path={prefix + "/profile"} element={<Profile />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/demo"
            element={<Navigate to="/demo/dashboard" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </WorkspaceProvider>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
