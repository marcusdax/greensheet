import { Routes, Route } from "react-router";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Crm from "./pages/Crm";
import Samples from "./pages/Samples";
import Campaigns from "./pages/Campaigns";
import Orders from "./pages/Orders";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/crm" element={<Crm />} />
      <Route path="/samples" element={<Samples />} />
      <Route path="/campaigns" element={<Campaigns />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}
