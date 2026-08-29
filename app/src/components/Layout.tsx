import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Coffee,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
  Compass,
  Warehouse as WarehouseIcon,
  FlaskConical,
  Handshake,
  Send,
  GraduationCap,
  Rocket,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Trade",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/catalog", label: "Catalog", icon: Coffee },
      { to: "/orders", label: "Orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Relationships",
    items: [
      { to: "/crm", label: "CRM", icon: Users },
      { to: "/samples", label: "Sample Kits", icon: Package },
      { to: "/campaigns", label: "Campaigns", icon: Megaphone },
      { to: "/comms", label: "Comms", icon: Send },
      { to: "/growth", label: "Growth", icon: Rocket },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/warehouse", label: "Warehouse", icon: WarehouseIcon },
      { to: "/qc", label: "QC Lab", icon: FlaskConical },
      { to: "/partners", label: "Partners", icon: Handshake },
      { to: "/education", label: "Education", icon: GraduationCap },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 w-60 border-r border-border bg-[#16382a] text-[#eaf2ec] flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <Compass className="h-6 w-6 text-[#d9a441]" />
          <div>
            <div className="font-bold tracking-tight leading-none">Greensheet</div>
            <div className="text-[10px] uppercase tracking-widest text-[#9fc0ab] mt-1">
              ODASI Technologies
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-[#7fa48e]">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
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
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 space-y-2 border-t border-white/10 shrink-0">
          <div className="flex gap-2">
            <Link
              to="/foundry"
              className="flex-1 text-center rounded-md border border-[#d9a441]/40 px-2 py-1.5 text-[11px] text-[#d9a441] hover:bg-[#d9a441]/10 transition-colors"
            >
              Flavor Foundry
            </Link>
            <Link
              to="/lotspace"
              className="flex-1 text-center rounded-md border border-[#d9a441]/40 px-2 py-1.5 text-[11px] text-[#d9a441] hover:bg-[#d9a441]/10 transition-colors"
            >
              Lotspace
            </Link>
          </div>
          <div className="text-[10px] text-[#7fa48e] leading-relaxed">
            Navigate Your Reality.
            <br />
            Own Your Journey.
          </div>
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

export function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
