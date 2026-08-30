import { Navigate, Route, Routes } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/providers/auth";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Crm from "./pages/Crm";
import Samples from "./pages/Samples";
import Campaigns from "./pages/Campaigns";
import Orders from "./pages/Orders";
import Warehouse from "./pages/Warehouse";
import QcLab from "./pages/QcLab";
import Partners from "./pages/Partners";
import Comms from "./pages/Comms";
import Education from "./pages/Education";
import Growth from "./pages/Growth";
import Foundry from "./pages/Foundry";
import Lotspace from "./pages/Lotspace";
import Pricing from "./pages/Pricing";
import Analytics from "./pages/Analytics";
import DocIntake from "./pages/DocIntake";
import Login from "./pages/Login";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Buyers land on the catalog — the dashboard is a staff analytics surface.
function Home() {
  const { user } = useAuth();
  if (user?.role === "roaster_buyer") return <Navigate to="/catalog" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/crm" element={<Crm />} />
              <Route path="/samples" element={<Samples />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/warehouse" element={<Warehouse />} />
              <Route path="/intake" element={<DocIntake />} />
              <Route path="/qc" element={<QcLab />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/comms" element={<Comms />} />
              <Route path="/education" element={<Education />} />
              <Route path="/growth" element={<Growth />} />
              <Route path="/foundry" element={<Foundry />} />
              <Route path="/lotspace" element={<Lotspace />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
