import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Coffee,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
  Compass,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Catalog", icon: Coffee },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/samples", label: "Sample Kits", icon: Package },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 w-60 border-r border-border bg-[#16382a] text-[#eaf2ec] flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <Compass className="h-6 w-6 text-[#d9a441]" />
          <div>
            <div className="font-bold tracking-tight leading-none">Greensheet</div>
            <div className="text-[10px] uppercase tracking-widest text-[#9fc0ab] mt-1">
              ODASI Technologies
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === to
                  ? "bg-[#d9a441] text-[#16382a] font-semibold"
                  : "text-[#c4d8cb] hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 text-[10px] text-[#7fa48e] leading-relaxed border-t border-white/10">
          Navigate Your Reality.
          <br />
          Own Your Journey.
        </div>
      </aside>
      <main className="ml-60 p-8 max-w-[1400px]">{children}</main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
