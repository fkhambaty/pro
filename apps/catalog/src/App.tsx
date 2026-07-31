import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ContractPage from "./pages/ContractPage";
import ContractsList from "./pages/ContractsList";
import Landing from "./pages/Landing";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import SignIn from "./pages/SignIn";
import BuyerHome from "./pages/buyer/BuyerHome";
import BuyerProject from "./pages/buyer/BuyerProject";
import NewRequirement from "./pages/buyer/NewRequirement";
import Payments from "./pages/buyer/Payments";
import DevBids from "./pages/developer/DevBids";
import DevBoard from "./pages/developer/DevBoard";
import DevProject from "./pages/developer/DevProject";
import Earnings from "./pages/developer/Earnings";
import Verification from "./pages/developer/Verification";
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
  if (role === "guest") return <Navigate to="/signin" replace />;
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

function Home() {
  const { role } = useStore();
  if (role === "guest") return <Landing />;
  return <Navigate to="/app" replace />;
}

function Dashboard() {
  const { role } = useStore();
  return role === "buyer" ? <BuyerHome /> : <DevBoard />;
}

function ProjectRoute() {
  const { role } = useStore();
  return role === "buyer" ? <BuyerProject /> : <DevProject />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
