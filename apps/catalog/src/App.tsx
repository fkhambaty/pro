import { useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import About from "./pages/About";
import ContractPage from "./pages/ContractPage";
import ContractsList from "./pages/ContractsList";
import ExampleWalkthrough from "./pages/ExampleWalkthrough";
import Faq from "./pages/Faq";
import Guarantee from "./pages/Guarantee";
import HowItWorks from "./pages/HowItWorks";
import Landing from "./pages/Landing";
import Security from "./pages/Security";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import SignIn from "./pages/SignIn";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminHome from "./pages/admin/AdminHome";
import AdminVerifications from "./pages/admin/AdminVerifications";
import BuyerHome from "./pages/buyer/BuyerHome";
import BuyerProject from "./pages/buyer/BuyerProject";
import DeveloperProfile from "./pages/buyer/DeveloperProfile";
import Developers from "./pages/buyer/Developers";
import NewRequirement from "./pages/buyer/NewRequirement";
import Payments from "./pages/buyer/Payments";
import DevBids from "./pages/developer/DevBids";
import DevBoard from "./pages/developer/DevBoard";
import DevProject from "./pages/developer/DevProject";
import Earnings from "./pages/developer/Earnings";
import Verification from "./pages/developer/Verification";
import { trackPageView } from "./lib/analytics";
import { IdleSessionGuard } from "./lib/idleSession";
import { applySeo } from "./lib/seo";
import { useAuth } from "./lib/auth";
import { useStore } from "./store";

function RequireAuth({ children }: { children: ReactElement }) {
  const { role, ready } = useAuth();
  if (!ready) {
    return (
      <div className="auth-screen">
        <p style={{ color: "var(--muted)" }}>Loading your workspace…</p>
      </div>
    );
  }
  // Signing out drops the role to guest while the workspace is still mounted,
  // so this is also the redirect that runs on sign-out. Send people home
  // rather than to a sign-in form they did not ask for.
  if (role === "guest") return <Navigate to="/" replace />;
  return children;
}

function BuyerOnly({ children }: { children: ReactElement }) {
  const { role } = useStore();
  if (role !== "buyer") return <Navigate to="/app" replace />;
  return children;
}

function DeveloperOnly({ children }: { children: ReactElement }) {
  const { role } = useStore();
  if (role !== "developer") return <Navigate to="/app" replace />;
  return children;
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { role } = useStore();
  if (role !== "admin") return <Navigate to="/app" replace />;
  return children;
}

function Home() {
  const { role } = useStore();
  if (role === "guest") return <Landing />;
  return <Navigate to="/app" replace />;
}

function Dashboard() {
  const { role } = useStore();
  if (role === "admin") return <AdminHome />;
  return role === "buyer" ? <BuyerHome /> : <DevBoard />;
}

function ProjectRoute() {
  const { role } = useStore();
  return role === "buyer" ? <BuyerProject /> : <DevProject />;
}

/** Landing on a new page half way down it is disorienting. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    applySeo(pathname);
  }, [pathname]);
  return null;
}

function PageViews() {
  const { pathname, search } = useLocation();
  const { userId } = useAuth();
  useEffect(() => {
    trackPageView(userId);
  }, [pathname, search, userId]);
  return null;
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <PageViews />
    <IdleSessionGuard />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/example" element={<ExampleWalkthrough />} />
      <Route path="/guarantee" element={<Guarantee />} />
      <Route path="/security" element={<Security />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/about" element={<About />} />
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="project/:id" element={<ProjectRoute />} />
        <Route path="contract/:id" element={<ContractPage />} />
        <Route path="contracts" element={<ContractsList />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="new"
          element={
            <BuyerOnly>
              <NewRequirement />
            </BuyerOnly>
          }
        />
        <Route
          path="payments"
          element={
            <BuyerOnly>
              <Payments />
            </BuyerOnly>
          }
        />
        <Route
          path="developers"
          element={
            <BuyerOnly>
              <Developers />
            </BuyerOnly>
          }
        />
        <Route
          path="developers/:id"
          element={
            <BuyerOnly>
              <DeveloperProfile />
            </BuyerOnly>
          }
        />
        <Route
          path="bids"
          element={
            <DeveloperOnly>
              <DevBids />
            </DeveloperOnly>
          }
        />
        <Route
          path="earnings"
          element={
            <DeveloperOnly>
              <Earnings />
            </DeveloperOnly>
          }
        />
        <Route
          path="verification"
          element={
            <DeveloperOnly>
              <Verification />
            </DeveloperOnly>
          }
        />
        <Route
          path="verifications"
          element={
            <AdminOnly>
              <AdminVerifications />
            </AdminOnly>
          }
        />
        <Route
          path="traffic"
          element={
            <AdminOnly>
              <AdminAnalytics />
            </AdminOnly>
          }
        />
        <Route
          path="audit"
          element={
            <AdminOnly>
              <AdminAuditLogs />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
