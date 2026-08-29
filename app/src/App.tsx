import { Routes, Route } from "react-router";
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/crm" element={<Crm />} />
      <Route path="/samples" element={<Samples />} />
      <Route path="/campaigns" element={<Campaigns />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/warehouse" element={<Warehouse />} />
      <Route path="/qc" element={<QcLab />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/comms" element={<Comms />} />
      <Route path="/education" element={<Education />} />
      <Route path="/growth" element={<Growth />} />
      <Route path="/foundry" element={<Foundry />} />
      <Route path="/lotspace" element={<Lotspace />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}
